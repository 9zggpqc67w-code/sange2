import React, { useRef, useState } from 'react';
import { AlertTriangle, Bot, CheckCircle2, Loader2, RefreshCw, Upload, ArrowRight, HelpCircle } from 'lucide-react';
import { useJourney } from '../journey/JourneyContext';
import { DOC_TYPE_LABEL } from '../data/documentSlots';
import { AgentOption } from '../services/api';

interface AgentActionPanelProps {
  /** Opens the qualification screen (used for "show missing requirement"). */
  onOpenQualification?: () => void;
}

const optionLabel = (o: AgentOption) => {
  const where = o.sources.map((s) => DOC_TYPE_LABEL[s] ?? (s === 'applicant' ? 'your input' : s)).join(', ');
  return `${String(o.value)}${where ? ` — stated in ${where}` : ''}`;
};

/**
 * Renders the backend agent's single next action. All decisions come from the backend
 * (POST /agent/decide); this component only shows them and sends the applicant's response back.
 */
export const AgentActionPanel: React.FC<AgentActionPanelProps> = ({ onOpenQualification }) => {
  const { journey, agent, busy, isLoading, uploadDocument, processDocuments, answerClarification, refresh } = useJourney();
  const fileRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [freeText, setFreeText] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const action = agent?.action ?? null;
  const type = action?.type;
  const params = action?.params;
  const clarificationId = agent?.clarification?.id ?? params?.clarificationId;
  const working = busy !== 'idle';
  const rationale = action?.decision?.decision?.rationale;

  // --- nothing to decide yet
  if (!journey?.evaluation) {
    return (
      <PanelShell tone="neutral" kicker="Next step" heading="Scan your documents to get your first recommendation">
        <p className="text-sm theme-text-muted max-w-2xl leading-relaxed">
          Once your documents are scanned and checked, the SIEG.AI agent will tell you the single most useful thing to do next.
        </p>
      </PanelShell>
    );
  }
  if (!agent && isLoading) {
    return (
      <PanelShell tone="neutral" kicker="Next step" heading="Thinking…">
        <Loader2 className="w-5 h-5 animate-spin text-[#FFD21C]" />
      </PanelShell>
    );
  }

  const uploadAndScan = async (file: File) => {
    setLocalError(null);
    try {
      await uploadDocument(file, params!.docType ?? 'UNKNOWN');
      await processDocuments();
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Upload failed');
    }
  };

  const submitAnswer = async () => {
    if (!clarificationId) return;
    setLocalError(null);
    try {
      const options = params?.options ?? [];
      if (options.length) {
        if (picked === null) return;
        await answerClarification(clarificationId, { value: options[picked].value, choice: String(options[picked].value) });
      } else {
        if (!freeText.trim()) return;
        await answerClarification(clarificationId, { text: freeText.trim() });
      }
      setPicked(null);
      setFreeText('');
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Could not save your answer');
    }
  };

  const ready = type === 'RECOMMEND_NEXT_STEP';
  const heading =
    type === 'ASK_CLARIFICATION' ? 'We need one answer from you'
    : type === 'REQUEST_DOCUMENT' ? `Upload your ${DOC_TYPE_LABEL[params?.docType ?? ''] ?? 'document'}`
    : type === 'SHOW_MISSING_REQUIREMENT' ? 'A requirement needs your attention'
    : ready ? 'You are ready for the next step'
    : 'Nothing needed right now';

  return (
    <PanelShell
      tone={ready ? 'good' : type === 'NO_ACTION' ? 'neutral' : 'alert'}
      kicker={ready ? 'Application on track' : 'Priority Directive'}
      heading={heading}
      badge={agent?.source === 'LLM' ? 'AI agent' : agent?.source === 'FALLBACK' ? 'Rule-based fallback' : undefined}
    >
      <p className="text-sm theme-text-main max-w-2xl leading-relaxed">{agent?.message}</p>
      {rationale && type !== 'NO_ACTION' && (
        <p className="text-xs theme-text-muted max-w-2xl leading-relaxed">
          <span className="font-mono font-bold uppercase">Why: </span>
          {rationale}
        </p>
      )}

      {type === 'REQUEST_DOCUMENT' && (
        <div className="pt-1">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void uploadAndScan(f);
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={working}
            className="px-6 py-3.5 bg-[#E30613] hover:bg-[#E00018] disabled:opacity-50 text-white font-black text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span>{busy === 'processing' ? 'Scanning…' : busy === 'uploading' ? 'Uploading…' : `Upload ${DOC_TYPE_LABEL[params?.docType ?? ''] ?? 'document'}`}</span>
          </button>
        </div>
      )}

      {type === 'ASK_CLARIFICATION' && clarificationId && (
        <div className="space-y-3 pt-1">
          {(params?.options ?? []).length > 0 ? (
            <div className="space-y-2">
              {params!.options.map((o, i) => (
                <label
                  key={i}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                    picked === i ? 'border-[#E30613] bg-red-500/10' : 'theme-border theme-bg-card hover:border-neutral-500'
                  }`}
                >
                  <input type="radio" name="clarification-option" checked={picked === i} onChange={() => setPicked(i)} className="accent-[#E30613]" />
                  <span className="text-sm font-bold theme-text-main">{optionLabel(o)}</span>
                </label>
              ))}
            </div>
          ) : (
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              rows={3}
              placeholder="Type your answer…"
              className="w-full px-4 py-3 rounded-xl theme-bg-input border theme-border theme-text-main text-sm focus:outline-none focus:border-[#E30613]"
            />
          )}
          <button
            onClick={submitAnswer}
            disabled={working || ((params?.options ?? []).length > 0 ? picked === null : !freeText.trim())}
            className="px-6 py-3 bg-[#E30613] hover:bg-[#E00018] disabled:opacity-40 text-white font-black text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            {busy === 'answering' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{busy === 'answering' ? 'Saving…' : 'Confirm answer'}</span>
          </button>
        </div>
      )}

      {type === 'SHOW_MISSING_REQUIREMENT' && onOpenQualification && (
        <button
          onClick={onOpenQualification}
          className="px-6 py-3 bg-[#E30613] hover:bg-[#E00018] text-white font-black text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
        >
          <span>See the requirement</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      )}

      {ready && journey.evaluation && (
        <p className="text-[11px] font-mono theme-text-muted">{journey.evaluation.disclaimer}</p>
      )}

      {localError && (
        <p role="alert" className="text-xs text-[#E30613] bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {localError}
        </p>
      )}

      <div className="pt-2 border-t theme-border">
        <button
          onClick={() => void refresh()}
          disabled={working || isLoading}
          className="text-xs font-mono theme-text-muted hover:theme-text-main flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh from server</span>
        </button>
      </div>
    </PanelShell>
  );
};

const PanelShell: React.FC<{
  tone: 'alert' | 'good' | 'neutral';
  kicker: string;
  heading: string;
  badge?: string;
  children: React.ReactNode;
}> = ({ tone, kicker, heading, badge, children }) => {
  const Icon = tone === 'good' ? CheckCircle2 : tone === 'alert' ? AlertTriangle : HelpCircle;
  return (
    <div
      className={`border-2 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl transition-all ${
        tone === 'good' ? 'theme-bg-card border-emerald-500/80 shadow-emerald-500/5' : tone === 'alert' ? 'theme-bg-surface border-[#E30613] shadow-red-500/10' : 'theme-bg-card theme-border'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2.5 py-0.5 rounded font-mono font-extrabold text-[10px] uppercase tracking-wider text-white ${tone === 'good' ? 'bg-emerald-600' : 'bg-[#E30613]'}`}>
          {kicker}
        </span>
        {badge && (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono theme-text-muted">
            <Bot className="w-3 h-3" /> {badge}
          </span>
        )}
      </div>
      <h2 className="text-2xl sm:text-3xl font-black theme-text-main tracking-tight uppercase flex items-center gap-3">
        <Icon className={`w-7 h-7 shrink-0 ${tone === 'good' ? 'text-emerald-500' : tone === 'alert' ? 'text-[#E30613]' : 'text-[#FFD21C]'}`} />
        <span>{heading}</span>
      </h2>
      {children}
    </div>
  );
};
