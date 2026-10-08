import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck, Cpu, AlertTriangle, RefreshCw, ArrowLeft, ArrowRight } from 'lucide-react';
import { useJourney } from '../journey/JourneyContext';
import { DOC_TYPE_LABEL } from '../data/documentSlots';

interface ProcessingScreenProps {
  onComplete: () => void;
  onBack: () => void;
  applicantName: string;
}

const analysisSteps = [
  { id: 1, text: 'Reading your uploaded documents (text layer or vision)...' },
  { id: 2, text: 'Classifying each document and extracting facts with source quotes...' },
  { id: 3, text: 'Checking every extracted fact against the document text...' },
  { id: 4, text: 'Comparing documents for conflicts and checking the requirements...' },
  { id: 5, text: 'Building your verified applicant dossier & next step...' },
];

type Phase = 'running' | 'done' | 'error';

/** Runs the real backend scan (POST /applicants/:id/process) and shows its progress and outcome. */
export const ProcessingScreen: React.FC<ProcessingScreenProps> = ({ onComplete, onBack, applicantName }) => {
  const { processDocuments, journey } = useJourney();
  const [progress, setProgress] = useState(8);
  const [phase, setPhase] = useState<Phase>('running');
  const [problems, setProblems] = useState<string[]>([]);
  const started = useRef(false);

  const run = useCallback(async () => {
    setPhase('running');
    setProblems([]);
    setProgress(8);
    try {
      const result = await processDocuments();
      const failed = result.processed.filter((p) => p.status === 'FAILED');
      const lines = [
        ...failed.map((p) => `${DOC_TYPE_LABEL[journey?.documents.find((d) => d.id === p.documentId)?.docType ?? ''] ?? 'Document'}: ${p.error ?? 'processing failed'}`),
        ...(result.evaluationError ? [result.evaluationError] : []),
      ];
      setProblems(lines);
      // everything that was waiting failed: nothing new to show, so let the applicant decide
      if (result.processed.length > 0 && failed.length === result.processed.length) {
        setPhase('error');
      } else {
        setProgress(100);
        setPhase('done');
      }
    } catch (err) {
      setProblems([err instanceof Error ? err.message : 'Processing failed']);
      setPhase('error');
    }
  }, [processDocuments, journey]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  // creep towards 90% while the backend works; the last stretch happens when it answers
  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => setProgress((p) => (p < 90 ? p + 1 : p)), 400);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'done') return;
    const t = setTimeout(onComplete, 900);
    return () => clearTimeout(t);
  }, [phase, onComplete]);

  const stepIndex = progress >= 85 ? 4 : progress >= 65 ? 3 : progress >= 40 ? 2 : progress >= 20 ? 1 : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 space-y-8 text-center theme-text-main">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full theme-bg-card border theme-border text-[#FFD21C] text-xs font-mono font-bold backdrop-blur-md">
          <Cpu className="w-3.5 h-3.5 text-[#FFD21C]" />
          <span>SIEG.AI Admissions Intelligence Engine</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black theme-text-main tracking-tight uppercase">
          {phase === 'error' ? 'Scan could not finish' : 'Scanning & Verifying Dossier'}
        </h1>

        <p className="text-sm theme-text-muted max-w-md mx-auto">
          Evaluating credentials for <span className="theme-text-main font-bold">{applicantName || 'Applicant'}</span> against the application requirements.
        </p>
      </div>

      <div className="theme-bg-card border theme-border rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono theme-text-muted">
            <span>Document scan &amp; qualification</span>
            <span className="font-bold text-[#FFD21C]">{progress}%</span>
          </div>

          <div className="w-full h-3 theme-bg-surface rounded-full overflow-hidden border theme-border p-0.5 flex">
            <div
              className="h-full bg-gradient-to-r from-[#050505] via-[#E30613] to-[#FFD21C] rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {phase === 'error' ? (
          <div role="alert" className="p-4 rounded-2xl bg-red-500/10 border border-[#E30613]/50 text-left space-y-2">
            <div className="text-[11px] font-mono font-bold text-[#E30613] uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> What went wrong
            </div>
            {problems.map((p, i) => (
              <p key={i} className="text-sm theme-text-main leading-snug break-words">{p}</p>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-2xl theme-bg-surface border theme-border text-left space-y-3">
            <div className="text-[11px] font-mono font-bold text-[#E30613] uppercase tracking-wider flex items-center justify-between">
              <span>Current Pipeline Operation</span>
              <span className="w-2 h-2 rounded-full bg-[#FFD21C] animate-ping" />
            </div>
            <p className="text-sm font-bold theme-text-main font-mono">{analysisSteps[stepIndex].text}</p>
          </div>
        )}

        {phase === 'done' && problems.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-left text-xs theme-text-muted space-y-1">
            <div className="font-bold text-[#FFD21C]">Finished with notes</div>
            {problems.map((p, i) => (
              <p key={i} className="break-words">{p}</p>
            ))}
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              onClick={onBack}
              className="px-5 py-3 rounded-xl theme-bg-surface hover:theme-bg-subtle border theme-border theme-text-main text-sm font-bold flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Back to documents
            </button>
            <button
              onClick={() => void run()}
              className="px-5 py-3 rounded-xl bg-[#E30613] hover:bg-[#E00018] text-white text-sm font-black flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Try again
            </button>
            <button
              onClick={onComplete}
              className="px-5 py-3 rounded-xl theme-bg-surface hover:theme-bg-subtle border theme-border theme-text-muted text-sm font-bold flex items-center gap-2 cursor-pointer"
            >
              Continue anyway <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="pt-2 flex flex-wrap items-center justify-around gap-4 text-xs font-mono theme-text-muted border-t theme-border">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#FFD21C]" />
            Facts grounded in your documents
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#E30613]" />
            Conflicts are never silently resolved
          </span>
        </div>
      </div>
    </div>
  );
};
