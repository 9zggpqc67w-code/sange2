// Builds tiny valid PDFs for tests. A page with lines has a real text layer; a page with
// no lines has none (it behaves like a scanned page as far as text extraction goes).

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/** Each entry is one page: its text lines (empty array = a page without any text layer). */
export function makePdf(pages: string[][]): Buffer {
  const objects: string[] = [];
  const add = (body: string) => objects.push(body) && objects.length; // returns the object number

  const catalog = add('<< /Type /Catalog /Pages 2 0 R >>');
  const pagesObj = add(''); // filled below (object 2)
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const kids: number[] = [];
  for (const lines of pages) {
    const stream = lines.length
      ? `BT /F1 11 Tf 14 TL 40 780 Td ${lines.map((l) => `(${esc(l)}) Tj T*`).join(' ')} ET`
      : '';
    const content = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    kids.push(
      add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`),
    );
  }
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  void catalog;

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

export const makeTextPdf = (...pages: string[][]) => makePdf(pages);
/** A PDF whose pages have no text layer at all (what a scan looks like to a text extractor). */
export const makeBlankPdf = (pageCount = 1) => makePdf(Array.from({ length: pageCount }, () => []));

/** A 1x1 PNG, enough to exercise the image path. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);
