import { buildArjun } from '../testing/arjun.fixture';
import { qualify } from '../qualification/qualify';
import { hashInputs, summarize } from './evaluation-summary';

const NOW = new Date('2026-10-08T00:00:00Z');
const run = (opts?: Parameters<typeof buildArjun>[0]) => {
  const { claims, documents } = buildArjun(opts);
  return { claims, documents, result: qualify({ claims, documents, now: NOW }) };
};

describe('summarize', () => {
  it('counts requirements, mandatory coverage and gaps; the first evaluation has no changes', () => {
    const { result } = run();
    const s = summarize(result, null);
    expect(s.requirements).toEqual({ MET: 6 });
    expect(s.mandatory).toEqual({ total: 6, met: 6 });
    expect(s.gaps).toEqual({ total: 0, blocking: 0, byKind: {} });
    expect(s.conflictFieldIds).toEqual([]);
    expect(s.changes).toBeNull();
  });

  it('reports a conflict and the blocking gaps', () => {
    const s = summarize(run({ cvGraduationYear: '2024' }).result, null);
    expect(s.conflictFieldIds).toEqual(['degree.graduationYear']);
    expect(s.gaps.byKind.CONFLICT).toBe(1);
    expect(s.gaps.blocking).toBeGreaterThan(0);
    expect(s.requirements.CONFLICT).toBe(1);
  });

  it('describes what changed since the previous evaluation', () => {
    const before = run({ omit: ['language'] }).result;
    const after = run().result;
    const s = summarize(after, { id: 'prev', score: before.readiness.score, verdict: before.readiness.verdict, gaps: before.gaps });
    expect(s.changes).toMatchObject({
      previousEvaluationId: 'prev',
      verdict: { from: 'INCOMPLETE', to: 'READY' },
      newGapIds: [],
    });
    expect(s.changes!.scoreDelta).toBeGreaterThan(0);
    expect(s.changes!.closedGapIds).toEqual(expect.arrayContaining(['MISSING_DOC:LANGUAGE_CERT', 'MISSING_FIELD:language.overall']));
  });
});

describe('hashInputs', () => {
  const docs = [
    { id: 'b', docType: 'DEGREE', status: 'DONE' },
    { id: 'a', docType: 'CV', status: 'DONE' },
  ];
  const base = { requirementSetId: 'X', claimIds: ['c2', 'c1'], documents: docs };

  it('is independent of ordering', () => {
    expect(hashInputs(base)).toBe(hashInputs({ requirementSetId: 'X', claimIds: ['c1', 'c2'], documents: [...docs].reverse() }));
  });
  it('changes when evidence, documents or the requirement set change', () => {
    const h = hashInputs(base);
    expect(hashInputs({ ...base, claimIds: ['c1', 'c2', 'c3'] })).not.toBe(h);
    expect(hashInputs({ ...base, documents: [docs[0]] })).not.toBe(h);
    expect(hashInputs({ ...base, documents: [{ ...docs[0], status: 'FAILED' }, docs[1]] })).not.toBe(h);
    expect(hashInputs({ ...base, requirementSetId: 'Y' })).not.toBe(h);
  });
});
