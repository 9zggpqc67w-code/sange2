import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { activeClaimsWhere } from '../evidence/active-claims';
import { normalizeClaimValue } from '../evidence/field-registry';
import type { ClarificationStatus } from '../generated/prisma/enums';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EvaluationService } from '../workflow/evaluation.service';
import { WorkflowService } from '../workflow/workflow.service';
import { ClarificationAnswer, conflictOptions, representative, selectOption } from './conflict-answer';

export type { ClarificationAnswer } from './conflict-answer';

export interface OpenClarificationInput {
  applicantId: string;
  prompt: string;
  gapId?: string;
  fieldId?: string;
  claimIds?: string[];
  evaluationId?: string;
  agentActionId?: string;
}

interface ResolutionPlan {
  fieldKey: string;
  entryKey: string | null;
  rawValue: string;
  value: unknown;
}

const json = (v: unknown) => v as Prisma.InputJsonValue;

/**
 * Durable record of questions put to the applicant and their answers.
 *
 * Answering a CONFLICT clarification resolves the conflict: the applicant's choice must be one
 * of the values the documents already state, and is stored as one additional APPLICANT claim
 * with isResolution=true (the document claims are never touched). A new evaluation snapshot is
 * then created, so the answer is immediately reflected in the journey. Any other clarification
 * only stores the answer.
 */
@Injectable()
export class ClarificationsService {
  private readonly logger = new Logger(ClarificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluations: EvaluationService,
    private readonly workflow: WorkflowService,
  ) {}

  /** Service-level only (the agent calls this); there is deliberately no public endpoint to create questions. */
  async open(input: OpenClarificationInput) {
    if (!input.prompt.trim()) throw new BadRequestException('A clarification needs a prompt');
    return this.prisma.clarification.create({
      data: {
        applicantId: input.applicantId,
        prompt: input.prompt.trim(),
        gapId: input.gapId,
        fieldId: input.fieldId,
        claimIds: input.claimIds as Prisma.InputJsonValue | undefined,
        evaluationId: input.evaluationId,
        agentActionId: input.agentActionId,
      },
    });
  }

