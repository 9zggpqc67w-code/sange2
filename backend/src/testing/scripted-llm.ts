// A stand-in for Claude used in tests: returns the extraction a correct model would produce for
// each fictional Arjun Mehta document (authored by reading the PDFs), keyed by filename. It
// can also be told to emit hallucinated claims, which grounding must reject.
import { LlmUnavailableError, type JsonCompletionRequest } from '../llm/llm.service';

export interface Proposal {
  fieldKey: string;
  rawValue: string;
  quote: string;
  entryKey?: string | null;
  page?: number;
}

const p = (fieldKey: string, rawValue: string, quote: string, entryKey: string | null = null): Proposal => ({
  fieldKey,
  rawValue,
  quote,
  entryKey,
});

export const ARJUN_SCRIPT: Record<string, { documentType: string; claims: Proposal[] }> = {
  '01_Arjun_Mehta_CV.pdf': {
    documentType: 'CV',
    claims: [
      p('applicant.name', 'Arjun Mehta', 'Arjun Mehta'),
      p('degree.level', 'Bachelor of Technology', 'Bachelor of Technology in Computer Science and Engineering'),
      p('degree.field', 'Computer Science and Engineering', 'Bachelor of Technology in Computer Science and Engineering'),
      p('degree.institution', 'Riverview Institute of Technology, Bengaluru', 'Riverview Institute of Technology, Bengaluru'),
      p('degree.graduationYear', '2025', 'Graduation year: 2025'),
      p('degree.cgpa', '8.42 / 10.00', 'CGPA: 8.42 / 10.00'),
      p('experience.employer', 'Northstar Digital Labs, Bengaluru', 'Northstar Digital Labs, Bengaluru', 'job-1'),
      p('experience.role', 'Software Engineering Intern', 'Software Engineering Intern - 8 months', 'job-1'),
      p('experience.startDate', 'Jan 2025', 'Jan 2025 - Aug 2025', 'job-1'),
      p('experience.endDate', 'Aug 2025', 'Jan 2025 - Aug 2025', 'job-1'),
      p('experience.totalMonths', '8 months', 'Software Engineering Intern - 8 months'),
    ],
  },
  '02_Arjun_Mehta_Degree_Certificate.pdf': {
    documentType: 'DEGREE',
    claims: [
      p('applicant.name', 'Arjun Mehta', 'Candidate Arjun Mehta'),
      p('applicant.dob', '14 February 2004', 'Date of Birth 14 February 2004'),
      p('degree.level', 'BACHELOR OF TECHNOLOGY', 'BACHELOR OF TECHNOLOGY'),
      p('degree.field', 'Computer Science and Engineering', 'Computer Science and Engineering'),
      p('degree.institution', 'Riverview Institute of Technology, Bengaluru', 'University Riverview Institute of Technology, Bengaluru'),
      p('degree.graduationYear', '2025', 'Year of Graduation 2025'),
      p('degree.cgpa', '8.42 / 10.00', 'Final CGPA 8.42 / 10.00'),
    ],
  },
  '03_Arjun_Mehta_Academic_Transcript.pdf': {
    documentType: 'TRANSCRIPT',
    claims: [
      p('applicant.name', 'Arjun Mehta', 'Student: Arjun Mehta'),
      p('degree.institution', 'Riverview Institute of Technology, Bengaluru', 'University: Riverview Institute of Technology, Bengaluru'),
      p('degree.graduationYear', '2025', 'Graduation year: 2025'),
      p('degree.cgpa', '8.42 / 10.00', 'Final CGPA: 8.42 / 10.00'),
    ],
  },
  '04_Arjun_Mehta_Language_Certificate.pdf': {
    documentType: 'LANGUAGE_CERT',
    claims: [
      p('applicant.name', 'Arjun Mehta', 'Candidate Arjun Mehta'),
      p('language.test', 'Academic English - Demo', 'Test Academic English - Demo'),
      p('language.overall', '7.0', 'Overall Band 7.0'),
      p('language.testDate', '20 September 2026', 'Test date 20 September 2026'),
    ],
  },
  '05_Arjun_Mehta_Experience_Letter.pdf': {
    documentType: 'EXPERIENCE_LETTER',
    claims: [
      p('applicant.name', 'Arjun Mehta', 'confirms that Arjun Mehta completed an internship'),
      p('experience.employer', 'Northstar Digital Labs, Bengaluru', 'Northstar Digital Labs, Bengaluru', 'job-1'),
      p('experience.role', 'Software Engineering Intern', 'Software Engineering Intern', 'job-1'),
      p('experience.startDate', '01 January 2025', '01 January 2025 to 31 August 2025', 'job-1'),
      p('experience.endDate', '31 August 2025', '01 January 2025 to 31 August 2025', 'job-1'),
      p('experience.totalMonths', '8 months', 'Total experience represented in this demo letter: 8 months.'),
    ],
  },
  '06_Arjun_Mehta_Statement_of_Purpose.pdf': {
    documentType: 'SOP',
    claims: [
      p('applicant.name', 'Arjun Mehta', 'Applicant: Arjun Mehta'),
      p('degree.level', 'bachelor of technology', 'I completed a bachelor of technology in computer science and engineering'),
      p('degree.graduationYear', '2025', 'Bengaluru in 2025 with a final CGPA of 8.42 / 10.00'),
      p('degree.cgpa', '8.42 / 10.00', 'a final CGPA of 8.42 / 10.00'),
      p('experience.totalMonths', 'eight-month', 'During an eight-month software engineering internship'),
    ],
  },
};

