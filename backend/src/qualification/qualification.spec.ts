import {
  DEMO_DISCLAIMER,
  DEMO_MSC_COMPUTER_SCIENCE,
  type RequirementDef,
  type RequirementSet,
} from '../config/requirements.demo';
import { EvidenceState } from '../evidence/evidence.types';
import { NOW, buildArjun } from '../testing/arjun.fixture';
import { computeReadiness } from './readiness';
import { qualify } from './qualify';
import type { RequirementResult } from './qualification.types';

const run = (opts: Parameters<typeof buildArjun>[0] = {}, set?: RequirementSet) => {
  const { claims, documents } = buildArjun(opts);
  return qualify({ claims, documents, now: NOW, requirementSet: set });
};
const byId = (r: ReturnType<typeof run>, id: string) => r.requirements.find((x) => x.requirementId === id)!;

describe('Arjun Mehta - complete state', () => {
  const result = run();

  it('meets every demo requirement on document evidence', () => {
    for (const r of result.requirements) {
      expect(r.status).toBe('MET');
      expect(r.credit).toBe(1);
    }
    expect(byId(result, 'gpa-min').evidenceState).toBe(EvidenceState.DOCUMENT_SUPPORTED);
  });

  it('scores 100 and is READY with no gaps', () => {
    expect(result.readiness.score).toBe(100);
    expect(result.readiness.verdict).toBe('READY');
    expect(result.gaps).toEqual([]);
  });

  it('is clearly marked as demo', () => {
    expect(result.isDemo).toBe(true);
    expect(result.disclaimer).toBe(DEMO_DISCLAIMER);
  });

  it('reads the demo documents correctly', () => {
    expect(result.fields['applicant.name'].state).toBe(EvidenceState.DOCUMENT_SUPPORTED);
    expect(result.fields['degree.level'].value).toBe('BACHELOR');
    expect(result.fields['degree.graduationYear'].value).toBe(2025);
    expect(result.fields['degree.cgpa'].value).toEqual({ value: 8.42, scale: 10 });
    expect(result.fields['language.overall'].value).toBe(7);
    expect(result.fields['experience.totalMonths'].value).toBe(8);
    expect(result.fields['experience.startDate#job-1'].value).toBe('2025-01-01');
  });

  it('is deterministic', () => {
    expect(run()).toEqual(result);
  });
});

describe('missing information', () => {
  it('flags the missing language certificate (agent test step 1)', () => {
    const r = run({ omit: ['language'] });
    expect(byId(r, 'language-level').status).toBe('MISSING');
    expect(byId(r, 'docs-complete').status).toBe('MISSING');
    expect(byId(r, 'docs-complete').missingDocTypes).toEqual(['LANGUAGE_CERT']);
    expect(r.gaps.map((g) => g.id)).toEqual(
      expect.arrayContaining(['MISSING_DOC:LANGUAGE_CERT', 'MISSING_FIELD:language.overall']),
    );
    expect(r.gaps.every((g) => g.severity === 'BLOCKING')).toBe(true);
    // 100 - language (20) - documents (15)
    expect(r.readiness.score).toBe(65);
    expect(r.readiness.verdict).toBe('INCOMPLETE');
  });

  it('updates once the certificate is uploaded (agent test step 2)', () => {
    expect(run({ omit: ['language'] }).readiness.score).toBeLessThan(run().readiness.score);
    expect(run().readiness.verdict).toBe('READY');
  });

  it('treats a FAILED document as not uploaded', () => {
    const { claims, documents } = buildArjun();
    const docs = documents.map((d) => (d.docType === 'TRANSCRIPT' ? { ...d, status: 'FAILED' as const } : d));
    const r = qualify({ claims, documents: docs, now: NOW });
    expect(byId(r, 'docs-complete').missingDocTypes).toEqual(['TRANSCRIPT']);
  });
});

