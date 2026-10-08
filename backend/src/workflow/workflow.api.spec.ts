// Stage 4 end-to-end: upload -> process -> claims -> qualification -> evaluation snapshot -> stage,
// the journey read model, history preservation and failure/retry. Real PostgreSQL, the real
// fictional Arjun Mehta PDFs, and a scripted stand-in for Claude. No agent exists yet.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import request from 'supertest';
import { ClarificationsService } from '../clarifications/clarifications.service';
import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { makeTextPdf } from '../testing/pdf-fixtures';
import { ScriptedLlm } from '../testing/scripted-llm';
import { EvaluationService } from './evaluation.service';

const FIXTURES = path.resolve(__dirname, '../../test-fixtures/arjun');
const CV = '01_Arjun_Mehta_CV.pdf';
const DEGREE = '02_Arjun_Mehta_Degree_Certificate.pdf';
const TRANSCRIPT = '03_Arjun_Mehta_Academic_Transcript.pdf';
const LANGUAGE = '04_Arjun_Mehta_Language_Certificate.pdf';
const EXPERIENCE = '05_Arjun_Mehta_Experience_Letter.pdf';
const SOP = '06_Arjun_Mehta_Statement_of_Purpose.pdf';
const ALL = [CV, DEGREE, TRANSCRIPT, LANGUAGE, EXPERIENCE, SOP];
const WITHOUT_LANGUAGE = ALL.filter((f) => f !== LANGUAGE);
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

