import type { Stage } from '../generated/prisma/enums';

export interface EvaluationOutcomeInput {
  verdict: string;
  gaps: Array<{ kind: string }>;
}

/**
 * The journey stage an evaluation leads to:
 *   READY            - verdict READY
 *   ACTION_REQUIRED  - the applicant has to act: a conflict to resolve, or a mandatory requirement not met
 *   INCOMPLETE       - evidence is still missing / unverified
 */
export function outcomeStage(e: EvaluationOutcomeInput): Stage {
  if (e.verdict === 'READY') return 'READY';
  if (e.gaps.some((g) => g.kind === 'CONFLICT') || e.verdict === 'NOT_ELIGIBLE_DEMO') return 'ACTION_REQUIRED';
  return 'INCOMPLETE';
}

export interface StageFacts {
  /** Documents currently being processed. */
  processingDocuments: number;
  /** Active claims (current evidence). */
  activeClaims: number;
  /** Outcome of the latest evaluation, if any. */
  latestOutcome: Stage | null;
}

/** The applicant's current stage, derived only from durable facts (so it can be recomputed any time). */
export function deriveStage(f: StageFacts): Stage {
  if (f.processingDocuments > 0) return 'DOCUMENTS_PROCESSING';
  if (f.latestOutcome) return f.latestOutcome;
  if (f.activeClaims > 0) return 'PROFILE_BUILT';
  return 'NEW';
}
