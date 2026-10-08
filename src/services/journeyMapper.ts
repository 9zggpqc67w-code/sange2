/**
 * Presentation-only mapping from the backend journey (GET /applicants/:id/journey) to the
 * shapes the existing screens render. Nothing is computed here: statuses, scores, gaps, conflicts
 * and evidence all come from the backend; this file only renames and formats them.
 */
import {
  DashboardStats,
  DocumentItem,
  ProfileFieldItem,
  ProfileSection,
  ProvenanceType,
  QualificationRequirement,
} from '../types';
import { DOCUMENT_SLOTS, DOC_TYPE_LABEL } from '../data/documentSlots';
import type { BackendStage, EvidenceState, Evidence, Journey, RequirementStatus } from './api';

const PROVENANCE: Record<EvidenceState, ProvenanceType> = {
  DOCUMENT_SUPPORTED: 'document-supported',
  APPLICANT_PROVIDED: 'applicant-provided',
  MISSING: 'missing',
  CONFLICT: 'conflict',
  AI_GENERATED: 'ai-generated',
};

export const STAGE_LABEL: Record<BackendStage, string> = {
  NEW: 'Not started',
  DOCUMENTS_PROCESSING: 'Processing documents',
  PROFILE_BUILT: 'Profile built',
  INCOMPLETE: 'Incomplete',
  ACTION_REQUIRED: 'Action required',
  READY: 'Ready',
};

const STATUS_LABEL: Record<RequirementStatus, string> = {
  MET: 'Met',
  NOT_MET: 'Not met',
  MISSING: 'Missing',
  CONFLICT: 'Conflict',
  UNVERIFIED: 'Unverified',
  NEEDS_REVIEW: 'Needs review',
};

// ------------------------------------------------------------------ documents

export function toDocumentItems(journey: Journey | null): DocumentItem[] {
  return DOCUMENT_SLOTS.map((slot) => {
    // the most recent upload of this type wins
    const doc = journey ? [...journey.documents].reverse().find((d) => d.docType === slot.docType) : undefined;
    return {
      id: slot.id,
      name: slot.name,
      shortDescription: slot.shortDescription,
      requiredFor: slot.requiredFor,
      docType: slot.docType,
      status: doc ? ('uploaded' as const) : ('missing' as const),
      fileName: doc?.filename,
      processingStatus: doc?.status,
      error: doc?.error ?? undefined,
    };
  });
}

// ------------------------------------------------------------------ requirements

const citation = (e: Evidence) => `${DOC_TYPE_LABEL[e.documentType ?? ''] ?? (e.source === 'APPLICANT' ? 'Your answer' : 'Document')}${e.page ? `, p.${e.page}` : ''}`;

export function toRequirements(journey: Journey | null): QualificationRequirement[] {
  if (!journey?.evaluation) return [];
  const evidenceByClaim = new Map<string, Evidence>();
  journey.profile.forEach((f) => f.evidence.forEach((e) => evidenceByClaim.set(e.claimId, e)));

  return journey.evaluation.requirements.map((r) => {
    const cited = [...new Set(r.claimIds.map((id) => evidenceByClaim.get(id)).filter((e): e is Evidence => Boolean(e)).map(citation))];
    return {
      id: r.requirementId,
      title: r.title,
      status: r.status === 'MET' ? 'met' : r.status === 'MISSING' || r.status === 'NOT_MET' ? 'missing' : 'warning',
      statusLabel: STATUS_LABEL[r.status],
      explanation: r.message,
      evidence: cited.length ? cited.join(' · ') : r.status === 'MET' ? 'Verified against your documents' : 'No supporting evidence yet',
      provenance: r.evidenceState ? PROVENANCE[r.evidenceState] : 'missing',
    };
  });
}

// ------------------------------------------------------------------ profile

const displayValue = (f: Journey['profile'][number]): string => {
  if (f.state === 'CONFLICT' && f.conflictOptions?.length) {
    return f.conflictOptions.map((o) => o.evidence[0]?.rawValue ?? String(o.value)).join('  vs  ');
  }
  // prefer the document's own wording over the normalized (lower-cased) value
  const raw = f.evidence.find((e) => e.source === 'DOCUMENT')?.rawValue ?? f.evidence[0]?.rawValue;
  return raw ?? (f.value === null || f.value === undefined ? '—' : String(f.value));
};

