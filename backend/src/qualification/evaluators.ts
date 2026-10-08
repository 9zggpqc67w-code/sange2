import type { DegreeLevel, RequirementDef } from '../config/requirements.demo';
import { SCORING } from '../config/scoring.config';
import { EvidenceState, FieldState, FieldStates } from '../evidence/evidence.types';
import { getFieldState } from '../evidence/resolve';
import {
  DEGREE_LEVEL_RANK,
  canonicalText,
  certificateAgeMonths,
  gradeMeetsMinimum,
  totalExperienceMonths,
  type ExperienceEntry,
  type Grade,
} from '../normalization';
import type { DocumentInfo, RequirementResult, RequirementStatus } from './qualification.types';

export interface EvalContext {
  fields: FieldStates;
  documents: DocumentInfo[];
  now: Date;
}

// ---------------------------------------------------------------- helpers

const FACT_CREDIT: Record<EvidenceState, number> = {
  [EvidenceState.DOCUMENT_SUPPORTED]: SCORING.credit.documentSupported,
  [EvidenceState.APPLICANT_PROVIDED]: SCORING.credit.applicantProvided,
  [EvidenceState.AI_GENERATED]: SCORING.credit.aiGenerated,
  [EvidenceState.MISSING]: 0,
  [EvidenceState.CONFLICT]: 0,
};

const base = (req: RequirementDef) => ({
  requirementId: req.id,
  title: req.title,
  type: req.type,
  mandatory: req.mandatory,
  weight: req.weight,
});

interface Inputs {
  fields: FieldState[];
  /** A conflicting input takes precedence over a missing one. */
  blocker: 'CONFLICT' | 'MISSING' | null;
  /** Weakest evidence among present inputs. */
  weakest: EvidenceState | null;
  claimIds: string[];
}

function gather(ctx: EvalContext, ids: Array<{ key: string; entry?: string | null }>): Inputs {
  const fields = ids.map((i) => getFieldState(ctx.fields, i.key, i.entry));
  const blocker = fields.some((f) => f.state === EvidenceState.CONFLICT)
    ? 'CONFLICT'
    : fields.some((f) => f.state === EvidenceState.MISSING)
      ? 'MISSING'
      : null;
  const present = fields.filter(
    (f) => f.state !== EvidenceState.MISSING && f.state !== EvidenceState.CONFLICT,
  );
  const weakest = present.length
    ? present.reduce((w, f) => (FACT_CREDIT[f.state] < FACT_CREDIT[w] ? f.state : w), present[0].state)
    : null;
  return { fields, blocker, weakest, claimIds: fields.flatMap((f) => f.claimIds) };
}

function blocked(req: RequirementDef, inputs: Inputs, what: string): RequirementResult | null {
  if (!inputs.blocker) return null;
  const status: RequirementStatus = inputs.blocker;
  return {
    ...base(req),
    status,
    credit: 0,
    evidenceState: null,
    message:
      status === 'CONFLICT'
        ? `${what}: conflicting evidence, needs applicant resolution`
        : `${what}: no evidence provided yet`,
    inputFields: inputs.fields.map((f) => f.id),
    claimIds: inputs.claimIds,
  };
}

/** Outcome of a threshold check, graded by the weakest evidence behind the inputs. */
function graded(
  req: RequirementDef,
  inputs: Inputs,
  pass: boolean,
  detail: { observed?: unknown; required?: unknown; message: string },
): RequirementResult {
  const weakest = inputs.weakest ?? EvidenceState.MISSING;
  let status: RequirementStatus;
  let credit: number;
  if (!pass) {
    status = 'NOT_MET';
    credit = 0;
  } else if (weakest === EvidenceState.DOCUMENT_SUPPORTED) {
    status = 'MET';
    credit = FACT_CREDIT[weakest];
  } else {
    status = 'UNVERIFIED';
    credit = FACT_CREDIT[weakest];
  }
  return {
    ...base(req),
    status,
    credit,
    evidenceState: inputs.weakest,
    ...detail,
    inputFields: inputs.fields.map((f) => f.id),
    claimIds: inputs.claimIds,
  };
}

function needsReview(req: RequirementDef, inputs: Inputs, message: string, observed?: unknown): RequirementResult {
  return {
    ...base(req),
    status: 'NEEDS_REVIEW',
    credit: 0,
    evidenceState: inputs.weakest,
    observed,
    message,
    inputFields: inputs.fields.map((f) => f.id),
    claimIds: inputs.claimIds,
  };
}

// ------------------------------------------------------------- evaluators

