import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicantsService } from '../applicants/applicants.service';
import { DocType } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentStorage, cleanOriginalName, validateUpload } from './document-storage';

/** Fields exposed over the API. `pages` (full extracted text) is intentionally omitted. */
const PUBLIC_SELECT = {
  id: true,
  applicantId: true,
  filename: true,
  storagePath: true,
  mime: true,
  docType: true,
  status: true,
  error: true,
  textMethod: true,
  ocrConfidence: true,
  createdAt: true,
} as const;

@Injectable()
export class DocumentsService {
  private readonly storage: DocumentStorage;

  constructor(
    private readonly prisma: PrismaService,
    private readonly applicants: ApplicantsService,
    config: ConfigService,
  ) {
    this.storage = new DocumentStorage(config.get<string>('UPLOAD_DIR', './uploads'));
  }

  async upload(applicantId: string, file: Express.Multer.File | undefined, docType?: DocType) {
    if (!file) throw new BadRequestException('Missing file: send multipart/form-data with a "file" field');
    await this.applicants.assertExists(applicantId);

    const { ext } = validateUpload(file.mimetype, file.buffer);
    const storagePath = await this.storage.save(applicantId, ext, file.buffer);
    try {
      return await this.prisma.document.create({
        data: {
          applicantId,
          filename: cleanOriginalName(file.originalname),
          storagePath,
          mime: file.mimetype,
          docType: docType ?? DocType.UNKNOWN,
          // status defaults to UPLOADED; Stage 3 picks it up for processing.
        },
        select: PUBLIC_SELECT,
      });
    } catch (err) {
      await this.storage.remove(storagePath); // no orphan files if the insert fails
      throw err;
    }
  }

  async list(applicantId: string) {
    await this.applicants.assertExists(applicantId);
    return this.prisma.document.findMany({
      where: { applicantId },
      orderBy: { createdAt: 'asc' },
      select: PUBLIC_SELECT,
    });
  }
}
