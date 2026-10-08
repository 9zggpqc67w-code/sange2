import { BackendDocType } from '../services/api';

/**
 * The upload slots shown to the applicant, and the backend document type each one maps to.
 * (The backend decides which of these are actually required: see its "docs-complete" requirement.)
 */
export interface DocumentSlot {
  id: string;
  docType: BackendDocType;
  name: string;
  shortDescription: string;
  requiredFor: string;
}

export const DOCUMENT_SLOTS: DocumentSlot[] = [
  { id: 'cv', docType: 'CV', name: 'CV', shortDescription: 'Tabellarischer Lebenslauf (German standard CV)', requiredFor: 'Required' },
  { id: 'degree', docType: 'DEGREE', name: 'Degree Certificate', shortDescription: "Bachelor's degree certificate", requiredFor: 'Required' },
  { id: 'marksheet', docType: 'TRANSCRIPT', name: 'Marksheet', shortDescription: 'Official academic transcript with final CGPA', requiredFor: 'Required' },
  { id: 'language', docType: 'LANGUAGE_CERT', name: 'Language Certificate', shortDescription: 'IELTS / TOEFL or other language test report', requiredFor: 'Required' },
  { id: 'experience', docType: 'EXPERIENCE_LETTER', name: 'Experience Letter', shortDescription: 'Employer reference or internship letter', requiredFor: 'Optional' },
];

export const DOC_TYPE_LABEL: Record<string, string> = {
  CV: 'CV',
  DEGREE: 'Degree Certificate',
  TRANSCRIPT: 'Marksheet',
  LANGUAGE_CERT: 'Language Certificate',
  EXPERIENCE_LETTER: 'Experience Letter',
  SOP: 'Statement of Purpose',
  UNKNOWN: 'Document',
};