function evalDegreeLevel(req: Extract<RequirementDef, { type: 'DEGREE_LEVEL' }>, ctx: EvalContext) {
  const inputs = gather(ctx, [{ key: 'degree.level' }]);
  const stop = blocked(req, inputs, 'Degree level');
  if (stop) return stop;
  const level = inputs.fields[0].value as DegreeLevel | null | undefined;
  if (!level) return needsReview(req, inputs, 'Degree level could not be read from the evidence');
  const pass = DEGREE_LEVEL_RANK[level] >= DEGREE_LEVEL_RANK[req.params.minLevel];
  return graded(req, inputs, pass, {
    observed: level,
    required: `>= ${req.params.minLevel}`,
    message: pass ? `Degree level ${level}` : `Degree level ${level} is below ${req.params.minLevel}`,
  });
}

function evalFieldRelevance(req: Extract<RequirementDef, { type: 'FIELD_RELEVANCE' }>, ctx: EvalContext) {
  const inputs = gather(ctx, [{ key: 'degree.field' }]);
  const stop = blocked(req, inputs, 'Field of study');
  if (stop) return stop;
  const field = inputs.fields[0].value as string | null | undefined;
  if (!field) return needsReview(req, inputs, 'Field of study could not be read from the evidence');
  const match = req.params.allowList.find((term) => field.includes(canonicalText(term)));
  if (!match) {
    return needsReview(
      req,
      inputs,
      `"${field}" is not on the demo allow-list; semantic review required`,
      field,
    );
  }
  return graded(req, inputs, true, {
    observed: field,
    required: `one of: ${req.params.allowList.join(', ')}`,
    message: `Field "${field}" matches demo allow-list term "${match}"`,
  });
}

function evalGpa(req: Extract<RequirementDef, { type: 'GPA_MIN' }>, ctx: EvalContext) {
  const inputs = gather(ctx, [{ key: 'degree.cgpa' }]);
  const stop = blocked(req, inputs, 'CGPA');
  if (stop) return stop;
  const grade = inputs.fields[0].value as Grade | null | undefined;
  if (!grade) return needsReview(req, inputs, 'CGPA could not be read (an explicit scale such as "8.42 / 10" is required)');
  const { min, scale } = req.params;
  const pass = gradeMeetsMinimum(grade, min, scale);
  return graded(req, inputs, pass, {
    observed: `${grade.value} / ${grade.scale}`,
    required: `>= ${min} / ${scale}`,
    message: pass
      ? `CGPA ${grade.value} / ${grade.scale} meets ${min} / ${scale}`
      : `CGPA ${grade.value} / ${grade.scale} is below ${min} / ${scale}`,
  });
}

function evalLanguage(req: Extract<RequirementDef, { type: 'LANGUAGE_LEVEL' }>, ctx: EvalContext) {
  const { minOverall, maxCertificateAgeMonths } = req.params;
  const ids = [{ key: 'language.overall' }];
  if (maxCertificateAgeMonths !== undefined) ids.push({ key: 'language.testDate' });
  const inputs = gather(ctx, ids);
  const stop = blocked(req, inputs, 'Language score');
  if (stop) return stop;

  const score = inputs.fields[0].value as number | null | undefined;
  if (score === null || score === undefined) {
    return needsReview(req, inputs, 'Language score could not be read from the evidence');
  }
  let pass = score >= minOverall;
  let message = pass ? `Overall ${score} meets ${minOverall}` : `Overall ${score} is below ${minOverall}`;

  if (pass && maxCertificateAgeMonths !== undefined) {
    const age = certificateAgeMonths((inputs.fields[1].value as string | null) ?? null, ctx.now);
    if (age === null) return needsReview(req, inputs, 'Language test date could not be read', score);
    if (age > maxCertificateAgeMonths) {
      pass = false;
      message = `Certificate is ${age} months old (limit ${maxCertificateAgeMonths})`;
    }
  }
  return graded(req, inputs, pass, { observed: score, required: `>= ${minOverall}`, message });
}

function experienceEntries(ctx: EvalContext): { entries: ExperienceEntry[]; fields: FieldState[]; conflict: boolean } {
  const keys = new Set(
    Object.values(ctx.fields)
      .filter((f) => f.fieldKey.startsWith('experience.') && f.entryKey)
      .map((f) => f.entryKey as string),
  );
  const entries: ExperienceEntry[] = [];
  const fields: FieldState[] = [];
  let conflict = false;
  for (const entry of keys) {
    const start = getFieldState(ctx.fields, 'experience.startDate', entry);
    const end = getFieldState(ctx.fields, 'experience.endDate', entry);
    fields.push(start, end);
    if (start.state === EvidenceState.CONFLICT || end.state === EvidenceState.CONFLICT) conflict = true;
    if (typeof start.value === 'string' && typeof end.value === 'string') {
      entries.push({ start: start.value, end: end.value });
    }
  }
  return { entries, fields, conflict };
}

