import { Injectable } from '@nestjs/common';
import { LlmContentBlock, LlmService } from '../llm/llm.service';
import { TRANSCRIPTION_SCHEMA, TRANSCRIPTION_SYSTEM_PROMPT } from './extraction.schema';
import { assessTextLayer, extractPdfPages, type PageText } from './pdf-text';

/** A problem with the document itself (not a bug): shown to the applicant, stored in Document.error. */
export class IngestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IngestionError';
  }
}

export const MAX_PAGES = 30;
export type PageMethod = 'TEXT_LAYER' | 'VISION';

export interface ReadPage extends PageText {
  method: PageMethod;
}

export interface ReadResult {
  pages: ReadPage[];
  /** TEXT_LAYER if every page came from the PDF text layer, otherwise VISION. */
  textMethod: PageMethod;
  textLayer: 'TEXT' | 'SCANNED' | 'MIXED' | 'IMAGE';
}

/**
 * Turns an uploaded file into page-level text, cheapest source first:
 *   1. PDF text layer (pdf-parse) - free, exact.
 *   2. Claude vision transcription - only for pages without a usable text layer, and for images.
 * Vision output is a model transcription, not classic OCR: it is stored as page text with
 * method=VISION, and quotes extracted later are validated against that stored transcription
 * exactly like they are for a text layer. No confidence number is invented for it.
 */
@Injectable()
export class DocumentReader {
  constructor(private readonly llm: LlmService) {}

  async read(file: { buffer: Buffer; mime: string; filename: string }): Promise<ReadResult> {
    if (file.mime === 'application/pdf') return this.readPdf(file.buffer, file.filename);
    if (file.mime === 'image/png' || file.mime === 'image/jpeg') return this.readImage(file.buffer, file.mime);
    throw new IngestionError(`Unsupported file type: ${file.mime}`);
  }

  private async readPdf(buffer: Buffer, filename: string): Promise<ReadResult> {
    let layer: PageText[];
    try {
      layer = await extractPdfPages(buffer);
    } catch {
      throw new IngestionError('The PDF could not be read (it may be corrupted or password-protected)');
    }
    if (layer.length > MAX_PAGES) throw new IngestionError(`Document has ${layer.length} pages; the limit is ${MAX_PAGES}`);

    const assessment = assessTextLayer(layer);
    if (assessment.kind === 'TEXT') {
      return { pages: layer.map((p) => ({ ...p, method: 'TEXT_LAYER' as const })), textMethod: 'TEXT_LAYER', textLayer: 'TEXT' };
    }

    // Scanned or mixed: transcribe with vision, keep the text layer wherever it was good.
    const transcribed = await this.transcribe(
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') } },
      filename,
    );
    const byPage = new Map(transcribed.map((p) => [p.pageNo, p.text]));
    const pages: ReadPage[] = layer.map((p) =>
      assessment.usablePages.includes(p.pageNo)
        ? { ...p, method: 'TEXT_LAYER' as const }
        : { pageNo: p.pageNo, text: (byPage.get(p.pageNo) ?? '').trim(), method: 'VISION' as const },
    );
    if (pages.every((p) => !p.text)) throw new IngestionError('No readable text could be found in this document');
    return { pages, textMethod: 'VISION', textLayer: assessment.kind };
  }

  private async readImage(buffer: Buffer, mime: 'image/png' | 'image/jpeg'): Promise<ReadResult> {
    const transcribed = await this.transcribe(
      { type: 'image', source: { type: 'base64', media_type: mime, data: buffer.toString('base64') } },
      'image',
    );
    const text = transcribed.map((p) => p.text).join('\n').trim();
    if (!text) throw new IngestionError('No readable text could be found in this image');
    return { pages: [{ pageNo: 1, text, method: 'VISION' }], textMethod: 'VISION', textLayer: 'IMAGE' };
  }

  private async transcribe(block: LlmContentBlock, label: string): Promise<PageText[]> {
    if (!this.llm.isConfigured) {
      throw new IngestionError('This document has no selectable text and needs a vision model, but GEMINI_API_KEY is not configured');
    }
    const out = (await this.llm.completeJson({
      system: TRANSCRIPTION_SYSTEM_PROMPT,
      content: [block, { type: 'text', text: `Transcribe this document (${label}) page by page.` }],
      schema: TRANSCRIPTION_SCHEMA,
      effort: 'low',
    })) as { pages?: unknown };

    const pages: PageText[] = [];
    for (const p of Array.isArray(out?.pages) ? out.pages : []) {
      const item = (p ?? {}) as { pageNo?: unknown; text?: unknown };
      if (Number.isInteger(item.pageNo) && typeof item.text === 'string') {
        pages.push({ pageNo: item.pageNo as number, text: item.text });
      }
    }
    return pages;
  }
}