const sourceDetail = (f: Journey['profile'][number]): string | undefined => {
  if (f.state === 'CONFLICT' && f.conflictOptions?.length) {
    return f.conflictOptions.map((o) => `${o.evidence[0]?.rawValue ?? String(o.value)}: ${[...new Set(o.evidence.map(citation))].join(', ')}`).join(' | ');
  }
  const e = f.evidence.find((x) => x.source === 'DOCUMENT') ?? f.evidence[0];
  if (!e) return undefined;
  return `${citation(e)}${e.quote ? ` · “${e.quote}”` : ''}${f.resolved ? ' · confirmed by you' : ''}`;
};

const SECTIONS: Array<{ id: string; title: string; description: string; match: (fieldKey: string) => boolean }> = [
  { id: 'personal', title: 'Personal Information', description: 'Applicant identity & destination objective', match: (k) => k.startsWith('applicant.') },
  { id: 'education', title: 'Education', description: 'Undergraduate academic records & credentials', match: (k) => k.startsWith('degree.') },
  { id: 'experience', title: 'Experience', description: 'Professional experience', match: (k) => k.startsWith('experience.') },
  { id: 'languages', title: 'Languages', description: 'Language test results from official certificates', match: (k) => k.startsWith('language.') },
];

export function toProfileSections(journey: Journey | null): ProfileSection[] {
  if (!journey) return [];
  const sections: ProfileSection[] = SECTIONS.map((def) => {
    const fields: ProfileFieldItem[] = journey.profile
      .filter((f) => def.match(f.fieldKey))
      .map((f) => ({
        label: f.entryKey ? `${f.label} (${f.entryKey})` : f.label,
        value: displayValue(f),
        provenance: PROVENANCE[f.state],
        sourceDetail: sourceDetail(f),
      }));
    // fields the backend says are missing
    journey.gaps
      .filter((g) => g.kind === 'MISSING_FIELD' && g.fieldId && def.match(g.fieldId))
      .forEach((g) => fields.push({ label: 'Missing information', value: g.message, provenance: 'missing' }));
    return { id: def.id, title: def.title, description: def.description, fields };
  });

  // what the applicant told us when signing up
  const personal = sections[0];
  personal.fields.unshift(
    { label: 'Email Address', value: journey.applicant.email ?? '—', provenance: 'applicant-provided', sourceDetail: 'Provided during onboarding' },
    { label: 'Destination Goal', value: journey.applicant.goal ?? '—', provenance: 'applicant-provided', sourceDetail: 'Provided during onboarding' },
  );

  const docFields: ProfileFieldItem[] = journey.documents.map((d) => ({
    label: DOC_TYPE_LABEL[d.docType] ?? 'Document',
    value: d.filename,
    provenance: d.status === 'DONE' ? ('document-supported' as const) : d.status === 'FAILED' ? ('missing' as const) : ('applicant-provided' as const),
    sourceDetail: d.status === 'DONE' ? `Processed · ${d.activeClaimCount} facts extracted` : d.status === 'FAILED' ? d.error ?? 'Processing failed' : 'Uploaded, not processed yet',
  }));
  journey.gaps
    .filter((g) => g.kind === 'MISSING_DOC' && g.docType)
    .forEach((g) => docFields.push({ label: DOC_TYPE_LABEL[g.docType!] ?? 'Document', value: 'Missing', provenance: 'missing', sourceDetail: g.message }));
  sections.push({ id: 'documents', title: 'Documents', description: 'Uploaded files and their processing status', fields: docFields });

  return sections.filter((s) => s.fields.length > 0);
}

// ------------------------------------------------------------------ dashboard

export function toDashboardStats(journey: Journey | null, nextActionText: string): DashboardStats {
  const docs = toDocumentItems(journey);
  const reqs = toRequirements(journey);
  return {
    progressPercentage: journey?.evaluation?.score ?? 0,
    profileStatus: journey ? STAGE_LABEL[journey.stage] : STAGE_LABEL.NEW,
    documentsUploadedCount: docs.filter((d) => d.status === 'uploaded').length,
    documentsTotalCount: docs.length,
    documentsMissingCount: docs.filter((d) => d.status === 'missing').length,
    requirementsMetCount: reqs.filter((r) => r.status === 'met').length,
    requirementsTotalCount: reqs.length,
    requirementsAttentionCount: reqs.filter((r) => r.status !== 'met').length,
    nextActionText,
  };
}
