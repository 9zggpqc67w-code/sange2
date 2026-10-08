import type { DocumentType } from '../config/requirements.demo';
import { normalizeClaimValue } from '../evidence/field-registry';
import { ALLOWED_FIELDS, ENTRY_FIELDS, FIELD_GUIDE } from './extraction.schema';
import type { PageText } from './pdf-text';

/** A claim exactly as the model proposed it. Nothing here is trusted yet. */
export interface ProposedClaim {
  fieldKey: string;
  entryKey: string | null;
  rawValue: string;
  page: number;
  quote: string;
}

export type RejectionReason =
  | 'MALFORMED'
  | 'UNKNOWN_FIELD'
  | 'FIELD_NOT_ALLOWED_FOR_DOCUMENT_TYPE'
  | 'EMPTY_VALUE'
  | 'QUOTE_NOT_IN_DOCUMENT'
  | 'VALUE_NOT_IN_QUOTE'
  | 'DUPLICATE';

export interface RejectedClaim {
  proposed: Partial<ProposedClaim>;
  reason: RejectionReason;
}

/** A claim that passed grounding: its quote exists in the document text and contains its value. */
export interface GroundedClaim {
  fieldKey: string;
  entryKey: string | null;
  rawValue: string;
  /** Normalized value from the deterministic field registry (null if unreadable). */
  value: unknown;
  /** Page where the quote was actually found (may differ from what the model said). */
  page: number;
  quote: string;
  pageCorrected: boolean;
}

export interface GroundingResult {
  accepted: GroundedClaim[];
  rejected: RejectedClaim[];
}

/** Whitespace/case/dash-insensitive form used to compare quotes with page text. Punctuation is kept. */
export function comparable(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[‐-―−]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Validates the untrusted model output into ProposedClaim[]; malformed items are reported, not guessed at. */
export function parseProposedClaims(output: unknown): { claims: ProposedClaim[]; rejected: RejectedClaim[]; documentType?: string } {
  const claims: ProposedClaim[] = [];
  const rejected: RejectedClaim[] = [];
  const obj = (output ?? {}) as { claims?: unknown; documentType?: unknown };
  const list = Array.isArray(obj.claims) ? obj.claims : [];
  for (const item of list) {
    const c = (item ?? {}) as Record<string, unknown>;
    if (
      typeof c.fieldKey !== 'string' ||
      typeof c.rawValue !== 'string' ||
      typeof c.quote !== 'string' ||
      typeof c.page !== 'number' ||
      !Number.isInteger(c.page) ||
      !(c.entryKey === null || c.entryKey === undefined || typeof c.entryKey === 'string')
    ) {
      rejected.push({ proposed: c as Partial<ProposedClaim>, reason: 'MALFORMED' });
      continue;
    }
    claims.push({
      fieldKey: c.fieldKey,
      entryKey: (c.entryKey as string | null | undefined) ?? null,
      rawValue: c.rawValue,
      page: c.page,
      quote: c.quote,
    });
  }
  return { claims, rejected, documentType: typeof obj.documentType === 'string' ? obj.documentType : undefined };
}

/**
 * The anti-hallucination gate. A proposed claim is accepted only if
 *  1. its field exists and is allowed for this document type,
 *  2. its quote appears verbatim (modulo whitespace/case) in the document text, and
 *  3. its raw value appears verbatim inside that quote.
 * The page comes from where the quote is actually found, not from the model's say-so.
 * Normalization is done here by the deterministic registry, never by the model.
 */
export function groundClaims(proposed: ProposedClaim[], pages: PageText[], docType: DocumentType): GroundingResult {
  const allowed = new Set(ALLOWED_FIELDS[docType]);
  const comparablePages = pages.map((p) => ({ pageNo: p.pageNo, text: comparable(p.text) }));
  const accepted: GroundedClaim[] = [];
  const rejected: RejectedClaim[] = [];
  const seen = new Set<string>();

  for (const p of proposed) {
    const reject = (reason: RejectionReason) => rejected.push({ proposed: p, reason });

    if (!(p.fieldKey in FIELD_GUIDE)) { reject('UNKNOWN_FIELD'); continue; }
    if (!allowed.has(p.fieldKey)) { reject('FIELD_NOT_ALLOWED_FOR_DOCUMENT_TYPE'); continue; }

    const raw = p.rawValue.trim();
    const quote = comparable(p.quote);
    if (!raw || !quote) { reject('EMPTY_VALUE'); continue; }

    // Prefer the page the model named; otherwise the first page that contains the quote.
    const named = comparablePages.find((cp) => cp.pageNo === p.page);
    const found = named?.text.includes(quote) ? named : comparablePages.find((cp) => cp.text.includes(quote));
    if (!found) { reject('QUOTE_NOT_IN_DOCUMENT'); continue; }
    if (!quote.includes(comparable(raw))) { reject('VALUE_NOT_IN_QUOTE'); continue; }

    const entryKey = ENTRY_FIELDS.has(p.fieldKey) ? (p.entryKey?.trim() || 'job-1') : null;
    const dedupeKey = `${p.fieldKey}|${entryKey ?? ''}|${comparable(raw)}`;
    if (seen.has(dedupeKey)) { reject('DUPLICATE'); continue; }
    seen.add(dedupeKey);

    accepted.push({
      fieldKey: p.fieldKey,
      entryKey,
      rawValue: raw,
      value: normalizeClaimValue(p.fieldKey, raw),
      page: found.pageNo,
      quote: p.quote.trim(),
      pageCorrected: found.pageNo !== p.page,
    });
  }
  return { accepted, rejected };
}
