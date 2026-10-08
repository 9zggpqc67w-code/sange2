import { groundClaims, parseProposedClaims, type ProposedClaim } from './grounding';

const PAGES = [
  {
    pageNo: 1,
    text: [
      'DEGREE CERTIFICATE',
      'Candidate Arjun Mehta',
      'Date of Birth 14 February 2004',
      'University Riverview Institute of Technology, Bengaluru',
      'Final CGPA 8.42 / 10.00',
      'Year of Graduation 2025',
    ].join('\n'),
  },
  { pageNo: 2, text: 'Awarded on 30 June 2025\nCertificate ID DEMO-RIT-CSE-2025-0148' },
];

const claim = (p: Partial<ProposedClaim> & Pick<ProposedClaim, 'fieldKey' | 'rawValue' | 'quote'>): ProposedClaim => ({
  entryKey: null,
  page: 1,
  ...p,
});

describe('groundClaims: provenance is preserved', () => {
  it('keeps value, normalized value, page and the verbatim quote', () => {
    const { accepted, rejected } = groundClaims(
      [
        claim({ fieldKey: 'degree.graduationYear', rawValue: '2025', quote: 'Year of Graduation 2025' }),
        claim({ fieldKey: 'degree.cgpa', rawValue: '8.42 / 10.00', quote: 'Final CGPA 8.42 / 10.00' }),
        claim({ fieldKey: 'applicant.dob', rawValue: '14 February 2004', quote: 'Date of Birth 14 February 2004' }),
      ],
      PAGES,
      'DEGREE',
    );
    expect(rejected).toEqual([]);
    expect(accepted).toHaveLength(3);
    const year = accepted.find((c) => c.fieldKey === 'degree.graduationYear')!;
    expect(year).toMatchObject({ rawValue: '2025', value: 2025, page: 1, quote: 'Year of Graduation 2025', pageCorrected: false });
    expect(accepted.find((c) => c.fieldKey === 'applicant.dob')!.value).toBe('2004-02-14');
    expect(accepted.find((c) => c.fieldKey === 'degree.cgpa')!.value).toMatchObject({ value: 8.42, scale: 10 });
  });

  it('takes the page from where the quote really is, not from the model', () => {
    const { accepted } = groundClaims(
      [claim({ fieldKey: 'degree.graduationYear', rawValue: '2025', quote: 'Year of Graduation 2025', page: 2 })],
      PAGES,
      'DEGREE',
    );
    expect(accepted[0]).toMatchObject({ page: 1, pageCorrected: true });
  });

  it('tolerates line breaks, repeated whitespace, case and typographic dashes in the quote', () => {
    const pages = [{ pageNo: 1, text: 'Software   Engineering\nIntern – 8 months' }];
    const { accepted } = groundClaims(
      [claim({ fieldKey: 'experience.role', rawValue: 'Software Engineering Intern', quote: 'software engineering intern - 8 months', entryKey: 'job-1' })],
      pages,
      'CV',
    );
    expect(accepted).toHaveLength(1);
  });
});