export class ScriptedLlm {
  configured = true;
  model = 'scripted-test-model';
  /** Extra proposals appended per filename (to simulate hallucination). */
  extra: Record<string, Proposal[]> = {};
  /** Overrides the script per filename entirely. */
  override: Record<string, { documentType: string; claims: Proposal[] }> = {};
  /** Page transcriptions returned for vision requests, keyed by call order. */
  transcriptions: Array<Array<{ pageNo: number; text: string }>> = [];
  calls: Array<{ kind: 'extract' | 'transcribe' | 'agent'; filename?: string }> = [];
  /** Agent requests: the context the agent sent, and an optional custom reply (default: pick the first candidate). */
  agentContexts: any[] = [];
  agentHandler?: (context: any) => unknown;
  agentError?: Error;
  /** When set, extraction waits for it (lets a test observe the "processing" state). */
  gate?: Promise<void>;

  get isConfigured() {
    return this.configured;
  }

  async completeJson(req: JsonCompletionRequest): Promise<unknown> {
    if (!this.configured) throw new LlmUnavailableError();
    if (/next-best-action/i.test(req.system)) {
      const context = JSON.parse((req.content[0] as { text: string }).text);
      this.calls.push({ kind: 'agent' });
      this.agentContexts.push(context);
      if (this.agentError) throw this.agentError;
      return this.agentHandler ? this.agentHandler(context) : defaultAgentReply(context);
    }
    if (/transcribe/i.test(req.system)) {
      this.calls.push({ kind: 'transcribe' });
      return { pages: this.transcriptions.shift() ?? [] };
    }
    if (this.gate) await this.gate;
    const block = req.content[0] as { type: 'text'; text: string };
    const filename = /^Filename: (.+)$/m.exec(block.text)?.[1] ?? '';
    this.calls.push({ kind: 'extract', filename });
    const entry = this.override[filename] ?? ARJUN_SCRIPT[filename] ?? { documentType: 'UNKNOWN', claims: [] };
    return {
      documentType: entry.documentType,
      claims: [...entry.claims, ...(this.extra[filename] ?? [])].map((c) => ({
        fieldKey: c.fieldKey,
        entryKey: c.entryKey ?? null,
        rawValue: c.rawValue,
        page: c.page ?? 1,
        quote: c.quote,
      })),
    };
  }
}

/** What a well-behaved model does: take the first candidate and word it from the supplied description. */
export function defaultAgentReply(context: any) {
  const c = context.candidates[0];
  if (!c) return { action: 'NO_ACTION', message: 'Nothing to do.', rationale: 'No candidates.', gapId: null, requirementId: null, docType: null, route: null, evidenceRefs: [] };
  const demo = c.action === 'SHOW_MISSING_REQUIREMENT' || c.action === 'RECOMMEND_NEXT_STEP' ? ' (DEMO requirements)' : '';
  return {
    action: c.action,
    message: `${c.description}${demo}`,
    rationale: 'First-ranked candidate.',
    gapId: c.gapId,
    requirementId: c.requirementId,
    docType: c.docType,
    route: c.action === 'RECOMMEND_NEXT_STEP' ? 'STUDY' : null,
    evidenceRefs: c.evidenceRefs.slice(0, 2),
  };
}
