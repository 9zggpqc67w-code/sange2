import { Injectable, NotFoundException } from '@nestjs/common';
import { activeClaimsWhere } from '../evidence/active-claims';
import type { ClaimRecord, FieldState } from '../evidence/evidence.types';
import { fieldDef } from '../evidence/field-registry';
import { resolveFields } from '../evidence/resolve';
import { PrismaService } from '../prisma/prisma.service';
import type { Gap } from '../qualification/qualification.types';
import { EvaluationService } from '../workflow/evaluation.service';
import { hashInputs } from '../workflow/evaluation-summary';

const HISTORY_IN_JOURNEY = 10;

/** One piece of evidence behind a field value, with its provenance. */
export interface EvidenceRef {
  claimId: string;
  source: string;
  documentId: string | null;
  documentType: string | null;
  page: number | null;
  quote: string | null;
  rawValue: string;
}

/**
 * The applicant journey read model: everything known about an applicant, assembled from
 * PostgreSQL only (never from raw documents). This is the one call the agent (and a frontend)
 * makes to get the complete current state:
 *
 *   - applicant + stage                 (durable, derived by the workflow)
 *   - documents with status/run history
 *   - profile: current field states with evidence (document, page, quote)
 *   - evaluation: the latest immutable snapshot (score, verdict, requirements, gaps, conflicts)
 *   - isStale: whether evidence changed since that snapshot was taken
 *   - history: recent evaluations with what changed
 *   - clarifications: questions asked and answers given
 */
