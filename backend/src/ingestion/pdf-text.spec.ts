import { makeBlankPdf, makeTextPdf, makePdf } from '../testing/pdf-fixtures';
import { assessTextLayer, extractPdfPages } from './pdf-text';

const LONG = ['CURRICULUM VITAE', 'Arjun Mehta', 'Bachelor of Technology in Computer Science and Engineering'];

describe('extractPdfPages', () => {
  it('reads the text layer page by page', async () => {
    const pages = await extractPdfPages(makeTextPdf(LONG, ['Page two: Graduation year: 2025']));
    expect(pages.map((p) => p.pageNo)).toEqual([1, 2]);
    expect(pages[0].text).toContain('Arjun Mehta');
    expect(pages[1].text).toContain('Graduation year: 2025');
  });

  it('returns empty text for pages without a text layer', async () => {
    const pages = await extractPdfPages(makeBlankPdf(2));
    expect(pages).toHaveLength(2);
    expect(pages.every((p) => p.text === '')).toBe(true);
  });

  it('rejects data that is not a PDF', async () => {
    await expect(extractPdfPages(Buffer.from('not a pdf at all'))).rejects.toBeDefined();
  });
});

describe('assessTextLayer: text vs scanned PDFs', () => {
  it('TEXT when every page has real text', async () => {
    const a = assessTextLayer(await extractPdfPages(makeTextPdf(LONG, LONG)));
    expect(a).toEqual({ kind: 'TEXT', usablePages: [1, 2], unusablePages: [] });
  });

  it('SCANNED when no page has a text layer', async () => {
    const a = assessTextLayer(await extractPdfPages(makeBlankPdf(3)));
    expect(a).toEqual({ kind: 'SCANNED', usablePages: [], unusablePages: [1, 2, 3] });
  });

  it('SCANNED when the only text is a stray page number / watermark', async () => {
    const a = assessTextLayer(await extractPdfPages(makePdf([['Page 1 of 1']])));
    expect(a.kind).toBe('SCANNED');
  });

  it('MIXED names exactly the pages that need vision', async () => {
    const a = assessTextLayer(await extractPdfPages(makePdf([LONG, [], LONG])));
    expect(a).toEqual({ kind: 'MIXED', usablePages: [1, 3], unusablePages: [2] });
  });

  it('treats an empty page list as scanned', () => {
    expect(assessTextLayer([]).kind).toBe('SCANNED');
  });
});
