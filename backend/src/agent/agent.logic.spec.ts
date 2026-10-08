// Pure tests of candidate selection, guardrails and fallback, on the fictional Arjun Mehta evidence.
import { createClaimFactory, buildArjun } from '../testing/arjun.fixture';
import { qualify } from '../qualification/qualify';
import type { ClaimRecord } from '../evidence/evidence.types';
import { fieldDef } from '../evidence/field-registry';
import {
  AgentState,
  Candidate,
  buildLlmContext,
  buildPlan,
  fallbackDecision,
  stateBlocker,
  validateDecision,
} from './agent.logic';

const NOW = new Date('2026-10-08T00:00:00Z');

/** Builds the slice of the journey read model the agent uses, from claims + documents. */
function stateFor(claims: ClaimRecord[], documents: ReturnType<typeof buildArjun>['documents'], over: Partial<AgentState> = {}): AgentState {
  const result = qualify({ claims, documents, now: NOW });
  const docTypeOf = new Map(claims.map((c) => [c.id, documents.find((d) => d.id === c.documentId)?.docType ?? null]));
  const evidence = (ids: string[]) => ids.map((claimId) => ({ claimId, documentType: docTypeOf.get(claimId) ?? null }));
  const fields = Object.values(result.fields);
  return {
    applicant: { goal: "Master's in Computer Science in Germany", programLabel: null },
    stage: 'INCOMPLETE',
    isStale: false,
    documents: documents.map((d) => ({ id: d.id, docType: d.docType, status: d.status, activeVersion: 1 })),
    profile: fields.map((f) => ({ id: f.id, label: fieldDef(f.fieldKey).label, state: f.state, value: f.value ?? null, evidence: f.claimIds.map((claimId) => ({ claimId })) })),
    evaluation: {
      id: 'eval-1',
      verdict: result.readiness.verdict,
      score: result.readiness.score,
      isDemo: true,
      requirements: result.requirements.map((r) => ({ requirementId: r.requirementId, title: r.title, status: r.status, mandatory: r.mandatory, weight: r.weight, message: r.message, claimIds: r.claimIds })),
    },
    gaps: result.gaps,
    conflicts: result.gaps
      .filter((g) => g.kind === 'CONFLICT')
      .map((g) => ({
        gapId: g.id,
        fieldId: g.fieldId ?? null,
        label: g.fieldId ?? null,
        options: (result.fields[g.fieldId!].conflictOptions ?? []).map((o) => ({ value: o.value, evidence: evidence(o.claimIds) })),
      })),
    clarifications: { items: [] },
    ...over,
  };
}

const arjun = (opts?: Parameters<typeof buildArjun>[0]) => {
  const a = buildArjun(opts);
  return stateFor(a.claims, a.documents);
};
const candidatesOf = (state: AgentState) => {
  const plan = buildPlan(state);
  if ('noAction' in plan) throw new Error(`unexpected noAction: ${plan.noAction}`);
  return plan.candidates;
};

/** A state where the only problem is a CGPA below the DEMO minimum (every document present). */
function lowGpaState() {
  const a = buildArjun();
  const claim = createClaimFactory();
  const claims = a.claims.filter((c) => c.fieldKey !== 'degree.cgpa').concat(claim({ fieldKey: 'degree.cgpa', raw: '6.20 / 10.00', doc: 'degree' }));
  return stateFor(claims, a.documents);
}