  async list(applicantId: string, status?: ClarificationStatus) {
    await this.assertApplicant(applicantId);
    return this.prisma.clarification.findMany({
      where: { applicantId, ...(status && { status }) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(applicantId: string, id: string) {
    const found = await this.prisma.clarification.findFirst({ where: { id, applicantId } });
    if (!found) throw new NotFoundException(`Clarification ${id} not found for applicant ${applicantId}`);
    return found;
  }

  /**
   * Stores the applicant's answer (an OPEN clarification can be answered exactly once). For a
   * conflict, also records the resolution claim and re-evaluates. An answer that does not match
   * an existing option is rejected and leaves the clarification OPEN.
   */
  async answer(applicantId: string, id: string, answer: ClarificationAnswer) {
    const clean: ClarificationAnswer = {};
    if (typeof answer.text === 'string' && answer.text.trim()) clean.text = answer.text.trim();
    if (answer.value !== undefined && answer.value !== null) clean.value = answer.value;
    if (typeof answer.choice === 'string' && answer.choice.trim()) clean.choice = answer.choice.trim();
    if (Object.keys(clean).length === 0) throw new BadRequestException('Provide at least one of text, value or choice');

    const existing = await this.get(applicantId, id); // 404 if it does not exist
    if (existing.status !== 'OPEN') {
      throw new ConflictException(`Clarification is ${existing.status}; only OPEN clarifications can be answered`);
    }

    // Validate BEFORE storing anything, so a rejected answer changes nothing.
    const isConflict = Boolean(existing.fieldId) && Boolean(existing.gapId?.startsWith('CONFLICT:'));
    const planned = isConflict ? await this.planResolution(applicantId, existing, clean) : null;

    const claim = await this.prisma.$transaction(async (tx) => {
      const stored = await tx.clarification.updateMany({
        where: { id, applicantId, status: 'OPEN' },
        data: { status: 'ANSWERED', answer: json(clean), answeredAt: new Date() },
      });
      if (stored.count === 0) throw new ConflictException('Clarification is no longer OPEN'); // lost a race
      if (!planned?.plan || existing.resolutionClaimId) return null; // never a second resolution claim
      const created = await tx.claim.create({
        data: {
          applicantId,
          fieldKey: planned.plan.fieldKey,
          entryKey: planned.plan.entryKey,
          rawValue: planned.plan.rawValue,
          value: planned.plan.value === null || planned.plan.value === undefined ? Prisma.JsonNull : json(planned.plan.value),
          source: 'APPLICANT',
          isResolution: true,
          documentId: null,
          runId: null,
          page: null,
          quote: null,
          confidence: null,
        },
      });
      await tx.clarification.update({ where: { id }, data: { resolutionClaimId: created.id } });
      return created;
    });

    const answered = await this.get(applicantId, id);
    if (!claim) return { ...answered, resolution: planned?.skipped ? { skipped: planned.skipped } : null };

    // The answer is committed. Everything below is derived state and can be retried.
    await this.settleActions(applicantId, answered, clean);
    let evaluation: Awaited<ReturnType<EvaluationService['evaluate']>> | null = null;
    let evaluationError: string | undefined;
    try {
      evaluation = await this.evaluations.evaluate(applicantId, { trigger: 'MANUAL' });
    } catch (err) {
      this.logger.error('Evaluation failed after a conflict resolution', err instanceof Error ? err.stack : String(err));
      evaluationError = 'The answer was recorded but evaluation failed; retry with POST /applicants/:id/evaluate';
    }
    const stage = await this.workflow.refreshStage(applicantId);
    return {
      ...answered,
      resolution: {
        claim: { id: claim.id, fieldKey: claim.fieldKey, entryKey: claim.entryKey, rawValue: claim.rawValue, value: claim.value, source: claim.source, isResolution: claim.isResolution },
        evaluation: evaluation && {
          id: evaluation.id,
          createdAt: evaluation.createdAt,
          trigger: evaluation.trigger,
          score: evaluation.score,
          verdict: evaluation.verdict,
          outcome: evaluation.outcome,
          summary: evaluation.summary,
        },
        evaluationError,
        stage,
      },
    };
  }

  /**
   * Works out the resolution claim for a conflict answer from the field's CURRENT live claims.
   * Returns `skipped` when the conflict no longer exists (e.g. a document was re-processed meanwhile)
   * and throws 400 when the answer is not one of the existing options.
   */
  private async planResolution(
    applicantId: string,
    clarification: { fieldId: string | null; claimIds: Prisma.JsonValue },
    answer: ClarificationAnswer,
  ): Promise<{ plan?: ResolutionPlan; skipped?: 'CONFLICT_NO_LONGER_PRESENT' }> {
    const [fieldKey, entryFromId] = clarification.fieldId!.split('#');
    let entryKey: string | null = entryFromId ?? null;
    if (!entryKey) {
      const referenced = Array.isArray(clarification.claimIds) ? (clarification.claimIds as string[]) : [];
      const ref = referenced.length ? await this.prisma.claim.findFirst({ where: { id: { in: referenced }, fieldKey } }) : null;
      entryKey = ref?.entryKey ?? null;
    }

    const live = await this.prisma.claim.findMany({
      where: { ...activeClaimsWhere(applicantId), fieldKey, entryKey, isResolution: false },
      orderBy: { createdAt: 'asc' },
    });
    const groups = conflictOptions(fieldKey, live);
    if (groups.length < 2) return { skipped: 'CONFLICT_NO_LONGER_PRESENT' };

    const picked = selectOption(fieldKey, groups, answer);
    if (!picked.ok) {
      const options = groups.map((g) => representative(g).rawValue).join(', ');
      throw new BadRequestException(
        picked.reason === 'AMBIGUOUS'
          ? `The answer matches more than one option. Choose exactly one of: ${options}`
          : `The answer must be one of the existing options: ${options}`,
      );
    }
    // The document's own wording of the chosen value: the applicant selects a fact, never writes one.
    const rawValue = representative(groups[picked.index]).rawValue;
    return { plan: { fieldKey, entryKey, rawValue, value: normalizeClaimValue(fieldKey, rawValue) } };
  }

  /** The agent action that was waiting on this clarification is settled (history is kept). */
  private async settleActions(applicantId: string, clarification: { id: string; agentActionId: string | null }, answer: ClarificationAnswer) {
    await this.prisma.agentAction.updateMany({
      where: {
        applicantId,
        status: 'PENDING',
        OR: [
          ...(clarification.agentActionId ? [{ id: clarification.agentActionId }] : []),
          { params: { path: ['clarificationId'], equals: clarification.id } },
        ],
      },
      data: { status: 'ANSWERED', answer: json(answer), answeredAt: new Date() },
    });
  }

  private async assertApplicant(applicantId: string) {
    const found = await this.prisma.applicant.findUnique({ where: { id: applicantId }, select: { id: true } });
    if (!found) throw new NotFoundException(`Applicant ${applicantId} not found`);
  }
}
