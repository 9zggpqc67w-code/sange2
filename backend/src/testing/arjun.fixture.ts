// Fictional applicant "Arjun Mehta" - claims mirror what the six demo documents state.
// All data is fictional and for hackathon testing only.
import type { DocumentType } from '../config/requirements.demo';
import type { ClaimRecord, ClaimSourceType } from '../evidence/evidence.types';
import { normalizeClaimValue } from '../evidence/field-registry';
import type { DocumentInfo } from '../qualification/qualification.types';

export const NOW = new Date('2026-10-08T00:00:00Z');

export type DocKey = 'cv' | 'degree' | 'transcript' | 'language' | 'experience' | 'sop';

const DOC_TYPES: Record<DocKey, DocumentType> = {
  cv: 'CV',
  degree: 'DEGREE',
  transcript: 'TRANSCRIPT',
  language: 'LANGUAGE_CERT',
  experience: 'EXPERIENCE_LETTER',
  sop: 'SOP',
};

export function createClaimFactory() {
  let seq = 0;
  return function claim(p: {
    fieldKey: string;
    raw: string;
    doc?: DocKey;
    source?: ClaimSourceType;
    entryKey?: string;
    quote?: string;
    isResolution?: boolean;
    value?: unknown;
  }): ClaimRecord {
    seq += 1;
    return {
      id: `c${seq}`,
      fieldKey: p.fieldKey,
      entryKey: p.entryKey ?? null,
      rawValue: p.raw,
      value: p.value !== undefined ? p.value : normalizeClaimValue(p.fieldKey, p.raw),
      source: p.source ?? (p.doc ? 'DOCUMENT' : 'APPLICANT'),
      documentId: p.doc ? `doc-${p.doc}` : null,
      page: p.doc ? 1 : null,
      quote: p.quote ?? p.raw,
      isResolution: p.isResolution ?? false,
      supersededById: null,
      confidence: 0.95,
      createdAt: new Date(Date.UTC(2026, 9, 8, 10, 0, seq)),
    };
  };
}

export interface ArjunOptions {
  /** Documents that were not uploaded (their claims are absent too). */
  omit?: DocKey[];
  /** Override the graduation year the CV states (default 2025). */
  cvGraduationYear?: string;
}

/** Claims + documents for the "complete state" of the demo package. */
export function buildArjun(opts: ArjunOptions = {}) {
  const claim = createClaimFactory();
  const omit = new Set(opts.omit ?? []);
  const claims: ClaimRecord[] = [];
  const add = (doc: DocKey, items: Array<[string, string, string?]>) => {
    if (omit.has(doc)) return;
    for (const [fieldKey, raw, entryKey] of items) claims.push(claim({ fieldKey, raw, doc, entryKey }));
  };

  add('cv', [
    ['applicant.name', 'Arjun Mehta'],
    ['degree.level', 'Bachelor of Technology'],
    ['degree.field', 'Computer Science and Engineering'],
    ['degree.institution', 'Riverview Institute of Technology, Bengaluru'],
    ['degree.graduationYear', opts.cvGraduationYear ?? '2025'],
    ['degree.cgpa', '8.42 / 10.00'],
    ['experience.employer', 'Northstar Digital Labs, Bengaluru', 'job-1'],
    ['experience.role', 'Software Engineering Intern', 'job-1'],
    ['experience.startDate', 'Jan 2025', 'job-1'],
    ['experience.endDate', 'Aug 2025', 'job-1'],
    ['experience.totalMonths', '8 months'],
  ]);
  add('degree', [
    ['applicant.name', 'Arjun Mehta'],
    ['applicant.dob', '14 February 2004'],
    ['degree.level', 'BACHELOR OF TECHNOLOGY'],
    ['degree.field', 'Computer Science and Engineering'],
    ['degree.institution', 'Riverview Institute of Technology, Bengaluru'],
    ['degree.graduationYear', '2025'],
    ['degree.cgpa', 'Final CGPA 8.42 / 10.00'],
  ]);
  add('transcript', [
    ['applicant.name', 'Arjun Mehta'],
    ['degree.institution', 'Riverview Institute of Technology, Bengaluru'],
    ['degree.graduationYear', '2025'],
    ['degree.cgpa', 'Final CGPA: 8.42 / 10.00'],
  ]);
  add('language', [
    ['applicant.name', 'Arjun Mehta'],
    ['language.test', 'Academic English - Demo'],
    ['language.overall', '7.0'],
    ['language.testDate', '20 September 2026'],
  ]);
  add('experience', [
    ['experience.employer', 'Northstar Digital Labs', 'job-1'],
    ['experience.role', 'Software Engineering Intern', 'job-1'],
    ['experience.startDate', '01 January 2025', 'job-1'],
    ['experience.endDate', '31 August 2025', 'job-1'],
    ['experience.totalMonths', 'Total experience represented in this demo letter: 8 months.'],
  ]);

  const documents: DocumentInfo[] = (Object.keys(DOC_TYPES) as DocKey[])
    .filter((k) => !omit.has(k))
    .map((k) => ({ id: `doc-${k}`, docType: DOC_TYPES[k], status: 'DONE' as const }));

  return { claims, documents, claim };
}
