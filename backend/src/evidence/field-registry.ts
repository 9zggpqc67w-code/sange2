import {
  canonicalText,
  canonicalizeName,
  normalizeDate,
  normalizeDegreeLevel,
  parseDurationMonths,
  parseGrade,
  parseLanguageScore,
  parseYear,
} from '../normalization';
import type { ComparatorKind } from './comparators';

export interface FieldDef {
  label: string;
  comparator: ComparatorKind;
  /** Deterministic normalization of the raw extracted text. Returns null if unreadable. */
  normalize: (raw: string) => unknown;
}

/** The fields the demo needs. Unknown field keys fall back to a plain text comparison. */
export const FIELD_DEFS: Record<string, FieldDef> = {
  'applicant.name': { label: 'Full name', comparator: 'name', normalize: (r) => canonicalizeName(r) || null },
  'applicant.dob': { label: 'Date of birth', comparator: 'date', normalize: normalizeDate },

  'degree.title': { label: 'Degree title', comparator: 'exact', normalize: (r) => canonicalText(r) || null },
  'degree.level': { label: 'Degree level', comparator: 'exact', normalize: normalizeDegreeLevel },
  'degree.field': { label: 'Field of study', comparator: 'textContains', normalize: (r) => canonicalText(r) || null },
  'degree.institution': { label: 'Institution', comparator: 'textContains', normalize: (r) => canonicalText(r) || null },
  'degree.graduationYear': { label: 'Graduation year', comparator: 'number', normalize: parseYear },
  'degree.cgpa': { label: 'Final CGPA', comparator: 'gpa', normalize: parseGrade },

  'language.test': { label: 'Language test', comparator: 'exact', normalize: (r) => canonicalText(r) || null },
  'language.overall': { label: 'Overall language score', comparator: 'number', normalize: parseLanguageScore },
  'language.testDate': { label: 'Language test date', comparator: 'date', normalize: normalizeDate },

  'experience.employer': { label: 'Employer', comparator: 'textContains', normalize: (r) => canonicalText(r) || null },
  'experience.role': { label: 'Role', comparator: 'textContains', normalize: (r) => canonicalText(r) || null },
  'experience.startDate': { label: 'Employment start', comparator: 'date', normalize: normalizeDate },
  'experience.endDate': { label: 'Employment end', comparator: 'date', normalize: normalizeDate },
  'experience.totalMonths': { label: 'Total experience (months)', comparator: 'number', normalize: parseDurationMonths },
};

const DEFAULT_DEF: FieldDef = {
  label: 'Unknown field',
  comparator: 'exact',
  normalize: (r) => canonicalText(r) || null,
};

export const fieldDef = (fieldKey: string): FieldDef => FIELD_DEFS[fieldKey] ?? DEFAULT_DEF;

export function normalizeClaimValue(fieldKey: string, raw: string): unknown {
  return fieldDef(fieldKey).normalize(raw) ?? null;
}
