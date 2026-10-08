export class BadRequestException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestException';
  }
}
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Allowed types, their stored extension, and the magic bytes the content must start with. */
const ALLOWED: Record<string, { ext: string; magic: number[] }> = {
  'application/pdf': { ext: '.pdf', magic: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  'image/png': { ext: '.png', magic: [0x89, 0x50, 0x4e, 0x47] },
  'image/jpeg': { ext: '.jpg', magic: [0xff, 0xd8, 0xff] },
};

export const ALLOWED_MIME_TYPES = Object.keys(ALLOWED);

/** Throws if the declared MIME type is unsupported or the bytes do not match it. */
export function validateUpload(mime: string, buffer: Buffer): { ext: string } {
  const rule = ALLOWED[mime];
  if (!rule) {
    throw new BadRequestException(`Unsupported file type "${mime}". Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`);
  }
  if (buffer.length === 0) throw new BadRequestException('Uploaded file is empty');
  if (!rule.magic.every((b, i) => buffer[i] === b)) {
    throw new BadRequestException(`File content does not match its declared type "${mime}"`);
  }
  return { ext: rule.ext };
}

/** multer decodes filenames as latin1; recover UTF-8 and strip any path components. */
export function cleanOriginalName(name: string): string {
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  // eslint-disable-next-line no-control-regex
  const base = path.basename(decoded.replace(/\\/g, '/')).replace(/[\u0000-\u001f]/g, '');
  return (base || 'upload').slice(0, 255);
}

/**
 * Files live at `<uploadDir>/<applicantId>/<uuid><ext>`. The stored name is generated,
 * never derived from user input, so uploads cannot escape the directory or overwrite
 * each other. The DB stores the path relative to `uploadDir`.
 */
export class DocumentStorage {
  constructor(private readonly uploadDir: string) {}

  get root(): string {
    return path.resolve(this.uploadDir);
  }

  async save(applicantId: string, ext: string, buffer: Buffer): Promise<string> {
    const relative = path.join(applicantId, `${randomUUID()}${ext}`);
    const absolute = this.resolve(relative);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, buffer, { flag: 'wx' });
    return relative.split(path.sep).join('/');
  }

  /** Resolves a stored relative path, refusing anything outside the upload root. */
  resolve(relative: string): string {
    const absolute = path.resolve(this.root, relative);
    if (!absolute.startsWith(this.root + path.sep)) {
      throw new Error('Path escapes upload directory');
    }
    return absolute;
  }

  async remove(relative: string): Promise<void> {
    await fs.rm(this.resolve(relative), { force: true });
  }
}
