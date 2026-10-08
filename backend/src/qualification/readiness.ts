import { SCORING } from '../config/scoring.config';
import type { ReadinessResult, RequirementResult, Verdict } from './qualification.types';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Deterministic readiness:
 *   score = round(100 * sum(weight * credit) / sum(weight))
 * The verdict is separate from the number, so a high score can never hide a failed or
 * unresolved mandatory requirement. Only mandatory requirements can block.
 */
export function computeReadiness(
  results: RequirementResult[],
  readyThreshold: number = SCORING.readyThreshold,
): ReadinessResult {
  const totalWeight = results.reduce((s, r) => s + r.weight, 0);
  const breakdown = results.map((r) => ({
    requirementId: r.requirementId,
    weight: r.weight,
    credit: r.credit,
    points: totalWeight > 0 ? round2((100 * r.weight * r.credit) / totalWeight) : 0,
  }));
  const score = totalWeight > 0 ? Math.round((100 * results.reduce((s, r) => s + r.weight * r.credit, 0)) / totalWeight) : 0;

  const mandatory = results.filter((r) => r.mandatory);
  let verdict: Verdict;
  if (mandatory.some((r) => r.status === 'NOT_MET')) verdict = 'NOT_ELIGIBLE_DEMO';
  else if (mandatory.some((r) => r.status !== 'MET')) verdict = 'INCOMPLETE';
  else verdict = score >= readyThreshold ? 'READY' : 'PARTIAL';

  return { score, verdict, readyThreshold, totalWeight, breakdown };
}
