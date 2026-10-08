import {
  canonicalizeName,
  certificateAgeMonths,
  gradeMeetsMinimum,
  namesMatch,
  normalizeDate,
  normalizeDegreeLevel,
  parseDate,
  parseDurationMonths,
  parseGrade,
  parseLanguageScore,
  parseYear,
  totalExperienceMonths,
} from './index';

const NOW = new Date('2026-10-08T00:00:00Z');

describe('names', () => {
  it('canonicalizes case, titles, punctuation and diacritics', () => {
    expect(canonicalizeName('  Dr. ARJUN  Mehta ')).toBe('arjun mehta');
    expect(canonicalizeName('Müller')).toBe('mueller');
    expect(canonicalizeName('José')).toBe('jose');
  });

  it('matches order-insensitively and with initials', () => {
    expect(namesMatch(canonicalizeName('Arjun Mehta'), canonicalizeName('Mehta, Arjun'))).toBe(true);
    expect(namesMatch(canonicalizeName('A. Mehta'), canonicalizeName('Arjun Mehta'))).toBe(true);
    expect(namesMatch(canonicalizeName('Müller'), canonicalizeName('Mueller'))).toBe(true);
  });

  it('does not silently merge different names', () => {
    expect(namesMatch(canonicalizeName('Arjun Mehta'), canonicalizeName('Arjun Mehra'))).toBe(false);
    expect(namesMatch(canonicalizeName('Arjun Mehta'), canonicalizeName('Arjun K Mehta'))).toBe(false);
  });
});

describe('dates', () => {
  it.each([
    ['14 February 2004', '2004-02-14'],
    ['01 January 2025', '2025-01-01'],
    ['31 August 2025', '2025-08-31'],
    ['20 September 2026', '2026-09-20'],
    ['Jan 2025', '2025-01'],
    ['Sept 2025', '2025-09'],
    ['February 14, 2004', '2004-02-14'],
    ['14th Feb, 2004', '2004-02-14'],
    ['2025', '2025'],
    ['2025-03-07', '2025-03-07'],
    ['25/03/2021', '2021-03-25'],
    ['Present', 'PRESENT'],
  ])('normalizes %s', (raw, iso) => {
    expect(normalizeDate(raw)).toBe(iso);
  });

  it('flags ambiguous numeric dates instead of guessing', () => {
    expect(parseDate('03/04/2021')).toEqual({ kind: 'ambiguous', candidates: ['2021-04-03', '2021-03-04'] });
    expect(normalizeDate('03/04/2021')).toBeNull();
  });

  it('rejects impossible dates', () => {
    expect(normalizeDate('31 February 2025')).toBeNull();
    expect(normalizeDate('not a date')).toBeNull();
  });
});

describe('grades', () => {
  it('parses explicit scales', () => {
    expect(parseGrade('8.42 / 10.00')).toEqual({ value: 8.42, scale: 10 });
    expect(parseGrade('Final CGPA: 8,42 out of 10')).toEqual({ value: 8.42, scale: 10 });
    expect(parseGrade('78%')).toEqual({ value: 78, scale: 100 });
  });

  it('rejects scale-less and out-of-range values', () => {
    expect(parseGrade('8.42')).toBeNull();
    expect(parseGrade('11 / 10')).toBeNull();
  });

  it('compares against a minimum as fractions of the scale', () => {
    expect(gradeMeetsMinimum({ value: 8.42, scale: 10 }, 7.0, 10)).toBe(true);
    expect(gradeMeetsMinimum({ value: 70, scale: 100 }, 7.0, 10)).toBe(true);
    expect(gradeMeetsMinimum({ value: 6.9, scale: 10 }, 7.0, 10)).toBe(false);
    expect(gradeMeetsMinimum({ value: 7.0, scale: 10 }, 7.0, 10)).toBe(true);
  });
});

describe('language', () => {
  it('parses overall band scores', () => {
    expect(parseLanguageScore('7.0')).toBe(7);
    expect(parseLanguageScore('Overall Band 6.5')).toBe(6.5);
    expect(parseLanguageScore('12')).toBeNull();
    expect(parseLanguageScore('n/a')).toBeNull();
  });

  it('computes certificate age in whole months', () => {
    expect(certificateAgeMonths('2026-09-20', NOW)).toBe(0);
    expect(certificateAgeMonths('2024-10-08', NOW)).toBe(24);
    expect(certificateAgeMonths(null, NOW)).toBeNull();
  });
});

describe('experience', () => {
  it('parses durations', () => {
    expect(parseDurationMonths('Total experience represented in this demo letter: 8 months.')).toBe(8);
    expect(parseDurationMonths('Software Engineering Intern - 8 months')).toBe(8);
    expect(parseDurationMonths('1 year 2 months')).toBe(14);
    expect(parseDurationMonths('eight-month internship')).toBe(8);
    expect(parseDurationMonths('1.5 years')).toBe(18);
    expect(parseDurationMonths('no duration here')).toBeNull();
  });

  it('computes months from partial and full dates', () => {
    expect(totalExperienceMonths([{ start: '2025-01', end: '2025-08' }], NOW)).toBe(8);
    expect(totalExperienceMonths([{ start: '2025-01-01', end: '2025-08-31' }], NOW)).toBe(8);
  });

  it('merges overlapping periods and supports PRESENT', () => {
    const merged = totalExperienceMonths(
      [
        { start: '2025-01', end: '2025-06' },
        { start: '2025-04', end: '2025-08' },
      ],
      NOW,
    );
    expect(merged).toBe(8);
    expect(totalExperienceMonths([{ start: '2026-04', end: 'PRESENT' }], NOW)).toBeCloseTo(6.2, 0);
  });

  it('ignores reversed periods', () => {
    expect(totalExperienceMonths([{ start: '2025-08', end: '2025-01' }], NOW)).toBe(0);
  });
});

describe('degree', () => {
  it.each([
    ['Bachelor of Technology', 'BACHELOR'],
    ['B.Tech', 'BACHELOR'],
    ['BSc Computer Science', 'BACHELOR'],
    ['Master of Science', 'MASTER'],
    ['M.Sc.', 'MASTER'],
    ['PhD', 'DOCTORATE'],
    ['Diploma in Engineering', 'DIPLOMA'],
  ])('maps %s to %s', (raw, level) => {
    expect(normalizeDegreeLevel(raw)).toBe(level);
  });

  it('returns null for unknown titles and extracts years', () => {
    expect(normalizeDegreeLevel('Certificate of Attendance')).toBeNull();
    expect(parseYear('Class of 2025')).toBe(2025);
    expect(parseYear('no year')).toBeNull();
  });
});
