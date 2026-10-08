import type { LlmService } from '../llm/llm.service';
import { TINY_PNG, makeBlankPdf, makePdf, makeTextPdf } from '../testing/pdf-fixtures';
import { DocumentReader, IngestionError, MAX_PAGES } from './document-reader';

const TEXT = ['ENGLISH LANGUAGE TEST REPORT', 'Candidate Arjun Mehta', 'Overall Band 7.0 Listening 7.5'];

function fakeLlm(transcription: Array<{ pageNo: number; text: string }> | null, configured = true) {
  const completeJson = jest.fn(async () => ({ pages: transcription ?? [] }));
  const llm = { isConfigured: configured, model: 'fake', completeJson } as unknown as LlmService;
  return { llm, completeJson };
}
const pdf = (buffer: Buffer) => ({ buffer, mime: 'application/pdf', filename: 'doc.pdf' });

describe('DocumentReader: text PDF first, vision only when needed', () => {
  it('uses the text layer and never calls Claude for a selectable-text PDF', async () => {
    const { llm, completeJson } = fakeLlm(null);
    const r = await new DocumentReader(llm).read(pdf(makeTextPdf(TEXT)));
    expect(r.textMethod).toBe('TEXT_LAYER');
    expect(r.textLayer).toBe('TEXT');
    expect(r.pages[0]).toMatchObject({ pageNo: 1, method: 'TEXT_LAYER' });
    expect(r.pages[0].text).toContain('Overall Band 7.0');
    expect(completeJson).not.toHaveBeenCalled();
  });

  it('works for a text PDF even when no API key is configured', async () => {
    const { llm } = fakeLlm(null, false);
    await expect(new DocumentReader(llm).read(pdf(makeTextPdf(TEXT)))).resolves.toMatchObject({ textMethod: 'TEXT_LAYER' });
  });

  it('falls back to Claude vision for a scanned PDF and keeps page numbers', async () => {
    const { llm, completeJson } = fakeLlm([
      { pageNo: 1, text: 'ENGLISH LANGUAGE TEST REPORT\nOverall Band 7.0' },
      { pageNo: 2, text: 'Result: pass' },
    ]);
    const r = await new DocumentReader(llm).read(pdf(makeBlankPdf(2)));
    expect(completeJson).toHaveBeenCalledTimes(1);
    expect(r.textMethod).toBe('VISION');
    expect(r.textLayer).toBe('SCANNED');
    expect(r.pages.map((p) => [p.pageNo, p.method])).toEqual([[1, 'VISION'], [2, 'VISION']]);
    expect(r.pages[1].text).toBe('Result: pass');
  });

  it('sends the original PDF to Claude as a document block', async () => {
    const { llm, completeJson } = fakeLlm([{ pageNo: 1, text: 'x y z' }]);
    await new DocumentReader(llm).read(pdf(makeBlankPdf(1)));
    const req = completeJson.mock.calls[0] as unknown as [{ content: Array<{ type: string; source?: { media_type: string } }> }];
    expect(req[0].content[0]).toMatchObject({ type: 'document', source: { media_type: 'application/pdf' } });
  });

  it('mixed PDF: keeps the good text layer, uses vision only for the page that has none', async () => {
    const { llm } = fakeLlm([
      { pageNo: 1, text: 'MODEL VERSION OF PAGE 1 (must be ignored)' },
      { pageNo: 2, text: 'Handwritten note: Overall Band 7.0' },
    ]);
    const r = await new DocumentReader(llm).read(pdf(makePdf([TEXT, []])));
    expect(r.textLayer).toBe('MIXED');
    expect(r.pages[0]).toMatchObject({ method: 'TEXT_LAYER' });
    expect(r.pages[0].text).toContain('Candidate Arjun Mehta');
    expect(r.pages[0].text).not.toContain('MODEL VERSION');
    expect(r.pages[1]).toMatchObject({ method: 'VISION', text: 'Handwritten note: Overall Band 7.0' });
  });

  it('fails clearly when a scan needs vision but no API key is configured', async () => {
    const { llm, completeJson } = fakeLlm(null, false);
    await expect(new DocumentReader(llm).read(pdf(makeBlankPdf(1)))).rejects.toThrow(/GEMINI_API_KEY/);
    expect(completeJson).not.toHaveBeenCalled();
  });

  it('fails when vision finds no readable text', async () => {
    const { llm } = fakeLlm([{ pageNo: 1, text: '   ' }]);
    await expect(new DocumentReader(llm).read(pdf(makeBlankPdf(1)))).rejects.toThrow(IngestionError);
  });

  it('ignores malformed vision pages instead of trusting them', async () => {
    const llm = {
      isConfigured: true,
      model: 'fake',
      completeJson: async () => ({ pages: [{ pageNo: 'one', text: 'bad' }, { pageNo: 1, text: 'good text' }, null] }),
    } as unknown as LlmService;
    const r = await new DocumentReader(llm).read(pdf(makeBlankPdf(1)));
    expect(r.pages[0].text).toBe('good text');
  });

  it('transcribes an image with vision as a single page', async () => {
    const { llm, completeJson } = fakeLlm([{ pageNo: 1, text: 'Overall Band 7.0' }]);
    const r = await new DocumentReader(llm).read({ buffer: TINY_PNG, mime: 'image/png', filename: 'scan.png' });
    expect(r).toMatchObject({ textMethod: 'VISION', textLayer: 'IMAGE', pages: [{ pageNo: 1, method: 'VISION', text: 'Overall Band 7.0' }] });
    const req = completeJson.mock.calls[0] as unknown as [{ content: Array<{ type: string }> }];
    expect(req[0].content[0].type).toBe('image');
  });

  it('rejects unreadable PDFs and over-long documents', async () => {
    const { llm } = fakeLlm(null);
    await expect(new DocumentReader(llm).read(pdf(Buffer.from('%PDF-1.4 garbage')))).rejects.toThrow(/could not be read/);
    await expect(new DocumentReader(llm).read(pdf(makeBlankPdf(MAX_PAGES + 1)))).rejects.toThrow(/limit/);
  });
});
