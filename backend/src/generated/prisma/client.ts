// @ts-nocheck
export * from './enums';
export * as $Enums from './enums';

export interface Applicant {
  id: string;
  name: string;
  email: string | null;
  goal: string | null;
  programLabel: string | null;
  stage: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  applicantId: string;
  filename: string;
  storagePath: string;
  mime: string;
  docType: any;
  status: any;
  error: string | null;
  textMethod: any;
  pages: any;
  ocrConfidence: number | null;
  extraction: any;
  createdAt: Date;
}

export interface DocumentRun {
  id: string;
  documentId: string;
  version: number;
  status: any;
  isActive: boolean;
  docType: any;
  textMethod: any;
  pages: any;
  extraction: any;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface Claim {
  id: string;
  applicantId: string;
  fieldKey: string;
  entryKey: string | null;
  rawValue: string;
  value: any;
  source: any;
  documentId: string | null;
  runId: string | null;
  page: number | null;
  quote: string | null;
  isResolution: boolean;
  supersededById: string | null;
  confidence: number | null;
  createdAt: Date;
}

export interface Evaluation {
  id: string;
  applicantId: string;
  requirementSetId: string;
  isDemo: boolean;
  trigger: any;
  triggerDocumentId: string | null;
  score: number;
  verdict: string;
  outcome: any;
  fields: any;
  gaps: any;
  requirements: any;
  breakdown: any;
  summary: any;
  inputs: any;
  inputHash: string;
  createdAt: Date;
}

export interface AgentAction {
  id: string;
  applicantId: string;
  evaluationId: string | null;
  type: any;
  gapId: string | null;
  params: any;
  decision: any;
  status: any;
  answer: any;
  createdAt: Date;
  answeredAt: Date | null;
}

export interface Clarification {
  id: string;
  applicantId: string;
  prompt: string;
  gapId: string | null;
  fieldId: string | null;
  claimIds: any;
  evaluationId: string | null;
  agentActionId: string | null;
  status: any;
  answer: any;
  resolutionClaimId: string | null;
  createdAt: Date;
  answeredAt: Date | null;
  updatedAt: Date;
}

export namespace Prisma {
  export type InputJsonValue = any;
  export type JsonValue = any;
  export type ApplicantCreateInput = any;
  export type ApplicantUpdateInput = any;
  export type DocumentCreateInput = any;
  export type DocumentUpdateInput = any;
  export type ClaimCreateInput = any;
  export type ClaimCreateManyInput = any;
  export type EvaluationCreateInput = any;
  export type AgentActionCreateInput = any;
  export type ClarificationCreateInput = any;
}

interface Delegate<T> {
  findUnique(args?: any): Promise<T | null>;
  findFirst(args?: any): Promise<T | null>;
  findMany(args?: any): Promise<T[]>;
  create(args?: any): Promise<T>;
  createMany(args?: any): Promise<{ count: number }>;
  update(args?: any): Promise<T>;
  updateMany(args?: any): Promise<{ count: number }>;
  delete(args?: any): Promise<T>;
  deleteMany(args?: any): Promise<{ count: number }>;
  count(args?: any): Promise<number>;
}

export class PrismaClient {
  applicant: Delegate<Applicant> = {} as any;
  document: Delegate<Document> = {} as any;
  documentRun: Delegate<DocumentRun> = {} as any;
  claim: Delegate<Claim> = {} as any;
  evaluation: Delegate<Evaluation> = {} as any;
  agentAction: Delegate<AgentAction> = {} as any;
  clarification: Delegate<Clarification> = {} as any;

  constructor(_options?: any) {}
  $connect(): Promise<void> { return Promise.resolve(); }
  $disconnect(): Promise<void> { return Promise.resolve(); }
  $transaction<T>(arg: any): Promise<T> {
    if (typeof arg === 'function') return arg(this);
    return Promise.all(arg) as any;
  }
}
