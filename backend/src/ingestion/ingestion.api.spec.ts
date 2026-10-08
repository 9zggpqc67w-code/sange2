// End-to-end ingestion against the REAL PostgreSQL and the REAL fictional Arjun Mehta PDFs
// (backend/test-fixtures/arjun). Claude is replaced by a scripted model that returns what a
// correct extraction looks like; everything else (PDF text, classification, grounding,
// normalization, persistence, evidence resolution, qualification) is the production code.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import request from 'supertest';
import { EvidenceState } from '../evidence/evidence.types';
import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { qualify } from '../qualification/qualify';
import { makeBlankPdf, makeTextPdf } from '../testing/pdf-fixtures';
import { ScriptedLlm } from '../testing/scripted-llm';

const FIXTURES = path.resolve(__dirname, '../../test-fixtures/arjun');
const ARJUN_FILES = [
  '01_Arjun_Mehta_CV.pdf',
  '02_Arjun_Mehta_Degree_Certificate.pdf',
  '03_Arjun_Mehta_Academic_Transcript.pdf',
  '04_Arjun_Mehta_Language_Certificate.pdf',
  '05_Arjun_Mehta_Experience_Letter.pdf',
  '06_Arjun_Mehta_Statement_of_Purpose.pdf',
];
const NOW = new Date('2026-10-08T00:00:00Z');

