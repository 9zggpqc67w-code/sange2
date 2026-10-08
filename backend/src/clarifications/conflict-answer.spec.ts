import type { ClaimRecord } from '../evidence/evidence.types';
import { normalizeClaimValue } from '../evidence/field-registry';
import { conflictOptions, representative, selectOption } from './conflict-answer';

let seq = 0;
const claim = (fieldKey: string, rawValue: string, source: ClaimRecord['source'] = 'DOCUMENT', entryKey: string | null = null): ClaimRecord => ({
  id: `c${++seq}`,
  fieldKey,
  entryKey,
  rawValue,
  value: normalizeClaimValue(fieldKey, rawValue),
  source,
  createdAt: new Date(Date.UTC(2026, 9, 8, 10, 0, seq)),
});

const YEAR = 'degree.graduationYear';
const years = () => conflictOptions(YEAR, [claim(YEAR, '2025'), claim(YEAR, '2024'), claim(YEAR, 'Graduation year 2025')]);

describe('conflictOptions', () => {
  it('groups equivalent claims into one option each', () => {
    const groups = years();
    expect(groups).toHaveLength(2);
    expect(groups[0].map((c) => c.rawValue)).toEqual(['2025', 'Graduation year 2025']);
    expect(groups[1].map((c) => c.rawValue)).toEqual(['2024']);
  });

  it('is a single option when everything agrees (no conflict)', () => {
    expect(conflictOptions(YEAR, [claim(YEAR, '2025'), claim(YEAR, '2025')])).toHaveLength(1);
  });
});

describe('selectOption', () => {
  const groups = years();

  it.each([
    ['numeric value', { value: 2024 }, 1],
    ['string value', { value: '2025' }, 0],
    ['choice', { choice: '2024' }, 1],
    ['a short sentence naming exactly one option', { text: 'It is 2025' }, 0],
  ])('accepts %s', (_n, answer, index) => {
    expect(selectOption(YEAR, groups, answer)).toEqual({ ok: true, index });
  });

  it('falls through to the next field when the first does not match', () => {
    expect(selectOption(YEAR, groups, { value: 'n/a', text: '2024' })).toEqual({ ok: true, index: 1 });
  });

  it.each([
    ['a value that is not an option', { value: 2023 }],
    ['free text without a value', { text: 'whatever you think' }],
    ['a different type of value', { value: { year: 2025 } }],
    ['an empty answer', {}],
  ])('rejects %s', (_n, answer) => {
    expect(selectOption(YEAR, groups, answer)).toEqual({ ok: false, reason: 'NO_MATCH' });
  });

  it('rejects text that mentions several options instead of silently picking one', () => {
    expect(selectOption(YEAR, groups, { text: '2024 or 2025' })).toEqual({ ok: false, reason: 'AMBIGUOUS' });
    expect(selectOption(YEAR, groups, { text: 'maybe 2025, not 2024' })).toEqual({ ok: false, reason: 'AMBIGUOUS' });
  });

  it('works for non-numeric fields and flags answers that fit several options', () => {
    const inst = 'degree.institution';
    const g = conflictOptions(inst, [claim(inst, 'Riverview Institute of Technology'), claim(inst, 'Lakeside University')]);
    expect(g).toHaveLength(2);
    expect(selectOption(inst, g, { choice: 'Lakeside University' })).toEqual({ ok: true, index: 1 });
    expect(selectOption(inst, g, { text: 'MIT' })).toEqual({ ok: false, reason: 'NO_MATCH' });
  });
});

describe('representative', () => {
  it('prefers the document wording over an applicant claim', () => {
    const g = [claim(YEAR, '2025', 'APPLICANT'), claim(YEAR, 'Year of Graduation 2025', 'DOCUMENT')];
    expect(representative(g).rawValue).toBe('Year of Graduation 2025');
  });
});
