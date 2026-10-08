-- AlterEnum: ActionType. Old values are mapped; a conflict is now an ASK_CLARIFICATION.
BEGIN;
CREATE TYPE "ActionType_new" AS ENUM ('ASK_CLARIFICATION', 'REQUEST_DOCUMENT', 'SHOW_MISSING_REQUIREMENT', 'RECOMMEND_NEXT_STEP', 'NO_ACTION');
ALTER TABLE "AgentAction" ALTER COLUMN "type" TYPE "ActionType_new" USING (
  CASE "type"::text
    WHEN 'ASK_APPLICANT' THEN 'ASK_CLARIFICATION'
    WHEN 'RESOLVE_CONFLICT' THEN 'ASK_CLARIFICATION'
    WHEN 'RECOMMEND_STEP' THEN 'RECOMMEND_NEXT_STEP'
    ELSE "type"::text
  END
)::"ActionType_new";
ALTER TYPE "ActionType" RENAME TO "ActionType_old";
ALTER TYPE "ActionType_new" RENAME TO "ActionType";
DROP TYPE "ActionType_old";
COMMIT;
