export enum EvidenceState {
  DOCUMENT_SUPPORTED = 'DOCUMENT_SUPPORTED',
  APPLICANT_PROVIDED = 'APPLICANT_PROVIDED',
  MISSING = 'MISSING',
  CONFLICT = 'CONFLICT',
  AI_GENERATED = 'AI_GENERATED',
}

export type ClaimSourceType = 'DOCUMENT' | 'APPLICANT' | 'AI_DERIVED';

/** Structural subset of the Prisma Claim row, so persisted claims can be passed straight in. */
export interface ClaimRecord {
  id: string;
  fieldKey: string;
  entryKey?: string | null;
  rawValue: string;
  /** Normalized value (see field-registry). null/undefined when the raw text could not be normalized. */
  value?: unknown;
  source: ClaimSourceType;
  documentId?: string | null;
  page?: number | null;
  quote?: string | null;
  /** An explicit applicant choice that settles a conflict for this field. */
  isResolution?: boolean;
  supersededById?: string | null;
  confidence?: number | null;
  createdAt: Date;
}

export interface ConflictOption {
  value: unknown;
  claimIds: string[];
  sources: ClaimSourceType[];
}

export interface FieldState {
  /** `fieldKey` or `fieldKey#entryKey`. */
  id: string;
  fieldKey: string;
  entryKey: string | null;
  state: EvidenceState;
  /** Resolved normalized value; undefined when MISSING or CONFLICT. */
  value?: unknown;
  /** Claims that determine this state. */
  claimIds: string[];
  /** Claims overruled by an explicit applicant resolution (kept for audit, never deleted). */
  rejectedClaimIds: string[];
  /** The competing values when state is CONFLICT. */
  conflictOptions?: ConflictOption[];
  /** True when an explicit applicant resolution settled a previous conflict. */
  resolved: boolean;
}

export type FieldStates = Record<string, FieldState>;

export const fieldStateId = (fieldKey: string, entryKey?: string | null): string =>
  entryKey ? `${fieldKey}#${entryKey}` : fieldKey;
