// Readiness scoring parameters, consumed by the deterministic scorer.
// The LLM never produces or adjusts the numeric score.
export const SCORING = {
  /** Credit for a satisfied requirement, by the weakest evidence behind it. */
  credit: {
    documentSupported: 1.0,
    applicantProvided: 0.5,
    aiGenerated: 0.25,
    /** Upper bound for semantic (LLM-rated) judgements in a later stage. */
    aiJudgementCap: 0.6,
  },
  readyThreshold: 80,
} as const;
