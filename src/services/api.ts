/**
 * Typed client for the SIEG.AI backend (NestJS). This is the ONLY place that calls fetch.
 *
 * The backend is the source of truth for qualification, evidence, conflicts, readiness and the
 * agent's decisions: this client just transports them. No AI provider key ever reaches the browser.
 */

/** Unified full-stack API client. Uses relative origin in production and dev, served by server.ts. */
export const API_BASE_URL: string = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''
).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status; 0 when the backend could not be reached at all. */
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ------------------------------------------------------------------ response types

export type BackendStage = 'NEW' | 'DOCUMENTS_PROCESSING' | 'PROFILE_BUILT' | 'INCOMPLETE' | 'ACTION_REQUIRED' | 'READY';
export type BackendDocType = 'CV' | 'DEGREE' | 'TRANSCRIPT' | 'LANGUAGE_CERT' | 'EXPERIENCE_LETTER' | 'SOP' | 'UNKNOWN';
export type BackendDocStatus = 'UPLOADED' | 'PROCESSING' | 'DONE' | 'FAILED';
export type EvidenceState = 'DOCUMENT_SUPPORTED' | 'APPLICANT_PROVIDED' | 'MISSING' | 'CONFLICT' | 'AI_GENERATED';
export type RequirementStatus = 'MET' | 'NOT_MET' | 'UNVERIFIED' | 'MISSING' | 'CONFLICT' | 'NEEDS_REVIEW';
export type AgentActionType = 'ASK_CLARIFICATION' | 'REQUEST_DOCUMENT' | 'SHOW_MISSING_REQUIREMENT' | 'RECOMMEND_NEXT_STEP' | 'NO_ACTION';

export interface Applicant {
  id: string;
  name: string;
  email: string | null;
  goal: string | null;
  programLabel: string | null;
  stage: BackendStage;
}

export interface DocumentRecord {
  id: string;
  applicantId: string;
  filename: string;
  mime: string;
  docType: BackendDocType;
  status: BackendDocStatus;
  error: string | null;
}

export interface Evidence {
  claimId: string;
  source: string;
  documentId: string | null;
  documentType: BackendDocType | null;
  page: number | null;
  quote: string | null;
  rawValue: string;
}

export interface ConflictOption {
  value: unknown;
  sources?: string[];
  claimIds?: string[];
  evidence: Evidence[];
}

export interface ProfileField {
  id: string;
  fieldKey: string;
  label: string;
  entryKey: string | null;
  state: EvidenceState;
  value: unknown;
  resolved: boolean;
  conflictOptions: ConflictOption[] | null;
  evidence: Evidence[];
}

export interface RequirementResult {
  requirementId: string;
  title: string;
  mandatory: boolean;
  status: RequirementStatus;
  evidenceState: EvidenceState | null;
  message: string;
  claimIds: string[];
}

export interface Gap {
  id: string;
  kind: 'MISSING_FIELD' | 'MISSING_DOC' | 'CONFLICT' | 'UNVERIFIED' | 'NEEDS_REVIEW';
  fieldId?: string;
  docType?: BackendDocType;
  severity: 'BLOCKING' | 'ADVISORY';
  message: string;
}

export interface JourneyConflict {
  gapId: string;
  fieldId: string | null;
  label: string | null;
  options: ConflictOption[];
}

export interface Evaluation {
  id: string;
  createdAt: string;
  score: number;
  verdict: string;
  outcome: BackendStage;
  isDemo: boolean;
  disclaimer: string;
  requirements: RequirementResult[];
}

export interface Clarification {
  id: string;
  prompt: string;
  gapId: string | null;
  fieldId: string | null;
  status: 'OPEN' | 'ANSWERED' | 'DISMISSED' | 'SUPERSEDED';
  answer: { text?: string; value?: unknown; choice?: string } | null;
  createdAt: string;
  answeredAt: string | null;
}

export interface Journey {
  applicant: { id: string; name: string; email: string | null; goal: string | null; programLabel: string | null };
  stage: BackendStage;
  documents: Array<{
    id: string;
    filename: string;
    docType: BackendDocType;
    status: BackendDocStatus;
    error: string | null;
    activeVersion: number | null;
    activeClaimCount: number;
  }>;
  profile: ProfileField[];
  evaluation: Evaluation | null;
  isStale: boolean;
  gaps: Gap[];
  conflicts: JourneyConflict[];
  history: Array<{ id: string; createdAt: string; score: number; verdict: string; outcome: BackendStage }>;
  clarifications: { open: number; items: Clarification[] };
}