describe('conflicts', () => {
  it('flags CV graduation year 2024 as CONFLICT and does not pick a value (agent test step 3)', () => {
    const r = run({ cvGraduationYear: '2024' });
    expect(r.fields['degree.graduationYear'].state).toBe(EvidenceState.CONFLICT);
    expect(byId(r, 'consistency').status).toBe('CONFLICT');
    expect(r.readiness.verdict).toBe('INCOMPLETE');
    const gap = r.gaps.find((g) => g.id === 'CONFLICT:degree.graduationYear')!;
    expect(gap.severity).toBe('BLOCKING');
    expect(gap.requirementIds).toContain('consistency');
    // 100 - consistency (15)
    expect(r.readiness.score).toBe(85);
  });

  it('is resolved only by an explicit applicant choice, then the verdict recovers (agent test step 4)', () => {
    const { claims, documents, claim } = buildArjun({ cvGraduationYear: '2024' });
    const choice = claim({ fieldKey: 'degree.graduationYear', raw: '2025', isResolution: true });
    const r = qualify({ claims: [...claims, choice], documents, now: NOW });
    expect(r.fields['degree.graduationYear'].resolved).toBe(true);
    expect(r.fields['degree.graduationYear'].rejectedClaimIds).toHaveLength(1);
    expect(byId(r, 'consistency').status).toBe('MET');
    expect(r.gaps).toEqual([]);
    expect(r.readiness).toMatchObject({ score: 100, verdict: 'READY' });
  });

  it('reports a conflict on a field no requirement reads', () => {
    const { claims, documents, claim } = buildArjun();
    const r = qualify({
      claims: [...claims, claim({ fieldKey: 'applicant.dob', raw: '15 February 2004', doc: 'cv' })],
      documents,
      now: NOW,
    });
    expect(r.fields['applicant.dob'].state).toBe(EvidenceState.CONFLICT);
    expect(r.gaps.map((g) => g.id)).toContain('CONFLICT:applicant.dob');
    expect(byId(r, 'consistency').status).toBe('CONFLICT');
  });

  it('flags a requirement whose input is in conflict instead of evaluating one value', () => {
    const { claims, documents, claim } = buildArjun();
    const r = qualify({
      claims: [...claims, claim({ fieldKey: 'degree.cgpa', raw: '6.1 / 10', doc: 'cv' })],
      documents,
      now: NOW,
    });
    expect(byId(r, 'gpa-min').status).toBe('CONFLICT');
  });
});

describe('qualification rules', () => {
  it('NOT_MET on a mandatory requirement makes the applicant NOT_ELIGIBLE_DEMO', () => {
    const { claims, documents, claim } = buildArjun();
    const low = claims.filter((c) => c.fieldKey !== 'degree.cgpa');
    const r = qualify({
      claims: [...low, claim({ fieldKey: 'degree.cgpa', raw: '6.5 / 10', doc: 'degree' })],
      documents,
      now: NOW,
    });
    expect(byId(r, 'gpa-min').status).toBe('NOT_MET');
    expect(r.readiness.verdict).toBe('NOT_ELIGIBLE_DEMO');
    expect(r.readiness.score).toBe(80);
  });

  it('applicant-only evidence is UNVERIFIED with partial credit and a gap', () => {
    const { claims, documents, claim } = buildArjun({ omit: ['language'] });
    const r = qualify({
      claims: [...claims, claim({ fieldKey: 'language.overall', raw: '7.0' })],
      documents,
      now: NOW,
    });
    const lang = byId(r, 'language-level');
    expect(lang.status).toBe('UNVERIFIED');
    expect(lang.credit).toBe(0.5);
    expect(lang.evidenceState).toBe(EvidenceState.APPLICANT_PROVIDED);
    expect(r.gaps.map((g) => g.id)).toContain('UNVERIFIED:language.overall');
    expect(r.readiness.verdict).toBe('INCOMPLETE');
  });

  it('AI-derived evidence cannot satisfy a mandatory factual requirement', () => {
    const { claims, documents, claim } = buildArjun({ omit: ['language'] });
    const r = qualify({
      claims: [...claims, claim({ fieldKey: 'language.overall', raw: '7.0', source: 'AI_DERIVED' })],
      documents,
      now: NOW,
    });
    expect(byId(r, 'language-level')).toMatchObject({ status: 'UNVERIFIED', credit: 0.25 });
  });

  it('language below the minimum is NOT_MET', () => {
    const { claims, documents, claim } = buildArjun({ omit: ['language'] });
    const r = qualify({
      claims: [
        ...claims,
        claim({ fieldKey: 'language.overall', raw: '6.0', doc: 'language' }),
      ],
      documents,
      now: NOW,
    });
    expect(byId(r, 'language-level').status).toBe('NOT_MET');
  });

  it('unreadable CGPA needs review rather than being guessed', () => {
    const { claims, documents, claim } = buildArjun();
    const r = qualify({
      claims: [...claims.filter((c) => c.fieldKey !== 'degree.cgpa'), claim({ fieldKey: 'degree.cgpa', raw: '8.42', doc: 'degree' })],
      documents,
      now: NOW,
    });
    expect(byId(r, 'gpa-min').status).toBe('NEEDS_REVIEW');
    expect(r.gaps.map((g) => g.id)).toContain('NEEDS_REVIEW:gpa-min');
    expect(r.readiness.verdict).toBe('INCOMPLETE');
  });

  it('a field outside the demo allow-list needs semantic review', () => {
    const { claims, documents, claim } = buildArjun();
    const r = qualify({
      claims: [...claims.filter((c) => c.fieldKey !== 'degree.field'), claim({ fieldKey: 'degree.field', raw: 'Fine Arts', doc: 'degree' })],
      documents,
      now: NOW,
    });
    expect(byId(r, 'field-relevance').status).toBe('NEEDS_REVIEW');
  });

  it('a degree below the required level is NOT_MET', () => {
    const set: RequirementSet = {
      ...DEMO_MSC_COMPUTER_SCIENCE,
      requirements: DEMO_MSC_COMPUTER_SCIENCE.requirements.map((r) =>
        r.type === 'DEGREE_LEVEL' ? { ...r, params: { minLevel: 'MASTER' as const } } : r,
      ),
    };
    expect(byId(run({}, set), 'degree-level').status).toBe('NOT_MET');
  });

  it('enforces certificate age only when configured', () => {
    const withAge = (months: number): RequirementSet => ({
      ...DEMO_MSC_COMPUTER_SCIENCE,
      requirements: DEMO_MSC_COMPUTER_SCIENCE.requirements.map((r) =>
        r.type === 'LANGUAGE_LEVEL' ? { ...r, params: { ...r.params, maxCertificateAgeMonths: months } } : r,
      ),
    });
    expect(byId(run({}, withAge(24)), 'language-level').status).toBe('MET');
    // Test date is 20 Sep 2026; 'now' is 8 Oct 2026, i.e. 0 whole months old.
    const old = qualify({
      claims: buildArjun().claims,
      documents: buildArjun().documents,
      now: new Date('2029-01-01T00:00:00Z'),
      requirementSet: withAge(24),
    });
    expect(old.requirements.find((r) => r.type === 'LANGUAGE_LEVEL')!.status).toBe('NOT_MET');
  });
});

