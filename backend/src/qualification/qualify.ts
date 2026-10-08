import { REQUIREMENT_SETS, DEFAULT_REQUIREMENT_SET_ID, type RequirementSet } from '../config/requirements.demo';
import { resolveFields } from '../evidence/resolve';
import { evaluateRequirement } from './evaluators';
import { detectGaps } from './gaps';
import { computeReadiness } from './readiness';
import type { QualificationInput, QualificationResult } from './qualification.types';

/**
 * Pure end-to-end qualification: claims -> field states -> requirement results -> gaps
 * -> readiness. No IO, no LLM; identical input always yields an identical result.
 * `requirementSet` overrides the lookup by id (useful for tests and custom sets).
 */
export function qualify(
  input: QualificationInput & { requirementSet?: RequirementSet },
): QualificationResult {
  const set = input.requirementSet ?? REQUIREMENT_SETS[input.requirementSetId ?? DEFAULT_REQUIREMENT_SET_ID];
  if (!set) throw new Error(`Unknown requirement set: ${input.requirementSetId}`);

  const now = input.now ?? new Date();
  const fields = resolveFields(input.claims);
  const ctx = { fields, documents: input.documents, now };

  const requirements = set.requirements.map((req) => evaluateRequirement(req, ctx));
  return {
    requirementSetId: set.id,
    isDemo: set.isDemo,
    disclaimer: set.disclaimer,
    fields,
    requirements,
    gaps: detectGaps(fields, requirements),
    readiness: computeReadiness(requirements),
  };
}
