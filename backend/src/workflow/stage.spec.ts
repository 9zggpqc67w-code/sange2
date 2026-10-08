import { deriveStage, outcomeStage } from './stage';

describe('outcomeStage', () => {
  it('READY when the verdict is READY', () => {
    expect(outcomeStage({ verdict: 'READY', gaps: [] })).toBe('READY');
  });
  it('ACTION_REQUIRED for conflicts, even when other things are also missing', () => {
    expect(outcomeStage({ verdict: 'INCOMPLETE', gaps: [{ kind: 'MISSING_DOC' }, { kind: 'CONFLICT' }] })).toBe('ACTION_REQUIRED');
  });
  it('ACTION_REQUIRED when a mandatory requirement is not met', () => {
    expect(outcomeStage({ verdict: 'NOT_ELIGIBLE_DEMO', gaps: [] })).toBe('ACTION_REQUIRED');
  });
  it('INCOMPLETE for missing or unverified evidence', () => {
    expect(outcomeStage({ verdict: 'INCOMPLETE', gaps: [{ kind: 'MISSING_DOC' }, { kind: 'UNVERIFIED' }] })).toBe('INCOMPLETE');
    expect(outcomeStage({ verdict: 'PARTIAL', gaps: [] })).toBe('INCOMPLETE');
  });
});

describe('deriveStage', () => {
  const base = { processingDocuments: 0, activeClaims: 0, latestOutcome: null };
  it('NEW with no evidence', () => expect(deriveStage(base)).toBe('NEW'));
  it('PROFILE_BUILT with evidence but no evaluation', () => expect(deriveStage({ ...base, activeClaims: 3 })).toBe('PROFILE_BUILT'));
  it('the latest evaluation outcome once one exists', () => {
    expect(deriveStage({ ...base, activeClaims: 3, latestOutcome: 'INCOMPLETE' })).toBe('INCOMPLETE');
  });
  it('DOCUMENTS_PROCESSING wins while any document is processing', () => {
    expect(deriveStage({ processingDocuments: 1, activeClaims: 3, latestOutcome: 'READY' })).toBe('DOCUMENTS_PROCESSING');
  });
});