describe('groundClaims: hallucinated fields are not accepted', () => {
  const reasonOf = (c: ProposedClaim, docType: Parameters<typeof groundClaims>[2] = 'DEGREE') =>
    groundClaims([c], PAGES, docType).rejected.map((r) => r.reason);

  it('rejects a quote that does not exist in the document', () => {
    expect(reasonOf(claim({ fieldKey: 'degree.graduationYear', rawValue: '2024', quote: 'Year of Graduation 2024' }))).toEqual([
      'QUOTE_NOT_IN_DOCUMENT',
    ]);
  });

  it('rejects a real quote whose value was changed (value not in quote)', () => {
    expect(reasonOf(claim({ fieldKey: 'degree.graduationYear', rawValue: '2024', quote: 'Year of Graduation 2025' }))).toEqual([
      'VALUE_NOT_IN_QUOTE',
    ]);
  });

  it('rejects a subtly altered number (8.42 -> 84.2) even though the digits are the same', () => {
    expect(reasonOf(claim({ fieldKey: 'degree.cgpa', rawValue: '84.2 / 10.00', quote: 'Final CGPA 8.42 / 10.00' }))).toEqual([
      'VALUE_NOT_IN_QUOTE',
    ]);
  });

  it('rejects a quote that exists only in the model\'s imagination, however plausible', () => {
    expect(reasonOf(claim({ fieldKey: 'applicant.dob', rawValue: '15 February 2004', quote: 'Born on 15 February 2004' }))).toEqual([
      'QUOTE_NOT_IN_DOCUMENT',
    ]);
  });

  it('rejects fields the document type cannot provide', () => {
    // a degree certificate cannot supply a language score, even with a "valid" quote
    expect(
      reasonOf(claim({ fieldKey: 'language.overall', rawValue: '8.42', quote: 'Final CGPA 8.42 / 10.00' })),
    ).toEqual(['FIELD_NOT_ALLOWED_FOR_DOCUMENT_TYPE']);
  });

  it('rejects everything for an UNKNOWN document type', () => {
    const r = groundClaims([claim({ fieldKey: 'applicant.name', rawValue: 'Arjun Mehta', quote: 'Candidate Arjun Mehta' })], PAGES, 'UNKNOWN');
    expect(r.accepted).toEqual([]);
    expect(r.rejected[0].reason).toBe('FIELD_NOT_ALLOWED_FOR_DOCUMENT_TYPE');
  });

  it('rejects unknown field keys, empty values and empty quotes', () => {
    expect(reasonOf(claim({ fieldKey: 'applicant.passportNumber', rawValue: 'X123', quote: 'X123' }))).toEqual(['UNKNOWN_FIELD']);
    expect(reasonOf(claim({ fieldKey: 'applicant.name', rawValue: '  ', quote: 'Candidate Arjun Mehta' }))).toEqual(['EMPTY_VALUE']);
    expect(reasonOf(claim({ fieldKey: 'applicant.name', rawValue: 'Arjun Mehta', quote: '' }))).toEqual(['EMPTY_VALUE']);
  });

  it('drops duplicates but keeps distinct entries of a repeated field', () => {
    const pages = [{ pageNo: 1, text: 'Acme Corp 2020-2021\nGlobex 2022-2023' }];
    const r = groundClaims(
      [
        claim({ fieldKey: 'experience.employer', rawValue: 'Acme Corp', quote: 'Acme Corp 2020-2021', entryKey: 'job-1' }),
        claim({ fieldKey: 'experience.employer', rawValue: 'Acme Corp', quote: 'Acme Corp 2020-2021', entryKey: 'job-1' }),
        claim({ fieldKey: 'experience.employer', rawValue: 'Globex', quote: 'Globex 2022-2023', entryKey: 'job-2' }),
      ],
      pages,
      'CV',
    );
    expect(r.accepted.map((c) => c.entryKey)).toEqual(['job-1', 'job-2']);
    expect(r.rejected.map((x) => x.reason)).toEqual(['DUPLICATE']);
  });

  it('only keeps entry keys on per-job fields', () => {
    const { accepted } = groundClaims(
      [claim({ fieldKey: 'applicant.name', rawValue: 'Arjun Mehta', quote: 'Candidate Arjun Mehta', entryKey: 'job-9' })],
      PAGES,
      'DEGREE',
    );
    expect(accepted[0].entryKey).toBeNull();
  });
});

describe('parseProposedClaims: untrusted model output', () => {
  it('accepts well-formed items and reports malformed ones instead of guessing', () => {
    const r = parseProposedClaims({
      documentType: 'DEGREE',
      claims: [
        { fieldKey: 'applicant.name', entryKey: null, rawValue: 'Arjun', page: 1, quote: 'Arjun' },
        { fieldKey: 'applicant.name', rawValue: 'Arjun', page: '1', quote: 'Arjun' },
        { fieldKey: 5 },
        null,
      ],
    });
    expect(r.documentType).toBe('DEGREE');
    expect(r.claims).toHaveLength(1);
    expect(r.rejected.map((x) => x.reason)).toEqual(['MALFORMED', 'MALFORMED', 'MALFORMED']);
  });

  it('survives garbage', () => {
    expect(parseProposedClaims(null).claims).toEqual([]);
    expect(parseProposedClaims('text').claims).toEqual([]);
    expect(parseProposedClaims({ claims: 'x' }).claims).toEqual([]);
  });
});