function evalExperience(req: Extract<RequirementDef, { type: 'EXPERIENCE_MONTHS' }>, ctx: EvalContext) {
  const declared = gather(ctx, [{ key: 'experience.totalMonths' }]);
  let inputs = declared;
  let months: number | null = null;

  if (declared.blocker !== 'MISSING') {
    // Declared total present (or in conflict).
    if (declared.blocker === 'CONFLICT') return blocked(req, declared, 'Experience')!;
    months = declared.fields[0].value as number | null;
  } else {
    // Fall back to the employment periods, merged so overlaps are not double counted.
    const { entries, fields, conflict } = experienceEntries(ctx);
    const present = fields.filter((f) => f.state !== EvidenceState.MISSING && f.state !== EvidenceState.CONFLICT);
    inputs = {
      fields: fields.length ? fields : declared.fields,
      blocker: conflict ? 'CONFLICT' : entries.length ? null : 'MISSING',
      weakest: present.length
        ? present.reduce((w, f) => (FACT_CREDIT[f.state] < FACT_CREDIT[w] ? f.state : w), present[0].state)
        : null,
      claimIds: fields.flatMap((f) => f.claimIds),
    };
    const stop = blocked(req, inputs, 'Experience');
    if (stop) return stop;
    months = totalExperienceMonths(entries, ctx.now);
  }

  if (months === null || months === undefined) {
    return needsReview(req, inputs, 'Experience duration could not be read from the evidence');
  }
  const pass = months >= req.params.minMonths;
  return graded(req, inputs, pass, {
    observed: months,
    required: `>= ${req.params.minMonths} months`,
    message: pass
      ? `${months} months of experience`
      : `${months} months of experience, below ${req.params.minMonths}`,
  });
}

function evalDocs(req: Extract<RequirementDef, { type: 'DOCS_COMPLETE' }>, ctx: EvalContext): RequirementResult {
  const present = new Set(ctx.documents.filter((d) => d.status !== 'FAILED').map((d) => d.docType));
  const missing = req.params.required.filter((t) => !present.has(t));
  const ok = missing.length === 0;
  return {
    ...base(req),
    status: ok ? 'MET' : 'MISSING',
    credit: ok ? SCORING.credit.documentSupported : 0,
    evidenceState: ok ? EvidenceState.DOCUMENT_SUPPORTED : null,
    observed: [...present],
    required: req.params.required,
    message: ok ? 'All required documents are present' : `Missing documents: ${missing.join(', ')}`,
    inputFields: [],
    claimIds: [],
    missingDocTypes: missing,
  };
}

function evalConsistency(req: Extract<RequirementDef, { type: 'CONSISTENCY' }>, ctx: EvalContext): RequirementResult {
  const conflicts = Object.values(ctx.fields).filter((f) => f.state === EvidenceState.CONFLICT);
  const ok = conflicts.length === 0;
  return {
    ...base(req),
    status: ok ? 'MET' : 'CONFLICT',
    credit: ok ? SCORING.credit.documentSupported : 0,
    evidenceState: ok ? EvidenceState.DOCUMENT_SUPPORTED : EvidenceState.CONFLICT,
    observed: conflicts.map((f) => f.id),
    message: ok
      ? 'No unresolved conflicts'
      : `Unresolved conflicts in: ${conflicts.map((f) => f.id).join(', ')}`,
    inputFields: conflicts.map((f) => f.id),
    claimIds: conflicts.flatMap((f) => f.claimIds),
  };
}

export function evaluateRequirement(req: RequirementDef, ctx: EvalContext): RequirementResult {
  switch (req.type) {
    case 'DEGREE_LEVEL':
      return evalDegreeLevel(req, ctx);
    case 'FIELD_RELEVANCE':
      return evalFieldRelevance(req, ctx);
    case 'GPA_MIN':
      return evalGpa(req, ctx);
    case 'LANGUAGE_LEVEL':
      return evalLanguage(req, ctx);
    case 'EXPERIENCE_MONTHS':
      return evalExperience(req, ctx);
    case 'DOCS_COMPLETE':
      return evalDocs(req, ctx);
    case 'CONSISTENCY':
      return evalConsistency(req, ctx);
  }
}
