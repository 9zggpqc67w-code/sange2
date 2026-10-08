import { BadRequestException } from '@nestjs/common';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { DocumentStorage, cleanOriginalName, validateUpload } from './document-storage';

const PDF = Buffer.from('%PDF-1.4\n%fake\n');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('validateUpload', () => {
  it('accepts PDF, PNG and JPEG whose bytes match', () => {
    expect(validateUpload('application/pdf', PDF).ext).toBe('.pdf');
    expect(validateUpload('image/png', PNG).ext).toBe('.png');
    expect(validateUpload('image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0])).ext).toBe('.jpg');
  });

  it('rejects unsupported MIME types', () => {
    expect(() => validateUpload('text/html', Buffer.from('<html>'))).toThrow(BadRequestException);
    expect(() => validateUpload('application/x-msdownload', Buffer.from('MZ'))).toThrow(BadRequestException);
  });

  it('rejects content that does not match the declared type', () => {
    expect(() => validateUpload('application/pdf', Buffer.from('<script>alert(1)</script>'))).toThrow(
      BadRequestException,
    );
    expect(() => validateUpload('image/png', PDF)).toThrow(BadRequestException);
  });

  it('rejects empty files', () => {
    expect(() => validateUpload('application/pdf', Buffer.alloc(0))).toThrow(BadRequestException);
  });
});

describe('cleanOriginalName', () => {
  it('strips path components and control characters', () => {
    expect(cleanOriginalName('../../etc/passwd')).toBe('passwd');
    expect(cleanOriginalName('C:\\Users\\x\\cv.pdf')).toBe('cv.pdf');
    expect(cleanOriginalName('a\u0000b.pdf')).toBe('ab.pdf');
  });

  it('falls back to a default name', () => {
    expect(cleanOriginalName('')).toBe('upload');
  });
});

describe('DocumentStorage', () => {
  let dir: string;
  let storage: DocumentStorage;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'uploads-'));
    storage = new DocumentStorage(dir);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('stores under <applicant>/<generated name> and never uses user input in the path', async () => {
    const rel = await storage.save('app-1', '.pdf', PDF);
    expect(rel).toMatch(/^app-1\/[0-9a-f-]{36}\.pdf$/);
    expect(existsSync(storage.resolve(rel))).toBe(true);
    expect(readFileSync(storage.resolve(rel)).equals(PDF)).toBe(true);
  });

  it('gives two uploads different paths', async () => {
    const a = await storage.save('app-1', '.pdf', PDF);
    const b = await storage.save('app-1', '.pdf', PDF);
    expect(a).not.toBe(b);
  });

  it('refuses paths that escape the upload root', () => {
    expect(() => storage.resolve('../outside.txt')).toThrow();
    expect(() => storage.resolve('app-1/../../outside.txt')).toThrow();
  });

  it('removes files', async () => {
    const rel = await storage.save('app-1', '.pdf', PDF);
    await storage.remove(rel);
    expect(existsSync(storage.resolve(rel))).toBe(false);
  });
});