describe('candidate selection', () => {
  it('a blocking conflict becomes ASK_CLARIFICATION with the stored options and sources', () => {
    const c = candidatesOf(arjun({ cvGraduationYear: '2024' }));
    expect(c[0]).toMatchObject({ action: 'ASK_CLARIFICATION', kind: 'CONFLICT', gapId: 'CONFLICT:degree.graduationYear', fieldId: 'degree.graduationYear', severity: 'BLOCKING' });
    expect(c[0].options.map((o) => o.value).sort()).toEqual([2024, 2025]);
    expect(c[0].options.find((o) => o.value === 2024)!.sources).toEqual(['CV']);
    expect(c[0].claimIds.length).toBeGreaterThanOrEqual(2);
  });

  it('a missing mandatory document becomes REQUEST_DOCUMENT, and the redundant field question is suppressed', () => {
    const c = candidatesOf(arjun({ omit: ['language'] }));
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ action: 'REQUEST_DOCUMENT', docType: 'LANGUAGE_CERT', gapId: 'MISSING_DOC:LANGUAGE_CERT' });
  });

  it('an unmet mandatory requirement becomes SHOW_MISSING_REQUIREMENT', () => {
    const c = candidatesOf(lowGpaState());
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ action: 'SHOW_MISSING_REQUIREMENT', kind: 'UNMET_REQUIREMENT', requirementId: 'gpa-min', gapId: null, severity: 'BLOCKING' });
    expect(c[0].description).toMatch(/Minimum CGPA/);
  });

  it('a ready applicant gets RECOMMEND_NEXT_STEP only', () => {
    const c = candidatesOf(arjun());
    expect(c).toEqual([expect.objectContaining({ action: 'RECOMMEND_NEXT_STEP', kind: 'READY', gapId: null })]);
  });

  it('orders conflict > missing document > unmet requirement, and keeps at most three', () => {
    const a = buildArjun({ cvGraduationYear: '2024', omit: ['language'] });
    const c = candidatesOf(stateFor(a.claims, a.documents));
    expect(c.map((x) => x.kind)).toEqual(['CONFLICT', 'MISSING_DOC']);

    const gpa = lowGpaState();
    gpa.gaps = [...arjun({ omit: ['language'] }).gaps];
    expect(candidatesOf(gpa).map((x) => x.kind)).toEqual(['MISSING_DOC', 'UNMET_REQUIREMENT']);

    const many = arjun({ omit: ['cv', 'degree', 'transcript', 'language'] });
    expect(candidatesOf(many).length).toBeLessThanOrEqual(3);
  });

  it('does nothing when the state does not allow a decision', () => {
    const ready = arjun();
    expect(stateBlocker({ ...ready, evaluation: null })).toMatch(/not been evaluated/);
    expect(stateBlocker({ ...ready, isStale: true })).toMatch(/re-evaluate/);
    expect(stateBlocker({ ...ready, stage: 'DOCUMENTS_PROCESSING' })).toMatch(/still being processed/);
    expect(buildPlan({ ...ready, isStale: true })).toEqual({ noAction: expect.stringMatching(/re-evaluate/) });
  });

  it('does not re-ask a gap that has an OPEN clarification or an answer awaiting re-evaluation', () => {
    const s = arjun({ cvGraduationYear: '2024' });
    const gapId = 'CONFLICT:degree.graduationYear';
    const open = { ...s, clarifications: { items: [{ id: 'q', status: 'OPEN', gapId, evaluationId: 'eval-1', prompt: 'p' }] } };
    expect(buildPlan(open)).toEqual({ noAction: expect.stringMatching(/Waiting/) });
    const answered = { ...s, clarifications: { items: [{ id: 'q', status: 'ANSWERED', gapId, evaluationId: 'eval-1', prompt: 'p' }] } };
    expect(buildPlan(answered)).toEqual({ noAction: expect.stringMatching(/Waiting/) });
    // an answer given for an OLDER evaluation does not block asking again
    const old = { ...s, clarifications: { items: [{ id: 'q', status: 'ANSWERED', gapId, evaluationId: 'eval-0', prompt: 'p' }] } };
    expect('candidates' in buildPlan(old)).toBe(true);
  });

  it('says nothing is needed when there is no gap and the verdict is not READY', () => {
    const s = arjun();
    s.evaluation!.verdict = 'PARTIAL';
    expect(buildPlan(s)).toEqual({ noAction: expect.stringMatching(/Nothing further/) });
  });
});

