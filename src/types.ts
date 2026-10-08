/**
 * AI Applicant Copilot - Type Definitions
 */

export type ApplicantGoal = 'study' | 'work';

export interface ApplicantDetails {
  fullName: string;
  email: string;
  goal: ApplicantGoal;
  intendedField: string;
  targetInstitution: string;
  country: string; // Pre-configured to Germany
}

export type DocumentStatus = 'uploaded' | 'missing';

export interface DocumentItem {
  id: string;
  name: string;
  shortDescription: string;
  requiredFor: string;
  status: DocumentStatus;
  fileName?: string;
  fileSize?: string;
  uploadedAt?: string;
  /** Backend document type this slot maps to (set by the journey mapper). */
  docType?: string;
  /** Backend processing status of the uploaded file. */
  processingStatus?: 'UPLOADED' | 'PROCESSING' | 'DONE' | 'FAILED';
  /** Backend error message when processing failed. */
  error?: string;
}

// Provenance labels for information origin
export type ProvenanceType =
  | 'document-supported' // ✓ Document-supported
  | 'applicant-provided' // ● Applicant-provided
  | 'missing'            // ⚠ Missing
  | 'conflict'           // ! Conflict
  | 'ai-generated';      // ✦ AI-generated

export interface ProfileFieldItem {
  label: string;
  value: string;
  provenance: ProvenanceType;
  sourceDetail?: string;
  subValue?: string;
}

export interface ProfileSection {
  id: string;
  title: string;
  description?: string;
  fields: ProfileFieldItem[];
}

export interface QualificationRequirement {
  id: string;
  title: string;
  status: 'met' | 'missing' | 'warning';
  statusLabel: string;
  explanation: string;
  evidence: string;
  provenance: ProvenanceType;
}

export type JourneyStage = 'understand' | 'check' | 'find-gap' | 'decide' | 'act';

export type ApplicationStep =
  | 'home'
  | 'details'
  | 'consent'
  | 'documents'
  | 'processing'
  | 'dashboard'
  | 'profile'
  | 'qualification'
  | 'next-action';

export interface DashboardStats {
  progressPercentage: number;
  profileStatus: string;
  documentsUploadedCount: number;
  documentsTotalCount: number;
  documentsMissingCount: number;
  requirementsMetCount: number;
  requirementsTotalCount: number;
  requirementsAttentionCount: number;
  nextActionText: string;
}
