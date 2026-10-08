// Pure logic that maps an applicant's answer onto one of the existing conflict options.
// The applicant can only choose between values that documents already state; an answer that
// matches none of them (or more than one) is rejected, so no new fact can enter this way.
import type { ClaimRecord } from '../evidence/evidence.types';
import { normalizeClaimValue } from '../evidence/field-registry';
import { claimsAgree } from '../evidence/resolve';
import { canonicalText } from '../normalization/text';

/** Live claims of one field, grouped by agreement: each group is one conflict option. */
export function conflictOptions(fieldKey: string, claims: ClaimRecord[]): ClaimRecord[][] {
  const groups: ClaimRecord[][] = [];
  for (const claim of claims) {
    const home = groups.find((g) => claimsAgree(fieldKey, g[0], claim));
    if (home) home.push(claim);
    else groups.push([claim]);
  }
  return groups;
}

export interface ClarificationAnswer {
  text?: string;
  value?: unknown;
  choice?: string;
}

export type Selection = { ok: true; index: number } | { ok: false; reason: 'NO_MATCH' | 'AMBIGUOUS' };

const asText = (v: unknown): string | null =>
  typeof v === 'string' ? v.trim() || null : typeof v === 'number' && Number.isFinite(v) ? String(v) : null;

/** The strings that identify an option: the raw text its claims carry and their normalized value. */
const labels = (group: ClaimRecord[]) =>
  group.flatMap((c) => [c.rawValue, asText(c.value)]).filter((x): x is string => Boolean(x)).map(canonicalText).filter(Boolean);

/**
 * Picks the option the applicant chose. Tries `value`, then `choice`, then `text`. A candidate is
 * accepted only if it is equivalent to exactly one option, and (to stop "2024 or 2025" from
 * silently becoming 2024) only if it does not mention the label of any other option.
 */
export function selectOption(fieldKey: string, groups: ClaimRecord[][], answer: ClarificationAnswer): Selection {
  const optionLabels = groups.map(labels);
  for (const candidate of [answer.value, answer.choice, answer.text].map(asText)) {
    if (!candidate) continue;
    const text = canonicalText(candidate);
    const mentioned = optionLabels.flatMap((ls, i) => (ls.some((l) => text.includes(l)) ? [i] : []));
    if (mentioned.length > 1) return { ok: false, reason: 'AMBIGUOUS' };

    const probe: ClaimRecord = {
      id: 'answer',
      fieldKey,
      rawValue: candidate,
      value: normalizeClaimValue(fieldKey, candidate),
      source: 'APPLICANT',
      createdAt: new Date(),
    };
    const matching = groups.flatMap((g, i) => (claimsAgree(fieldKey, probe, g[0]) ? [i] : []));
    if (matching.length > 1) return { ok: false, reason: 'AMBIGUOUS' };
    if (matching.length === 1) return { ok: true, index: matching[0] };
  }
  return { ok: false, reason: 'NO_MATCH' };
}

/** The document's own wording of an option (prefers a document claim over any other source). */
export const representative = (group: ClaimRecord[]): ClaimRecord => group.find((c) => c.source === 'DOCUMENT') ?? group[0];