describe('guardrails', () => {
  const missingLang = arjun({ omit: ['language'] });
  const conflict = arjun({ cvGraduationYear: '2024' });
  const ready = arjun();

  const run = (state: AgentState, raw: unknown) => {
    const candidates = candidatesOf(state);
    return validateDecision(raw, candidates, state, buildLlmContext(state, candidates));
  };
  const docReq = (over: Record<string, unknown> = {}) => ({
    action: 'REQUEST_DOCUMENT',
    message: 'Please upload your language certificate.',
    rationale: 'Mandatory document missing.',
    gapId: 'MISSING_DOC:LANGUAGE_CERT',
    requirementId: null,
    docType: 'LANGUAGE_CERT',
    route: null,
    evidenceRefs: [],
    ...over,
  });
  const askConflict = (over: Record<string, unknown> = {}) => ({
    action: 'ASK_CLARIFICATION',
    message: 'Your documents disagree on the graduation year (2024 vs 2025). Which is correct?',
    rationale: 'Blocking conflict.',
    gapId: 'CONFLICT:degree.graduationYear',
    requirementId: null,
    docType: null,
    route: null,
    evidenceRefs: [],
    ...over,
  });
  const recommend = (over: Record<string, unknown> = {}) => ({
    action: 'RECOMMEND_NEXT_STEP',
    message: 'You meet all DEMO study requirements; prepare your application.',
    rationale: 'Ready.',
    gapId: null,
    requirementId: null,
    docType: null,
    route: 'STUDY',
    evidenceRefs: [],
    ...over,
  });

  it('accepts valid decisions and takes parameters from the backend candidate', () => {
    const a = run(missingLang, docReq());
    expect(a.violations).toEqual([]);
    expect(a.decision).toMatchObject({ action: 'REQUEST_DOCUMENT', docType: 'LANGUAGE_CERT', gapId: 'MISSING_DOC:LANGUAGE_CERT' });
    expect(run(conflict, askConflict()).violations).toEqual([]);
    const r = run(ready, recommend({ route: null }));
    expect(r.violations).toEqual([]);
    expect(r.decision!.route).toBe('STUDY'); // filled in by the backend
  });

  it('rejects an invalid gap id', () => {
    expect(run(missingLang, docReq({ gapId: 'MISSING_DOC:PASSPORT' })).violations).toContain('GAP_NOT_A_CANDIDATE');
  });

  it('rejects an action that is not allowed for the candidate', () => {
    const v = run(conflict, askConflict({ action: 'REQUEST_DOCUMENT', docType: 'LANGUAGE_CERT', message: 'Please upload a language certificate.' }));
    expect(v.violations).toEqual(expect.arrayContaining(['ACTION_NOT_ALLOWED_FOR_CANDIDATE']));
    expect(v.decision).toBeNull();
  });

  it('rejects a requirement that is already satisfied', () => {
    const v = run(lowGpaState(), {
      ...docReq(),
      action: 'SHOW_MISSING_REQUIREMENT',
      gapId: null,
      docType: null,
      requirementId: 'degree-level',
      message: 'Your degree level is a problem (DEMO).',
    });
    expect(v.violations).toContain('REQUIREMENT_ALREADY_SATISFIED');
  });

  it('rejects a document that is already present and usable', () => {
    const v = run(missingLang, docReq({ docType: 'CV', message: 'Please upload your CV.' }));
    expect(v.violations).toEqual(expect.arrayContaining(['DOCUMENT_ALREADY_PRESENT', 'DOCTYPE_MISMATCH']));
  });

  it('rejects a document type that does not match the gap', () => {
    expect(run(missingLang, docReq({ docType: 'SOP' })).violations).toContain('DOCTYPE_MISMATCH');
  });

  it('rejects unsupported routes, routes on the wrong action, and routes without requirement data', () => {
    expect(run(ready, recommend({ route: 'ABROAD' })).violations).toContain('UNSUPPORTED_ROUTE');
    expect(run(ready, recommend({ route: 'EMPLOYMENT' })).violations).toContain('ROUTE_NOT_BACKED_BY_REQUIREMENTS');
    expect(run(ready, recommend({ route: 'VOCATIONAL_TRAINING' })).violations).toContain('ROUTE_NOT_BACKED_BY_REQUIREMENTS');
    expect(run(missingLang, docReq({ route: 'STUDY' })).violations).toContain('ROUTE_NOT_ALLOWED_FOR_ACTION');
  });

  it('rejects a hallucinated requirement', () => {
    const v = run(lowGpaState(), {
      ...recommend(),
      action: 'SHOW_MISSING_REQUIREMENT',
      route: null,
      requirementId: 'german-b2',
      message: 'You must reach German B2 (DEMO).',
    });
    expect(v.violations).toContain('UNKNOWN_REQUIREMENT');
  });

  it('accepts the real unmet requirement', () => {
    const v = run(lowGpaState(), {
      ...recommend(),
      action: 'SHOW_MISSING_REQUIREMENT',
      route: null,
      requirementId: 'gpa-min',
      message: 'The DEMO minimum CGPA is not met.',
    });
    expect(v.violations).toEqual([]);
    expect(v.decision!.requirementId).toBe('gpa-min');
  });

  it('rejects an evidence reference that does not exist, and accepts one that does', () => {
    expect(run(conflict, askConflict({ evidenceRefs: ['claim-that-does-not-exist'] })).violations).toContain('UNKNOWN_EVIDENCE_REF');
    const real = candidatesOf(conflict)[0].claimIds[0];
    expect(run(conflict, askConflict({ evidenceRefs: [real] })).violations).toEqual([]);
  });

  it('rejects numbers that are not in the supplied state, accepts ones that are', () => {
    expect(run(conflict, askConflict({ message: 'Was it 2023 or 2025?' })).violations).toContain('UNSUPPORTED_NUMBER:2023');
    expect(run(conflict, askConflict({ rationale: 'Your CGPA of 9.9 is high.' })).violations).toContain('UNSUPPORTED_NUMBER:9.9');
    expect(run(conflict, askConflict()).violations).toEqual([]);
  });

  it('does not let digits inside ids (e.g. a uuid in the change summary) license numbers', () => {
    const state = arjun({ cvGraduationYear: '2024' });
    state.evaluation!.summary = { changes: { previousEvaluationId: 'a14b-0777-9c', newGapIds: ['X:99'], scoreDelta: 0 } };
    const candidates = candidatesOf(state);
    const ctx = buildLlmContext(state, candidates);
    const v = validateDecision(askConflict({ message: 'Was it 14 or 777?' }), candidates, state, ctx);
    expect(v.violations).toEqual(expect.arrayContaining(['UNSUPPORTED_NUMBER:14', 'UNSUPPORTED_NUMBER:777']));
    expect(validateDecision(askConflict(), candidates, state, ctx).violations).toEqual([]);
  });

  it('sends only goal and program to the model, so applicant ids/timestamps cannot license numbers', () => {
    const state = arjun({ cvGraduationYear: '2024' });
    // the real journey object carries more than the AgentState type declares
    (state as any).applicant = { ...state.applicant, id: '985fac29-3cbe-4b13-8539-c3afce73d48f', name: 'Arjun Mehta', email: 'a@b.c', createdAt: '2026-10-08T14:07:08.534Z', updatedAt: '2026-10-08T14:07:09.086Z' };
    const candidates = candidatesOf(state);
    const ctx = buildLlmContext(state, candidates);
    expect(ctx.applicant).toEqual({ goal: "Master's in Computer Science in Germany", programLabel: null });
    expect(JSON.stringify(ctx)).not.toMatch(/985fac29|14:07|a@b\.c/);
    // "14" (the hour in the timestamp) and "985" (from the id) must not be accepted as facts
    const v = validateDecision(askConflict({ message: 'Please answer within 14 days, ref 985.' }), candidates, state, ctx);
    expect(v.violations).toEqual(expect.arrayContaining(['UNSUPPORTED_NUMBER:14', 'UNSUPPORTED_NUMBER:985']));
  });

  it('rejects promises and missing DEMO labelling', () => {
    expect(run(ready, recommend({ message: 'You are eligible and your visa is guaranteed. DEMO.' })).violations).toContain('OVERPROMISE');
    expect(run(ready, recommend({ message: 'Prepare your application.' })).violations).toContain('MISSING_DEMO_LABEL');
  });

  it('rejects a decision that contradicts the evaluation', () => {
    const v = run(missingLang, recommend());
    expect(v.violations).toContain('CONTRADICTS_EVALUATION:NOT_READY');
    expect(run(conflict, { action: 'NO_ACTION', message: 'Nothing to do.', rationale: 'x', gapId: null, requirementId: null, docType: null, route: null, evidenceRefs: [] }).violations).toContain('NO_ACTION_WITH_CANDIDATES');
  });

  it('rejects extra fields, wrong types and non-objects', () => {
    expect(run(missingLang, { ...docReq(), score: 100 }).violations).toContain('UNKNOWN_FIELD:score');
    expect(run(missingLang, { ...docReq(), action: 'RESOLVE_CONFLICT' }).violations).toContain('INVALID_ACTION');
    expect(run(missingLang, { ...docReq(), message: '' }).violations).toContain('INVALID_MESSAGE');
    expect(run(missingLang, { ...docReq(), evidenceRefs: [1] }).violations).toContain('INVALID_EVIDENCE_REFS');
    for (const bad of [null, 'text', [1], 42]) expect(run(missingLang, bad).violations).toEqual(['MALFORMED_OUTPUT']);
  });
});

describe('fallback', () => {
  const states: Array<[string, AgentState]> = [
    ['conflict', arjun({ cvGraduationYear: '2024' })],
    ['missing document', arjun({ omit: ['language'] })],
    ['unmet requirement', lowGpaState()],
    ['ready', arjun()],
  ];

  it.each(states)('is deterministic, mentions DEMO where needed, and would itself pass the guardrails: %s', (_name, state) => {
    const candidates: Candidate[] = candidatesOf(state);
    const d = fallbackDecision(candidates[0]);
    expect(d).toEqual(fallbackDecision(candidates[0]));
    expect(d.action).toBe(candidates[0].action);
    const checked = validateDecision(d, candidates, state, buildLlmContext(state, candidates));
    expect(checked.violations).toEqual([]);
  });

  it('maps each situation to the expected action', () => {
    expect(states.map(([, s]) => fallbackDecision(candidatesOf(s)[0]).action)).toEqual([
      'ASK_CLARIFICATION',
      'REQUEST_DOCUMENT',
      'SHOW_MISSING_REQUIREMENT',
      'RECOMMEND_NEXT_STEP',
    ]);
  });
});
