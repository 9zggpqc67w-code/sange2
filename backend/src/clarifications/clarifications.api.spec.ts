// Stage 6: clarification answer -> resolution claim -> re-evaluation. Real PostgreSQL, real
// fictional Arjun Mehta PDFs, scripted stand-in for Claude (no live provider is called).
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import request from 'supertest';
import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { makeTextPdf } from '../testing/pdf-fixtures';
import { ScriptedLlm } from '../testing/scripted-llm';
import { EvaluationService } from '../workflow/evaluation.service';
import { ClarificationsService } from './clarifications.service';

const FIXTURES = path.resolve(__dirname, '../../test-fixtures/arjun');
const ALL = [
  '01_Arjun_Mehta_CV.pdf',
  '02_Arjun_Mehta_Degree_Certificate.pdf',
  '03_Arjun_Mehta_Academic_Transcript.pdf',
  '04_Arjun_Mehta_Language_Certificate.pdf',
  '05_Arjun_Mehta_Experience_Letter.pdf',
  '06_Arjun_Mehta_Statement_of_Purpose.pdf',
];
const GAP = 'CONFLICT:degree.graduationYear';

describe('Conflict clarification -> resolution claim -> re-evaluation (real PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let evaluations: EvaluationService;
  let clarifications: ClarificationsService;
  let uploadDir: string;
  let llm: ScriptedLlm;
  const created: string[] = [];

  beforeAll(async () => {
    uploadDir = mkdtempSync(path.join(tmpdir(), 'clarif-uploads-'));
    process.env.UPLOAD_DIR = uploadDir;
    const { AppModule } = await import('../app.module');
    llm = new ScriptedLlm();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(LlmService).useValue(llm).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    evaluations = app.get(EvaluationService);
    clarifications = app.get(ClarificationsService);
  });
  beforeEach(() => {
    llm.configured = true;
    llm.override = {};
    llm.agentContexts = [];
    llm.agentHandler = undefined;
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await prisma.applicant.deleteMany({ where: { id: { in: created } } });
    await app.close();
    rmSync(uploadDir, { recursive: true, force: true });
  });

  const http = () => request(app.getHttpServer());

  async function newApplicant() {
    const res = await http().post('/applicants').send({ name: 'Arjun Mehta' }).expect(201);
    created.push(res.body.id);
    return res.body.id as string;
  }
  async function upload(applicantId: string, filename: string, buffer: Buffer) {
    await http().post(`/applicants/${applicantId}/documents`).attach('file', buffer, { filename, contentType: 'application/pdf' }).expect(201);
  }

  /** The degree says 2025 (as do the transcript and SOP); a CV says 2024. The agent then asks which is right. */
  async function conflictScenario() {
    const applicantId = await newApplicant();
    for (const f of ALL.filter((x) => !x.startsWith('01_'))) await upload(applicantId, f, readFileSync(path.join(FIXTURES, f)));
    await upload(applicantId, 'cv_2024.pdf', makeTextPdf(['CURRICULUM VITAE', 'Arjun Mehta', 'Graduation year: 2024']));
    llm.override['cv_2024.pdf'] = { documentType: 'CV', claims: [{ fieldKey: 'degree.graduationYear', rawValue: '2024', quote: 'Graduation year: 2024' }] };
    await http().post(`/applicants/${applicantId}/process`).expect(200);

    const decided = (await http().post(`/applicants/${applicantId}/agent/decide`).expect(200)).body;
    expect(decided.action.type).toBe('ASK_CLARIFICATION');
    return { applicantId, clarificationId: decided.clarification.id as string, actionId: decided.action.id as string };
  }
  const answer = (applicantId: string, id: string, body: object) => http().post(`/applicants/${applicantId}/clarifications/${id}/answer`).send(body);
  const counts = async (applicantId: string) => ({
    claims: await prisma.claim.count({ where: { applicantId } }),
    resolutions: await prisma.claim.count({ where: { applicantId, isResolution: true } }),
    evaluations: await prisma.evaluation.count({ where: { applicantId } }),
  });

  describe('a conflict answer that matches an existing option', () => {
    it('creates one resolution claim, links it, re-evaluates, resolves the conflict and updates the stage', async () => {
      const { applicantId, clarificationId, actionId } = await conflictScenario();
      const before = await counts(applicantId);
      const conflicted = (await http().get(`/applicants/${applicantId}/evaluations/latest`).expect(200)).body;
      expect(conflicted).toMatchObject({ outcome: 'ACTION_REQUIRED' });
      expect((await http().get(`/applicants/${applicantId}/journey`).expect(200)).body.stage).toBe('ACTION_REQUIRED');

      const res = await answer(applicantId, clarificationId, { value: 2025, text: 'The degree certificate is right' }).expect(201);

      // the answered clarification keeps its familiar top-level shape ...
      expect(res.body).toMatchObject({ id: clarificationId, status: 'ANSWERED', answer: { value: 2025 } });
      expect(res.body.answeredAt).toEqual(expect.any(String));
      // ... plus the resolution
      const { claim, evaluation, stage } = res.body.resolution;
      expect(claim).toMatchObject({ fieldKey: 'degree.graduationYear', entryKey: null, rawValue: '2025', value: 2025, source: 'APPLICANT', isResolution: true });
      expect(res.body.resolutionClaimId).toBe(claim.id);

      const row = await prisma.claim.findUniqueOrThrow({ where: { id: claim.id } });
      expect(row).toMatchObject({ applicantId, source: 'APPLICANT', isResolution: true, documentId: null, runId: null, page: null, quote: null, confidence: null, supersededById: null });
      expect((await prisma.clarification.findUniqueOrThrow({ where: { id: clarificationId } })).resolutionClaimId).toBe(claim.id);

      // a new immutable evaluation snapshot, and the stage moved on
      expect(await counts(applicantId)).toEqual({ claims: before.claims + 1, resolutions: 1, evaluations: before.evaluations + 1 });
      expect(evaluation).toMatchObject({ trigger: 'MANUAL', outcome: 'READY', verdict: 'READY' });
      expect(evaluation.id).not.toBe(conflicted.id);
      expect(evaluation.summary.changes.closedGapIds).toContain(GAP);
      expect(stage).toBe('READY');
      expect((await prisma.applicant.findUniqueOrThrow({ where: { id: applicantId } })).stage).toBe('READY');

      // the journey shows the conflict as settled by the applicant's choice
      const journey = (await http().get(`/applicants/${applicantId}/journey`).expect(200)).body;
      expect(journey.conflicts).toEqual([]);
      expect(journey.isStale).toBe(false);
      expect(journey.profile.find((f: any) => f.id === 'degree.graduationYear')).toMatchObject({ state: 'DOCUMENT_SUPPORTED', value: 2025, resolved: true });

      // the old evaluation still shows the conflict, and still replays exactly
      const old = (await http().get(`/applicants/${applicantId}/evaluations/${conflicted.id}`).expect(200)).body;
      expect(old.gaps.map((g: any) => g.id)).toContain(GAP);
      expect((await http().get(`/applicants/${applicantId}/evaluations/${conflicted.id}/replay`).expect(200)).body.matches).toBe(true);

      // the agent action that was waiting for this answer is settled, not deleted
      const action = await prisma.agentAction.findUniqueOrThrow({ where: { id: actionId } });
      expect(action).toMatchObject({ status: 'ANSWERED' });
      expect(action.answer).toMatchObject({ value: 2025 });
      expect(action.answeredAt).not.toBeNull();
    });

    it('lets the applicant pick the other document value too (the CV is right)', async () => {
      const { applicantId, clarificationId } = await conflictScenario();
      const res = await answer(applicantId, clarificationId, { choice: '2024' }).expect(201);
      expect(res.body.resolution.claim).toMatchObject({ rawValue: '2024', value: 2024, isResolution: true });
      const field = (await http().get(`/applicants/${applicantId}/journey`).expect(200)).body.profile.find((f: any) => f.id === 'degree.graduationYear');
      expect(field).toMatchObject({ value: 2024, resolved: true });
      expect(res.body.resolution.evaluation.verdict).toBe('READY');
    });

    it('keeps the original conflicting document claims untouched, as history', async () => {
      const { applicantId, clarificationId } = await conflictScenario();
      const docClaimsBefore = await prisma.claim.findMany({ where: { applicantId, fieldKey: 'degree.graduationYear', source: 'DOCUMENT' }, orderBy: { id: 'asc' } });
      expect(docClaimsBefore.map((c) => c.rawValue).sort()).toEqual(['2024', '2025', '2025', '2025']);

      await answer(applicantId, clarificationId, { value: 2025 }).expect(201);

      const docClaimsAfter = await prisma.claim.findMany({ where: { applicantId, fieldKey: 'degree.graduationYear', source: 'DOCUMENT' }, orderBy: { id: 'asc' } });
      expect(docClaimsAfter).toEqual(docClaimsBefore); // unchanged: not edited, not superseded, not deleted
      expect(docClaimsAfter.every((c) => c.supersededById === null)).toBe(true);

      const all = (await http().get(`/applicants/${applicantId}/claims?scope=all`).expect(200)).body.filter((c: any) => c.fieldKey === 'degree.graduationYear');
      expect(all.map((c: any) => [c.source, c.isResolution, c.rawValue]).sort()).toEqual([
        ['APPLICANT', true, '2025'],
        ['DOCUMENT', false, '2024'],
        ['DOCUMENT', false, '2025'],
        ['DOCUMENT', false, '2025'],
        ['DOCUMENT', false, '2025'],
      ]);
      expect(all.every((c: any) => c.active)).toBe(true);
    });
  });

  describe('an answer that is not an existing option', () => {
    it.each([
      ['an invented value', { value: 2023 }, /existing options: 2025, 2024|existing options: 2024, 2025/],
      ['free text that names no option', { text: 'whatever you think is best' }, /existing options/],
      ['a sentence naming both options', { text: '2024 or 2025' }, /more than one option/],
    ])('is rejected with 400 for %s, leaving everything unchanged and the clarification OPEN', async (_n, body, message) => {
      const { applicantId, clarificationId, actionId } = await conflictScenario();
      const before = await counts(applicantId);

      const res = await answer(applicantId, clarificationId, body).expect(400);
      expect(res.body.message).toMatch(message);

      expect(await counts(applicantId)).toEqual(before);
      const row = await prisma.clarification.findUniqueOrThrow({ where: { id: clarificationId } });
      expect(row).toMatchObject({ status: 'OPEN', answer: null, answeredAt: null, resolutionClaimId: null });
      expect((await prisma.agentAction.findUniqueOrThrow({ where: { id: actionId } })).status).toBe('PENDING');
      expect((await http().get(`/applicants/${applicantId}/journey`).expect(200)).body.stage).toBe('ACTION_REQUIRED');

      // and a correct answer still works afterwards
      await answer(applicantId, clarificationId, { value: 2025 }).expect(201);
    });
  });

  describe('duplicate answers', () => {
    it('answering again creates no second claim and no second evaluation', async () => {
      const { applicantId, clarificationId } = await conflictScenario();
      await answer(applicantId, clarificationId, { value: 2025 }).expect(201);
      const after = await counts(applicantId);

      await answer(applicantId, clarificationId, { value: 2025 }).expect(409);
      await answer(applicantId, clarificationId, { value: 2024 }).expect(409);
      expect(await counts(applicantId)).toEqual(after);
    });

    it('two simultaneous answers produce exactly one resolution claim and one evaluation', async () => {
      const { applicantId, clarificationId } = await conflictScenario();
      const before = await counts(applicantId);
      const [a, b] = await Promise.all([answer(applicantId, clarificationId, { value: 2025 }), answer(applicantId, clarificationId, { value: 2025 })]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      expect(await counts(applicantId)).toEqual({ claims: before.claims + 1, resolutions: 1, evaluations: before.evaluations + 1 });
    });

    it('a clarification that already has a resolutionClaimId never gets another claim', async () => {
      const { applicantId, clarificationId } = await conflictScenario();
      const existing = await prisma.claim.create({
        data: { applicantId, fieldKey: 'degree.graduationYear', rawValue: '2025', value: 2025, source: 'APPLICANT', isResolution: true },
      });
      await prisma.clarification.update({ where: { id: clarificationId }, data: { resolutionClaimId: existing.id } });
      const before = await counts(applicantId);

      const res = await answer(applicantId, clarificationId, { value: 2025 }).expect(201);
      expect(res.body.resolutionClaimId).toBe(existing.id);
      expect(res.body.resolution).toBeNull();
      expect(await counts(applicantId)).toEqual(before);
    });
  });

  describe('clarifications that are not conflict resolutions behave as before', () => {
    it('an ordinary question only stores the answer: no claim, no evaluation, no stage change', async () => {
      const { applicantId } = await conflictScenario();
      const q = await clarifications.open({ applicantId, prompt: 'Anything else we should know?' });
      const before = await counts(applicantId);
      const stage = (await prisma.applicant.findUniqueOrThrow({ where: { id: applicantId } })).stage;

      const res = await answer(applicantId, q.id, { text: 'No, thanks', value: 2023 }).expect(201);
      expect(res.body).toMatchObject({ status: 'ANSWERED', answer: { text: 'No, thanks', value: 2023 }, resolution: null, resolutionClaimId: null });
      expect(await counts(applicantId)).toEqual(before);
      expect((await prisma.applicant.findUniqueOrThrow({ where: { id: applicantId } })).stage).toBe(stage);
    });

    it('a question about a missing field (gap without a conflict) also only stores the answer', async () => {
      const applicantId = await newApplicant();
      const q = await clarifications.open({ applicantId, prompt: 'What is your date of birth?', gapId: 'MISSING_FIELD:applicant.dob', fieldId: 'applicant.dob' });
      const res = await answer(applicantId, q.id, { text: '14 February 2004' }).expect(201);
      expect(res.body.resolution).toBeNull();
      expect(await counts(applicantId)).toEqual({ claims: 0, resolutions: 0, evaluations: 0 });
    });

    it('a conflict question whose conflict has meanwhile disappeared only stores the answer', async () => {
      const applicantId = await newApplicant();
      for (const f of ALL) await upload(applicantId, f, readFileSync(path.join(FIXTURES, f))); // consistent: no conflict
      await http().post(`/applicants/${applicantId}/process`).expect(200);
      const q = await clarifications.open({ applicantId, prompt: 'Which year?', gapId: GAP, fieldId: 'degree.graduationYear', claimIds: [] });
      const before = await counts(applicantId);

      const res = await answer(applicantId, q.id, { value: 2025 }).expect(201);
      expect(res.body).toMatchObject({ status: 'ANSWERED', resolution: { skipped: 'CONFLICT_NO_LONGER_PRESENT' } });
      expect(await counts(applicantId)).toEqual(before);
    });
  });

  describe('failure after the answer is committed', () => {
    it('keeps the answer and the resolution claim; /evaluate recovers the snapshot', async () => {
      const { applicantId, clarificationId } = await conflictScenario();
      const before = await counts(applicantId);
      jest.spyOn(evaluations, 'evaluate').mockRejectedValueOnce(new Error('boom'));

      const res = await answer(applicantId, clarificationId, { value: 2025 }).expect(201);
      expect(res.body.status).toBe('ANSWERED');
      expect(res.body.resolution.evaluation).toBeNull();
      expect(res.body.resolution.evaluationError).toMatch(/evaluation failed/);
      expect(await counts(applicantId)).toEqual({ claims: before.claims + 1, resolutions: 1, evaluations: before.evaluations });
      expect((await http().get(`/applicants/${applicantId}/journey`).expect(200)).body.isStale).toBe(true);

      const retry = await http().post(`/applicants/${applicantId}/evaluate`).expect(201);
      expect(retry.body.evaluation.outcome).toBe('READY');
      expect(retry.body.stage).toBe('READY');
      expect((await http().get(`/applicants/${applicantId}/journey`).expect(200)).body.isStale).toBe(false);
    });
  });
});
