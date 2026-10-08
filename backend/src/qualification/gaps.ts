import { EvidenceState, FieldStates } from '../evidence/evidence.types';
import { getFieldState } from '../evidence/resolve';
import { fieldDef } from '../evidence/field-registry';
import type { Gap, RequirementResult } from './qualification.types';

const BLOCKING_BONUS = 100;

function build(
  partial: Omit<Gap, 'severity' | 'priority' | 'requirementIds'>,
  related: RequirementResult[],
): Gap {
  const blocking = related.some((r) => r.mandatory);
  const weight = related.reduce((sum, r) => sum + r.weight, 0);
  return {
    ...partial,
    requirementIds: related.map((r) => r.requirementId),
    severity: blocking ? 'BLOCKING' : 'ADVISORY',
    priority: weight + (blocking ? BLOCKING_BONUS : 0),
  };
}

/**
 * Derives missing / conflicting / unverified information from the field states and the
 * requirement results. Gaps are never stored as rows: they are recomputed on every
 * evaluation and keep a stable id so a UI can show which ones closed.
 */
export function detectGaps(fields: FieldStates, results: RequirementResult[]): Gap[] {
  const gaps = new Map<string, Gap>();
  const usedBy = (fieldId: string) => results.filter((r) => r.inputFields.includes(fieldId));
  const label = (fieldKey: string) => fieldDef(fieldKey).label;

  for (const r of results) {
    for (const docType of r.missingDocTypes ?? []) {
      const id = `MISSING_DOC:${docType}`;
      const related = results.filter((x) => x.missingDocTypes?.includes(docType));
      gaps.set(id, build({ id, kind: 'MISSING_DOC', docType, message: `Upload a ${docType} document` }, related));
    }
    if (r.status === 'NEEDS_REVIEW') {
      const id = `NEEDS_REVIEW:${r.requirementId}`;
      gaps.set(id, build({ id, kind: 'NEEDS_REVIEW', message: r.message }, [r]));
    }
    for (const fieldId of r.inputFields) {
      const f = fields[fieldId] ?? getFieldState(fields, fieldId);
      if (r.status === 'MISSING' && f.state === EvidenceState.MISSING) {
        const id = `MISSING_FIELD:${f.id}`;
        gaps.set(id, build({ id, kind: 'MISSING_FIELD', fieldId: f.id, message: `${label(f.fieldKey)} is missing` }, usedBy(f.id)));
      }
      if (
        r.status === 'UNVERIFIED' &&
        (f.state === EvidenceState.APPLICANT_PROVIDED || f.state === EvidenceState.AI_GENERATED)
      ) {
        const id = `UNVERIFIED:${f.id}`;
        gaps.set(id, build({ id, kind: 'UNVERIFIED', fieldId: f.id, message: `${label(f.fieldKey)} has no supporting document` }, usedBy(f.id)));
      }
    }
  }

  // Every unresolved conflict is a gap, whether or not a requirement reads that field.
  const consistency = results.filter((r) => r.type === 'CONSISTENCY');
  for (const f of Object.values(fields)) {
    if (f.state !== EvidenceState.CONFLICT) continue;
    const related = [...new Set([...usedBy(f.id), ...consistency])];
    const id = `CONFLICT:${f.id}`;
    gaps.set(id, build({ id, kind: 'CONFLICT', fieldId: f.id, message: `Conflicting evidence for ${label(f.fieldKey)}` }, related));
  }

  return [...gaps.values()].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}
