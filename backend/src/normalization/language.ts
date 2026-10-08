import { monthsSince } from './dates';

/**
 * Parses an overall band score on a 0-9 scale ("7.0", "Band 7.5"). Rejects values
 * outside the scale. No mapping to CEFR levels is performed because the demo rules
 * are expressed directly as an overall score.
 */
export function parseLanguageScore(raw: string): number | null {
  const m = raw.trim().toLowerCase().replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const score = parseFloat(m[1]);
  return score >= 0 && score <= 9 ? score : null;
}

/** Age of a test certificate in whole months (null if the test date is unknown). */
export function certificateAgeMonths(testDateIso: string | null, now: Date): number | null {
  if (!testDateIso) return null;
  return Math.max(0, monthsSince(testDateIso, now));
}
