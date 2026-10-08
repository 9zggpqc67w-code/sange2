import type { DocumentType, RequirementType } from '../config/requirements.demo';
import type { ClaimRecord, EvidenceState, FieldStates } from '../evidence/evidence.types';

export type RequirementStatus =
  | 'MET'
  | 'NOT_MET'
  /** The threshold is satisfied, but only on applicant-provided or AI-derived evidence. */
  | 'UNVERIFIED'
  | 'MISSING'
  | 'CONFLICT'
  /** Deterministic rules cannot decide; a later (LLM / human) step must. */
  | 'NEEDS_REVIEW';

export type Verdict = 'READY' | 'PARTIAL' | 'INCOMPLETE' | 'NOT_ELIGIBLE_DEMO';

export interface DocumentInfo {
  id: string;
  docType: DocumentType;
  status: 'UPLOADED' | 'PROCESSING' | 'DONE' | 'FAILED';
}

export interface RequirementResult {
  requirementId: string;
  title: string;
  type: RequirementType;
  mandatory: boolean;
  weight: number;
  status: RequirementStatus;
  /** 0..1 credit used by the readiness score. */
  credit: number;
  /** Weakest evidence among the inputs actually used (null if none / not applicable). */
  evidenceState: EvidenceState | null;
  observed?: unknown;
  required?: unknown;
  message: string;
  /** Field-state ids this result depended on. */
  inputFields: string[];
  claimIds: string[];
  missingDocTypes?: DocumentType[];
}

export type GapKind = 'MISSING_FIELD' | 'MISSING_DOC' | 'CONFLICT' | 'UNVERIFIED' | 'NEEDS_REVIEW';

export interface Gap {
  /** Stable id, e.g. `CONFLICT:degree.graduationYear`. */
  id: string;
  kind: GapKind;
  fieldId?: string;
  docType?: DocumentType;
  requirementIds: string[];
  /** BLOCKING if any related requirement is mandatory. */
  severity: 'BLOCKING' | 'ADVISORY';
  /** Higher = more valuable to close first. */
  priority: number;
  message: string;
}

export interface BreakdownItem {
  requirementId: string;
  weight: number;
  credit: number;
  /** Contribution to the 0-100 score. */
  points: number;
}

export interface ReadinessResult {
  score: number;
  verdict: Verdict;
  readyThreshold: number;
  totalWeight: number;
  breakdown: BreakdownItem[];
}

export interface QualificationInput {
  claims: ClaimRecord[];
  documents: DocumentInfo[];
  requirementSetId?: string;
  now?: Date;
}

export interface QualificationResult {
  requirementSetId: string;
  isDemo: true;
  disclaimer: string;
  fields: FieldStates;
  requirements: RequirementResult[];
  gaps: Gap[];
  readiness: ReadinessResult;
}
