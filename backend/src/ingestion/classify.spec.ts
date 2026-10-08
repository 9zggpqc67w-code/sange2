import { classifyDocument } from './classify';

const page = (text: string) => ({ pageNo: 1, text });

describe('classifyDocument', () => {
  const cases: Array<[string, string, string]> = [
    ['DEMO DOCUMENT\nCURRICULUM VITAE\nArjun Mehta', 'x.pdf', 'CV'],
    ['DEMO DOCUMENT\nDEGREE CERTIFICATE\nRiverview Institute', 'x.pdf', 'DEGREE'],
    ['DEMO DOCUMENT\nACADEMIC TRANSCRIPT\nB.Tech', 'x.pdf', 'TRANSCRIPT'],
    ['DEMO DOCUMENT\nENGLISH LANGUAGE TEST REPORT', 'x.pdf', 'LANGUAGE_CERT'],
    ['DEMO DOCUMENT\nEXPERIENCE LETTER\nNorthstar', 'x.pdf', 'EXPERIENCE_LETTER'],
    ['DEMO DOCUMENT\nSTATEMENT OF PURPOSE', 'x.pdf', 'SOP'],
  ];
  it.each(cases)('classifies by title: %j', (text, filename, expected) => {
    expect(classifyDocument(page(text), filename)).toEqual({ docType: expected, source: 'TITLE' });
  });

  it('is not fooled by a statement of purpose that talks about degrees and transcripts', () => {
    const text = 'STATEMENT OF PURPOSE\nI completed my degree and my transcript shows a CGPA of 8.4';
    expect(classifyDocument(page(text), 'sop.pdf').docType).toBe('SOP');
  });

  it('falls back to the filename when the title says nothing', () => {
    expect(classifyDocument(page('lorem ipsum'), '04_Arjun_Mehta_Language_Certificate.pdf')).toEqual({
      docType: 'LANGUAGE_CERT',
      source: 'FILENAME',
    });
    expect(classifyDocument(undefined, '01_Arjun_Mehta_CV.pdf').docType).toBe('CV');
  });

  it('returns UNKNOWN when nothing matches', () => {
    expect(classifyDocument(page('Demo applicant profile and rules'), '07_Demo_Profile_and_Rules.pdf')).toEqual({
      docType: 'UNKNOWN',
      source: 'NONE',
    });
  });
});
