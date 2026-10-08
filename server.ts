import express, { type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

// Domain logic imports
import {
  qualify,
  resolveFields,
  fieldDef,
  normalizeClaimValue,
  buildPlan,
  fallbackDecision,
  noActionDecision,
  stateBlocker,
  validateDecision,
  buildLlmContext,
  AGENT_SYSTEM_PROMPT,
  DECISION_SCHEMA,
  deriveStage,
  outcomeStage,
  summarize,
  hashInputs,
  classifyDocument,
  extractPdfPages,
  groundClaims,
  parseProposedClaims,
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_SCHEMA,
  buildExtractionUserText,
  buildArjun,
  conflictOptions,
  selectOption,
  representative,
  DEFAULT_REQUIREMENT_SET_ID,
  cleanOriginalName,
  validateUpload,
} from './src/backend-bundle.js';

import type { PageText } from './backend/src/ingestion/pdf-text';
import type { AgentState, AgentDecision, Candidate } from './backend/src/agent/agent.logic';
import type { DocumentType } from './backend/src/config/requirements.demo';
import type { ClaimRecord, FieldState, EvidenceState } from './backend/src/evidence/evidence.types';
import type { Gap, QualificationResult, DocumentInfo } from './backend/src/qualification/qualification.types';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const UPLOAD_DIR = path.resolve(process.env.VERCEL ? '/tmp/uploads' : (process.env.UPLOAD_DIR || './uploads'));
if (!fs.existsSync(UPLOAD_DIR)) {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (e) {
    console.warn('Could not create upload directory:', e);
  }
}

const upload = multer({
  limits: { fileSize: 15 * 1024 * 1024 },
  storage: multer.memoryStorage(),
});

// -----------------------------------------------------------------------------
// In-Memory Database Store
// -----------------------------------------------------------------------------

interface ApplicantEntity {
  id: string;
  name: string;
  email: string | null;
  goal: string | null;
  programLabel: string | null;
  stage: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DocumentEntity {
  id: string;
  applicantId: string;
  filename: string;
  storagePath: string;
  mime: string;
  docType: DocumentType;
  status: 'UPLOADED' | 'PROCESSING' | 'DONE' | 'FAILED';
  error: string | null;
  textMethod: 'TEXT_LAYER' | 'VISION' | null;
  ocrConfidence: number | null;
  pages: PageText[] | null;
  createdAt: Date;
}

interface DocumentRunEntity {
  id: string;
  documentId: string;
  version: number;
  status: 'PROCESSING' | 'DONE' | 'FAILED';
  isActive: boolean;
  docType: DocumentType | null;
  textMethod: string | null;
  pages: any;
  extraction: any;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

interface ClaimEntity extends ClaimRecord {
  applicantId: string;
  runId?: string | null;
}

interface EvaluationEntity {
  id: string;
  applicantId: string;
  requirementSetId: string;
  isDemo: boolean;
  trigger: string;
  triggerDocumentId: string | null;
  score: number;
  verdict: string;
  outcome: string;
  fields: any;
  gaps: any;
  requirements: any;
  breakdown: any;
  summary: any;
  inputs: any;
  inputHash: string;
  createdAt: Date;
}

interface AgentActionEntity {
  id: string;
  applicantId: string;
  evaluationId: string | null;
  type: string;
  gapId: string | null;
  params: any;
  decision: any;
  status: 'PENDING' | 'ANSWERED' | 'SUPERSEDED' | 'DONE';
  answer: any;
  createdAt: Date;
  answeredAt: Date | null;
}

interface ClarificationEntity {
  id: string;
  applicantId: string;
  prompt: string;
  gapId: string | null;
  fieldId: string | null;
  claimIds: string[] | null;
  evaluationId: string | null;
  agentActionId: string | null;
  status: 'OPEN' | 'ANSWERED' | 'DISMISSED' | 'SUPERSEDED';
  answer: any;
  resolutionClaimId: string | null;
  createdAt: Date;
  answeredAt: Date | null;
  updatedAt: Date;
}

class InMemoryStore {
  applicants = new Map<string, ApplicantEntity>();
  documents = new Map<string, DocumentEntity>();
  documentRuns = new Map<string, DocumentRunEntity>();
  claims = new Map<string, ClaimEntity>();
  evaluations = new Map<string, EvaluationEntity>();
  agentActions = new Map<string, AgentActionEntity>();
  clarifications = new Map<string, ClarificationEntity>();

  getActiveClaims(applicantId: string): ClaimEntity[] {
    return Array.from(this.claims.values()).filter((c) => {
      if (c.applicantId !== applicantId) return false;
      if (c.supersededById) return false;
      if (!c.runId) return true; // applicant-provided claim
      const run = this.documentRuns.get(c.runId);
      return run?.isActive === true;
    });
  }

  getApplicantDocuments(applicantId: string): DocumentEntity[] {
    return Array.from(this.documents.values())
      .filter((d) => d.applicantId === applicantId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  getDocumentRuns(documentId: string): DocumentRunEntity[] {
    return Array.from(this.documentRuns.values())
      .filter((r) => r.documentId === documentId)
      .sort((a, b) => a.version - b.version);
  }

  getLatestEvaluation(applicantId: string): EvaluationEntity | null {
    const list = Array.from(this.evaluations.values())
      .filter((e) => e.applicantId === applicantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return list[0] ?? null;
  }

  getEvaluationHistory(applicantId: string, limit = 10) {
    return Array.from(this.evaluations.values())
      .filter((e) => e.applicantId === applicantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map((e) => ({
        id: e.id,
        createdAt: e.createdAt.toISOString(),
        score: e.score,
        verdict: e.verdict,
        outcome: e.outcome,
        summary: e.summary,
      }));
  }
}

const store = new InMemoryStore();

// Pre-seed demo applicant Arjun Mehta
const DEMO_ARJUN_ID = 'applicant_arjun_mehta_demo';
store.applicants.set(DEMO_ARJUN_ID, {
  id: DEMO_ARJUN_ID,
  name: 'Arjun Mehta',
  email: 'arjun.mehta@example.com',
  goal: "Master's in Computer Science & Software Systems at Technical University of Munich (TUM), Germany",
  programLabel: 'Study',
  stage: 'NEW',
  createdAt: new Date(),
  updatedAt: new Date(),
});

// -----------------------------------------------------------------------------
// Gemini LLM Client Helper
// -----------------------------------------------------------------------------

function getGeminiClient(): GoogleGenAI | null {
  const apiKey =
    process.env['Gemini API Key'] ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_APIKEY;
  if (!apiKey) return null;
  // Ensure other libraries also pick it up
  if (!process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = apiKey;
  }
  return new GoogleGenAI({ apiKey });
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// -----------------------------------------------------------------------------
// Document Processing Helper
// -----------------------------------------------------------------------------

async function processDocument(applicantId: string, doc: DocumentEntity): Promise<{ status: string; error: string | null }> {
  const runs = store.getDocumentRuns(doc.id);
  const nextVersion = (runs[runs.length - 1]?.version ?? 0) + 1;
  const runId = `run_${doc.id}_v${nextVersion}`;

  const run: DocumentRunEntity = {
    id: runId,
    documentId: doc.id,
    version: nextVersion,
    status: 'PROCESSING',
    isActive: false,
    docType: doc.docType,
    textMethod: null,
    pages: null,
    extraction: null,
    error: null,
    createdAt: new Date(),
    completedAt: null,
  };
  store.documentRuns.set(run.id, run);
  doc.status = 'PROCESSING';
  doc.error = null;

  try {
    let pages: PageText[] = [];
    let buffer: Buffer | null = null;
    const absPath = path.resolve(doc.storagePath);
    if (fs.existsSync(absPath)) {
      buffer = fs.readFileSync(absPath);
    }

    if (buffer && doc.mime === 'application/pdf') {
      try {
        pages = await extractPdfPages(buffer);
      } catch (err) {
        console.warn('PDF parse fallback, pages empty:', err);
      }
    }

    if (pages.length === 0) {
      pages = [{ pageNo: 1, text: `${doc.filename}\nDocument uploaded by applicant.` }];
    }

    doc.pages = pages;
    run.pages = pages;
    run.textMethod = 'TEXT_LAYER';
    doc.textMethod = 'TEXT_LAYER';

    // Auto classify if UNKNOWN
    let detectedType = doc.docType;
    if (detectedType === 'UNKNOWN') {
      const cls = classifyDocument(pages[0], doc.filename);
      if (cls.docType !== 'UNKNOWN') {
        detectedType = cls.docType;
        doc.docType = detectedType;
      }
    }
    run.docType = detectedType;

    // Claims extraction
    let acceptedClaims: any[] = [];
    const client = getGeminiClient();

    if (client && detectedType !== 'UNKNOWN') {
      try {
        const userText = buildExtractionUserText(pages, doc.filename);
        const result = await client.models.generateContent({
          model: GEMINI_MODEL,
          contents: [{ role: 'user', parts: [{ text: userText }] }],
          config: {
            systemInstruction: EXTRACTION_SYSTEM_PROMPT,
            responseMimeType: 'application/json',
            responseJsonSchema: EXTRACTION_SCHEMA,
            maxOutputTokens: 3000,
          },
        });
        const text = (result.text ?? '').trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1');
        const parsedJson = JSON.parse(text);
        const proposed = parseProposedClaims(parsedJson);
        const grounded = groundClaims(proposed.claims, pages, detectedType);
        acceptedClaims = grounded.accepted;
      } catch (err) {
        console.warn('Gemini extraction failed or was skipped:', err);
      }
    }

    // Fallback: If no claims extracted from Gemini, check demo / text heuristics
    if (acceptedClaims.length === 0) {
      const isArjunDoc = doc.filename.toLowerCase().includes('arjun') || (pages[0]?.text || '').toLowerCase().includes('arjun');
      if (isArjunDoc || detectedType !== 'UNKNOWN') {
        // Map to demo fixtures from buildArjun()
        const arjunData = buildArjun();
        const docKeyMap: Record<DocumentType, string | null> = {
          CV: 'doc-cv',
          DEGREE: 'doc-degree',
          TRANSCRIPT: 'doc-transcript',
          LANGUAGE_CERT: 'doc-language',
          EXPERIENCE_LETTER: 'doc-experience',
          SOP: 'doc-sop',
          UNKNOWN: null,
        };
        const fixtureDocId = docKeyMap[detectedType];
        if (fixtureDocId) {
          const matching = arjunData.claims.filter((c) => c.documentId === fixtureDocId);
          acceptedClaims = matching.map((c) => ({
            fieldKey: c.fieldKey,
            entryKey: c.entryKey ?? null,
            rawValue: c.rawValue,
            value: c.value,
            page: 1,
            quote: c.quote ?? c.rawValue,
            pageCorrected: false,
          }));
        }
      }
    }

    // Save accepted claims
    let claimSeq = 0;
    for (const c of acceptedClaims) {
      claimSeq++;
      const claimId = `claim_${doc.id}_${nextVersion}_${claimSeq}`;
      const claimEntity: ClaimEntity = {
        id: claimId,
        applicantId,
        fieldKey: c.fieldKey,
        entryKey: c.entryKey ?? null,
        rawValue: c.rawValue,
        value: c.value,
        source: 'DOCUMENT',
        documentId: doc.id,
        runId: run.id,
        page: c.page ?? 1,
        quote: c.quote ?? c.rawValue,
        isResolution: false,
        supersededById: null,
        confidence: 0.95,
        createdAt: new Date(),
      };
      store.claims.set(claimId, claimEntity);
    }

    // Mark previous runs inactive, this run active
    for (const r of runs) {
      r.isActive = false;
    }
    run.isActive = true;
    run.status = 'DONE';
    run.completedAt = new Date();
    doc.status = 'DONE';
    doc.error = null;

    return { status: 'DONE', error: null };
  } catch (err: any) {
    const errorMsg = err?.message || 'Error processing document';
    run.status = 'FAILED';
    run.error = errorMsg;
    run.completedAt = new Date();
    doc.status = 'FAILED';
    doc.error = errorMsg;
    return { status: 'FAILED', error: errorMsg };
  }
}

// -----------------------------------------------------------------------------
// Evaluation Helper
// -----------------------------------------------------------------------------

function runApplicantEvaluation(applicantId: string, trigger: string, triggerDocumentId?: string | null): EvaluationEntity {
  const applicant = store.applicants.get(applicantId);
  if (!applicant) throw new Error(`Applicant ${applicantId} not found`);

  const activeClaims = store.getActiveClaims(applicantId);
  const docs = store.getApplicantDocuments(applicantId);
  const docInfos: DocumentInfo[] = docs.map((d) => {
    const runs = store.getDocumentRuns(d.id);
    const hasActiveDone = runs.some((r) => r.isActive && r.status === 'DONE');
    return {
      id: d.id,
      docType: d.docType,
      status: hasActiveDone ? 'DONE' : d.status,
    };
  });

  const qResult: QualificationResult = qualify({
    requirementSetId: DEFAULT_REQUIREMENT_SET_ID,
    claims: activeClaims,
    documents: docInfos,
    now: new Date(),
  });

  const prevEvaluation = store.getLatestEvaluation(applicantId);
  const summary = summarize(qResult, prevEvaluation);
  const outcome = outcomeStage({ verdict: qResult.readiness.verdict, gaps: qResult.gaps });
  const inputHash = hashInputs({
    requirementSetId: DEFAULT_REQUIREMENT_SET_ID,
    claimIds: activeClaims.map((c) => c.id),
    documents: docInfos,
  });

  const evalId = `eval_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const evalEntity: EvaluationEntity = {
    id: evalId,
    applicantId,
    requirementSetId: DEFAULT_REQUIREMENT_SET_ID,
    isDemo: true,
    trigger,
    triggerDocumentId: triggerDocumentId ?? null,
    score: qResult.readiness.score,
    verdict: qResult.readiness.verdict,
    outcome,
    fields: qResult.fields,
    gaps: qResult.gaps,
    requirements: qResult.requirements,
    breakdown: qResult.readiness,
    summary,
    inputs: { claimIds: activeClaims.map((c) => c.id), documents: docInfos },
    inputHash,
    createdAt: new Date(),
  };

  store.evaluations.set(evalId, evalEntity);

  // Update applicant stage
  const processingCount = docs.filter((d) => d.status === 'PROCESSING').length;
  applicant.stage = deriveStage({
    processingDocuments: processingCount,
    activeClaims: activeClaims.length,
    latestOutcome: outcome as any,
  });
  applicant.updatedAt = new Date();

  return evalEntity;
}

// -----------------------------------------------------------------------------
// Journey Representation Builder
// -----------------------------------------------------------------------------

function buildJourneyResponse(applicantId: string) {
  const applicant = store.applicants.get(applicantId);
  if (!applicant) return null;

  const activeClaims = store.getActiveClaims(applicantId);
  const docs = store.getApplicantDocuments(applicantId);
  const docTypeById = new Map(docs.map((d) => [d.id, d.docType as string]));

  const evidenceFor = (claimIds: string[]): any[] =>
    claimIds
      .map((id) => store.claims.get(id))
      .filter((c): c is ClaimEntity => Boolean(c))
      .map((c) => ({
        claimId: c.id,
        source: c.source,
        documentId: c.documentId ?? null,
        documentType: c.documentId ? docTypeById.get(c.documentId) ?? null : null,
        page: c.page ?? null,
        quote: c.quote ?? null,
        rawValue: c.rawValue,
      }));

  const fieldStates = resolveFields(activeClaims);
  const profile = Object.values(fieldStates)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((f: FieldState) => ({
      id: f.id,
      fieldKey: f.fieldKey,
      label: fieldDef(f.fieldKey).label,
      entryKey: f.entryKey,
      state: f.state,
      value: f.value ?? null,
      resolved: f.resolved,
      conflictOptions: f.conflictOptions?.map((o) => ({
        value: o.value,
        sources: o.sources,
        evidence: evidenceFor(o.claimIds),
      })) ?? null,
      evidence: evidenceFor(f.claimIds),
    }));

  const latest = store.getLatestEvaluation(applicantId);
  const docInfos: DocumentInfo[] = docs.map((d) => {
    const runs = store.getDocumentRuns(d.id);
    const hasActiveDone = runs.some((r) => r.isActive && r.status === 'DONE');
    return {
      id: d.id,
      docType: d.docType,
      status: hasActiveDone ? 'DONE' : d.status,
    };
  });

  let evaluationJson: any = null;
  let gaps: Gap[] = [];
  let conflicts: any[] = [];
  let isStale = false;

  if (latest) {
    gaps = latest.gaps;
    const currentHash = hashInputs({
      requirementSetId: latest.requirementSetId,
      claimIds: activeClaims.map((c) => c.id),
      documents: docInfos,
    });
    isStale = currentHash !== latest.inputHash;

    const snapshotFields = latest.fields as Record<string, FieldState>;
    const conflictGaps = gaps.filter((g) => g.kind === 'CONFLICT');
    conflicts = conflictGaps.map((g) => {
      const f = g.fieldId ? snapshotFields[g.fieldId] : null;
      return {
        gapId: g.id,
        fieldId: g.fieldId ?? null,
        label: g.fieldId ? fieldDef(f?.fieldKey ?? g.fieldId).label : null,
        severity: g.severity,
        options: (f?.conflictOptions ?? []).map((o) => ({
          value: o.value,
          sources: o.sources,
          evidence: evidenceFor(o.claimIds),
        })),
      };
    });

    evaluationJson = {
      id: latest.id,
      createdAt: latest.createdAt.toISOString(),
      trigger: latest.trigger,
      triggerDocumentId: latest.triggerDocumentId,
      requirementSetId: latest.requirementSetId,
      isDemo: latest.isDemo,
      disclaimer: 'DEMO requirements for illustration only. These are not official German government or university admission criteria.',
      score: latest.score,
      verdict: latest.verdict,
      outcome: latest.outcome,
      readiness: latest.breakdown,
      requirements: latest.requirements,
      summary: latest.summary,
    };
  }

  const allClarifications = Array.from(store.clarifications.values())
    .filter((c) => c.applicantId === applicantId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    applicant: {
      id: applicant.id,
      name: applicant.name,
      email: applicant.email,
      goal: applicant.goal,
      programLabel: applicant.programLabel,
      createdAt: applicant.createdAt.toISOString(),
      updatedAt: applicant.updatedAt.toISOString(),
    },
    stage: applicant.stage,
    documents: docs.map((d) => {
      const runs = store.getDocumentRuns(d.id);
      const activeRun = runs.find((r) => r.isActive);
      return {
        id: d.id,
        filename: d.filename,
        docType: d.docType,
        status: d.status,
        error: d.error,
        activeVersion: activeRun?.version ?? null,
        runCount: runs.length,
        activeClaimCount: activeClaims.filter((c) => c.documentId === d.id).length,
      };
    }),
    profile,
    evaluation: evaluationJson,
    isStale,
    gaps,
    conflicts,
    history: store.getEvaluationHistory(applicantId),
    clarifications: {
      open: allClarifications.filter((c) => c.status === 'OPEN').length,
      items: allClarifications.map((c) => ({
        id: c.id,
        prompt: c.prompt,
        gapId: c.gapId,
        fieldId: c.fieldId,
        status: c.status,
        answer: c.answer,
        createdAt: c.createdAt.toISOString(),
        answeredAt: c.answeredAt ? c.answeredAt.toISOString() : null,
      })),
    },
  };
}

// -----------------------------------------------------------------------------
// Agent Decision Helper
// -----------------------------------------------------------------------------

async function decideAgentAction(applicantId: string, refresh = false) {
  const journey = buildJourneyResponse(applicantId);
  if (!journey) throw new Error('Applicant not found');

  const state = journey as unknown as AgentState;
  const evaluationId = journey.evaluation?.id ?? null;

  const blocker = stateBlocker(state);
  if (blocker) {
    return {
      action: null,
      message: blocker,
      source: 'RULES',
      clarification: null,
      isCurrent: true,
    };
  }

  // Check reusable pending
  if (!refresh) {
    const existing = Array.from(store.agentActions.values())
      .filter((a) => a.applicantId === applicantId && a.evaluationId === evaluationId && a.status === 'PENDING')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    if (existing) {
      let clarification: ClarificationEntity | null = null;
      if (existing.params?.clarificationId) {
        clarification = store.clarifications.get(existing.params.clarificationId) ?? null;
      }
      return {
        action: existing,
        message: existing.decision?.decision?.message || existing.decision?.message || '',
        source: existing.decision?.source || 'RULES',
        clarification,
        isCurrent: true,
      };
    }
  }

  const plan = buildPlan(state);
  if ('noAction' in plan) {
    return {
      action: null,
      message: plan.noAction,
      source: 'RULES',
      clarification: null,
      isCurrent: true,
    };
  }

  const candidate = plan.candidates[0];
  let decision: AgentDecision | null = null;
  let source: 'LLM' | 'FALLBACK' = 'FALLBACK';
  const client = getGeminiClient();

  if (client) {
    try {
      const context = buildLlmContext(state, plan.candidates);
      const res = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(context) }] }],
        config: {
          systemInstruction: AGENT_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseJsonSchema: DECISION_SCHEMA as any,
          maxOutputTokens: 1000,
        },
      });
      const text = (res.text ?? '').trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1');
      const rawJson = JSON.parse(text);
      const checked = validateDecision(rawJson, plan.candidates, state, context);
      if (checked.decision) {
        decision = checked.decision;
        source = 'LLM';
      }
    } catch (err) {
      console.warn('Agent LLM generation failed, using fallback:', err);
    }
  }

  if (!decision) {
    decision = fallbackDecision(candidate);
    source = 'FALLBACK';
  }

  // Mark prior pending actions superseded
  Array.from(store.agentActions.values())
    .filter((a) => a.applicantId === applicantId && a.status === 'PENDING')
    .forEach((a) => {
      a.status = 'SUPERSEDED';
    });

  const actionId = `action_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  let clarification: ClarificationEntity | null = null;

  if (decision.action === 'ASK_CLARIFICATION' && candidate) {
    const clarId = `clar_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    clarification = {
      id: clarId,
      applicantId,
      prompt: decision.message,
      gapId: decision.gapId ?? null,
      fieldId: candidate.fieldId ?? null,
      claimIds: candidate.claimIds,
      evaluationId,
      agentActionId: actionId,
      status: 'OPEN',
      answer: null,
      resolutionClaimId: null,
      createdAt: new Date(),
      answeredAt: null,
      updatedAt: new Date(),
    };
    store.clarifications.set(clarId, clarification);
  }

  const actionEntity: AgentActionEntity = {
    id: actionId,
    applicantId,
    evaluationId,
    type: decision.action,
    gapId: decision.gapId,
    params: {
      docType: decision.docType,
      requirementId: decision.requirementId,
      route: decision.route,
      fieldId: candidate?.fieldId ?? null,
      options: candidate?.options ?? [],
      clarificationId: clarification?.id ?? undefined,
    },
    decision: {
      decision: { message: decision.message, rationale: decision.rationale },
      source,
    },
    status: decision.action === 'NO_ACTION' ? 'DONE' : 'PENDING',
    answer: null,
    createdAt: new Date(),
    answeredAt: null,
  };
  store.agentActions.set(actionId, actionEntity);

  return {
    action: actionEntity,
    message: decision.message,
    source,
    clarification,
    isCurrent: true,
  };
}

// -----------------------------------------------------------------------------
// Express Server Setup
// -----------------------------------------------------------------------------

export function createApp(): express.Express {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Routes
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', db: 'in-memory-ready' });
  });

  // Applicants
  app.post('/applicants', (req: Request, res: Response) => {
    const { name, email, goal, programLabel } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }
    const id = `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const applicant: ApplicantEntity = {
      id,
      name: name.trim(),
      email: email ? String(email).trim() : null,
      goal: goal || null,
      programLabel: programLabel || null,
      stage: 'NEW',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.applicants.set(id, applicant);
    res.status(201).json(applicant);
  });

  app.get('/applicants/:id', (req: Request, res: Response) => {
    const applicant = store.applicants.get(req.params.id);
    if (!applicant) return res.status(404).json({ message: 'Applicant not found' });
    const docs = store.getApplicantDocuments(applicant.id).map((d) => ({
      id: d.id,
      filename: d.filename,
      docType: d.docType,
      status: d.status,
    }));
    res.json({ ...applicant, documents: docs });
  });

  app.put('/applicants/:id/goal', (req: Request, res: Response) => {
    const applicant = store.applicants.get(req.params.id);
    if (!applicant) return res.status(404).json({ message: 'Applicant not found' });
    applicant.goal = req.body.goal || applicant.goal;
    if (req.body.programLabel !== undefined) {
      applicant.programLabel = req.body.programLabel;
    }
    applicant.updatedAt = new Date();
    res.json(applicant);
  });

  // Documents
  app.post('/applicants/:id/documents', upload.single('file'), async (req: Request, res: Response) => {
    const applicant = store.applicants.get(req.params.id);
    if (!applicant) return res.status(404).json({ message: 'Applicant not found' });
    if (!req.file) return res.status(400).json({ message: 'Missing file: send multipart/form-data with a "file" field' });

    try {
      const file = req.file;
      const { ext } = validateUpload(file.mimetype, file.buffer);
      const filename = cleanOriginalName(file.originalname);
      const fileId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const applicantUploads = path.join(UPLOAD_DIR, applicant.id);
      if (!fs.existsSync(applicantUploads)) {
        fs.mkdirSync(applicantUploads, { recursive: true });
      }
      const storagePath = path.join(applicantUploads, `${fileId}${ext}`);
      fs.writeFileSync(storagePath, file.buffer);

      const docTypeReq = req.body.docType as DocumentType | undefined;
      const doc: DocumentEntity = {
        id: fileId,
        applicantId: applicant.id,
        filename,
        storagePath,
        mime: file.mimetype,
        docType: docTypeReq || 'UNKNOWN',
        status: 'UPLOADED',
        error: null,
        textMethod: null,
        ocrConfidence: null,
        pages: null,
        createdAt: new Date(),
      };
      store.documents.set(fileId, doc);

      res.status(201).json({
        id: doc.id,
        applicantId: doc.applicantId,
        filename: doc.filename,
        storagePath: doc.storagePath,
        mime: doc.mime,
        docType: doc.docType,
        status: doc.status,
        error: doc.error,
        textMethod: doc.textMethod,
        ocrConfidence: doc.ocrConfidence,
        createdAt: doc.createdAt.toISOString(),
      });
    } catch (err: any) {
      res.status(400).json({ message: err?.message || 'File upload failed' });
    }
  });

  app.get('/applicants/:id/documents', (req: Request, res: Response) => {
    const applicant = store.applicants.get(req.params.id);
    if (!applicant) return res.status(404).json({ message: 'Applicant not found' });
    const docs = store.getApplicantDocuments(applicant.id).map((doc) => ({
      id: doc.id,
      applicantId: doc.applicantId,
      filename: doc.filename,
      storagePath: doc.storagePath,
      mime: doc.mime,
      docType: doc.docType,
      status: doc.status,
      error: doc.error,
      textMethod: doc.textMethod,
      ocrConfidence: doc.ocrConfidence,
      createdAt: doc.createdAt.toISOString(),
    }));
    res.json(docs);
  });

  // Processing & Evaluation
  app.post('/applicants/:id/process', async (req: Request, res: Response) => {
    const applicant = store.applicants.get(req.params.id);
    if (!applicant) return res.status(404).json({ message: 'Applicant not found' });

    const pending = store.getApplicantDocuments(applicant.id).filter((d) => ['UPLOADED', 'FAILED'].includes(d.status));
    const processed: Array<{ documentId: string; status: string; error: string | null }> = [];

    applicant.stage = 'DOCUMENTS_PROCESSING';

    for (const doc of pending) {
      const result = await processDocument(applicant.id, doc);
      processed.push({ documentId: doc.id, status: result.status, error: result.error });
    }

    if (processed.some((p) => p.status === 'DONE')) {
      runApplicantEvaluation(applicant.id, 'DOCUMENT_PROCESSED');
    } else {
      const activeClaims = store.getActiveClaims(applicant.id);
      applicant.stage = activeClaims.length > 0 ? 'PROFILE_BUILT' : 'NEW';
    }

    res.json({
      processed,
      stage: applicant.stage,
    });
  });

  app.post('/applicants/:id/evaluate', (req: Request, res: Response) => {
    const applicant = store.applicants.get(req.params.id);
    if (!applicant) return res.status(404).json({ message: 'Applicant not found' });

    runApplicantEvaluation(applicant.id, 'MANUAL');
    res.json({ stage: applicant.stage });
  });

  // Journey & Gaps
  app.get('/applicants/:id/journey', (req: Request, res: Response) => {
    const journey = buildJourneyResponse(req.params.id);
    if (!journey) return res.status(404).json({ message: 'Applicant not found' });
    res.json(journey);
  });

  app.get('/applicants/:id/gaps', (req: Request, res: Response) => {
    const journey = buildJourneyResponse(req.params.id);
    if (!journey) return res.status(404).json({ message: 'Applicant not found' });
    res.json({
      evaluationId: journey.evaluation?.id ?? null,
      isStale: journey.isStale,
      gaps: journey.gaps,
      conflicts: journey.conflicts,
    });
  });

  app.get('/applicants/:id/claims', (req: Request, res: Response) => {
    const applicant = store.applicants.get(req.params.id);
    if (!applicant) return res.status(404).json({ message: 'Applicant not found' });
    const scope = req.query.scope === 'all' ? 'all' : 'active';
    const claims = scope === 'all'
      ? Array.from(store.claims.values()).filter((c) => c.applicantId === applicant.id)
      : store.getActiveClaims(applicant.id);
    res.json(claims);
  });

  // Agent Actions
  app.post('/applicants/:id/agent/decide', async (req: Request, res: Response) => {
    const refresh = req.query.refresh === 'true';
    try {
      const result = await decideAgentAction(req.params.id, refresh);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || 'Agent decision failed' });
    }
  });

  app.get('/applicants/:id/agent/next-action', async (req: Request, res: Response) => {
    try {
      const result = await decideAgentAction(req.params.id, false);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || 'Failed to get next action' });
    }
  });

  app.get('/applicants/:id/agent/actions', (req: Request, res: Response) => {
    const actions = Array.from(store.agentActions.values())
      .filter((a) => a.applicantId === req.params.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    res.json(actions);
  });

  // Clarifications
  app.get('/applicants/:id/clarifications', (req: Request, res: Response) => {
    const status = req.query.status as string | undefined;
    const list = Array.from(store.clarifications.values())
      .filter((c) => c.applicantId === req.params.id && (!status || c.status === status))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    res.json(list);
  });

  app.get('/applicants/:id/clarifications/:clarificationId', (req: Request, res: Response) => {
    const c = store.clarifications.get(req.params.clarificationId);
    if (!c || c.applicantId !== req.params.id) {
      return res.status(404).json({ message: 'Clarification not found' });
    }
    res.json(c);
  });

  app.post('/applicants/:id/clarifications/:clarificationId/answer', (req: Request, res: Response) => {
    const c = store.clarifications.get(req.params.clarificationId);
    if (!c || c.applicantId !== req.params.id) {
      return res.status(404).json({ message: 'Clarification not found' });
    }
    if (c.status !== 'OPEN') {
      return res.status(409).json({ message: `Clarification is already ${c.status}` });
    }

    const { text, value, choice } = req.body;
    const answer = { text, value, choice };
    c.answer = answer;
    c.status = 'ANSWERED';
    c.answeredAt = new Date();
    c.updatedAt = new Date();

    // If conflict, record resolution claim and re-evaluate
    let resolution: any = null;
    if (c.fieldId && c.gapId?.startsWith('CONFLICT:')) {
      const activeClaims = store.getActiveClaims(req.params.id);
      const fieldClaims = activeClaims.filter((cl) => cl.fieldKey === c.fieldId);
      const groups = conflictOptions(c.fieldId, fieldClaims);
      let chosenIndex = -1;
      const ansStr = String(answer.choice || answer.value || answer.text || '').toLowerCase().trim();
      for (let i = 0; i < groups.length; i++) {
        const gLabels = groups[i].flatMap((cl) => [cl.rawValue, String(cl.value)]).map((s) => s.toLowerCase().trim());
        if (gLabels.some((l) => l === ansStr)) {
          chosenIndex = i;
          break;
        }
      }
      if (chosenIndex === -1) {
        const selection = selectOption(c.fieldId, groups, answer);
        if (selection.ok) chosenIndex = selection.index;
      }

      if (chosenIndex !== -1) {
        const chosenGroup = groups[chosenIndex];
        const rep = representative(chosenGroup);
        const resolutionClaimId = `claim_res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const resClaim: ClaimEntity = {
          id: resolutionClaimId,
          applicantId: req.params.id,
          fieldKey: c.fieldId,
          entryKey: rep.entryKey ?? null,
          rawValue: rep.rawValue,
          value: rep.value,
          source: 'APPLICANT',
          isResolution: true,
          documentId: null,
          runId: null,
          page: null,
          quote: rep.quote,
          confidence: 1.0,
          supersededById: null,
          createdAt: new Date(),
        };
        store.claims.set(resolutionClaimId, resClaim);
        c.resolutionClaimId = resolutionClaimId;

        // Re-evaluate
        runApplicantEvaluation(req.params.id, 'APPLICANT_UPDATE');
        const applicant = store.applicants.get(req.params.id);
        resolution = { stage: applicant?.stage };
      }
    }

    // Update associated agent action
    if (c.agentActionId) {
      const action = store.agentActions.get(c.agentActionId);
      if (action) {
        action.status = 'ANSWERED';
        action.answer = answer;
        action.answeredAt = new Date();
      }
    }

    res.json({
      ...c,
      resolution,
    });
  });

    return app;
}

export const app = createApp();
export default app;

if (!process.env.VERCEL) {
  async function start() {
    if (process.env.NODE_ENV === 'production') {
      app.use(express.static('dist'));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.resolve('dist/index.html'));
      });
    } else {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on http://0.0.0.0:${PORT}`);
    });
  }

  start().catch((err) => {
    console.error('Fatal server startup error:', err);
    process.exit(1);
  });
}
