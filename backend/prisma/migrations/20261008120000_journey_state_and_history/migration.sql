-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "EvaluationTrigger" AS ENUM ('DOCUMENT_PROCESSED', 'MANUAL', 'APPLICANT_UPDATE');

-- CreateEnum
CREATE TYPE "ClarificationStatus" AS ENUM ('OPEN', 'ANSWERED', 'DISMISSED', 'SUPERSEDED');

-- AlterEnum: Stage. Old values are mapped onto the new journey stages.
BEGIN;
CREATE TYPE "Stage_new" AS ENUM ('NEW', 'DOCUMENTS_PROCESSING', 'PROFILE_BUILT', 'INCOMPLETE', 'ACTION_REQUIRED', 'READY');
ALTER TABLE "Applicant" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "Applicant" ALTER COLUMN "stage" TYPE "Stage_new" USING (
  CASE "stage"::text
    WHEN 'PROCESSING' THEN 'DOCUMENTS_PROCESSING'
    WHEN 'AWAITING_APPLICANT' THEN 'ACTION_REQUIRED'
    WHEN 'REVIEW_READY' THEN 'READY'
    ELSE 'NEW'
  END
)::"Stage_new";
ALTER TYPE "Stage" RENAME TO "Stage_old";
ALTER TYPE "Stage_new" RENAME TO "Stage";
DROP TYPE "Stage_old";
ALTER TABLE "Applicant" ALTER COLUMN "stage" SET DEFAULT 'NEW';
COMMIT;

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "runId" TEXT;

-- AlterTable
ALTER TABLE "Evaluation" ADD COLUMN     "inputHash" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "inputs" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "outcome" "Stage" NOT NULL DEFAULT 'NEW',
ADD COLUMN     "requirementSetId" TEXT NOT NULL DEFAULT 'DEMO_MSC_COMPUTER_SCIENCE',
ADD COLUMN     "summary" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "trigger" "EvaluationTrigger" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "triggerDocumentId" TEXT;

-- CreateTable
CREATE TABLE "DocumentRun" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'PROCESSING',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "docType" "DocType",
    "textMethod" "TextMethod",
    "pages" JSONB,
    "extraction" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clarification" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "gapId" TEXT,
    "fieldId" TEXT,
    "claimIds" JSONB,
    "evaluationId" TEXT,
    "agentActionId" TEXT,
    "status" "ClarificationStatus" NOT NULL DEFAULT 'OPEN',
    "answer" JSONB,
    "resolutionClaimId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clarification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentRun_documentId_isActive_idx" ON "DocumentRun"("documentId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRun_documentId_version_key" ON "DocumentRun"("documentId", "version");

-- CreateIndex
CREATE INDEX "Clarification_applicantId_status_idx" ON "Clarification"("applicantId", "status");

-- CreateIndex
CREATE INDEX "Claim_runId_idx" ON "Claim"("runId");

-- AddForeignKey
ALTER TABLE "DocumentRun" ADD CONSTRAINT "DocumentRun_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DocumentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clarification" ADD CONSTRAINT "Clarification_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clarification" ADD CONSTRAINT "Clarification_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clarification" ADD CONSTRAINT "Clarification_agentActionId_fkey" FOREIGN KEY ("agentActionId") REFERENCES "AgentAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: documents already processed before run history existed get a version-1 active run,
-- and their document claims are attached to it, so no evidence becomes inactive by accident.
INSERT INTO "DocumentRun" ("id", "documentId", "version", "status", "isActive", "docType", "textMethod", "pages", "extraction", "createdAt", "completedAt")
SELECT gen_random_uuid()::text, d."id", 1, 'DONE', true, d."docType", d."textMethod", d."pages", d."extraction", d."createdAt", d."createdAt"
FROM "Document" d WHERE d."status" = 'DONE';

UPDATE "Claim" c SET "runId" = r."id"
FROM "DocumentRun" r
WHERE c."documentId" = r."documentId" AND c."source" = 'DOCUMENT' AND c."runId" IS NULL;
