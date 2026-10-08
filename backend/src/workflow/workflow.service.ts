import { Injectable, Logger } from '@nestjs/common';
import { activeClaimsWhere } from '../evidence/active-claims';
import type { Stage } from '../generated/prisma/enums';
import { IngestionService } from '../ingestion/ingestion.service';
import { PrismaService } from '../prisma/prisma.service';
import { EvaluationService } from './evaluation.service';
import { deriveStage } from './stage';

/** A document stuck in PROCESSING for longer than this (server crash, lost request) is treated as interrupted. */
export const STALE_PROCESSING_MS = 10 * 60 * 1000;

type Evaluation = Awaited<ReturnType<EvaluationService['evaluate']>>;
const brief = (e: Evaluation) => ({
  id: e.id,
  createdAt: e.createdAt,
  trigger: e.trigger,
  score: e.score,
  verdict: e.verdict,
  outcome: e.outcome,
  summary: e.summary,
});

/**
 * Orchestrates the applicant journey over durable state:
 *   process document -> claims (new active run) -> qualification -> Evaluation snapshot -> stage.
 * All decisions here are deterministic; no LLM is involved after document extraction.
 */
@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestion: IngestionService,
    private readonly evaluations: EvaluationService,
  ) {}

  /** Recomputes the stored journey stage from durable facts (documents, claims, latest evaluation). */
  async refreshStage(applicantId: string): Promise<Stage> {
    const [processingDocuments, activeClaims, latest] = await Promise.all([
      this.prisma.document.count({ where: { applicantId, status: 'PROCESSING' } }),
      this.prisma.claim.count({ where: activeClaimsWhere(applicantId) }),
      this.prisma.evaluation.findFirst({ where: { applicantId }, orderBy: { createdAt: 'desc' }, select: { outcome: true } }),
    ]);
    const stage = deriveStage({ processingDocuments, activeClaims, latestOutcome: latest?.outcome ?? null });
    await this.prisma.applicant.update({ where: { id: applicantId }, data: { stage } });
    return stage;
  }

  /** Marks a document whose processing was interrupted long ago as FAILED, so it can be retried. */
  private async recoverStale(applicantId: string, documentId: string) {
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, applicantId }, select: { status: true } });
    if (doc?.status !== 'PROCESSING') return;
    const run = await this.prisma.documentRun.findFirst({ where: { documentId, status: 'PROCESSING' }, orderBy: { version: 'desc' } });
    if (run && Date.now() - run.createdAt.getTime() < STALE_PROCESSING_MS) return;
    const error = 'Processing was interrupted; please retry';
    await this.prisma.$transaction([
      this.prisma.documentRun.updateMany({ where: { documentId, status: 'PROCESSING' }, data: { status: 'FAILED', error, completedAt: new Date() } }),
      this.prisma.document.update({ where: { id: documentId }, data: { status: 'FAILED', error } }),
    ]);
  }

  /**
   * Processes one document, then re-evaluates the applicant and updates the stage.
   * A failed document changes nothing: earlier evidence and the latest evaluation stay as they were.
   * If only the evaluation fails, the evidence is kept (stage PROFILE_BUILT) and `evaluationError`
   * says so; POST /applicants/:id/evaluate retries it.
   */
  async processDocument(applicantId: string, documentId: string, opts: { force?: boolean; evaluate?: boolean } = {}) {
    await this.recoverStale(applicantId, documentId);

    const startable = await this.prisma.document.findFirst({
      where: { id: documentId, applicantId, status: { in: opts.force ? ['UPLOADED', 'FAILED', 'DONE'] : ['UPLOADED', 'FAILED'] } },
      select: { id: true },
    });
    if (startable) await this.prisma.applicant.update({ where: { id: applicantId }, data: { stage: 'DOCUMENTS_PROCESSING' } });

    let result: Awaited<ReturnType<IngestionService['processDocument']>>;
    try {
      result = await this.ingestion.processDocument(applicantId, documentId, { force: opts.force });
    } catch (err) {
      await this.refreshStage(applicantId); // e.g. 404 / 409: put the stage back
      throw err;
    }

    let evaluation: Evaluation | null = null;
    let evaluationError: string | undefined;
    if (result.run.status === 'DONE' && opts.evaluate !== false) {
      try {
        evaluation = await this.evaluations.evaluate(applicantId, { trigger: 'DOCUMENT_PROCESSED', triggerDocumentId: documentId });
      } catch (err) {
        this.logger.error('Evaluation failed after document processing', err instanceof Error ? err.stack : String(err));
        evaluationError = 'The document was processed but evaluation failed; retry with POST /applicants/:id/evaluate';
      }
    }
    const stage = await this.refreshStage(applicantId);
    return { ...result, evaluation: evaluation && brief(evaluation), evaluationError, stage };
  }

  /** Processes every document that is waiting (UPLOADED or FAILED), then evaluates once. */
  async processPending(applicantId: string) {
    const pending = await this.prisma.document.findMany({
      where: { applicantId, status: { in: ['UPLOADED', 'FAILED'] } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const processed: Array<{ documentId: string; status: string; error: string | null }> = [];
    for (const { id } of pending) {
      const r = await this.processDocument(applicantId, id, { evaluate: false });
      processed.push({ documentId: id, status: r.document.status, error: r.document.error });
    }
    let evaluation: Evaluation | null = null;
    let evaluationError: string | undefined;
    if (processed.some((p) => p.status === 'DONE')) {
      try {
        evaluation = await this.evaluations.evaluate(applicantId, { trigger: 'DOCUMENT_PROCESSED' });
      } catch (err) {
        this.logger.error('Evaluation failed after processing documents', err instanceof Error ? err.stack : String(err));
        evaluationError = 'Documents were processed but evaluation failed; retry with POST /applicants/:id/evaluate';
      }
    }
    const stage = await this.refreshStage(applicantId);
    return { processed, evaluation: evaluation && brief(evaluation), evaluationError, stage };
  }

  /** Manual re-evaluation of the current evidence (creates a new snapshot). */
  async evaluate(applicantId: string) {
    const evaluation = await this.evaluations.evaluate(applicantId, { trigger: 'MANUAL' });
    const stage = await this.refreshStage(applicantId);
    return { evaluation, stage };
  }
}