describe('Applicant journey workflow (real PostgreSQL, real Arjun PDFs, scripted Claude)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let evaluations: EvaluationService;
  let clarifications: ClarificationsService;
  let uploadDir: string;
  let llm: ScriptedLlm;
  const created: string[] = [];

  beforeAll(async () => {
    uploadDir = mkdtempSync(path.join(tmpdir(), 'workflow-uploads-'));
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
    llm.extra = {};
    llm.override = {};
    llm.transcriptions = [];
    llm.calls = [];
    llm.gate = undefined;
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await prisma.applicant.deleteMany({ where: { id: { in: created } } });
    await app.close();
    rmSync(uploadDir, { recursive: true, force: true });
  });

  const http = () => request(app.getHttpServer());
  const pdf = (name: string) => readFileSync(path.join(FIXTURES, name));

  async function newApplicant() {
    const res = await http().post('/applicants').send({ name: 'Arjun Mehta', goal: "Master's in Computer Science in Germany" }).expect(201);
    created.push(res.body.id);
    return res.body.id as string;
  }
  async function upload(applicantId: string, filename: string, buffer: Buffer) {
    const res = await http()
      .post(`/applicants/${applicantId}/documents`)
      .attach('file', buffer, { filename, contentType: 'application/pdf' })
      .expect(201);
    return res.body.id as string;
  }
  const uploadFixture = (applicantId: string, name: string) => upload(applicantId, name, pdf(name));
  const processDoc = (applicantId: string, docId: string, query = '') =>
    http().post(`/applicants/${applicantId}/documents/${docId}/process${query}`).expect(200);
  const journey = async (applicantId: string) => (await http().get(`/applicants/${applicantId}/journey`).expect(200)).body;

  /** Uploads the given Arjun files and processes all of them with the batch endpoint. */
  async function applicantWith(files: string[]) {
    const applicantId = await newApplicant();
    const ids: Record<string, string> = {};
    for (const f of files) ids[f] = await uploadFixture(applicantId, f);
    return { applicantId, ids };
  }

  describe('journey stage and the document -> qualification workflow', () => {
    it('a brand new applicant is NEW with no evaluation', async () => {
      const applicantId = await newApplicant();
      const j = await journey(applicantId);
      expect(j.stage).toBe('NEW');
      expect(j.evaluation).toBeNull();
      expect(j.gaps).toEqual([]);
      expect(j.history).toEqual([]);
      await http().get(`/applicants/${applicantId}/evaluations/latest`).expect(404);
      expect((await http().get(`/applicants/${applicantId}/evaluations`).expect(200)).body).toEqual([]);
    });

    it('processing a document extracts claims, evaluates, stores a snapshot and moves the stage', async () => {
      const { applicantId, ids } = await applicantWith([CV]);
      const res = await processDoc(applicantId, ids[CV]);

      expect(res.body.document).toMatchObject({ status: 'DONE', docType: 'CV' });
      expect(res.body.run).toMatchObject({ version: 1, status: 'DONE' });
      expect(res.body.claims.length).toBeGreaterThan(0);
      expect(res.body.evaluation).toMatchObject({ trigger: 'DOCUMENT_PROCESSED', verdict: 'INCOMPLETE', outcome: 'INCOMPLETE' });
      expect(res.body.stage).toBe('INCOMPLETE');

      const applicant = await prisma.applicant.findUniqueOrThrow({ where: { id: applicantId } });
      expect(applicant.stage).toBe('INCOMPLETE');
      expect(await prisma.evaluation.count({ where: { applicantId } })).toBe(1);
    });

    it('is DOCUMENTS_PROCESSING while a document is being processed', async () => {
      const { applicantId, ids } = await applicantWith([CV]);
      let release!: () => void;
      llm.gate = new Promise<void>((r) => (release = r));

      const inFlight = http().post(`/applicants/${applicantId}/documents/${ids[CV]}/process`).then((r) => r);
      for (let i = 0; i < 50; i++) {
        const a = await prisma.applicant.findUniqueOrThrow({ where: { id: applicantId } });
        if (a.stage === 'DOCUMENTS_PROCESSING') break;
        await new Promise((r) => setTimeout(r, 20));
      }
      expect((await journey(applicantId)).stage).toBe('DOCUMENTS_PROCESSING');
      expect((await journey(applicantId)).documents[0].status).toBe('PROCESSING');

      release();
      const done = await inFlight;
      expect(done.status).toBe(200);
      expect((await journey(applicantId)).stage).toBe('INCOMPLETE');
    });

    it('an unknown or already-processed document does not leave the stage stuck', async () => {
      const { applicantId, ids } = await applicantWith([CV]);
      await processDoc(applicantId, ids[CV]);
      await http().post(`/applicants/${applicantId}/documents/${ids[CV]}/process`).expect(409);
      await http().post(`/applicants/${applicantId}/documents/${MISSING_ID}/process`).expect(404);
      expect((await journey(applicantId)).stage).toBe('INCOMPLETE');
    });

    it('batch processing handles every waiting document and evaluates once', async () => {
      const { applicantId } = await applicantWith(ALL);
      const res = await http().post(`/applicants/${applicantId}/process`).expect(200);
      expect(res.body.processed).toHaveLength(6);
      expect(res.body.processed.every((p: any) => p.status === 'DONE')).toBe(true);
      expect(res.body.stage).toBe('READY');
      expect(await prisma.evaluation.count({ where: { applicantId } })).toBe(1);
      expect(res.body.evaluation).toMatchObject({ score: 100, verdict: 'READY' });
    });
  });

  describe('evaluation history', () => {
    it('keeps every evaluation: missing certificate -> uploaded -> READY, each snapshot intact', async () => {
      const { applicantId } = await applicantWith(WITHOUT_LANGUAGE);
      await http().post(`/applicants/${applicantId}/process`).expect(200);

      // 1st evaluation: language certificate missing
      const first = (await http().get(`/applicants/${applicantId}/evaluations/latest`).expect(200)).body;
      expect(first).toMatchObject({ verdict: 'INCOMPLETE', outcome: 'INCOMPLETE', trigger: 'DOCUMENT_PROCESSED' });
      expect(first.gaps.map((g: any) => g.id)).toEqual(expect.arrayContaining(['MISSING_DOC:LANGUAGE_CERT', 'MISSING_FIELD:language.overall']));
      expect(first.summary.changes).toBeNull();

      // the applicant uploads it later
      const langId = await uploadFixture(applicantId, LANGUAGE);
      const res = await processDoc(applicantId, langId);
      expect(res.body.evaluation).toMatchObject({ verdict: 'READY', score: 100, outcome: 'READY' });
      expect(res.body.stage).toBe('READY');

      const history = (await http().get(`/applicants/${applicantId}/evaluations`).expect(200)).body;
      expect(history).toHaveLength(2);
      expect(history.map((h: any) => h.verdict)).toEqual(['READY', 'INCOMPLETE']); // newest first
      expect(history[0].summary.changes).toMatchObject({
        previousEvaluationId: first.id,
        verdict: { from: 'INCOMPLETE', to: 'READY' },
      });
      expect(history[0].summary.changes.closedGapIds).toContain('MISSING_DOC:LANGUAGE_CERT');
      expect(history[0].triggerDocumentId).toBe(langId);

      // the first snapshot was NOT overwritten: it still answers "what was missing back then?"
      const oldSnapshot = (await http().get(`/applicants/${applicantId}/evaluations/${first.id}`).expect(200)).body;
      expect(oldSnapshot.score).toBe(first.score);
      expect(oldSnapshot.score).toBeLessThan(100);
      expect(oldSnapshot.gaps.map((g: any) => g.id)).toContain('MISSING_DOC:LANGUAGE_CERT');
      expect(oldSnapshot.requirements.find((r: any) => r.requirementId === 'docs-complete').status).toBe('MISSING');
      expect(oldSnapshot.inputs.documents.map((d: any) => d.docType)).not.toContain('LANGUAGE_CERT');
    });

    it('snapshots record their exact inputs and can be replayed to the same result', async () => {
      const { applicantId } = await applicantWith(WITHOUT_LANGUAGE);
      await http().post(`/applicants/${applicantId}/process`).expect(200);
      const first = (await http().get(`/applicants/${applicantId}/evaluations/latest`).expect(200)).body;
      expect(first.inputs.claimIds.length).toBeGreaterThan(0);
      expect(first.inputHash).toHaveLength(64);

      const langId = await uploadFixture(applicantId, LANGUAGE);
      await processDoc(applicantId, langId);
      await processDoc(applicantId, langId, '?force=true'); // supersede claims after the first evaluation too

      for (const h of (await http().get(`/applicants/${applicantId}/evaluations`).expect(200)).body) {
        const replay = (await http().get(`/applicants/${applicantId}/evaluations/${h.id}/replay`).expect(200)).body;
        expect(replay).toMatchObject({ matches: true });
        expect(replay.replayed).toEqual(replay.stored);
      }
    });

    it('manual evaluation adds a snapshot and is flagged as MANUAL', async () => {
      const { applicantId } = await applicantWith([CV]);
      await http().post(`/applicants/${applicantId}/process`).expect(200);
      const res = await http().post(`/applicants/${applicantId}/evaluate`).expect(201);
      expect(res.body.evaluation).toMatchObject({ trigger: 'MANUAL' });
      expect(res.body.evaluation.summary.changes.scoreDelta).toBe(0);
      expect(await prisma.evaluation.count({ where: { applicantId } })).toBe(2);
    });

    it('404s for an unknown applicant or evaluation', async () => {
      await http().get(`/applicants/${MISSING_ID}/evaluations`).expect(404);
      await http().get(`/applicants/${MISSING_ID}/journey`).expect(404);
      const applicantId = await newApplicant();
      await http().get(`/applicants/${applicantId}/evaluations/${MISSING_ID}`).expect(404);
    });
  });

  describe('gaps, conflicts and the journey read model', () => {
    it('reports a conflict with both options and their evidence, and the stage becomes ACTION_REQUIRED', async () => {
      const { applicantId } = await applicantWith(ALL.filter((f) => f !== CV));
      const cvId = await upload(
        applicantId,
        'cv_2024.pdf',
        makeTextPdf(['CURRICULUM VITAE', 'Arjun Mehta', 'Bachelor of Technology in Computer Science and Engineering', 'Graduation year: 2024']),
      );
      llm.override['cv_2024.pdf'] = {
        documentType: 'CV',
        claims: [
          { fieldKey: 'applicant.name', rawValue: 'Arjun Mehta', quote: 'Arjun Mehta' },
          { fieldKey: 'degree.graduationYear', rawValue: '2024', quote: 'Graduation year: 2024' },
        ],
      };
      await http().post(`/applicants/${applicantId}/process`).expect(200);

      const j = await journey(applicantId);
      expect(j.stage).toBe('ACTION_REQUIRED');
      expect(j.evaluation).toMatchObject({ verdict: 'INCOMPLETE', outcome: 'ACTION_REQUIRED', isDemo: true });
      expect(j.evaluation.disclaimer).toMatch(/DEMO/);
      expect(j.isStale).toBe(false);

      expect(j.conflicts).toHaveLength(1);
      const c = j.conflicts[0];
      expect(c).toMatchObject({ gapId: 'CONFLICT:degree.graduationYear', fieldId: 'degree.graduationYear', severity: 'BLOCKING' });
      expect(c.options.map((o: any) => o.value).sort()).toEqual([2024, 2025]);
      const o2024 = c.options.find((o: any) => o.value === 2024);
      expect(o2024.evidence[0]).toMatchObject({ documentId: cvId, documentType: 'CV', page: 1, quote: 'Graduation year: 2024', source: 'DOCUMENT' });

      const field = j.profile.find((f: any) => f.id === 'degree.graduationYear');
      expect(field).toMatchObject({ state: 'CONFLICT', value: null });
      expect(field.conflictOptions).toHaveLength(2);

      const gaps = (await http().get(`/applicants/${applicantId}/gaps`).expect(200)).body;
      expect(gaps.evaluationId).toBe(j.evaluation.id);
      expect(gaps.gaps.map((g: any) => g.id)).toContain('CONFLICT:degree.graduationYear');
      expect(gaps.conflicts).toHaveLength(1);
    });

    it('returns the complete read model for a complete applicant', async () => {
      const { applicantId } = await applicantWith(ALL);
      await http().post(`/applicants/${applicantId}/process`).expect(200);
      const j = await journey(applicantId);

      expect(j.applicant).toMatchObject({ id: applicantId, name: 'Arjun Mehta', goal: "Master's in Computer Science in Germany" });
      expect(j.stage).toBe('READY');
      expect(j.documents).toHaveLength(6);
      expect(j.documents.every((d: any) => d.status === 'DONE' && d.activeVersion === 1 && d.runCount === 1)).toBe(true);
      expect(j.documents.find((d: any) => d.docType === 'CV').activeClaimCount).toBeGreaterThan(0);

      const lang = j.profile.find((f: any) => f.id === 'language.overall');
      expect(lang).toMatchObject({ state: 'DOCUMENT_SUPPORTED', value: 7, label: 'Overall language score' });
      expect(lang.evidence[0]).toMatchObject({ documentType: 'LANGUAGE_CERT', page: 1, quote: 'Overall Band 7.0', rawValue: '7.0' });
      const gradYear = j.profile.find((f: any) => f.id === 'degree.graduationYear');
      expect(gradYear.evidence.length).toBe(4);

      expect(j.evaluation).toMatchObject({ score: 100, verdict: 'READY', outcome: 'READY' });
      expect(j.evaluation.requirements).toHaveLength(6);
      expect(j.evaluation.readiness).toMatchObject({ score: 100, readyThreshold: 80 });
      expect(j.gaps).toEqual([]);
      expect(j.conflicts).toEqual([]);
      expect(j.history).toHaveLength(1);
      expect(j.clarifications).toEqual({ open: 0, items: [] });
    });

    it('marks the evaluation stale when evidence changed after it', async () => {
      const { applicantId } = await applicantWith([CV]);
      await http().post(`/applicants/${applicantId}/process`).expect(200);
      expect((await journey(applicantId)).isStale).toBe(false);

      await uploadFixture(applicantId, DEGREE); // a new document changes the inputs
      expect((await journey(applicantId)).isStale).toBe(true);

      await http().post(`/applicants/${applicantId}/evaluate`).expect(201);
      expect((await journey(applicantId)).isStale).toBe(false);
    });
  });

  describe('re-processing: safe, idempotent, history preserved', () => {
    it('creates a new run version, keeps old claims as inactive history, and never duplicates active claims', async () => {
      const { applicantId, ids } = await applicantWith([DEGREE]);
      const first = await processDoc(applicantId, ids[DEGREE]);
      const n = first.body.claims.length;

      const second = await processDoc(applicantId, ids[DEGREE], '?force=true');
      expect(second.body.run).toMatchObject({ version: 2, status: 'DONE' });
      const third = await processDoc(applicantId, ids[DEGREE], '?force=true');
      expect(third.body.run.version).toBe(3);

      const active = (await http().get(`/applicants/${applicantId}/claims`).expect(200)).body;
      expect(active).toHaveLength(n);
      expect(active.every((c: any) => c.runVersion === 3 && c.active)).toBe(true);
      expect(new Set(active.map((c: any) => `${c.fieldKey}|${c.entryKey}`)).size).toBe(n); // no duplicate active claims

      const all = (await http().get(`/applicants/${applicantId}/claims?scope=all`).expect(200)).body;
      expect(all).toHaveLength(n * 3); // nothing was deleted
      expect(all.filter((c: any) => c.active)).toHaveLength(n);
      expect(all.filter((c: any) => !c.active).map((c: any) => c.runVersion).sort()).toEqual([...Array(n).fill(1), ...Array(n).fill(2)]);

      const runs = (await http().get(`/applicants/${applicantId}/documents/${ids[DEGREE]}/runs`).expect(200)).body;
      expect(runs.map((r: any) => [r.version, r.isActive, r.status, r.claimCount])).toEqual([
        [3, true, 'DONE', n],
        [2, false, 'DONE', n],
        [1, false, 'DONE', n],
      ]);

      // the document's own claims endpoint: active by default, history on request
      expect((await http().get(`/applicants/${applicantId}/documents/${ids[DEGREE]}/claims`).expect(200)).body).toHaveLength(n);
      expect((await http().get(`/applicants/${applicantId}/documents/${ids[DEGREE]}/claims?scope=all`).expect(200)).body).toHaveLength(n * 3);
      expect((await journey(applicantId)).documents[0]).toMatchObject({ activeVersion: 3, runCount: 3, activeClaimCount: n });
    });

    it('a run that extracts different facts replaces the active ones, while the old facts remain queryable and in old evaluations', async () => {
      const { applicantId } = await applicantWith(ALL.filter((f) => f !== CV));
      const cvId = await upload(
        applicantId,
        'cv_2024.pdf',
        makeTextPdf(['CURRICULUM VITAE', 'Arjun Mehta', 'Graduation year: 2024']),
      );
      llm.override['cv_2024.pdf'] = {
        documentType: 'CV',
        claims: [{ fieldKey: 'degree.graduationYear', rawValue: '2024', quote: 'Graduation year: 2024' }],
      };
      await http().post(`/applicants/${applicantId}/process`).expect(200);
      const conflicted = (await http().get(`/applicants/${applicantId}/evaluations/latest`).expect(200)).body;
      expect(conflicted.outcome).toBe('ACTION_REQUIRED');

      // a second extraction of the same document no longer produces that claim
      llm.override['cv_2024.pdf'] = { documentType: 'CV', claims: [{ fieldKey: 'applicant.name', rawValue: 'Arjun Mehta', quote: 'Arjun Mehta' }] };
      const res = await processDoc(applicantId, cvId, '?force=true');
      expect(res.body.stage).toBe('READY'); // the conflict is gone: the CV was the only 2024 source ...

      // ... but the 2024 claim was never deleted
      const all = (await http().get(`/applicants/${applicantId}/claims?scope=all`).expect(200)).body;
      const old = all.find((c: any) => c.fieldKey === 'degree.graduationYear' && c.rawValue === '2024');
      expect(old).toMatchObject({ active: false, runVersion: 1, quote: 'Graduation year: 2024' });
      expect((await http().get(`/applicants/${applicantId}/claims`).expect(200)).body.some((c: any) => c.rawValue === '2024')).toBe(false);

      // and the earlier evaluation still shows the conflict and still replays exactly
      const again = (await http().get(`/applicants/${applicantId}/evaluations/${conflicted.id}`).expect(200)).body;
      expect(again.gaps.map((g: any) => g.id)).toContain('CONFLICT:degree.graduationYear');
      expect((await http().get(`/applicants/${applicantId}/evaluations/${conflicted.id}/replay`).expect(200)).body.matches).toBe(true);
      const latest = (await http().get(`/applicants/${applicantId}/evaluations/latest`).expect(200)).body;
      expect(latest.summary.changes.closedGapIds).toContain('CONFLICT:degree.graduationYear');
    });

    it('applicant-provided facts are never touched by document re-processing', async () => {
      const { applicantId, ids } = await applicantWith([DEGREE]);
      const mine = await prisma.claim.create({
        data: { applicantId, fieldKey: 'language.overall', rawValue: '7.0', value: 7, source: 'APPLICANT', quote: 'told the assistant' },
      });
      await processDoc(applicantId, ids[DEGREE]);
      await processDoc(applicantId, ids[DEGREE], '?force=true');

      const j = await journey(applicantId);
      const lang = j.profile.find((f: any) => f.id === 'language.overall');
      expect(lang).toMatchObject({ state: 'APPLICANT_PROVIDED', value: 7 });
      expect(lang.evidence[0]).toMatchObject({ claimId: mine.id, source: 'APPLICANT' });
      expect(j.gaps.map((g: any) => g.id)).toContain('UNVERIFIED:language.overall');
    });
  });

  describe('failure and retry', () => {
    it('a failed document changes nothing: no evaluation, earlier state kept, retry succeeds', async () => {
      const { applicantId, ids } = await applicantWith([CV, LANGUAGE]);
      llm.configured = false;
      const failed = await processDoc(applicantId, ids[CV]);
      expect(failed.body.document).toMatchObject({ status: 'FAILED' });
      expect(failed.body.document.error).toMatch(/GEMINI_API_KEY/);
      expect(failed.body.run).toMatchObject({ version: 1, status: 'FAILED' });
      expect(failed.body.evaluation).toBeNull();
      expect(failed.body.stage).toBe('NEW');
      expect(await prisma.evaluation.count({ where: { applicantId } })).toBe(0);
      expect(await prisma.claim.count({ where: { applicantId } })).toBe(0);

      llm.configured = true;
      const retried = await processDoc(applicantId, ids[CV]);
      expect(retried.body.document).toMatchObject({ status: 'DONE', error: null });
      expect(retried.body.run).toMatchObject({ version: 2, status: 'DONE' });
      expect(retried.body.stage).toBe('INCOMPLETE');
      const runs = (await http().get(`/applicants/${applicantId}/documents/${ids[CV]}/runs`).expect(200)).body;
      expect(runs.map((r: any) => [r.version, r.status, r.isActive])).toEqual([[2, 'DONE', true], [1, 'FAILED', false]]);
    });

    it('a failed re-process keeps the previous evidence active and the evaluation unchanged', async () => {
      const { applicantId, ids } = await applicantWith(ALL);
      await http().post(`/applicants/${applicantId}/process`).expect(200);
      const before = (await http().get(`/applicants/${applicantId}/evaluations/latest`).expect(200)).body;

      llm.configured = false;
      const failed = await processDoc(applicantId, ids[LANGUAGE], '?force=true');
      expect(failed.body.document.status).toBe('FAILED');
      expect(failed.body.stage).toBe('READY');

      const j = await journey(applicantId);
      expect(j.profile.find((f: any) => f.id === 'language.overall')).toMatchObject({ state: 'DOCUMENT_SUPPORTED', value: 7 });
      expect(j.documents.find((d: any) => d.id === ids[LANGUAGE])).toMatchObject({ status: 'FAILED', activeVersion: 1 });
      expect(await prisma.evaluation.count({ where: { applicantId } })).toBe(1);

      // a manual evaluation still sees the document as present, because its evidence is intact
      llm.configured = true;
      const ev = await http().post(`/applicants/${applicantId}/evaluate`).expect(201);
      expect(ev.body.evaluation).toMatchObject({ score: before.score, verdict: 'READY' });
    });

    it('if evaluation fails after processing, evidence is kept, stage is PROFILE_BUILT, and /evaluate recovers', async () => {
      const { applicantId, ids } = await applicantWith([CV]);
      jest.spyOn(evaluations, 'evaluate').mockRejectedValueOnce(new Error('boom'));

      const res = await processDoc(applicantId, ids[CV]);
      expect(res.body.document.status).toBe('DONE');
      expect(res.body.evaluation).toBeNull();
      expect(res.body.evaluationError).toMatch(/evaluation failed/);
      expect(res.body.stage).toBe('PROFILE_BUILT');
      expect(await prisma.claim.count({ where: { applicantId } })).toBeGreaterThan(0);
      expect(await prisma.evaluation.count({ where: { applicantId } })).toBe(0);

      const retry = await http().post(`/applicants/${applicantId}/evaluate`).expect(201);
      expect(retry.body.stage).toBe('INCOMPLETE');
      expect(await prisma.evaluation.count({ where: { applicantId } })).toBe(1);
    });

    it('recovers a document whose processing was interrupted long ago, but not one that is still running', async () => {
      const { applicantId, ids } = await applicantWith([CV]);
      const docId = ids[CV];
      // simulate a crash: document and run stuck in PROCESSING
      const stuck = async (ageMs: number) => {
        await prisma.document.update({ where: { id: docId }, data: { status: 'PROCESSING' } });
        await prisma.documentRun.deleteMany({ where: { documentId: docId, status: 'PROCESSING' } });
        const v = ((await prisma.documentRun.aggregate({ where: { documentId: docId }, _max: { version: true } }))._max.version ?? 0) + 1;
        await prisma.documentRun.create({ data: { documentId: docId, version: v, status: 'PROCESSING', createdAt: new Date(Date.now() - ageMs) } });
      };

      await stuck(60 * 1000); // one minute old: assumed to be genuinely running
      await http().post(`/applicants/${applicantId}/documents/${docId}/process`).expect(409);

      await stuck(30 * 60 * 1000); // half an hour old: interrupted
      const res = await processDoc(applicantId, docId);
      expect(res.body.document.status).toBe('DONE');
      const runs = (await http().get(`/applicants/${applicantId}/documents/${docId}/runs`).expect(200)).body;
      expect(runs.find((r: any) => r.status === 'FAILED').error).toMatch(/interrupted/);
      expect(runs.filter((r: any) => r.isActive)).toHaveLength(1);
    });
  });

  describe('applicant answers / clarifications (persistence only)', () => {
    it('stores a question and its answer durably, and surfaces them in the journey', async () => {
      const { applicantId } = await applicantWith(ALL);
      await http().post(`/applicants/${applicantId}/process`).expect(200);
      const evaluation = await evaluations.latest(applicantId);

      const q = await clarifications.open({
        applicantId,
        prompt: 'Which graduation year is correct?',
        gapId: 'CONFLICT:degree.graduationYear',
        fieldId: 'degree.graduationYear',
        claimIds: ['c1', 'c2'],
        evaluationId: evaluation!.id,
      });
      expect(q).toMatchObject({ status: 'OPEN', answer: null, answeredAt: null });

      let j = await journey(applicantId);
      expect(j.clarifications.open).toBe(1);
      expect(j.clarifications.items[0]).toMatchObject({ id: q.id, prompt: 'Which graduation year is correct?', gapId: 'CONFLICT:degree.graduationYear' });

      const claimsBefore = await prisma.claim.count({ where: { applicantId } });
      const answered = await http()
        .post(`/applicants/${applicantId}/clarifications/${q.id}/answer`)
        .send({ text: 'It is 2025', value: 2025, choice: 'degree-certificate' })
        .expect(201);
      expect(answered.body).toMatchObject({ status: 'ANSWERED', answer: { text: 'It is 2025', value: 2025, choice: 'degree-certificate' } });
      expect(answered.body.answeredAt).toEqual(expect.any(String));

      // durable: straight from the database
      const row = await prisma.clarification.findUniqueOrThrow({ where: { id: q.id } });
      expect(row).toMatchObject({ status: 'ANSWERED', evaluationId: evaluation!.id, fieldId: 'degree.graduationYear' });
      expect(row.answer).toEqual({ text: 'It is 2025', value: 2025, choice: 'degree-certificate' });
      expect(row.claimIds).toEqual(['c1', 'c2']);

      // answering only records the answer: no claims, no new evaluation (that is a later stage)
      expect(await prisma.claim.count({ where: { applicantId } })).toBe(claimsBefore);
      expect(await prisma.evaluation.count({ where: { applicantId } })).toBe(1);

      j = await journey(applicantId);
      expect(j.clarifications.open).toBe(0);
      expect(j.clarifications.items[0].status).toBe('ANSWERED');
    });

    it('lists with a status filter and enforces answer rules', async () => {
      const applicantId = await newApplicant();
      const other = await newApplicant();
      const a = await clarifications.open({ applicantId, prompt: 'Question A?' });
      const b = await clarifications.open({ applicantId, prompt: 'Question B?' });

      await http().post(`/applicants/${applicantId}/clarifications/${a.id}/answer`).send({ text: 'yes' }).expect(201);
      await http().post(`/applicants/${applicantId}/clarifications/${a.id}/answer`).send({ text: 'again' }).expect(409); // only once
      await http().post(`/applicants/${applicantId}/clarifications/${b.id}/answer`).send({}).expect(400); // empty answer
      await http().post(`/applicants/${applicantId}/clarifications/${b.id}/answer`).send({ text: '   ' }).expect(400);
      await http().post(`/applicants/${other}/clarifications/${b.id}/answer`).send({ text: 'x' }).expect(404); // not theirs
      await http().get(`/applicants/${applicantId}/clarifications/${MISSING_ID}`).expect(404);

      const open = (await http().get(`/applicants/${applicantId}/clarifications?status=OPEN`).expect(200)).body;
      expect(open.map((c: any) => c.id)).toEqual([b.id]);
      const answered = (await http().get(`/applicants/${applicantId}/clarifications?status=ANSWERED`).expect(200)).body;
      expect(answered.map((c: any) => c.id)).toEqual([a.id]);
      expect((await http().get(`/applicants/${applicantId}/clarifications`).expect(200)).body).toHaveLength(2);
      await http().get(`/applicants/${applicantId}/clarifications?status=NOPE`).expect(400);
      await http().get(`/applicants/${MISSING_ID}/clarifications`).expect(404);
      expect((await http().get(`/applicants/${applicantId}/clarifications/${a.id}`).expect(200)).body.answer).toEqual({ text: 'yes' });
    });

    it('requires a prompt', async () => {
      const applicantId = await newApplicant();
      await expect(clarifications.open({ applicantId, prompt: '  ' })).rejects.toThrow(/prompt/);
    });
  });
});
