const TITLES = new Set(['dr', 'prof', 'mr', 'mrs', 'ms', 'miss', 'shri', 'smt', 'sri']);

/**
 * Canonical name: case-folded, German umlauts expanded (Müller = Mueller), other
 * diacritics stripped, titles and punctuation removed.
 */
export function canonicalizeName(raw: string): string {
  const expanded = raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
  return expanded
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((t) => t && !TITLES.has(t))
    .join(' ');
}

function tokenMatches(a: string, b: string): boolean {
  if (a === b) return true;
  // An initial ("a") matches a full token starting with it ("arjun").
  if (a.length === 1) return b.startsWith(a);
  if (b.length === 1) return a.startsWith(b);
  return false;
}

/**
 * Order-insensitive match of two canonical names. Initials are allowed; anything
 * else (a different spelling, a missing token) is NOT treated as equivalent, so it
 * surfaces as a conflict instead of being silently merged.
 */
export function namesMatch(a: string, b: string): boolean {
  const ta = a.split(' ').filter(Boolean);
  const tb = b.split(' ').filter(Boolean);
  if (ta.length === 0 || ta.length !== tb.length) return false;
  const remaining = [...tb];
  for (const token of ta) {
    const idx = remaining.findIndex((candidate) => tokenMatches(token, candidate));
    if (idx === -1) return false;
    remaining.splice(idx, 1);
  }
  return true;
}
