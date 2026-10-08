// Regression: an ID returned by POST /applicants must be accepted by every ID-validated route.
// Real PostgreSQL; the LLM is the scripted stand-in, so no live provider is called.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import request from 'supertest';
import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScriptedLlm } from '../testing/scripted-llm';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CV = path.resolve(__dirname, '../../test-fixtures/arjun/01_Arjun_Mehta_CV.pdf');

describe('Applicant ID strategy: one consistent UUID across all routes', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let uploadDir: string;
  const created: string[] = [];

  beforeAll(async () => {
    uploadDir = mkdtempSync(path.join(tmpdir(), 'ids-uploads-'));
    process.env.UPLOAD_DIR = uploadDir;
    const { AppModule } = await import('../app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(LlmService).useValue(new ScriptedLlm()).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => {
    await prisma.applicant.deleteMany({ where: { id: { in: created } } });
    await app.close();
    rmSync(uploadDir, { recursive: true, force: true });
  });

  const http = () => request(app.getHttpServer());
  async function newApplicant(body: Record<string, unknown> = { name: 'Arjun Mehta' }) {
    const res = await http().post('/applicants').send(body).expect(201);
    created.push(res.body.id);
    return res.body as { id: string };
  }

  it('POST /applicants always returns a valid UUID that is the stored primary key', async () => {
    const ids = [(await newApplicant()).id, (await newApplicant()).id, (await newApplicant()).id];
    for (const id of ids) {
      expect(id).toMatch(UUID);
      expect(await prisma.applicant.count({ where: { id } })).toBe(1);
    }
    expect(new Set(ids).size).toBe(3);
  });

  it('ignores a client-supplied id, so a non-UUID id can never be created through the API', async () => {
    const res = await http().post('/applicants').send({ name: 'Arjun Mehta', id: 'not-a-uuid' }).expect(201);
    created.push(res.body.id);
    expect(res.body.id).toMatch(UUID);
    expect(res.body.id).not.toBe('not-a-uuid');
  });

  it('the returned id is accepted immediately by every applicant-scoped route', async () => {
    const { id } = await newApplicant();
    const gets = ['', '/documents', '/journey', '/gaps', '/claims', '/evaluations', '/clarifications', '/agent/next-action', '/agent/actions'];
    for (const suffix of gets) await http().get(`/applicants/${id}${suffix}`).expect(200);
    await http().get(`/applicants/${id}`).expect(200).expect((r) => expect(r.body.id).toBe(id));
    await http().put(`/applicants/${id}/goal`).send({ goal: "Master's in Computer Science in Germany" }).expect(200);
    await http().post(`/applicants/${id}/agent/decide`).expect(200);
    await http().post(`/applicants/${id}/process`).expect(200);
    await http().post(`/applicants/${id}/evaluate`).expect(201);
    await http().get(`/applicants/${id}/evaluations/latest`).expect(200);
  });

  it('the returned id works with the document APIs, and document ids are UUIDs too', async () => {
    const { id } = await newApplicant();
    const up = await http()
      .post(`/applicants/${id}/documents`)
      .attach('file', readFileSync(CV), { filename: '01_Arjun_Mehta_CV.pdf', contentType: 'application/pdf' })
      .expect(201);
    expect(up.body.applicantId).toBe(id);
    expect(up.body.id).toMatch(UUID);

    const docId = up.body.id;
    const list = await http().get(`/applicants/${id}/documents`).expect(200);
    expect(list.body.map((d: any) => d.id)).toEqual([docId]);
    const processed = await http().post(`/applicants/${id}/documents/${docId}/process`).expect(200);
    expect(processed.body.document.id).toBe(docId);
    await http().get(`/applicants/${id}/documents/${docId}/claims`).expect(200);
    await http().get(`/applicants/${id}/documents/${docId}/runs`).expect(200);
  });

  it('rejects only strings that are not UUIDs (quotes, whitespace, placeholders) with a clear 400', async () => {
    const { id } = await newApplicant();
    for (const bad of [`"${id}"`, `${id}%20`, 'string', '123', 'null']) {
      const res = await http().get(`/applicants/${bad}`).expect(400);
      expect(res.body.message).toMatch(/uuid is expected/);
    }
    await http().get(`/applicants/${id.toUpperCase()}`).expect(404); // valid shape, different id
  });
});
