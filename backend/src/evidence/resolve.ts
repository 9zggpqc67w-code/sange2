import { canonicalText } from '../normalization/text';
import { COMPARATORS } from './comparators';
import {
  ClaimRecord,
  EvidenceState,
  FieldState,
  FieldStates,
  fieldStateId,
} from './evidence.types';
import { fieldDef } from './field-registry';

const isNil = (v: unknown) => v === null || v === undefined;

/** Deterministic equivalence of two claims for the same field. */
export function claimsAgree(fieldKey: string, a: ClaimRecord, b: ClaimRecord): boolean {
  if (isNil(a.value) || isNil(b.value)) {
    // At least one value could not be normalized: compare the raw text conservatively.
    return canonicalText(a.rawValue) === canonicalText(b.rawValue);
  }
  return COMPARATORS[fieldDef(fieldKey).comparator].equivalent(a.value, b.value);
}

interface Group {
  claims: ClaimRecord[];
}

function groupByAgreement(fieldKey: string, claims: ClaimRecord[]): Group[] {
  const groups: Group[] = [];
  for (const claim of claims) {
    const home = groups.find((g) => claimsAgree(fieldKey, g.claims[0], claim));
    if (home) home.claims.push(claim);
    else groups.push({ claims: [claim] });
  }
  return groups;
}

function representativeValue(fieldKey: string, claims: ClaimRecord[]): unknown {
  // Prefer document-backed values; among equivalents keep the most precise one.
  const pool = claims.some((c) => c.source === 'DOCUMENT')
    ? claims.filter((c) => c.source === 'DOCUMENT')
    : claims;
  const prefer = COMPARATORS[fieldDef(fieldKey).comparator].prefer;
  return pool
    .map((c) => c.value)
    .filter((v) => !isNil(v))
    .reduce<unknown>((best, v) => (best === undefined ? v : prefer ? prefer(best, v) : best), undefined);
}

function stateOfGroup(claims: ClaimRecord[]): EvidenceState {
  if (claims.some((c) => c.source === 'DOCUMENT')) return EvidenceState.DOCUMENT_SUPPORTED;
  if (claims.some((c) => c.source === 'APPLICANT')) return EvidenceState.APPLICANT_PROVIDED;
  return EvidenceState.AI_GENERATED;
}

function resolveGroup(fieldKey: string, entryKey: string | null, all: ClaimRecord[]): FieldState | null {
  const live = all.filter((c) => !c.supersededById);
  if (live.length === 0) return null;

  const id = fieldStateId(fieldKey, entryKey);
  const evidence = live.filter((c) => !c.isResolution);
  const resolutions = live
    .filter((c) => c.isResolution)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const latest = resolutions[resolutions.length - 1];

  // An explicit applicant resolution settles the field, unless newer evidence disagrees with it.
  if (latest) {
    const newerDisagreeing = evidence.filter(
      (c) => c.createdAt.getTime() > latest.createdAt.getTime() && !claimsAgree(fieldKey, c, latest),
    );
    if (newerDisagreeing.length === 0) {
      const supporting = evidence.filter((c) => claimsAgree(fieldKey, c, latest));
      const docSupport = supporting.some((c) => c.source === 'DOCUMENT');
      return {
        id,
        fieldKey,
        entryKey,
        state: docSupport ? EvidenceState.DOCUMENT_SUPPORTED : EvidenceState.APPLICANT_PROVIDED,
        value: latest.value ?? representativeValue(fieldKey, supporting),
        claimIds: [latest.id, ...supporting.map((c) => c.id)],
        rejectedClaimIds: evidence.filter((c) => !claimsAgree(fieldKey, c, latest)).map((c) => c.id),
        resolved: true,
      };
    }
  }

  // No (still valid) resolution: a stale resolution is just another applicant claim.
  const groups = groupByAgreement(fieldKey, latest ? [...evidence, latest] : evidence);

  if (groups.length > 1) {
    return {
      id,
      fieldKey,
      entryKey,
      state: EvidenceState.CONFLICT,
      claimIds: groups.flatMap((g) => g.claims.map((c) => c.id)),
      rejectedClaimIds: [],
      conflictOptions: groups.map((g) => ({
        value: representativeValue(fieldKey, g.claims) ?? g.claims[0].rawValue,
        claimIds: g.claims.map((c) => c.id),
        sources: [...new Set(g.claims.map((c) => c.source))],
      })),
      resolved: false,
    };
  }

  const claims = groups[0].claims;
  return {
    id,
    fieldKey,
    entryKey,
    state: stateOfGroup(claims),
    value: representativeValue(fieldKey, claims),
    claimIds: claims.map((c) => c.id),
    rejectedClaimIds: [],
    resolved: false,
  };
}

/**
 * Deterministically derives the evidence state of every field that has at least one
 * claim. Fields without claims are MISSING (see getFieldState). Conflicting evidence is
 * never merged: it is reported as CONFLICT until the applicant records a resolution.
 */
export function resolveFields(claims: ClaimRecord[]): FieldStates {
  const buckets = new Map<string, { fieldKey: string; entryKey: string | null; claims: ClaimRecord[] }>();
  for (const claim of claims) {
    const entryKey = claim.entryKey ?? null;
    const id = fieldStateId(claim.fieldKey, entryKey);
    const bucket = buckets.get(id) ?? { fieldKey: claim.fieldKey, entryKey, claims: [] };
    bucket.claims.push(claim);
    buckets.set(id, bucket);
  }

  const states: FieldStates = {};
  for (const [id, b] of buckets) {
    const state = resolveGroup(b.fieldKey, b.entryKey, b.claims);
    if (state) states[id] = state;
  }
  return states;
}

export function getFieldState(states: FieldStates, fieldKey: string, entryKey?: string | null): FieldState {
  const id = fieldStateId(fieldKey, entryKey);
  return (
    states[id] ?? {
      id,
      fieldKey,
      entryKey: entryKey ?? null,
      state: EvidenceState.MISSING,
      claimIds: [],
      rejectedClaimIds: [],
      resolved: false,
    }
  );
}
