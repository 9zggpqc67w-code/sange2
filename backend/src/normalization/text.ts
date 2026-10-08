/** Lowercase, Unicode-normalized, punctuation-free text for comparisons. */
export function canonicalText(raw: string): string {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
