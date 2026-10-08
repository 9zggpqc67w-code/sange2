import { createClaimFactory } from '../testing/arjun.fixture';
import { COMPARATORS } from './comparators';
import { EvidenceState } from './evidence.types';
import { normalizeClaimValue } from './field-registry';
import { getFieldState, resolveFields } from './resolve';

describe('comparators', () => {
  it('treats partial and full dates as compatible, different years as not', () => {
    expect(COMPARATORS.date.equivalent('2025-01', '2025-01-01')).toBe(true);
    expect(COMPARATORS.date.equivalent('2025', '2025-08-31')).toBe(true);
    expect(COMPARATORS.date.equivalent('2024', '2025')).toBe(false);
    expect(COMPARATORS.date.prefer!('2025-01', '2025-01-01')).toBe('2025-01-01');
  });

  it('compares grades as fractions of their scale', () => {
    expect(COMPARATORS.gpa.equivalent({ value: 8.42, scale: 10 }, { value: 84.2, scale: 100 })).toBe(true);
    expect(COMPARATORS.gpa.equivalent({ value: 8.42, scale: 10 }, { value: 8.1, scale: 10 })).toBe(false);
  });

  it('matches institutions that differ only by a trailing location', () => {
    const a = normalizeClaimValue('degree.institution', 'Riverview Institute of Technology');
    const b = normalizeClaimValue('degree.institution', 'Riverview Institute of Technology, Bengaluru');
    expect(COMPARATORS.textContains.equivalent(a, b)).toBe(true);
    expect(COMPARATORS.textContains.equivalent('it', 'bit')).toBe(false);
  });
});

