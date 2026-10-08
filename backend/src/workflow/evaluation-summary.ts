import { createHash } from 'node:crypto';
import type { Gap, QualificationResult } from '../qualification/qualification.types';

export interface PreviousEvaluation {
  id: string;
  score: number;
  verdict: string;
  gaps: Gap[];
}

export interface EvaluationSummary {
  requirements: Record<string, number>;
  mandatory: { total: number; met: number };
  gaps: { total: number; blocking: number; byKind: Record<string, number> };
  conflictFieldIds: string[];
  /** What changed since the previous evaluation; null for the first one. */
  changes: null | {
    previousEvaluationId: string;
    scoreDelta: number;
    verdict: { from: string; to: string } | null;
    newGapIds: string[];
    closedGapIds: string[];
  };
}

const count = <T>(items: T[], key: (t: T) => string) =>
  items.reduce<Record<string, number>>((acc, i) => ((acc[key(i)] = (acc[key(i)] ?? 0) + 1), acc), {});

/** Compact, queryable digest of an evaluation (the full detail lives in the snapshot JSON columns). */
export function summarize(result: QualificationResult, previous?: PreviousEvaluation | null): EvaluationSummary {
  const mandatory = result.requirements.filter((r) => r.mandatory);
  const gapIds = new Set(result.gaps.map((g) => g.id));
  const prevIds = new Set((previous?.gaps ?? []).map((g) => g.id));
  return {
    requirements: count(result.requirements, (r) => r.status),
    mandatory: { total: mandatory.length, met: mandatory.filter((r) => r.status === 'MET').length },
    gaps: {
      total: result.gaps.length,
      blocking: result.gaps.filter((g) => g.severity === 'BLOCKING').length,
      byKind: count(result.gaps, (g) => g.kind),
    },
    conflictFieldIds: result.gaps.filter((g) => g.kind === 'CONFLICT').map((g) => g.fieldId!).filter(Boolean),
    changes: previous
      ? {
          previousEvaluationId: previous.id,
          scoreDelta: result.readiness.score - previous.score,
          verdict: previous.verdict === result.readiness.verdict ? null : { from: previous.verdict, to: result.readiness.verdict },
          newGapIds: [...gapIds].filter((id) => !prevIds.has(id)),
          closedGapIds: [...prevIds].filter((id) => !gapIds.has(id)),
        }
      : null,
  };
}

export interface EvaluationInputs {
  requirementSetId: string;
  claimIds: string[];
  documents: Array<{ id: string; docType: string; status: string }>;
  evaluatedAt: string;
}

/** Stable fingerprint of what an evaluation depends on; equal hash = the evaluation would not change. */
export function hashInputs(i: Pick<EvaluationInputs, 'requirementSetId' | 'claimIds' | 'documents'>): string {
  const canonical = JSON.stringify({
    r: i.requirementSetId,
    c: [...i.claimIds].sort(),
    d: [...i.documents].map((d) => [d.id, d.docType, d.status]).sort((a, b) => a[0].localeCompare(b[0])),
  });
  return createHash('sha256').update(canonical).digest('hex');
}
