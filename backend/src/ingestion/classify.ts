import type { DocumentType } from '../config/requirements.demo';
import type { PageText } from './pdf-text';

/** Title patterns, checked against the first lines of the first page, most specific first. */
const TITLE_RULES: Array<[DocumentType, RegExp]> = [
  ['SOP', /statement of purpose|personal statement|letter of motivation/],
  ['TRANSCRIPT', /academic transcript|transcript of records|\btranscript\b|semester results|grade sheet|mark ?sheet/],
  ['LANGUAGE_CERT', /language test|english test|test report|\bielts\b|\btoefl\b|overall band|language certificate/],
  ['EXPERIENCE_LETTER', /experience letter|experience certificate|employment (letter|certificate)|internship (letter|certificate)/],
  ['DEGREE', /degree certificate|certificate of graduation|provisional certificate|diploma certificate/],
  ['CV', /curriculum vitae|\bresume\b|\bcv\b/],
];

const FILENAME_RULES: Array<[DocumentType, RegExp]> = [
  ['SOP', /sop|statement[-_ ]?of[-_ ]?purpose/],
  ['TRANSCRIPT', /transcript|marksheet/],
  ['LANGUAGE_CERT', /language|ielts|toefl|english/],
  ['EXPERIENCE_LETTER', /experience|internship|employment/],
  ['DEGREE', /degree|diploma/],
  ['CV', /\bcv\b|_cv|cv_|resume|curriculum/],
];

const TITLE_LINES = 8;

export interface Classification {
  docType: DocumentType;
  source: 'TITLE' | 'FILENAME' | 'NONE';
}

/**
 * Cheap deterministic classification. Looks only at the document title area (a statement of
 * purpose that mentions "degree" must not be classified as a degree certificate).
 * Returns UNKNOWN when nothing matches; the LLM is then asked, and only for that case.
 */
export function classifyDocument(firstPage: PageText | undefined, filename: string): Classification {
  if (firstPage) {
    const head = firstPage.text.split(/\r?\n/).slice(0, TITLE_LINES).join(' ').toLowerCase();
    for (const [type, re] of TITLE_RULES) if (re.test(head)) return { docType: type, source: 'TITLE' };
  }
  const name = filename.toLowerCase();
  for (const [type, re] of FILENAME_RULES) if (re.test(name)) return { docType: type, source: 'FILENAME' };
  return { docType: 'UNKNOWN', source: 'NONE' };
}
