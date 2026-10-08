import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import type { DocumentType } from '../config/requirements.demo';
import { DocumentStorage } from '../documents/document-storage';
import { activeClaimsWhere } from '../evidence/active-claims';
import { DocStatus } from '../generated/prisma/enums';
import { Prisma } from '../generated/prisma/client';
import { LlmOutputError, LlmService, LlmUnavailableError } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { classifyDocument } from './classify';
import { DocumentReader, IngestionError } from './document-reader';
import { DOC_TYPES, EXTRACTION_SCHEMA, EXTRACTION_SYSTEM_PROMPT, buildExtractionUserText } from './extraction.schema';
import { groundClaims, parseProposedClaims } from './grounding';

const CLAIM_SELECT = {
  id: true,
  documentId: true,
  runId: true,
  fieldKey: true,
  entryKey: true,
  rawValue: true,
  value: true,
  source: true,
  page: true,
  quote: true,
  confidence: true,
  createdAt: true,
} as const;

const DOCUMENT_SELECT = {
  id: true,
  applicantId: true,
  filename: true,
  mime: true,
  docType: true,
  status: true,
  error: true,
  textMethod: true,
  extraction: true,
  createdAt: true,
} as const;

const RUN_SELECT = {
  id: true,
  documentId: true,
  version: true,
  status: true,
  isActive: true,
  docType: true,
  textMethod: true,
  error: true,
  createdAt: true,
  completedAt: true,
} as const;

