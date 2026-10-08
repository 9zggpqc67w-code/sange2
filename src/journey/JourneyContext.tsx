import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ApplicantDetails } from '../types';
import { AgentView, AnswerResult, ApiError, BackendDocType, Journey, ProcessResult, api } from '../services/api';

/**
 * Holds the applicant's backend identity and the latest backend journey.
 * The backend is the source of truth: this store only fetches, keeps the latest result and
 * exposes actions. It contains no qualification, evidence, conflict or agent logic.
 */
export type Busy = 'idle' | 'saving' | 'uploading' | 'processing' | 'thinking' | 'answering';

interface JourneyContextValue {
  applicantId: string | null;
  journey: Journey | null;
  /** The backend agent's current next action (null until the applicant has been evaluated). */
  agent: AgentView | null;
  busy: Busy;
  /** True while the journey is being (re)loaded. */
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  saveApplicant: (details: ApplicantDetails) => Promise<string>;
  uploadDocument: (file: File, docType: BackendDocType) => Promise<void>;
  processDocuments: () => Promise<ProcessResult>;
  refresh: () => Promise<void>;
  askAgent: (opts?: { refresh?: boolean }) => Promise<AgentView | null>;
  answerClarification: (clarificationId: string, answer: { value?: unknown; choice?: string; text?: string }) => Promise<AnswerResult>;
}

const JourneyContext = createContext<JourneyContextValue | null>(null);

const storageKey = (userId: string) => `sieg_applicant_id_${userId}`;
const readStored = (userId: string): string | null => {
  try {
    return localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
};
const writeStored = (userId: string, applicantId: string | null) => {
  try {
    if (applicantId) localStorage.setItem(storageKey(userId), applicantId);
    else localStorage.removeItem(storageKey(userId));
  } catch {
    /* storage unavailable: the applicant id then only lives for this session */
  }
};

/** What the backend needs to know about the goal; the qualification rules themselves stay on the backend. */
export function goalText(d: ApplicantDetails): string {
  const field = d.intendedField.trim();
  const target = d.targetInstitution.trim();
  return d.goal === 'study'
    ? `Master's in ${field} at ${target}, Germany`
    : `Employment in Germany: ${field} at ${target}`;
}

const messageOf = (err: unknown) => (err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong');

export const JourneyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [applicantId, setApplicantId] = useState<string | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [agent, setAgent] = useState<AgentView | null>(null);
  const [busy, setBusy] = useState<Busy>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // always read the latest id inside async callbacks
  const idRef = useRef<string | null>(null);
  idRef.current = applicantId;

  const adopt = useCallback(
    (id: string | null) => {
      setApplicantId(id);
      idRef.current = id;
      if (userId) writeStored(userId, id);
    },
    [userId],
  );

  /** Journey first; then the agent's next action (the agent is only consulted once there is an evaluation). */
  const load = useCallback(
    async (id: string) => {
      setIsLoading(true);
      try {
        const j = await api.getJourney(id);
        setJourney(j);
        if (!j.evaluation) {
          setAgent(null);
          return;
        }
        try {
          // reading the pending action never calls the LLM; decide only when there is no current one
          let view = await api.getNextAction(id);
          if (!view.action || view.isCurrent === false) view = await api.decide(id);
          setAgent(view);
        } catch (err) {
          setAgent(null);
          setError(messageOf(err));
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          adopt(null); // the stored applicant no longer exists on the backend
          setJourney(null);
          setAgent(null);
        } else {
          setError(messageOf(err));
        }
      } finally {
        setIsLoading(false);
      }
    },
    [adopt],
  );

  // sign-in / sign-out / switching users
  useEffect(() => {
    setError(null);
    setJourney(null);
    setAgent(null);
    if (!userId) {
      setApplicantId(null);
      idRef.current = null;
      return;
    }
    const stored = readStored(userId);
    setApplicantId(stored);
    idRef.current = stored;
    if (stored) void load(stored);
  }, [userId, load]);

  const run = useCallback(async <T,>(state: Busy, fn: () => Promise<T>): Promise<T> => {
    setBusy(state);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(messageOf(err));
      throw err;
    } finally {
      setBusy('idle');
    }
  }, []);

  const requireId = () => {
    if (!idRef.current) throw new Error('Start your application first.');
    return idRef.current;
  };

  const value = useMemo<JourneyContextValue>(
    () => ({
      applicantId,
      journey,
      agent,
      busy,
      isLoading,
      error,
      clearError: () => setError(null),

      saveApplicant: (details) =>
        run('saving', async () => {
          const goal = goalText(details);
          const programLabel = details.goal === 'study' ? 'Study' : 'Employment';
          let id = idRef.current;
          if (!id) {
            const created = await api.createApplicant({
              name: details.fullName.trim(),
              email: details.email.trim() || undefined,
              goal,
              programLabel,
            });
            id = created.id;
            adopt(id);
          } else {
            await api.setGoal(id, goal, programLabel);
          }
          await load(id);
          return id;
        }),

      uploadDocument: (file, docType) =>
        run('uploading', async () => {
          const id = requireId();
          await api.uploadDocument(id, file, docType);
          await load(id);
        }),

      processDocuments: () =>
        run('processing', async () => {
          const id = requireId();
          const result = await api.processPending(id);
          await load(id);
          return result;
        }),

      refresh: async () => {
        if (idRef.current) await load(idRef.current);
      },

      askAgent: (opts) =>
        run('thinking', async () => {
          const id = requireId();
          const view = await api.decide(id, opts?.refresh);
          setAgent(view);
          return view;
        }),

      answerClarification: (clarificationId, answer) =>
        run('answering', async () => {
          const id = requireId();
          const result = await api.answerClarification(id, clarificationId, answer);
          await load(id);
          return result;
        }),
    }),
    [applicantId, journey, agent, busy, isLoading, error, run, load, adopt],
  );

  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
};

export function useJourney(): JourneyContextValue {
  const ctx = useContext(JourneyContext);
  if (!ctx) throw new Error('useJourney must be used inside <JourneyProvider>');
  return ctx;
}