describe('Document ingestion (real PostgreSQL, real Arjun PDFs, scripted Claude)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let uploadDir: string;
  let llm: ScriptedLlm;
  const created: string[] = [];

  beforeAll(async () => {
    uploadDir = mkdtempSync(path.join(tmpdir(), 'ingest-uploads-'));
    process.env.UPLOAD_DIR = uploadDir;
    const { AppModule } = await import('../app.module');
    llm = new ScriptedLlm();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LlmService)
      .useValue(llm)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(() => {
    llm.configured = true;
    llm.extra = {};
    llm.override = {};
    llm.transcriptions = [];
    llm.calls = [];
  });

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

  async function upload(applicantId: string, filename: string, buffer: Buffer, docType?: string) {
    const req = http().post(`/applicants/${applicantId}/documents`);
    if (docType) req.field('docType', docType);
    const res = await req.attach('file', buffer, { filename, contentType: 'application/pdf' }).expect(201);
    return res.body as { id: string; docType: string; status: string };
  }

  const arjunPdf = (name: string) => readFileSync(path.join(FIXTURES, name));

  async function ingestFixture(applicantId: string, name: string) {
    const doc = await upload(applicantId, name, arjunPdf(name));
    const res = await http().post(`/applicants/${applicantId}/documents/${doc.id}/process`).expect(200);
    return res.body as { document: Record<string, any>; claims: any[]; rejected: any[] };
  }

  async function qualifyApplicant(applicantId: string) {
    const [claims, documents] = await Promise.all([
      prisma.claim.findMany({ where: { applicantId } }),
      prisma.document.findMany({ where: { applicantId }, select: { id: true, docType: true, status: true } }),
    ]);
    return qualify({ claims, documents, now: NOW });
  }

  it('fixtures exist', () => {
    for (const f of ARJUN_FILES) expect(existsSync(path.join(FIXTURES, f))).toBe(true);
  });

  describe('1. complete applicant', () => {
    let applicantId: string;
    const results: Record<string, Awaited<ReturnType<typeof ingestFixture>>> = {};

    beforeAll(async () => {
      applicantId = await newApplicant();
      for (const f of ARJUN_FILES) results[f] = await ingestFixture(applicantId, f);
    });

    it('classifies every document from its text, without any docType hint', () => {
      const types = Object.fromEntries(ARJUN_FILES.map((f) => [f, results[f].document.docType]));
      expect(types).toEqual({
        '01_Arjun_Mehta_CV.pdf': 'CV',
        '02_Arjun_Mehta_Degree_Certificate.pdf': 'DEGREE',
        '03_Arjun_Mehta_Academic_Transcript.pdf': 'TRANSCRIPT',
        '04_Arjun_Mehta_Language_Certificate.pdf': 'LANGUAGE_CERT',
        '05_Arjun_Mehta_Experience_Letter.pdf': 'EXPERIENCE_LETTER',
        '06_Arjun_Mehta_Statement_of_Purpose.pdf': 'SOP',
      });
      for (const f of ARJUN_FILES) {
        expect(results[f].document.status).toBe('DONE');
        expect(results[f].document.textMethod).toBe('TEXT_LAYER');
        expect(results[f].document.extraction.docTypeSource).toBe('TITLE');
        expect(results[f].rejected).toEqual([]);
      }
    });

    it('never needs vision for the selectable-text PDFs', () => {
      expect(llm.calls.filter((c) => c.kind === 'transcribe')).toHaveLength(0);
    });

    it('persists every claim as DOCUMENT evidence with document, page and quote', async () => {
      const rows = await prisma.claim.findMany({ where: { applicantId } });
      const expected = ARJUN_FILES.reduce((n, f) => n + results[f].claims.length, 0);
      expect(rows).toHaveLength(expected);
      for (const r of rows) {
        expect(r.source).toBe('DOCUMENT');
        expect(r.documentId).toEqual(expect.any(String));
        expect(r.page).toBe(1);
        expect(r.quote).toBeTruthy();
        expect(r.confidence).toBeNull(); // no invented confidence
      }
      const grad = rows.filter((r) => r.fieldKey === 'degree.graduationYear');
      expect(grad).toHaveLength(4); // cv, degree, transcript, sop
      expect(grad.every((r) => r.value === 2025)).toBe(true);
    });

    it('stores the page text and an audit trail on the document', async () => {
      const doc = await prisma.document.findFirstOrThrow({ where: { applicantId, docType: 'DEGREE' } });
      expect((doc.pages as any)[0]).toMatchObject({ pageNo: 1, method: 'TEXT_LAYER' });
      expect((doc.pages as any)[0].text).toContain('Year of Graduation 2025');
      expect(doc.extraction).toMatchObject({ accepted: 7, proposed: 7, textLayer: 'TEXT', model: 'scripted-test-model' });
    });

    it('exposes claims with provenance via GET', async () => {
      const doc = results['04_Arjun_Mehta_Language_Certificate.pdf'].document;
      const res = await http().get(`/applicants/${applicantId}/documents/${doc.id}/claims`).expect(200);
      const overall = res.body.find((c: any) => c.fieldKey === 'language.overall');
      expect(overall).toMatchObject({ rawValue: '7.0', value: 7, page: 1, quote: 'Overall Band 7.0', source: 'DOCUMENT', documentId: doc.id });
    });

    it('feeds the existing qualification pipeline: all DOCUMENT_SUPPORTED, no conflicts, READY', async () => {
      const q = await qualifyApplicant(applicantId);
      expect(q.fields['degree.graduationYear'].state).toBe(EvidenceState.DOCUMENT_SUPPORTED);
      expect(q.fields['degree.graduationYear'].value).toBe(2025);
      expect(q.fields['language.overall'].value).toBe(7);
      expect(q.fields['experience.totalMonths'].value).toBe(8);
      expect(Object.values(q.fields).filter((f) => f.state === EvidenceState.CONFLICT)).toEqual([]);
      expect(q.gaps).toEqual([]);
      expect(q.requirements.every((r) => r.status === 'MET')).toBe(true);
      expect(q.readiness).toMatchObject({ score: 100, verdict: 'READY' });
    });
  });

  describe('2. missing language certificate', () => {
    it('is detected as a missing document, not invented', async () => {
      const applicantId = await newApplicant();
      for (const f of ARJUN_FILES.filter((x) => !x.startsWith('04_'))) await ingestFixture(applicantId, f);
      const q = await qualifyApplicant(applicantId);
      expect(q.fields['language.overall']).toBeUndefined();
      expect(q.gaps.map((g) => g.id)).toContain('MISSING_DOC:LANGUAGE_CERT');
      expect(q.gaps.map((g) => g.id)).toContain('MISSING_FIELD:language.overall');
      expect(q.readiness.verdict).toBe('INCOMPLETE');
      expect(q.readiness.score).toBeLessThan(100);
    });
  });

  describe('3. conflicting graduation year', () => {
    it('keeps both values and reports a CONFLICT instead of silently choosing', async () => {
      const applicantId = await newApplicant();
      for (const f of ARJUN_FILES.filter((x) => !x.startsWith('01_'))) await ingestFixture(applicantId, f);

      // A CV that says 2024 (everything else identical to the real one).
      const cv2024 = makeTextPdf([
        'CURRICULUM VITAE',
        'Arjun Mehta',
        'Education',
        'Bachelor of Technology in Computer Science and Engineering',
        'Riverview Institute of Technology, Bengaluru',
        'Graduation year: 2024',
      ]);
      llm.override['cv_2024.pdf'] = {
        documentType: 'CV',
        claims: [
          { fieldKey: 'applicant.name', rawValue: 'Arjun Mehta', quote: 'Arjun Mehta' },
          { fieldKey: 'degree.graduationYear', rawValue: '2024', quote: 'Graduation year: 2024' },
        ],
      };
      const doc = await upload(applicantId, 'cv_2024.pdf', cv2024);
      const res = await http().post(`/applicants/${applicantId}/documents/${doc.id}/process`).expect(200);
      expect(res.body.document.docType).toBe('CV');
      expect(res.body.claims.map((c: any) => c.rawValue)).toContain('2024');

      const q = await qualifyApplicant(applicantId);
      const field = q.fields['degree.graduationYear'];
      expect(field.state).toBe(EvidenceState.CONFLICT);
      expect(field.value).toBeUndefined();
      expect(field.conflictOptions!.map((o) => o.value).sort()).toEqual([2024, 2025]);
      expect(q.gaps.map((g) => g.id)).toContain('CONFLICT:degree.graduationYear');
      expect(q.requirements.find((r) => r.requirementId === 'consistency')!.status).toBe('CONFLICT');
      expect(q.readiness.verdict).toBe('INCOMPLETE');
    });
  });

  describe('4. hallucination and grounding', () => {
    it('rejects invented / altered claims, stores only grounded ones, and records why', async () => {
      const applicantId = await newApplicant();
      const name = '02_Arjun_Mehta_Degree_Certificate.pdf';
      llm.extra[name] = [
        { fieldKey: 'degree.graduationYear', rawValue: '2024', quote: 'Year of Graduation 2024' }, // invented quote
        { fieldKey: 'applicant.dob', rawValue: '15 February 2004', quote: 'Date of Birth 14 February 2004' }, // altered value
        { fieldKey: 'language.overall', rawValue: '8.0', quote: 'Overall Band 8.0' }, // wrong doc type + invented
        { fieldKey: 'applicant.passportNumber', rawValue: 'M1234567', quote: 'Passport M1234567' }, // unknown field
      ];
      const out = await ingestFixture(applicantId, name);

      expect(out.document.status).toBe('DONE');
      expect(out.claims).toHaveLength(7);
      expect(out.rejected.map((r) => r.reason).sort()).toEqual([
        'FIELD_NOT_ALLOWED_FOR_DOCUMENT_TYPE',
        'QUOTE_NOT_IN_DOCUMENT',
        'UNKNOWN_FIELD',
        'VALUE_NOT_IN_QUOTE',
      ]);
      expect(out.document.extraction).toMatchObject({ proposed: 11, accepted: 7 });

      const rows = await prisma.claim.findMany({ where: { applicantId } });
      expect(rows.some((r) => r.rawValue === '2024' || r.rawValue === '15 February 2004' || r.rawValue === '8.0')).toBe(false);
      const q = await qualifyApplicant(applicantId);
      expect(q.fields['degree.graduationYear'].value).toBe(2025);
      expect(q.fields['applicant.dob'].value).toBe('2004-02-14');
    });
  });

  describe('5. scanned documents use vision, with provenance', () => {
    it('transcribes a text-less PDF, validates quotes against that transcription, and records VISION', async () => {
      const applicantId = await newApplicant();
      llm.transcriptions = [
        [{ pageNo: 1, text: 'ENGLISH LANGUAGE TEST REPORT\nCandidate Arjun Mehta\nOverall Band 7.0' }],
      ];
      llm.override['scan.pdf'] = {
        documentType: 'LANGUAGE_CERT',
        claims: [
          { fieldKey: 'language.overall', rawValue: '7.0', quote: 'Overall Band 7.0' },
          { fieldKey: 'language.overall', rawValue: '8.0', quote: 'Overall Band 8.0' }, // not in the transcription
        ],
      };
      const doc = await upload(applicantId, 'scan.pdf', makeBlankPdf(1));
      const res = await http().post(`/applicants/${applicantId}/documents/${doc.id}/process`).expect(200);

      expect(res.body.document).toMatchObject({ status: 'DONE', docType: 'LANGUAGE_CERT', textMethod: 'VISION' });
      expect(res.body.document.extraction).toMatchObject({ textLayer: 'SCANNED', pageMethods: [{ pageNo: 1, method: 'VISION' }] });
      expect(res.body.claims.map((c: any) => c.rawValue)).toEqual(['7.0']);
      expect(res.body.rejected.map((r: any) => r.reason)).toEqual(['QUOTE_NOT_IN_DOCUMENT']);
      expect(llm.calls.map((c) => c.kind)).toEqual(['transcribe', 'extract']);

      const stored = await prisma.document.findUniqueOrThrow({ where: { id: doc.id } });
      expect((stored.pages as any)[0]).toMatchObject({ pageNo: 1, method: 'VISION' });
      expect((stored.pages as any)[0].text).toContain('Overall Band 7.0');
    });

    it('fails readably (and can be retried) when a scan needs vision but there is no API key', async () => {
      const applicantId = await newApplicant();
      llm.configured = false;
      const doc = await upload(applicantId, 'scan.pdf', makeBlankPdf(1), 'LANGUAGE_CERT');
      const res = await http().post(`/applicants/${applicantId}/documents/${doc.id}/process`).expect(200);
      expect(res.body.document).toMatchObject({ status: 'FAILED' });
      expect(res.body.document.error).toMatch(/GEMINI_API_KEY/);
      expect(await prisma.claim.count({ where: { applicantId } })).toBe(0);
    });
  });

  describe('6. lifecycle', () => {
    it('re-processing keeps the same active claims (old ones stay as history) and requires force for DONE documents', async () => {
      const applicantId = await newApplicant();
      const name = '04_Arjun_Mehta_Language_Certificate.pdf';
      const doc = await upload(applicantId, name, arjunPdf(name));
      const url = `/applicants/${applicantId}/documents/${doc.id}/process`;
      await http().post(url).expect(200);
      const active = await http().get(`/applicants/${applicantId}/documents/${doc.id}/claims`).expect(200);

      await http().post(url).expect(409); // already DONE
      await http().post(`${url}?force=true`).expect(200);
      const after = await http().get(`/applicants/${applicantId}/documents/${doc.id}/claims`).expect(200);
      expect(after.body).toHaveLength(active.body.length); // no duplicate ACTIVE claims
      expect(await prisma.claim.count({ where: { applicantId } })).toBe(active.body.length * 2); // history kept
    });

    it('a FAILED document can be retried and then succeeds', async () => {
      const applicantId = await newApplicant();
      const name = '04_Arjun_Mehta_Language_Certificate.pdf';
      const doc = await upload(applicantId, name, arjunPdf(name));
      const url = `/applicants/${applicantId}/documents/${doc.id}/process`;

      llm.configured = false;
      const failed = await http().post(url).expect(200);
      expect(failed.body.document.status).toBe('FAILED');

      llm.configured = true;
      const ok = await http().post(url).expect(200);
      expect(ok.body.document).toMatchObject({ status: 'DONE', error: null });
      expect(ok.body.claims.length).toBeGreaterThan(0);
    });

    it('fails readably when the document type cannot be determined', async () => {
      const applicantId = await newApplicant();
      const doc = await upload(applicantId, 'mystery.pdf', makeTextPdf(['Some unrelated page of text that is long enough to count as text']));
      const res = await http().post(`/applicants/${applicantId}/documents/${doc.id}/process`).expect(200);
      expect(res.body.document.status).toBe('FAILED');
      expect(res.body.document.error).toMatch(/document type/);
    });

    it('returns 404 for documents of another applicant and 400 for bad ids', async () => {
      const a = await newApplicant();
      const b = await newApplicant();
      const doc = await upload(a, 'x.pdf', makeTextPdf(['CURRICULUM VITAE and enough more words to be text here']));
      await http().post(`/applicants/${b}/documents/${doc.id}/process`).expect(404);
      await http().get(`/applicants/${b}/documents/${doc.id}/claims`).expect(404);
      await http().post(`/applicants/${a}/documents/nope/process`).expect(400);
    });
  });
});