export interface AgentOption {
  value: unknown;
  sources: string[];
}

export interface AgentAction {
  id: string;
  type: AgentActionType;
  status: 'PENDING' | 'ANSWERED' | 'SUPERSEDED' | 'DONE';
  gapId: string | null;
  evaluationId: string | null;
  params: {
    docType: BackendDocType | null;
    requirementId: string | null;
    route: string | null;
    fieldId: string | null;
    options: AgentOption[];
    clarificationId?: string;
  } | null;
  decision: { decision: { message: string; rationale: string }; source: 'LLM' | 'FALLBACK' | 'RULES' } | null;
}

export interface AgentView {
  action: AgentAction | null;
  message: string;
  source: 'LLM' | 'FALLBACK' | 'RULES' | null;
  clarification: Clarification | null;
  /** Next-action only: false when the evaluation changed since the action was decided. */
  isCurrent?: boolean;
}

export interface ProcessResult {
  processed: Array<{ documentId: string; status: BackendDocStatus; error: string | null }>;
  evaluationError?: string;
  stage: BackendStage;
}

export interface AnswerResult extends Clarification {
  resolution: null | { skipped?: string; evaluationError?: string; stage?: BackendStage };
}

// ------------------------------------------------------------------ transport

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError(`Cannot reach the SIEG.AI backend at ${API_BASE_URL}. Is it running?`, 0);
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const raw = (body as { message?: string | string[] } | null)?.message;
    const message = Array.isArray(raw) ? raw.join('; ') : raw || res.statusText || `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return body as T;
}

const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

// ------------------------------------------------------------------ endpoints

export const api = {
  health: () => request<{ status: string; db: string }>('/health'),

  createApplicant: (input: { name: string; email?: string; goal?: string; programLabel?: string }) =>
    request<Applicant>('/applicants', json(input)),
  getApplicant: (id: string) => request<Applicant>(`/applicants/${id}`),
  setGoal: (id: string, goal: string, programLabel?: string) =>
    request<Applicant>(`/applicants/${id}/goal`, { method: 'PUT', body: JSON.stringify({ goal, programLabel }) }),

  uploadDocument: (id: string, file: File, docType?: BackendDocType) => {
    const form = new FormData();
    form.append('file', file);
    if (docType) form.append('docType', docType);
    return request<DocumentRecord>(`/applicants/${id}/documents`, { method: 'POST', body: form });
  },
  listDocuments: (id: string) => request<DocumentRecord[]>(`/applicants/${id}/documents`),

  processPending: (id: string) => request<ProcessResult>(`/applicants/${id}/process`, { method: 'POST' }),
  evaluate: (id: string) => request<{ stage: BackendStage }>(`/applicants/${id}/evaluate`, { method: 'POST' }),

  getJourney: (id: string) => request<Journey>(`/applicants/${id}/journey`),
  getGaps: (id: string) => request<{ gaps: Gap[]; conflicts: JourneyConflict[]; isStale: boolean }>(`/applicants/${id}/gaps`),
  getClaims: (id: string, scope: 'active' | 'all' = 'active') => request<unknown[]>(`/applicants/${id}/claims?scope=${scope}`),

  decide: (id: string, refresh = false) => request<AgentView>(`/applicants/${id}/agent/decide${refresh ? '?refresh=true' : ''}`, { method: 'POST' }),
  getNextAction: (id: string) => request<AgentView>(`/applicants/${id}/agent/next-action`),
  getActions: (id: string) => request<AgentAction[]>(`/applicants/${id}/agent/actions`),

  listClarifications: (id: string, status?: Clarification['status']) =>
    request<Clarification[]>(`/applicants/${id}/clarifications${status ? `?status=${status}` : ''}`),
  getClarification: (id: string, clarificationId: string) => request<Clarification>(`/applicants/${id}/clarifications/${clarificationId}`),
  answerClarification: (id: string, clarificationId: string, answer: { value?: unknown; choice?: string; text?: string }) =>
    request<AnswerResult>(`/applicants/${id}/clarifications/${clarificationId}/answer`, json(answer)),
};