describe('evidence state resolution', () => {
  it('is MISSING when there are no claims', () => {
    const states = resolveFields([]);
    expect(getFieldState(states, 'language.overall').state).toBe(EvidenceState.MISSING);
  });

  it('is APPLICANT_PROVIDED for an applicant-only claim', () => {
    const claim = createClaimFactory();
    const states = resolveFields([claim({ fieldKey: 'language.overall', raw: '7.0' })]);
    expect(states['language.overall'].state).toBe(EvidenceState.APPLICANT_PROVIDED);
    expect(states['language.overall'].value).toBe(7);
  });

  it('is DOCUMENT_SUPPORTED with a document claim, and an agreeing applicant claim only corroborates', () => {
    const claim = createClaimFactory();
    const states = resolveFields([
      claim({ fieldKey: 'language.overall', raw: '7.0' }),
      claim({ fieldKey: 'language.overall', raw: 'Overall Band 7.0', doc: 'language' }),
    ]);
    expect(states['language.overall'].state).toBe(EvidenceState.DOCUMENT_SUPPORTED);
    expect(states['language.overall'].claimIds).toHaveLength(2);
  });

  it('is AI_GENERATED for AI-only claims', () => {
    const claim = createClaimFactory();
    const states = resolveFields([claim({ fieldKey: 'degree.field', raw: 'Computer Science', source: 'AI_DERIVED' })]);
    expect(states['degree.field'].state).toBe(EvidenceState.AI_GENERATED);
  });

  it('flags CONFLICT and never picks a value', () => {
    const claim = createClaimFactory();
    const states = resolveFields([
      claim({ fieldKey: 'degree.graduationYear', raw: '2024', doc: 'cv' }),
      claim({ fieldKey: 'degree.graduationYear', raw: '2025', doc: 'degree' }),
      claim({ fieldKey: 'degree.graduationYear', raw: '2025', doc: 'transcript' }),
    ]);
    const f = states['degree.graduationYear'];
    expect(f.state).toBe(EvidenceState.CONFLICT);
    expect(f.value).toBeUndefined();
    expect(f.conflictOptions).toHaveLength(2);
    expect(f.conflictOptions!.map((o) => o.value).sort()).toEqual([2024, 2025]);
  });

  it('keeps repeated entries separate by entryKey', () => {
    const claim = createClaimFactory();
    const states = resolveFields([
      claim({ fieldKey: 'experience.role', raw: 'Intern', doc: 'cv', entryKey: 'job-1' }),
      claim({ fieldKey: 'experience.role', raw: 'Developer', doc: 'cv', entryKey: 'job-2' }),
    ]);
    expect(states['experience.role#job-1'].state).toBe(EvidenceState.DOCUMENT_SUPPORTED);
    expect(states['experience.role#job-2'].state).toBe(EvidenceState.DOCUMENT_SUPPORTED);
  });

  it('ignores superseded claims', () => {
    const claim = createClaimFactory();
    const old = { ...claim({ fieldKey: 'degree.graduationYear', raw: '2024', doc: 'cv' }), supersededById: 'c99' };
    const states = resolveFields([old, claim({ fieldKey: 'degree.graduationYear', raw: '2025', doc: 'degree' })]);
    expect(states['degree.graduationYear'].state).toBe(EvidenceState.DOCUMENT_SUPPORTED);
    expect(states['degree.graduationYear'].value).toBe(2025);
  });

  it('compares raw text when a value could not be normalized', () => {
    const claim = createClaimFactory();
    const states = resolveFields([
      claim({ fieldKey: 'degree.cgpa', raw: 'eight point four', doc: 'cv' }),
      claim({ fieldKey: 'degree.cgpa', raw: 'Eight Point Four', doc: 'degree' }),
    ]);
    expect(states['degree.cgpa'].state).toBe(EvidenceState.DOCUMENT_SUPPORTED);
    expect(states['degree.cgpa'].value).toBeUndefined();
  });

  describe('explicit applicant resolution', () => {
    it('settles a conflict, keeps the rejected claim, and reports document support', () => {
      const claim = createClaimFactory();
      const cv = claim({ fieldKey: 'degree.graduationYear', raw: '2024', doc: 'cv' });
      const degree = claim({ fieldKey: 'degree.graduationYear', raw: '2025', doc: 'degree' });
      const choice = claim({ fieldKey: 'degree.graduationYear', raw: '2025', isResolution: true });
      const f = resolveFields([cv, degree, choice])['degree.graduationYear'];
      expect(f.state).toBe(EvidenceState.DOCUMENT_SUPPORTED);
      expect(f.resolved).toBe(true);
      expect(f.value).toBe(2025);
      expect(f.rejectedClaimIds).toEqual([cv.id]);
      expect(f.claimIds).toEqual(expect.arrayContaining([choice.id, degree.id]));
    });

    it('is APPLICANT_PROVIDED if the chosen value has no document behind it', () => {
      const claim = createClaimFactory();
      const a = claim({ fieldKey: 'degree.graduationYear', raw: '2024', doc: 'cv' });
      const b = claim({ fieldKey: 'degree.graduationYear', raw: '2025', doc: 'degree' });
      const typed = claim({ fieldKey: 'degree.graduationYear', raw: '2023', isResolution: true });
      const f = resolveFields([a, b, typed])['degree.graduationYear'];
      expect(f.state).toBe(EvidenceState.APPLICANT_PROVIDED);
      expect(f.value).toBe(2023);
    });

    it('reopens the conflict when newer evidence disagrees with the resolution', () => {
      const claim = createClaimFactory();
      const cv = claim({ fieldKey: 'degree.graduationYear', raw: '2024', doc: 'cv' });
      const degree = claim({ fieldKey: 'degree.graduationYear', raw: '2025', doc: 'degree' });
      const choice = claim({ fieldKey: 'degree.graduationYear', raw: '2025', isResolution: true });
      const newer = claim({ fieldKey: 'degree.graduationYear', raw: '2023', doc: 'transcript' });
      const f = resolveFields([cv, degree, choice, newer])['degree.graduationYear'];
      expect(f.state).toBe(EvidenceState.CONFLICT);
      expect(f.resolved).toBe(false);
    });
  });
});
