import type { Prisma } from '../generated/prisma/client';

/**
 * The single definition of "current evidence". Claims are never deleted, so history is kept in
 * the same table; a claim is ACTIVE when
 *  - it has not been individually superseded, and
 *  - it is not a document claim of an old run (document claims are active only while the run
 *    that produced them is the document's active run). Applicant claims have no run.
 */
export const activeClaimsWhere = (applicantId: string): Prisma.ClaimWhereInput => ({
  applicantId,
  supersededById: null,
  OR: [{ runId: null }, { run: { isActive: true } }],
});
