// Stage 5 end-to-end: real PostgreSQL, real fictional Arjun Mehta PDFs, scripted stand-in for Claude.
// The agent's only state source is JourneyService; it never edits claims or evaluations.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import request from 'supertest';
import { JourneyService } from '../journey/journey.service';
import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { makeTextPdf } from '../testing/pdf-fixtures';
import { ScriptedLlm, defaultAgentReply } from '../testing/scripted-llm';

const FIXTURES = path.resolve(__dirname, '../../test-fixtures/arjun');
const CV = '01_Arjun_Mehta_CV.pdf';
const DEGREE = '02_Arjun_Mehta_Degree_Certificate.pdf';
const TRANSCRIPT = '03_Arjun_Mehta_Academic_Transcript.pdf';
const LANGUAGE = '04_Arjun_Mehta_Language_Certificate.pdf';
const EXPERIENCE = '05_Arjun_Mehta_Experience_Letter.pdf';
const SOP = '06_Arjun_Mehta_Statement_of_Purpose.pdf';
const ALL = [CV, DEGREE, TRANSCRIPT, LANGUAGE, EXPERIENCE, SOP];
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

describe('Agent: next best action (real PostgreSQL, real Arjun PDFs, scripted Claude)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let journey: JourneyService;
  let uploadDir: string;
  let llm: ScriptedLlm;
  const created: string[] = [];

  beforeAll(async () => {
    uploadDir = mkdtempSync(path.join(tmpdir(), 'agent-uploads-'));
    process.env.UPLOAD_DIR = uploadDir;
    const { AppModule } = await import('../app.module');
    llm = new ScriptedLlm();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(LlmService).useValue(llm).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    journey = app.get(JourneyService);
  });

  beforeEach(() => {
    llm.configured = true;
    llm.extra = {};
    llm.override = {};
    llm.calls = [];
    llm.agentContexts = [];
    llm.agentHandler = undefined;
    llm.agentError = undefined;
  });
  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await prisma.applicant.deleteMany({ where: { id: { in: created } } });
    await app.close();
    rmSync(uploadDir, { recursive: true, force: true });
  });

  const http = () => request(app.getHttpServer());
  const agentCalls = () => llm.calls.filter((c) => c.kind === 'agent').length;

  async function newApplicant() {
    const res = await http().post('/applicants').send({ name: 'Arjun Mehta', goal: "Master's in Computer Science in Germany" }).expect(201);
    created.push(res.body.id);
    return res.body.id as string;
  }
  async function upload(applicantId: string, filename: string, buffer: Buffer) {
    const res = await http().post(`/applicants/${applicantId}/documents`).attach('file', buffer, { filename, contentType: 'application/pdf' }).expect(201);
    return res.body.id as string;
  }
  const uploadFixture = (applicantId: string, name: string) => upload(applicantId, name, readFileSync(path.join(FIXTURES, name)));
  async function applicantWith(files: string[]) {
    const applicantId = await newApplicant();
    for (const f of files) await uploadFixture(applicantId, f);
    await http().post(`/applicants/${applicantId}/process`).expect(200);
    return applicantId;
  }
  /** Everything but the CV, plus a CV that says the degree was completed in 2024. */
  async function conflictingApplicant(omit: string[] = []) {
    const applicantId = await applicantWith(ALL.filter((f) => f !== CV && !omit.includes(f)));
    await upload(applicantId, 'cv_2024.pdf', makeTextPdf(['CURRICULUM VITAE', 'Arjun Mehta', 'Graduation year: 2024']));
    llm.override['cv_2024.pdf'] = {
      documentType: 'CV',
      claims: [{ fieldKey: 'degree.graduationYear', rawValue: '2024', quote: 'Graduation year: 2024' }],
    };
    await http().post(`/applicants/${applicantId}/process`).expect(200);
    return applicantId;
  }
  /** Every required document present, but the CGPA is 6.20 (below the DEMO minimum of 7.0). */
  async function lowGpaApplicant() {
    const applicantId = await newApplicant();
    const claims = (title: string, extra: Array<[string, string, string]> = []) => ({
      documentType: title,
      claims: [
        { fieldKey: 'degree.level', rawValue: 'Bachelor of Technology', quote: 'Bachelor of Technology in Computer Science and Engineering' },
        { fieldKey: 'degree.field', rawValue: 'Computer Science and Engineering', quote: 'Bachelor of Technology in Computer Science and Engineering' },
        { fieldKey: 'degree.cgpa', rawValue: '6.20 / 10.00', quote: 'Final CGPA 6.20 / 10.00' },
        ...extra.map(([fieldKey, rawValue, quote]) => ({ fieldKey, rawValue, quote })),
      ],
    });
    for (const [file, title, doc] of [['cv_low.pdf', 'CURRICULUM VITAE', 'CV'], ['degree_low.pdf', 'DEGREE CERTIFICATE', 'DEGREE'], ['transcript_low.pdf', 'ACADEMIC TRANSCRIPT', 'TRANSCRIPT']] as const) {
      await upload(applicantId, file, makeTextPdf([title, 'Arjun Mehta', 'Bachelor of Technology in Computer Science and Engineering', 'Final CGPA 6.20 / 10.00']));
      llm.override[file] = claims(doc);
    }
    await uploadFixture(applicantId, LANGUAGE);
    await http().post(`/applicants/${applicantId}/process`).expect(200);
    return applicantId;
  }

  const decide = (applicantId: string, query = '') => http().post(`/applicants/${applicantId}/agent/decide${query}`).expect(200);

  describe('each situation picks the right single action', () => {
    it('missing required document -> REQUEST_DOCUMENT, persisted as a PENDING AgentAction', async () => {
      const applicantId = await applicantWith(ALL.filter((f) => f !== LANGUAGE));
      const evaluation = (await http().get(`/applicants/${applicantId}/evaluations/latest`).expect(200)).body;

      const res = await decide(applicantId);
      expect(res.body).toMatchObject({ source: 'LLM', reused: false, clarification: null });
      expect(res.body.action).toMatchObject({
        applicantId,
        type: 'REQUEST_DOCUMENT',
        status: 'PENDING',
        gapId: 'MISSING_DOC:LANGUAGE_CERT',
        evaluationId: evaluation.id,
        params: { docType: 'LANGUAGE_CERT' },
      });
      expect(res.body.action.decision).toMatchObject({
        source: 'LLM',
        model: 'scripted-test-model',
        violations: [],
        candidates: ['MISSING_DOC:LANGUAGE_CERT'],
        decision: { action: 'REQUEST_DOCUMENT', docType: 'LANGUAGE_CERT', gapId: 'MISSING_DOC:LANGUAGE_CERT' },
      });
      expect(res.body.message).toMatch(/upload your language certificate/i);

      const row = await prisma.agentAction.findUniqueOrThrow({ where: { id: res.body.action.id } });
      expect(row).toMatchObject({ type: 'REQUEST_DOCUMENT', status: 'PENDING', evaluationId: evaluation.id });
    });

    it('conflict -> ASK_CLARIFICATION, ranked above a missing document', async () => {
      const applicantId = await conflictingApplicant([LANGUAGE]); // conflict AND missing certificate
      const res = await decide(applicantId);
      expect(res.body.action).toMatchObject({ type: 'ASK_CLARIFICATION', gapId: 'CONFLICT:degree.graduationYear', status: 'PENDING' });
      // the model saw both candidates, conflict first, and nothing else
      expect(llm.agentContexts[0].candidates.map((c: any) => c.kind)).toEqual(['CONFLICT', 'MISSING_DOC']);
    });

    it('unmet mandatory requirement -> SHOW_MISSING_REQUIREMENT', async () => {
      const applicantId = await lowGpaApplicant();
      const res = await decide(applicantId);
      expect(res.body.action).toMatchObject({ type: 'SHOW_MISSING_REQUIREMENT', gapId: null, params: { requirementId: 'gpa-min' } });
      expect(res.body.message).toMatch(/DEMO/);
      expect(res.body.action.decision.decision.requirementId).toBe('gpa-min');
    });

    it('ready applicant -> RECOMMEND_NEXT_STEP on the STUDY route', async () => {
      const applicantId = await applicantWith(ALL);
      const res = await decide(applicantId);
      expect(res.body.action).toMatchObject({ type: 'RECOMMEND_NEXT_STEP', status: 'PENDING', params: { route: 'STUDY' } });
      expect(res.body.message).toMatch(/DEMO/);
    });
  });

  describe('clarification creation and linking', () => {
    it('creates one clarification after validation, linked to the action, gap, field, evaluation and claims', async () => {
      const applicantId = await conflictingApplicant();
      const evaluation = (await http().get(`/applicants/${applicantId}/evaluations/latest`).expect(200)).body;
      const res = await decide(applicantId);

      const q = res.body.clarification;
      expect(q).toMatchObject({
        applicantId,
        status: 'OPEN',
        gapId: 'CONFLICT:degree.graduationYear',
        fieldId: 'degree.graduationYear',
        evaluationId: evaluation.id,
        agentActionId: res.body.action.id,
        prompt: res.body.message,
      });
      expect(q.claimIds.length).toBeGreaterThanOrEqual(2);
      // the stored conflict options come from the gap, not from the model
      expect(res.body.action.params.options.map((o: any) => o.value).sort()).toEqual([2024, 2025]);
      expect(res.body.action.params.clarificationId).toBe(q.id);

      const rows = await prisma.clarification.findMany({ where: { applicantId } });
      expect(rows).toHaveLength(1);
      expect(rows[0].agentActionId).toBe(res.body.action.id);
      expect((await http().get(`/applicants/${applicantId}/journey`).expect(200)).body.clarifications.open).toBe(1);
    });

    it('creates no clarification when the decision is rejected for the wrong action', async () => {
      const applicantId = await conflictingApplicant();
      llm.agentHandler = (ctx) => ({ ...defaultAgentReply(ctx), action: 'REQUEST_DOCUMENT', docType: 'LANGUAGE_CERT' });
      const res = await decide(applicantId);
      expect(res.body.source).toBe('FALLBACK');
      expect(res.body.action.decision.violations).toContain('ACTION_NOT_ALLOWED_FOR_CANDIDATE');
      // the fallback still asks the (valid) conflict question, once
      expect(await prisma.clarification.count({ where: { applicantId } })).toBe(1);
    });

    it('is not asked twice; once the applicant answers, the conflict is resolved and the agent moves on', async () => {
      const applicantId = await conflictingApplicant();
      const first = await decide(applicantId);
      const again = await decide(applicantId);
      expect(again.body.reused).toBe(true);
      expect(again.body.action.id).toBe(first.body.action.id);
      expect(await prisma.clarification.count({ where: { applicantId } })).toBe(1);
      expect(agentCalls()).toBe(1);

      const answered = await http().post(`/applicants/${applicantId}/clarifications/${first.body.clarification.id}/answer`).send({ value: 2025, text: 'It is 2025' }).expect(201);
      expect(answered.body.resolution.claim).toMatchObject({ isResolution: true, source: 'APPLICANT', rawValue: '2025' });

      // the action that waited for the answer is settled, with its history kept
      const old = await prisma.agentAction.findUniqueOrThrow({ where: { id: first.body.action.id } });
      expect(old.status).toBe('ANSWERED');
      expect(old.answer).toMatchObject({ value: 2025 });
      expect((await http().get(`/applicants/${applicantId}/gaps`).expect(200)).body.conflicts).toEqual([]);

      // the next decision is based on the new evaluation: nothing left to resolve, so the applicant is ready
      const after = await decide(applicantId);
      expect(after.body.action).toMatchObject({ type: 'RECOMMEND_NEXT_STEP', status: 'PENDING' });
      expect(agentCalls()).toBe(2);
    });
  });

  describe('idempotency and supersession', () => {
    it('returns the pending decision for an unchanged evaluation without calling the model again', async () => {
      const applicantId = await applicantWith(ALL.filter((f) => f !== LANGUAGE));
      const first = await decide(applicantId);
      const second = await decide(applicantId);
      expect(second.body).toMatchObject({ reused: true });
      expect(second.body.action.id).toBe(first.body.action.id);
      expect(agentCalls()).toBe(1);
      expect(await prisma.agentAction.count({ where: { applicantId } })).toBe(1);

      const next = await http().get(`/applicants/${applicantId}/agent/next-action`).expect(200);
      expect(next.body).toMatchObject({ isCurrent: true, message: first.body.message });
      expect(next.body.action.id).toBe(first.body.action.id);
      expect(agentCalls()).toBe(1); // reading never calls the model
    });

    it('refresh=true decides again and supersedes the old action', async () => {
      const applicantId = await applicantWith(ALL.filter((f) => f !== LANGUAGE));
      const first = await decide(applicantId);
      const second = await decide(applicantId, '?refresh=true');
      expect(second.body.reused).toBe(false);
      expect(second.body.action.id).not.toBe(first.body.action.id);
      expect((await prisma.agentAction.findUniqueOrThrow({ where: { id: first.body.action.id } })).status).toBe('SUPERSEDED');
      expect(await prisma.agentAction.count({ where: { applicantId, status: 'PENDING' } })).toBe(1);
    });

    it('the next action changes when the evidence changes: missing certificate -> uploaded -> ready', async () => {
      const applicantId = await applicantWith(ALL.filter((f) => f !== LANGUAGE));
      const first = await decide(applicantId);
      expect(first.body.action.type).toBe('REQUEST_DOCUMENT');

      const langId = await uploadFixture(applicantId, LANGUAGE);
      // new document uploaded but not evaluated yet: the agent does not guess
      const waiting = await decide(applicantId);
      expect(waiting.body.action.type).toBe('NO_ACTION');
      expect(waiting.body.message).toMatch(/re-evaluate/);

      await http().post(`/applicants/${applicantId}/documents/${langId}/process`).expect(200);
      const ready = await decide(applicantId);
      expect(ready.body.action).toMatchObject({ type: 'RECOMMEND_NEXT_STEP', status: 'PENDING' });
      expect((await prisma.agentAction.findUniqueOrThrow({ where: { id: first.body.action.id } })).status).toBe('SUPERSEDED');

      const history = (await http().get(`/applicants/${applicantId}/agent/actions`).expect(200)).body;
      expect(history.map((a: any) => a.type)).toEqual(['RECOMMEND_NEXT_STEP', 'NO_ACTION', 'REQUEST_DOCUMENT']);
      expect((await http().get(`/applicants/${applicantId}/agent/next-action`).expect(200)).body.action.id).toBe(ready.body.action.id);
    });

    it('does nothing for an applicant who has not been evaluated, without calling the model, and does not repeat itself', async () => {
      const applicantId = await newApplicant();
      const a = await decide(applicantId);
      expect(a.body.action).toMatchObject({ type: 'NO_ACTION', status: 'DONE', evaluationId: null });
      expect(a.body.source).toBe('RULES');
      const b = await decide(applicantId);
      expect(b.body.action.id).toBe(a.body.action.id);
      expect(llm.calls).toEqual([]);
      expect((await http().get(`/applicants/${applicantId}/agent/next-action`).expect(200)).body.action).toBeNull();
    });
  });

  describe('fallback when Claude is unavailable or wrong', () => {
    it('uses the deterministic fallback when the API key is missing', async () => {
      const applicantId = await applicantWith(ALL.filter((f) => f !== LANGUAGE));
      llm.configured = false;
      const res = await decide(applicantId);
      expect(res.body.source).toBe('FALLBACK');
      expect(res.body.action).toMatchObject({ type: 'REQUEST_DOCUMENT', gapId: 'MISSING_DOC:LANGUAGE_CERT', status: 'PENDING' });
      expect(res.body.action.decision).toMatchObject({ source: 'FALLBACK', fallbackReason: 'LLM_UNAVAILABLE', model: null });
    });

    it('falls back when the model call fails', async () => {
      const applicantId = await applicantWith(ALL.filter((f) => f !== LANGUAGE));
      llm.agentError = new Error('network down');
      const res = await decide(applicantId);
      expect(res.body.source).toBe('FALLBACK');
      expect(res.body.action.decision.fallbackReason).toBe('LLM_ERROR:Error');
    });

    it.each([
      ['an invalid gap id', (c: any) => ({ ...defaultAgentReply(c), gapId: 'MISSING_DOC:PASSPORT' }), 'GAP_NOT_A_CANDIDATE'],
      ['an action not allowed for the gap', (c: any) => ({ ...defaultAgentReply(c), action: 'ASK_CLARIFICATION', docType: null }), 'ACTION_NOT_ALLOWED_FOR_CANDIDATE'],
      ['a document that is already present', (c: any) => ({ ...defaultAgentReply(c), docType: 'CV' }), 'DOCUMENT_ALREADY_PRESENT'],
      ['an unsupported route', (c: any) => ({ ...defaultAgentReply(c), route: 'ABROAD' }), 'UNSUPPORTED_ROUTE'],
      ['a hallucinated requirement', (c: any) => ({ ...defaultAgentReply(c), requirementId: 'german-b2' }), 'UNKNOWN_REQUIREMENT'],
      ['an already satisfied requirement', (c: any) => ({ ...defaultAgentReply(c), requirementId: 'gpa-min' }), 'REQUIREMENT_ALREADY_SATISFIED'],
      ['an invalid evidence reference', (c: any) => ({ ...defaultAgentReply(c), evidenceRefs: ['made-up-claim'] }), 'UNKNOWN_EVIDENCE_REF'],
      ['an invented number', (c: any) => ({ ...defaultAgentReply(c), message: 'Upload it within 14 days.' }), 'UNSUPPORTED_NUMBER:14'],
      ['malformed output', () => 'not an object', 'MALFORMED_OUTPUT'],
    ])('rejects %s, stores the violation and the rejected output, and uses the fallback', async (_name, handler, violation) => {
      const applicantId = await applicantWith(ALL.filter((f) => f !== LANGUAGE));
      llm.agentHandler = handler;
      const res = await decide(applicantId);
      expect(res.body.source).toBe('FALLBACK');
      expect(res.body.action).toMatchObject({ type: 'REQUEST_DOCUMENT', gapId: 'MISSING_DOC:LANGUAGE_CERT' });
      expect(res.body.action.decision.fallbackReason).toBe('GUARDRAIL_VIOLATION');
      expect(res.body.action.decision.violations).toContain(violation);
      expect(res.body.action.decision.rejectedOutput).toBeDefined();
    });
  });

  describe('JourneyService is the source of state, and the agent is read-only', () => {
    it('builds the model input from JourneyService.get, not from documents', async () => {
      const applicantId = await applicantWith(ALL.filter((f) => f !== LANGUAGE));
      const spy = jest.spyOn(journey, 'get');
      await decide(applicantId);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(applicantId);
      const state = await spy.mock.results[0].value;
      const ctx = llm.agentContexts[0];
      expect(ctx.readiness.score).toBe(state.evaluation.score);
      expect(state.gaps.map((g: any) => g.id)).toContain(ctx.candidates[0].gapId);
      expect(ctx.candidates[0]).toMatchObject({ action: 'REQUEST_DOCUMENT', docType: 'LANGUAGE_CERT' });
      expect(ctx.requirements).toHaveLength(state.evaluation.requirements.length);
      expect(ctx.routes.labels).toEqual(['STUDY', 'VOCATIONAL_TRAINING', 'EMPLOYMENT']);
      // no raw document text reaches the model
      expect(JSON.stringify(ctx)).not.toMatch(/FICTIONAL APPLICANT|NOT AN OFFICIAL CREDENTIAL/);
    });

    it('never changes claims, evaluations or documents', async () => {
      const applicantId = await conflictingApplicant();
      const snapshot = async () => ({
        claims: await prisma.claim.count({ where: { applicantId } }),
        evaluations: await prisma.evaluation.count({ where: { applicantId } }),
        runs: await prisma.documentRun.count({ where: { document: { applicantId } } }),
        stage: (await prisma.applicant.findUniqueOrThrow({ where: { id: applicantId } })).stage,
      });
      const before = await snapshot();
      await decide(applicantId);
      await decide(applicantId, '?refresh=true');
      expect(await snapshot()).toEqual(before);
    });

    it('404s for unknown applicants', async () => {
      await http().post(`/applicants/${MISSING_ID}/agent/decide`).expect(404);
      await http().get(`/applicants/${MISSING_ID}/agent/next-action`).expect(404);
      await http().get(`/applicants/${MISSING_ID}/agent/actions`).expect(404);
    });
  });
});