describe('experience (only where explicitly configured)', () => {
  const experience = (mandatory: boolean, minMonths = 12): RequirementDef => ({
    id: 'experience',
    title: `At least ${minMonths} months of experience`,
    type: 'EXPERIENCE_MONTHS',
    evaluator: 'DETERMINISTIC',
    weight: 10,
    mandatory,
    params: { minMonths },
  });
  const setWith = (req: RequirementDef): RequirementSet => ({
    ...DEMO_MSC_COMPUTER_SCIENCE,
    requirements: [...DEMO_MSC_COMPUTER_SCIENCE.requirements, req],
  });

  it('is not evaluated by the default demo set', () => {
    expect(run().requirements.some((r) => r.type === 'EXPERIENCE_MONTHS')).toBe(false);
  });

  it('lowers the score but does not block when optional', () => {
    const r = run({}, setWith(experience(false)));
    expect(byId(r, 'experience').status).toBe('NOT_MET'); // 8 < 12
    expect(r.readiness.score).toBe(91); // 100 / 110
    expect(r.readiness.verdict).toBe('READY');
  });

  it('blocks only when the set explicitly marks it mandatory', () => {
    const r = run({}, setWith(experience(true)));
    expect(r.readiness.verdict).toBe('NOT_ELIGIBLE_DEMO');
  });

  it('is MET when the threshold is satisfied (8 months >= 6)', () => {
    const r = run({}, setWith(experience(false, 6)));
    expect(byId(r, 'experience')).toMatchObject({ status: 'MET', observed: 8 });
    expect(r.readiness.score).toBe(100);
  });

  it('falls back to merged employment periods when no total is declared', () => {
    const { claims, documents } = buildArjun();
    const r = qualify({
      claims: claims.filter((c) => c.fieldKey !== 'experience.totalMonths'),
      documents,
      now: NOW,
      requirementSet: setWith(experience(false, 6)),
    });
    expect(byId(r, 'experience')).toMatchObject({ status: 'MET', observed: 8 });
  });

  it('is MISSING without any experience evidence', () => {
    const r = run({ omit: ['cv', 'experience'] }, setWith(experience(false)));
    expect(byId(r, 'experience').status).toBe('MISSING');
  });
});

describe('readiness score', () => {
  const result = (over: Partial<RequirementResult>): RequirementResult => ({
    requirementId: 'x',
    title: 'x',
    type: 'GPA_MIN',
    mandatory: true,
    weight: 10,
    status: 'MET',
    credit: 1,
    evidenceState: EvidenceState.DOCUMENT_SUPPORTED,
    message: '',
    inputFields: [],
    claimIds: [],
    ...over,
  });

  it('computes the weighted average of credits', () => {
    const r = computeReadiness([
      result({ requirementId: 'a', weight: 30, credit: 1 }),
      result({ requirementId: 'b', weight: 10, credit: 0.5, status: 'UNVERIFIED' }),
    ]);
    expect(r.score).toBe(88); // (30 + 5) / 40
    expect(r.breakdown.map((b) => b.points)).toEqual([75, 12.5]);
  });

  it('a high score cannot hide a failed mandatory requirement', () => {
    const r = computeReadiness([
      result({ requirementId: 'a', weight: 90 }),
      result({ requirementId: 'b', weight: 10, credit: 0, status: 'NOT_MET' }),
    ]);
    expect(r.score).toBe(90);
    expect(r.verdict).toBe('NOT_ELIGIBLE_DEMO');
  });

  it('is PARTIAL below the ready threshold when nothing blocks', () => {
    const r = computeReadiness([
      result({ requirementId: 'a', weight: 10 }),
      result({ requirementId: 'b', weight: 40, mandatory: false, credit: 0, status: 'NOT_MET' }),
    ]);
    expect(r).toMatchObject({ score: 20, verdict: 'PARTIAL' });
  });

  it('handles an empty requirement set', () => {
    expect(computeReadiness([])).toMatchObject({ score: 0, totalWeight: 0 });
  });
});
