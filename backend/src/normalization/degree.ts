import type { DegreeLevel } from '../config/requirements.demo';

export const DEGREE_LEVEL_RANK: Record<DegreeLevel, number> = {
  DIPLOMA: 1,
  BACHELOR: 2,
  MASTER: 3,
  DOCTORATE: 4,
};

/** Maps a degree title ("Bachelor of Technology", "B.Tech", "M.Sc.") to a level. */
export function normalizeDegreeLevel(raw: string): DegreeLevel | null {
  const s = raw.toLowerCase().replace(/\./g, '');
  if (/\b(phd|dphil|doctor\w*)\b/.test(s)) return 'DOCTORATE';
  if (/\b(master\w*|msc|mtech|meng|mba|ma)\b/.test(s)) return 'MASTER';
  if (/\b(bachelor\w*|bsc|btech|beng|ba|bcom)\b/.test(s)) return 'BACHELOR';
  if (/\bdiploma\b/.test(s)) return 'DIPLOMA';
  return null;
}

/** Extracts a 4-digit year (1900-2099) from text such as "2025" or "Class of 2025". */
export function parseYear(raw: string): number | null {
  const m = raw.match(/\b((?:19|20)\d{2})\b/);
  return m ? parseInt(m[1], 10) : null;
}