const isDocType = (v: unknown): v is DocumentType => typeof v === 'string' && (DOC_TYPES as readonly string[]).includes(v);
const json = (v: unknown) => v as Prisma.InputJsonValue;

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly storage: DocumentStorage;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reader: DocumentReader,
    private readonly llm: LlmService,
    config: ConfigService,
  ) {
    this.storage = new DocumentStorage(config.get<string>('UPLOAD_DIR', './uploads'));
  }

  /**
   * file -> page text (text layer, else vision) -> doc type -> Claude extraction -> grounding ->
   * Claim rows, as a new versioned DocumentRun. Nothing from earlier runs is deleted: when this
   * run succeeds it becomes the document's active run and the previous run (and its claims) stay
   * in the database as history. When it fails, the previous active run stays active.
   * Never throws for a bad document: the Document ends up FAILED with a readable `error`, and
   * can be retried. `force` re-processes a DONE document.
   */
  async processDocument(applicantId: string, documentId: string, opts: { force?: boolean } = {}) {
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, applicantId } });
    if (!doc) throw new NotFoundException(`Document ${documentId} not found for applicant ${applicantId}`);

    // Atomic claim of the document, so two concurrent requests cannot both process it.
    const startable: DocStatus[] = opts.force ? ['UPLOADED', 'FAILED', 'DONE'] : ['UPLOADED', 'FAILED'];
    const locked = await this.prisma.document.updateMany({
      where: { id: doc.id, status: { in: startable } },
      data: { status: 'PROCESSING', error: null },
    });
    if (locked.count === 0) {
      throw new ConflictException(`Document is ${doc.status}; ${doc.status === 'DONE' ? 'pass force=true to re-process' : 'wait for it to finish'}`);
    }

    const run = await this.createRun(doc.id);
    try {
      const { document, claims, rejected } = await this.run(doc, run.id);
      return { document, run: { id: run.id, version: run.version, status: 'DONE' as const }, claims, rejected };
    } catch (err) {
      const message = this.userMessage(err);
      await this.prisma.$transaction([
        this.prisma.documentRun.update({ where: { id: run.id }, data: { status: 'FAILED', error: message, completedAt: new Date() } }),
        this.prisma.document.update({ where: { id: doc.id }, data: { status: 'FAILED', error: message } }),
      ]);
      const document = await this.prisma.document.findUniqueOrThrow({ where: { id: doc.id }, select: DOCUMENT_SELECT });
      return { document, run: { id: run.id, version: run.version, status: 'FAILED' as const }, claims: [], rejected: [] };
    }
  }

  /** Next version number; the unique (documentId, version) index makes a race fail loudly instead of corrupting history. */
  private async createRun(documentId: string) {
    const last = await this.prisma.documentRun.aggregate({ where: { documentId }, _max: { version: true } });
    return this.prisma.documentRun.create({ data: { documentId, version: (last._max.version ?? 0) + 1 } });
  }

  private userMessage(err: unknown): string {
    if (err instanceof IngestionError || err instanceof LlmUnavailableError || err instanceof LlmOutputError) return err.message;
    this.logger.error('Unexpected ingestion failure', err instanceof Error ? err.stack : String(err));
    return 'Unexpected error while processing the document; please retry';
  }

  private async run(
    doc: { id: string; applicantId: string; filename: string; mime: string; storagePath: string; docType: DocumentType },
    runId: string,
  ) {
    const buffer = await fs.readFile(this.storage.resolve(doc.storagePath));
    const read = await this.reader.read({ buffer, mime: doc.mime, filename: doc.filename });

    // Document type: title/filename heuristics first, then the applicant's hint, then Claude.
    const cls = classifyDocument(read.pages[0], doc.filename);
    let docType: DocumentType = cls.docType !== 'UNKNOWN' ? cls.docType : doc.docType;
    let docTypeSource: 'TITLE' | 'FILENAME' | 'APPLICANT_HINT' | 'LLM' | 'NONE' =
      cls.docType !== 'UNKNOWN' ? cls.source : doc.docType !== 'UNKNOWN' ? 'APPLICANT_HINT' : 'NONE';
    const hintOverridden = cls.docType !== 'UNKNOWN' && doc.docType !== 'UNKNOWN' && cls.docType !== doc.docType;

    const output = await this.llm.completeJson({
      system: EXTRACTION_SYSTEM_PROMPT,
      content: [{ type: 'text', text: buildExtractionUserText(read.pages, doc.filename) }],
      schema: EXTRACTION_SCHEMA,
      maxTokens: 2000, // fits a small OpenRouter allowance; the global default stays 3000
    });
    const proposed = parseProposedClaims(output);

    if (docType === 'UNKNOWN' && isDocType(proposed.documentType) && proposed.documentType !== 'UNKNOWN') {
      docType = proposed.documentType;
      docTypeSource = 'LLM';
    }
    if (docType === 'UNKNOWN') {
      throw new IngestionError('Could not determine the document type; set docType on the document and retry');
    }

    const grounded = groundClaims(proposed.claims, read.pages, docType);
    const rejected = [...proposed.rejected, ...grounded.rejected];
    const pages = read.pages.map((p) => ({ pageNo: p.pageNo, text: p.text, method: p.method }));

    const extraction = {
      model: this.llm.model,
      processedAt: new Date().toISOString(),
      docTypeSource,
      hintOverridden,
      textLayer: read.textLayer,
      pageMethods: read.pages.map((p) => ({ pageNo: p.pageNo, method: p.method })),
      proposed: proposed.claims.length + proposed.rejected.length,
      accepted: grounded.accepted.length,
      rejected,
    };

    const { document, claims } = await this.prisma.$transaction(async (tx) => {
      // The new run takes over as the active one; earlier runs and their claims are kept as history.
      await tx.documentRun.updateMany({ where: { documentId: doc.id, isActive: true }, data: { isActive: false } });
      const created = await tx.claim.createManyAndReturn({
        data: grounded.accepted.map((c) => ({
          applicantId: doc.applicantId,
          documentId: doc.id,
          runId,
          fieldKey: c.fieldKey,
          entryKey: c.entryKey,
          rawValue: c.rawValue,
          value: c.value === null || c.value === undefined ? Prisma.JsonNull : json(c.value),
          source: 'DOCUMENT' as const,
          page: c.page,
          quote: c.quote,
          // The model reports no calibrated confidence; none is invented.
          confidence: null,
        })),
        select: CLAIM_SELECT,
      });
      await tx.documentRun.update({
        where: { id: runId },
        data: {
          status: 'DONE',
          isActive: true,
          error: null,
          docType,
          textMethod: read.textMethod,
          pages: json(pages),
          extraction: json(extraction),
          completedAt: new Date(),
        },
      });
      // The Document row mirrors the active run for convenient reads.
      const updated = await tx.document.update({
        where: { id: doc.id },
        data: { status: 'DONE', error: null, docType, textMethod: read.textMethod, pages: json(pages), extraction: json(extraction) },
        select: DOCUMENT_SELECT,
      });
      return { document: updated, claims: created };
    });

    return { document, claims, rejected };
  }

  /** Claims of a document: the active ones by default, or every claim ever extracted (with their run). */
  async listClaims(applicantId: string, documentId: string, scope: 'active' | 'all' = 'active') {
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, applicantId }, select: { id: true } });
    if (!doc) throw new NotFoundException(`Document ${documentId} not found for applicant ${applicantId}`);
    return this.prisma.claim.findMany({
      where: scope === 'active' ? { ...activeClaimsWhere(applicantId), documentId } : { documentId },
      orderBy: { createdAt: 'asc' },
      select: { ...CLAIM_SELECT, run: { select: { version: true, isActive: true } } },
    });
  }

  /** Processing history of a document, newest first. */
  async listRuns(applicantId: string, documentId: string) {
    const doc = await this.prisma.document.findFirst({ where: { id: documentId, applicantId }, select: { id: true } });
    if (!doc) throw new NotFoundException(`Document ${documentId} not found for applicant ${applicantId}`);
    const runs = await this.prisma.documentRun.findMany({
      where: { documentId },
      orderBy: { version: 'desc' },
      select: { ...RUN_SELECT, extraction: true, _count: { select: { claims: true } } },
    });
    return runs.map(({ extraction, _count, ...r }) => {
      const e = (extraction ?? {}) as { accepted?: number; proposed?: number; rejected?: unknown[] };
      return { ...r, claimCount: _count.claims, proposed: e.proposed ?? null, rejectedCount: e.rejected?.length ?? null };
    });
  }
}
