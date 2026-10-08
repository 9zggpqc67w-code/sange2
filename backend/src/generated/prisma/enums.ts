export const Stage = {
  NEW: 'NEW',
  DOCUMENTS_PROCESSING: 'DOCUMENTS_PROCESSING',
  PROFILE_BUILT: 'PROFILE_BUILT',
  INCOMPLETE: 'INCOMPLETE',
  ACTION_REQUIRED: 'ACTION_REQUIRED',
  READY: 'READY',
} as const;
export type Stage = (typeof Stage)[keyof typeof Stage];

export const RunStatus = {
  PROCESSING: 'PROCESSING',
  DONE: 'DONE',
  FAILED: 'FAILED',
} as const;
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

export const EvaluationTrigger = {
  DOCUMENT_PROCESSED: 'DOCUMENT_PROCESSED',
  MANUAL: 'MANUAL',
  APPLICANT_UPDATE: 'APPLICANT_UPDATE',
} as const;
export type EvaluationTrigger = (typeof EvaluationTrigger)[keyof typeof EvaluationTrigger];

export const ClarificationStatus = {
  OPEN: 'OPEN',
  ANSWERED: 'ANSWERED',
  DISMISSED: 'DISMISSED',
  SUPERSEDED: 'SUPERSEDED',
} as const;
export type ClarificationStatus = (typeof ClarificationStatus)[keyof typeof ClarificationStatus];

export const DocType = {
  CV: 'CV',
  DEGREE: 'DEGREE',
  TRANSCRIPT: 'TRANSCRIPT',
  LANGUAGE_CERT: 'LANGUAGE_CERT',
  EXPERIENCE_LETTER: 'EXPERIENCE_LETTER',
  SOP: 'SOP',
  UNKNOWN: 'UNKNOWN',
} as const;
export type DocType = (typeof DocType)[keyof typeof DocType];

export const DocStatus = {
  UPLOADED: 'UPLOADED',
  PROCESSING: 'PROCESSING',
  DONE: 'DONE',
  FAILED: 'FAILED',
} as const;
export type DocStatus = (typeof DocStatus)[keyof typeof DocStatus];

export const TextMethod = {
  TEXT_LAYER: 'TEXT_LAYER',
  OCR: 'OCR',
  VISION: 'VISION',
} as const;
export type TextMethod = (typeof TextMethod)[keyof typeof TextMethod];

export const ClaimSource = {
  DOCUMENT: 'DOCUMENT',
  APPLICANT: 'APPLICANT',
  AI_DERIVED: 'AI_DERIVED',
} as const;
export type ClaimSource = (typeof ClaimSource)[keyof typeof ClaimSource];

export const ActionType = {
  ASK_CLARIFICATION: 'ASK_CLARIFICATION',
  REQUEST_DOCUMENT: 'REQUEST_DOCUMENT',
  SHOW_MISSING_REQUIREMENT: 'SHOW_MISSING_REQUIREMENT',
  RECOMMEND_NEXT_STEP: 'RECOMMEND_NEXT_STEP',
  NO_ACTION: 'NO_ACTION',
} as const;
export type ActionType = (typeof ActionType)[keyof typeof ActionType];

export const ActionStatus = {
  PENDING: 'PENDING',
  ANSWERED: 'ANSWERED',
  SUPERSEDED: 'SUPERSEDED',
  DONE: 'DONE',
} as const;
export type ActionStatus = (typeof ActionStatus)[keyof typeof ActionStatus];
