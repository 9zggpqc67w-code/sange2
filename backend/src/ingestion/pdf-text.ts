import { PDFParse } from 'pdf-parse';

export interface PageText {
  pageNo: number;
  text: string;
}

/** Minimum letters+digits for a page's text layer to count as real, selectable text. */
export const MIN_USABLE_CHARS = 40;

/** Reads the embedded text layer, one entry per page. Throws if the file is not a readable PDF. */
export async function extractPdfPages(data: Buffer): Promise<PageText[]> {
  const parser = new PDFParse({ data: new Uint8Array(data) });
  try {
    const result = await parser.getText();
    return result.pages.map((p) => ({ pageNo: p.num, text: p.text.trim() }));
  } finally {
    await parser.destroy();
  }
}

const countAlnum = (s: string) => (s.match(/[\p{L}\p{N}]/gu) ?? []).length;

export interface TextLayerAssessment {
  /** 'TEXT' = every page has real text; 'SCANNED' = none do; 'MIXED' = some do. */
  kind: 'TEXT' | 'SCANNED' | 'MIXED';
  usablePages: number[];
  unusablePages: number[];
}

/**
 * Decides whether a PDF has a usable text layer. A scanned PDF either has no text objects or
 * only stray characters (page numbers, watermarks), so a page needs a minimum amount of
 * real letters/digits to count. Only pages that fail are read with vision.
 */
export function assessTextLayer(pages: PageText[], minChars = MIN_USABLE_CHARS): TextLayerAssessment {
  const usablePages = pages.filter((p) => countAlnum(p.text) >= minChars).map((p) => p.pageNo);
  const unusablePages = pages.filter((p) => !usablePages.includes(p.pageNo)).map((p) => p.pageNo);
  const kind = pages.length === 0 || usablePages.length === 0 ? 'SCANNED' : unusablePages.length === 0 ? 'TEXT' : 'MIXED';
  return { kind, usablePages, unusablePages };
}
