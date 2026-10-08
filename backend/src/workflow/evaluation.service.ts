import { Injectable, NotFoundException } from '@nestjs/common';
import { DEFAULT_REQUIREMENT_SET_ID } from '../config/requirements.demo';
import type { DocumentType } from '../config/requirements.demo';
import { activeClaimsWhere } from '../evidence/active-claims';
import type { ClaimRecord } from '../evidence/evidence.types';
import type { EvaluationTrigger } from '../generated/prisma/enums';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { DocumentInfo, Gap, QualificationResult } from '../qualification/qualification.types';
import { qualify } from '../qualification/qualify';
import { EvaluationInputs, hashInputs, summarize } from './evaluation-summary';
import { outcomeStage } from './stage';

const json = (v: unknown) => v as Prisma.InputJsonValue;

/** Columns of the light-weight history view (no heavy JSON snapshots). */
const LIST_SELECT = {
  id: true,
  createdAt: true,
  trigger: true,
  triggerDocumentId: true,
  requirementSetId: true,
  isDemo: true,
  score: true,
  verdict: true,
  outcome: true,
  summary: true,
} as const;

@Injectable()
export class EvaluationService {
  constructor(private readonly prisma: PrismaService) {}

  /** The current evidence and documents of an applicant, exactly as qualification consumes them. */
  async loadInputs(applicantId: string): Promise<{ claims: ClaimRecord[]; documents: DocumentInfo[] }> {
    const [claims, docs] = await Promise.all([
      this.prisma.claim.findMany({ where: activeClaimsWhere(applicantId), orderBy: { createdAt: 'asc' } }),
      this.prisma.document.findMany({
        where: { applicantId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, docType: true, status: true, runs: { where: { isActive: true }, select: { id: true } } },
      }),
    ]);
    const documents: DocumentInfo[] = docs.map((d) => ({
      id: d.id,
      docType: d.docType as DocumentType,
      // A document that was processed once keeps counting as processed while a re-run is in flight or failed.
      status: d.runs.length > 0 ? 'DONE' : d.status,
    }));
    return { claims, documents };
  }

  /** Fingerprint of the applicant's current inputs (used to tell whether an evaluation is stale). */
  async currentInputHash(applicantId: string, requirementSetId = DEFAULT_REQUIREMENT_SET_ID): Promise<string> {
    const { claims, documents } = await this.loadInputs(applicantId);
    return hashInputs({ requirementSetId, claimIds: claims.map((c) => c.id), documents });
  }

  /**
   * Runs the deterministic qualification over the current evidence and stores an immutable
   * snapshot. Never updates or replaces an earlier evaluation. No LLM is involved.
   */
  async evaluate(
    applicantId: string,
    opts: { trigger?: EvaluationTrigger; triggerDocumentId?: string; now?: Date; requirementSetId?: string } = {},
  ) {
    const applicant = await this.prisma.applicant.findUnique({ where: { id: applicantId }, select: { id: true } });
    if (!applicant) throw new NotFoundException(`Applicant ${applicantId} not found`);

    const now = opts.now ?? new Date();
    const { claims, documents } = await this.loadInputs(applicantId);
    const result = qualify({ claims, documents, requirementSetId: opts.requirementSetId, now });

    const previous = await this.prisma.evaluation.findFirst({
      where: { applicantId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, score: true, verdict: true, gaps: true },
    });
    const inputs: EvaluationInputs = {
      requirementSetId: result.requirementSetId,
      claimIds: claims.map((c) => c.id),
      documents,
      evaluatedAt: now.toISOString(),
    };

    return this.prisma.evaluation.create({
      data: {
        applicantId,
        requirementSetId: result.requirementSetId,
        isDemo: result.isDemo,
        trigger: opts.trigger ?? 'MANUAL',
        triggerDocumentId: opts.triggerDocumentId,
        score: result.readiness.score,
        verdict: result.readiness.verdict,
        outcome: outcomeStage({ verdict: result.readiness.verdict, gaps: result.gaps }),
        fields: json(result.fields),
        gaps: json(result.gaps),
        requirements: json(result.requirements),
        breakdown: json(result.readiness),
        summary: json(summarize(result, previous && { ...previous, gaps: previous.gaps as unknown as Gap[] })),
        inputs: json(inputs),
        inputHash: hashInputs(inputs),
      },
    });
  }

  private async assertApplicant(applicantId: string) {
    const found = await this.prisma.applicant.findUnique({ where: { id: applicantId }, select: { id: true } });
    if (!found) throw new NotFoundException(`Applicant ${applicantId} not found`);
  }

  /** The latest full snapshot, or null if the applicant has never been evaluated. */
  latest(applicantId: string) {
    return this.prisma.evaluation.findFirst({ where: { applicantId }, orderBy: { createdAt: 'desc' } });
  }

  async latestOrThrow(applicantId: string) {
    await this.assertApplicant(applicantId);
    const latest = await this.latest(applicantId);
    if (!latest) throw new NotFoundException('This applicant has not been evaluated yet');
    return latest;
  }

  async get(applicantId: string, evaluationId: string) {
    const evaluation = await this.prisma.evaluation.findFirst({ where: { id: evaluationId, applicantId } });
    if (!evaluation) throw new NotFoundException(`Evaluation ${evaluationId} not found for applicant ${applicantId}`);
    return evaluation;
  }

  /** Status history, newest first (summaries only; fetch one evaluation for its full snapshot). */
  async history(applicantId: string, limit = 20) {
    await this.assertApplicant(applicantId);
    return this.prisma.evaluation.findMany({
      where: { applicantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: LIST_SELECT,
    });
  }

  /**
   * Re-computes a stored evaluation from the exact claims, documents and time it recorded and
   * compares with what was stored. Claims are immutable, so this must always match.
   */
  async replay(applicantId: string, evaluationId: string) {
    const stored = await this.get(applicantId, evaluationId);
    const inputs = stored.inputs as unknown as EvaluationInputs;
    const rows = await this.prisma.claim.findMany({ where: { id: { in: inputs.claimIds } }, orderBy: { createdAt: 'asc' } });
    // Every claim listed was active when the evaluation ran, whatever happened to it since.
    const claims: ClaimRecord[] = rows.map((c) => ({ ...c, supersededById: null }));
    const result: QualificationResult = qualify({
      claims,
      documents: inputs.documents as DocumentInfo[],
      requirementSetId: inputs.requirementSetId,
      now: new Date(inputs.evaluatedAt),
    });
    const storedGapIds = (stored.gaps as unknown as Gap[]).map((g) => g.id);
    const replayedGapIds = result.gaps.map((g) => g.id);
    const matches =
      result.readiness.score === stored.score &&
      result.readiness.verdict === stored.verdict &&
      JSON.stringify(storedGapIds) === JSON.stringify(replayedGapIds);
    return {
      evaluationId,
      matches,
      stored: { score: stored.score, verdict: stored.verdict, gapIds: storedGapIds },
      replayed: { score: result.readiness.score, verdict: result.readiness.verdict, gapIds: replayedGapIds },
    };
  }
}