@Injectable()
export class JourneyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluations: EvaluationService,
  ) {}

  async get(applicantId: string) {
    const applicant = await this.prisma.applicant.findUnique({ where: { id: applicantId } });
    if (!applicant) throw new NotFoundException(`Applicant ${applicantId} not found`);

    const [{ claims, documents: docInfos }, docs, latest, history, clarifications] = await Promise.all([
      this.evaluations.loadInputs(applicantId),
      this.prisma.document.findMany({
        where: { applicantId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          filename: true,
          docType: true,
          status: true,
          error: true,
          textMethod: true,
          createdAt: true,
          runs: { select: { version: true, isActive: true, status: true }, orderBy: { version: 'asc' } },
        },
      }),
      this.evaluations.latest(applicantId),
      this.evaluations.history(applicantId, HISTORY_IN_JOURNEY),
      this.prisma.clarification.findMany({ where: { applicantId }, orderBy: { createdAt: 'desc' } }),
    ]);

    const docTypeById = new Map(docs.map((d) => [d.id, d.docType as string]));
    const evidenceFor = (claimIds: string[], pool: Map<string, ClaimRecord>): EvidenceRef[] =>
      claimIds
        .map((id) => pool.get(id))
        .filter((c): c is ClaimRecord => Boolean(c))
        .map((c) => ({
          claimId: c.id,
          source: c.source,
          documentId: c.documentId ?? null,
          documentType: c.documentId ? (docTypeById.get(c.documentId) ?? null) : null,
          page: c.page ?? null,
          quote: c.quote ?? null,
          rawValue: c.rawValue,
        }));

    // Profile: live field states over the current (active) evidence.
    const activePool = new Map(claims.map((c) => [c.id, c]));
    const fieldStates = resolveFields(claims);
    const profile = Object.values(fieldStates)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((f: FieldState) => ({
        id: f.id,
        fieldKey: f.fieldKey,
        label: fieldDef(f.fieldKey).label,
        entryKey: f.entryKey,
        state: f.state,
        value: f.value ?? null,
        resolved: f.resolved,
        conflictOptions: f.conflictOptions?.map((o) => ({ ...o, evidence: evidenceFor(o.claimIds, activePool) })) ?? null,
        evidence: evidenceFor(f.claimIds, activePool),
      }));

    // Evaluation: the stored snapshot; stale if the evidence changed after it.
    let evaluation: Record<string, unknown> | null = null;
    let gaps: Gap[] = [];
    let conflicts: Array<Record<string, unknown>> = [];
    let isStale = false;
    if (latest) {
      gaps = latest.gaps as unknown as Gap[];
      const currentHash = hashInputs({ requirementSetId: latest.requirementSetId, claimIds: claims.map((c) => c.id), documents: docInfos });
      isStale = currentHash !== latest.inputHash;

      const snapshotFields = latest.fields as unknown as Record<string, FieldState>;
      const conflictGaps = gaps.filter((g) => g.kind === 'CONFLICT');
      // Evidence of conflicts is resolved against the snapshot's own claims (they may have been superseded since).
      const ids = conflictGaps.flatMap((g) => (g.fieldId ? (snapshotFields[g.fieldId]?.conflictOptions ?? []).flatMap((o) => o.claimIds) : []));
      const rows = ids.length ? await this.prisma.claim.findMany({ where: { id: { in: ids } } }) : [];
      const pool = new Map<string, ClaimRecord>(rows.map((c) => [c.id, c]));
      conflicts = conflictGaps.map((g) => ({
        gapId: g.id,
        fieldId: g.fieldId,
        label: g.fieldId ? fieldDef(snapshotFields[g.fieldId]?.fieldKey ?? g.fieldId).label : null,
        severity: g.severity,
        options: (snapshotFields[g.fieldId!]?.conflictOptions ?? []).map((o) => ({
          value: o.value,
          sources: o.sources,
          evidence: evidenceFor(o.claimIds, pool),
        })),
      }));

      evaluation = {
        id: latest.id,
        createdAt: latest.createdAt,
        trigger: latest.trigger,
        triggerDocumentId: latest.triggerDocumentId,
        requirementSetId: latest.requirementSetId,
        isDemo: latest.isDemo,
        disclaimer: 'DEMO requirements for illustration only. These are not official German government or university admission criteria.',
        score: latest.score,
        verdict: latest.verdict,
        outcome: latest.outcome,
        readiness: latest.breakdown,
        requirements: latest.requirements,
        summary: latest.summary,
      };
    }

    return {
      applicant: {
        id: applicant.id,
        name: applicant.name,
        email: applicant.email,
        goal: applicant.goal,
        programLabel: applicant.programLabel,
        createdAt: applicant.createdAt,
        updatedAt: applicant.updatedAt,
      },
      stage: applicant.stage,
      documents: docs.map(({ runs, ...d }) => ({
        ...d,
        activeVersion: runs.find((r) => r.isActive)?.version ?? null,
        runCount: runs.length,
        activeClaimCount: claims.filter((c) => c.documentId === d.id).length,
      })),
      profile,
      evaluation,
      isStale,
      gaps,
      conflicts,
      history,
      clarifications: {
        open: clarifications.filter((c) => c.status === 'OPEN').length,
        items: clarifications,
      },
    };
  }

  /** Current gaps and conflicts from the latest evaluation. */
  async gaps(applicantId: string) {
    const journey = await this.get(applicantId);
    return {
      evaluationId: (journey.evaluation as { id: string } | null)?.id ?? null,
      isStale: journey.isStale,
      gaps: journey.gaps,
      conflicts: journey.conflicts,
    };
  }

  /** Evidence rows: the current ones, or the full history including superseded runs. */
  async claims(applicantId: string, scope: 'active' | 'all' = 'active') {
    const exists = await this.prisma.applicant.findUnique({ where: { id: applicantId }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Applicant ${applicantId} not found`);
    const rows = await this.prisma.claim.findMany({
      where: scope === 'active' ? activeClaimsWhere(applicantId) : { applicantId },
      orderBy: { createdAt: 'asc' },
      include: { run: { select: { version: true, isActive: true } } },
    });
    return rows.map(({ run, ...c }) => ({
      ...c,
      runVersion: run?.version ?? null,
      active: c.supersededById === null && (run === null || run.isActive),
    }));
  }
}
