// DEMO qualification requirements.
//
// These mirror the synthetic rules in the fictional Arjun Mehta demo package
// ("Predefined Demo Qualification Rules"). They are NOT official German
// government, visa or university eligibility rules and must always be presented
// to users as DEMO configuration.

export type DocumentType =
  | 'CV'
  | 'DEGREE'
  | 'TRANSCRIPT'
  | 'LANGUAGE_CERT'
  | 'EXPERIENCE_LETTER'
  | 'SOP'
  | 'UNKNOWN';

export type DegreeLevel = 'DIPLOMA' | 'BACHELOR' | 'MASTER' | 'DOCTORATE';

interface RequirementBase {
  id: string;
  title: string;
  /** HYBRID = deterministic first, an LLM may add a semantic judgement in a later stage. */
  evaluator: 'DETERMINISTIC' | 'HYBRID';
  weight: number;
  /** Only mandatory requirements can block eligibility. */
  mandatory: boolean;
}

export type RequirementDef = RequirementBase &
  (
    | { type: 'DEGREE_LEVEL'; params: { minLevel: DegreeLevel } }
    | { type: 'FIELD_RELEVANCE'; params: { allowList: string[] } }
    | { type: 'GPA_MIN'; params: { min: number; scale: number } }
    | { type: 'LANGUAGE_LEVEL'; params: { minOverall: number; maxCertificateAgeMonths?: number } }
    | { type: 'EXPERIENCE_MONTHS'; params: { minMonths: number } }
    | { type: 'DOCS_COMPLETE'; params: { required: DocumentType[] } }
    | { type: 'CONSISTENCY'; params: Record<string, never> }
  );

export type RequirementType = RequirementDef['type'];

export interface RequirementSet {
  id: string;
  name: string;
  isDemo: true;
  disclaimer: string;
  requirements: RequirementDef[];
}

export const DEMO_DISCLAIMER =
  'DEMO requirements for illustration only. These are not official German government or university admission criteria.';

/**
 * Experience is optional in this demo set and the demo rules define no threshold,
 * so no EXPERIENCE_MONTHS requirement is configured here. A requirement set may add
 * one; it never blocks eligibility unless it explicitly sets `mandatory: true`.
 */
export const DEMO_MSC_COMPUTER_SCIENCE: RequirementSet = {
  id: 'DEMO_MSC_COMPUTER_SCIENCE',
  name: "Demo Master's in Computer Science",
  isDemo: true,
  disclaimer: DEMO_DISCLAIMER,
  requirements: [
    {
      id: 'degree-level',
      title: "Completed bachelor's degree",
      type: 'DEGREE_LEVEL',
      evaluator: 'DETERMINISTIC',
      weight: 15,
      mandatory: true,
      params: { minLevel: 'BACHELOR' },
    },
    {
      id: 'field-relevance',
      title: 'Degree field relevant to Computer Science',
      type: 'FIELD_RELEVANCE',
      evaluator: 'HYBRID',
      weight: 15,
      mandatory: true,
      params: {
        allowList: [
          'computer science',
          'software engineering',
          'information technology',
          'data science',
          'artificial intelligence',
          'mathematics',
          'statistics',
        ],
      },
    },
    {
      id: 'gpa-min',
      title: 'Minimum CGPA of 7.0 / 10',
      type: 'GPA_MIN',
      evaluator: 'DETERMINISTIC',
      weight: 20,
      mandatory: true,
      params: { min: 7.0, scale: 10 },
    },
    {
      id: 'language-level',
      title: 'English overall score of at least 6.5',
      type: 'LANGUAGE_LEVEL',
      evaluator: 'DETERMINISTIC',
      weight: 20,
      mandatory: true,
      params: { minOverall: 6.5 },
    },
    {
      id: 'docs-complete',
      title: 'CV, degree, transcript and language evidence uploaded',
      type: 'DOCS_COMPLETE',
      evaluator: 'DETERMINISTIC',
      weight: 15,
      mandatory: true,
      params: { required: ['CV', 'DEGREE', 'TRANSCRIPT', 'LANGUAGE_CERT'] },
    },
    {
      id: 'consistency',
      title: 'No unresolved conflicts between documents',
      type: 'CONSISTENCY',
      evaluator: 'DETERMINISTIC',
      weight: 15,
      mandatory: true,
      params: {},
    },
  ],
};

export const REQUIREMENT_SETS: Record<string, RequirementSet> = {
  [DEMO_MSC_COMPUTER_SCIENCE.id]: DEMO_MSC_COMPUTER_SCIENCE,
};

export const DEFAULT_REQUIREMENT_SET_ID = DEMO_MSC_COMPUTER_SCIENCE.id;
