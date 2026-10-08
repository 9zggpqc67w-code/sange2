import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClarificationsService } from '../clarifications/clarifications.service';
import type { Prisma } from '../generated/prisma/client';
import { JourneyService } from '../journey/journey.service';
import { LlmService, LlmUnavailableError } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AGENT_SYSTEM_PROMPT,
  AgentDecision,
  AgentState,
  Candidate,
  DECISION_SCHEMA,
  buildLlmContext,
  buildPlan,
  fallbackDecision,
  noActionDecision,
  stateBlocker,
  validateDecision,
} from './agent.logic';

const json = (v: unknown) => v as Prisma.InputJsonValue;
const candidateKey = (c: Candidate) => c.gapId ?? (c.requirementId ? `REQUIREMENT:${c.requirementId}` : 'READY');

type Stored = Awaited<ReturnType<PrismaService['agentAction']['findFirstOrThrow']>>;

/**
 * One decision loop: JourneyService state -> ranked candidates -> Claude chooses ONE and words it ->
 * backend validation (else deterministic fallback) -> AgentAction (+ Clarification for questions).
 * The agent only reads state; it never writes claims, evaluations or applicant facts.
 */
@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly journey: JourneyService,
    private readonly llm: LlmService,
    private readonly clarifications: ClarificationsService,
  ) {}

  async decide(applicantId: string, opts: { refresh?: boolean } = {}) {
    const state = (await this.journey.get(applicantId)) as unknown as AgentState; // 404 for unknown applicants
    const evaluationId = state.evaluation?.id ?? null;

    const blocker = stateBlocker(state);
    if (blocker) return this.persistNoAction(applicantId, evaluationId, blocker, opts.refresh);

    // The same evaluation already has a pending decision: return it instead of creating another.
    if (!opts.refresh) {
      const reused = await this.reusablePending(applicantId, evaluationId);
      if (reused) return this.present(reused, true);
    }

    const plan = buildPlan(state);
    if ('noAction' in plan) return this.persistNoAction(applicantId, evaluationId, plan.noAction, opts.refresh);

    const context = buildLlmContext(state, plan.candidates);
    let decision: AgentDecision | null = null;
    let candidate: Candidate | null = null;
    let fallbackReason: string | undefined;
    let violations: string[] = [];
    let rejectedOutput: unknown;

    try {
      const raw = await this.llm.completeJson({
        system: AGENT_SYSTEM_PROMPT,
        content: [{ type: 'text', text: JSON.stringify(context) }],
        schema: DECISION_SCHEMA as unknown as Record<string, unknown>,
        effort: 'low',
        maxTokens: 1000,
      });
      const checked = validateDecision(raw, plan.candidates, state, context);
      if (checked.decision) ({ decision, candidate } = checked);
      else {
        violations = checked.violations;
        rejectedOutput = raw;
        fallbackReason = 'GUARDRAIL_VIOLATION';
      }
    } catch (err) {
      fallbackReason = err instanceof LlmUnavailableError ? 'LLM_UNAVAILABLE' : `LLM_ERROR:${err instanceof Error ? err.name : 'unknown'}`;
      if (!(err instanceof LlmUnavailableError)) this.logger.warn(`Agent LLM call failed: ${err instanceof Error ? err.message : err}`);
    }

    const source = decision ? 'LLM' : 'FALLBACK';
    if (!decision) {
      candidate = plan.candidates[0];
      decision = fallbackDecision(candidate);
    }
    return this.persist(applicantId, evaluationId, decision, candidate, {
      source,
      fallbackReason,
      violations,
      rejectedOutput,
      model: source === 'LLM' ? this.llm.model : null,
      candidates: plan.candidates.map(candidateKey),
    });
  }

  /** The pending action, if any. Read-only; never calls the LLM. */
  async nextAction(applicantId: string) {
    await this.assertApplicant(applicantId);
    const [action, latest] = await Promise.all([
      this.prisma.agentAction.findFirst({ where: { applicantId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } }),
      this.prisma.evaluation.findFirst({ where: { applicantId }, orderBy: { createdAt: 'desc' }, select: { id: true } }),
    ]);
    if (!action) return { action: null, isCurrent: false, clarification: null };
    return { ...(await this.present(action, true)), isCurrent: action.evaluationId === (latest?.id ?? null) };
  }

  async history(applicantId: string, limit = 20) {
    await this.assertApplicant(applicantId);
    return this.prisma.agentAction.findMany({ where: { applicantId }, orderBy: { createdAt: 'desc' }, take: limit });
  }

  // ---------------------------------------------------------------- internals

  private async assertApplicant(applicantId: string) {
    const found = await this.prisma.applicant.findUnique({ where: { id: applicantId }, select: { id: true } });
    if (!found) throw new NotFoundException(`Applicant ${applicantId} not found`);
  }

  /** A pending action for this evaluation whose question has not been answered meanwhile. */
  private async reusablePending(applicantId: string, evaluationId: string | null) {
    const pending = await this.prisma.agentAction.findFirst({ where: { applicantId, evaluationId, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
    if (!pending) return null;
    const clarificationId = (pending.params as { clarificationId?: string } | null)?.clarificationId;
    if (clarificationId) {
      const c = await this.prisma.clarification.findUnique({ where: { id: clarificationId } });
      if (c && c.status !== 'OPEN') {
        await this.prisma.agentAction.update({
          where: { id: pending.id },
          data: { status: c.status === 'ANSWERED' ? 'ANSWERED' : 'SUPERSEDED', answer: c.answer ?? undefined, answeredAt: c.answeredAt },
        });
        return null;
      }
    }
    return pending;
  }

  private async persistNoAction(applicantId: string, evaluationId: string | null, reason: string, refresh?: boolean) {
    const last = await this.prisma.agentAction.findFirst({ where: { applicantId }, orderBy: { createdAt: 'desc' } });
    const lastMessage = (last?.decision as { decision?: { message?: string } } | null)?.decision?.message;
    if (!refresh && last?.type === 'NO_ACTION' && last.evaluationId === evaluationId && lastMessage === reason) return this.present(last, true);
    return this.persist(applicantId, evaluationId, noActionDecision(reason), null, {
      source: 'RULES', violations: [], model: null, candidates: [],
    });
  }

  private async persist(
    applicantId: string,
    evaluationId: string | null,
    decision: AgentDecision,
    candidate: Candidate | null,
    meta: { source: 'LLM' | 'FALLBACK' | 'RULES'; fallbackReason?: string; violations: string[]; rejectedOutput?: unknown; model: string | null; candidates: string[] },
  ) {
    const params = {
      docType: decision.docType,
      requirementId: decision.requirementId,
      route: decision.route,
      fieldId: candidate?.fieldId ?? null,
      options: candidate?.options ?? [],
      evidenceRefs: decision.evidenceRefs,
      candidateKey: candidate ? candidateKey(candidate) : null,
    };
    // Only one decision is ever pending: a new one supersedes the old.
    const action = await this.prisma.$transaction(async (tx) => {
      await tx.agentAction.updateMany({ where: { applicantId, status: 'PENDING' }, data: { status: 'SUPERSEDED' } });
      return tx.agentAction.create({
        data: {
          applicantId,
          evaluationId,
          type: decision.action,
          gapId: decision.gapId,
          params: json(params),
          decision: json({ decision, ...meta, createdAt: new Date().toISOString() }),
          status: decision.action === 'NO_ACTION' ? 'DONE' : 'PENDING',
        },
      });
    });

    // The clarification is created only after the decision passed validation.
    if (decision.action === 'ASK_CLARIFICATION' && candidate) {
      const clarification = await this.clarifications.open({
        applicantId,
        prompt: decision.message,
        gapId: decision.gapId ?? undefined,
        fieldId: candidate.fieldId ?? undefined,
        claimIds: candidate.claimIds,
        evaluationId: evaluationId ?? undefined,
        agentActionId: action.id,
      });
      const linked = await this.prisma.agentAction.update({ where: { id: action.id }, data: { params: json({ ...params, clarificationId: clarification.id }) } });
      return { action: linked, message: decision.message, source: meta.source, clarification, reused: false };
    }
    return { action, message: decision.message, source: meta.source, clarification: null, reused: false };
  }

  private async present(action: Stored, reused: boolean) {
    const d = action.decision as { decision?: { message?: string }; source?: string } | null;
    const clarificationId = (action.params as { clarificationId?: string } | null)?.clarificationId;
    const clarification = clarificationId ? await this.prisma.clarification.findUnique({ where: { id: clarificationId } }) : null;
    return { action, message: d?.decision?.message ?? '', source: d?.source ?? null, clarification, reused };
  }
}
