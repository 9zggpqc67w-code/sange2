-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('INTAKE', 'AWAITING_DOCUMENTS', 'PROCESSING', 'AWAITING_APPLICANT', 'REVIEW_READY', 'ERROR');

-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('CV', 'DEGREE', 'TRANSCRIPT', 'LANGUAGE_CERT', 'EXPERIENCE_LETTER', 'SOP', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "TextMethod" AS ENUM ('TEXT_LAYER', 'OCR', 'VISION');

-- CreateEnum
CREATE TYPE "ClaimSource" AS ENUM ('DOCUMENT', 'APPLICANT', 'AI_DERIVED');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('ASK_APPLICANT', 'REQUEST_DOCUMENT', 'RESOLVE_CONFLICT', 'RECOMMEND_STEP', 'NO_ACTION');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PENDING', 'ANSWERED', 'SUPERSEDED', 'DONE');

-- CreateTable
CREATE TABLE "Applicant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "goal" TEXT,
    "programLabel" TEXT,
    "stage" "Stage" NOT NULL DEFAULT 'INTAKE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Applicant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "docType" "DocType" NOT NULL DEFAULT 'UNKNOWN',
    "status" "DocStatus" NOT NULL DEFAULT 'UPLOADED',
    "error" TEXT,
    "textMethod" "TextMethod",
    "pages" JSONB,
    "ocrConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "entryKey" TEXT,
    "rawValue" TEXT NOT NULL,
    "value" JSONB,
    "source" "ClaimSource" NOT NULL,
    "documentId" TEXT,
    "page" INTEGER,
    "quote" TEXT,
    "isResolution" BOOLEAN NOT NULL DEFAULT false,
    "supersededById" TEXT,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "gaps" JSONB NOT NULL,
    "requirements" JSONB NOT NULL,
    "breakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentAction" (
    "id" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "evaluationId" TEXT,
    "type" "ActionType" NOT NULL,
    "gapId" TEXT,
    "params" JSONB,
    "decision" JSONB,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "answer" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "AgentAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_applicantId_idx" ON "Document"("applicantId");

-- CreateIndex
CREATE INDEX "Claim_applicantId_fieldKey_idx" ON "Claim"("applicantId", "fieldKey");

-- CreateIndex
CREATE INDEX "Evaluation_applicantId_createdAt_idx" ON "Evaluation"("applicantId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentAction_applicantId_status_idx" ON "AgentAction"("applicantId", "status");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "Applicant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
