// API-level test against the REAL PostgreSQL configured in DATABASE_URL (run `npm run db:dev`
// and `npx prisma migrate deploy` first). Uses a temp upload dir and deletes its own data.
import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';

// Minimal PDF standing in for a fictional Arjun Mehta demo document.
const ARJUN_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n% Arjun Mehta - B.Tech Computer Science (fictional demo data)\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);

describe('Applicant + Document API (real PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let uploadDir: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    uploadDir = mkdtempSync(path.join(tmpdir(), 'api-uploads-'));
    // ConfigModule reads the environment when AppModule is first loaded, so set it before that.
    process.env.UPLOAD_DIR = uploadDir;
    const { AppModule } = await import('../app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.applicant.deleteMany({ where: { id: { in: createdIds } } }); // cascades to documents
    await app.close();
    rmSync(uploadDir, { recursive: true, force: true });
  });

  async function createArjun() {
    const res = await request(app.getHttpServer())
      .post('/applicants')
      .send({ name: 'Arjun Mehta', email: 'arjun.mehta@example.com' })
      .expect(201);
    createdIds.push(res.body.id);
    return res.body as { id: string };
  }

  it('creates and reads an applicant, and persists it in PostgreSQL', async () => {
    const created = await createArjun();
    expect(created).toMatchObject({ name: 'Arjun Mehta', stage: 'NEW', goal: null });

    const got = await request(app.getHttpServer()).get(`/applicants/${created.id}`).expect(200);
    expect(got.body).toMatchObject({ id: created.id, name: 'Arjun Mehta', documents: [] });
    expect(await prisma.applicant.count({ where: { id: created.id } })).toBe(1);
  });

  it('validates applicant input and ids', async () => {
    await request(app.getHttpServer()).post('/applicants').send({}).expect(400);
    await request(app.getHttpServer()).post('/applicants').send({ name: 'X', email: 'nope' }).expect(400);
    await request(app.getHttpServer()).get('/applicants/not-a-uuid').expect(400);
    await request(app.getHttpServer()).get('/applicants/00000000-0000-4000-8000-000000000000').expect(404);
  });

  it('updates the goal', async () => {
    const { id } = await createArjun();
    const res = await request(app.getHttpServer())
      .put(`/applicants/${id}/goal`)
      .send({ goal: "Master's in Computer Science in Germany", programLabel: 'DEMO MSc CS' })
      .expect(200);
    expect(res.body).toMatchObject({ goal: "Master's in Computer Science in Germany", programLabel: 'DEMO MSc CS' });
    await request(app.getHttpServer()).put(`/applicants/${id}/goal`).send({ goal: '' }).expect(400);
    await request(app.getHttpServer())
      .put('/applicants/00000000-0000-4000-8000-000000000000/goal')
      .send({ goal: 'x' })
      .expect(404);
  });

  it('uploads a document: file on disk + Document row + listed with status', async () => {
    const { id } = await createArjun();

    const up = await request(app.getHttpServer())
      .post(`/applicants/${id}/documents`)
      .field('docType', 'DEGREE')
      .attach('file', ARJUN_PDF, { filename: 'degree_certificate.pdf', contentType: 'application/pdf' })
      .expect(201);

    expect(up.body).toMatchObject({
      applicantId: id,
      filename: 'degree_certificate.pdf',
      mime: 'application/pdf',
      docType: 'DEGREE',
      status: 'UPLOADED',
    });
    expect(up.body.storagePath).toMatch(new RegExp(`^${id}/[0-9a-f-]{36}\\.pdf$`));

    // the file really exists in the upload directory, byte for byte
    const onDisk = path.join(uploadDir, up.body.storagePath);
    expect(existsSync(onDisk)).toBe(true);
    expect(readFileSync(onDisk).equals(ARJUN_PDF)).toBe(true);

    // the row really exists in PostgreSQL
    const row = await prisma.document.findUnique({ where: { id: up.body.id } });
    expect(row).toMatchObject({ applicantId: id, storagePath: up.body.storagePath, status: 'UPLOADED' });

    const list = await request(app.getHttpServer()).get(`/applicants/${id}/documents`).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ id: up.body.id, status: 'UPLOADED', docType: 'DEGREE' });
    expect(list.body[0]).not.toHaveProperty('pages');

    const applicant = await request(app.getHttpServer()).get(`/applicants/${id}`).expect(200);
    expect(applicant.body.documents).toEqual([
      { id: up.body.id, filename: 'degree_certificate.pdf', docType: 'DEGREE', status: 'UPLOADED' },
    ]);
  });

  it('defaults docType to UNKNOWN and sanitises hostile filenames', async () => {
    const { id } = await createArjun();
    const up = await request(app.getHttpServer())
      .post(`/applicants/${id}/documents`)
      .attach('file', ARJUN_PDF, { filename: '../../evil.pdf', contentType: 'application/pdf' })
      .expect(201);
    expect(up.body.docType).toBe('UNKNOWN');
    expect(up.body.filename).toBe('evil.pdf');
    expect(up.body.storagePath.startsWith(`${id}/`)).toBe(true);
  });

  it('rejects bad uploads without creating rows or files', async () => {
    const { id } = await createArjun();
    const http = request(app.getHttpServer());

    await http.post(`/applicants/${id}/documents`).expect(400); // no file
    await http
      .post(`/applicants/${id}/documents`)
      .attach('file', Buffer.from('<html></html>'), { filename: 'x.html', contentType: 'text/html' })
      .expect(400);
    await http
      .post(`/applicants/${id}/documents`)
      .attach('file', Buffer.from('not a pdf'), { filename: 'fake.pdf', contentType: 'application/pdf' })
      .expect(400);
    await http
      .post(`/applicants/${id}/documents`)
      .field('docType', 'PASSPORT')
      .attach('file', ARJUN_PDF, { filename: 'a.pdf', contentType: 'application/pdf' })
      .expect(400);
    await http
      .post('/applicants/00000000-0000-4000-8000-000000000000/documents')
      .attach('file', ARJUN_PDF, { filename: 'a.pdf', contentType: 'application/pdf' })
      .expect(404);

    expect(await prisma.document.count({ where: { applicantId: id } })).toBe(0);
    expect(existsSync(path.join(uploadDir, id))).toBe(false);
  });
});
