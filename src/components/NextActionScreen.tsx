import React, { useState } from 'react';
import { JourneyStage } from '../types';
import { JourneyStepper } from './JourneyStepper';
import { AgentActionPanel } from './AgentActionPanel';
import { useJourney } from '../journey/JourneyContext';
import { ArrowLeft, Sparkles, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

interface NextActionScreenProps {
  onBackToQualification: () => void;
}

/** The backend agent's next-best-action, plus everything the backend still lists as open. */
export const NextActionScreen: React.FC<NextActionScreenProps> = ({ onBackToQualification }) => {
  const [activeStage, setActiveStage] = useState<JourneyStage>('act');
  const { journey, busy, error, askAgent } = useJourney();
  const [askError, setAskError] = useState<string | null>(null);

  const openItems = journey?.gaps ?? [];
  const evaluated = Boolean(journey?.evaluation);

  const askAgain = async () => {
    setAskError(null);
    try {
      await askAgent({ refresh: true });
    } catch (e) {
      setAskError(e instanceof Error ? e.message : 'The agent could not decide right now');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8 theme-text-main">
      {/* Header Badge */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 theme-bg-card text-[#FFD21C] text-xs font-mono font-bold rounded-full border theme-border backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-[#FFD21C]" />
          <span>Screen 3 of 3 · AI Decision Engine</span>
        </div>
      </div>

      <JourneyStepper currentStage={activeStage} onSelectStage={setActiveStage} />

      {error && (
        <p role="alert" className="text-sm text-[#E30613] bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* Main focus: the agent's single next action */}
      <AgentActionPanel onOpenQualification={onBackToQualification} />

      {/* Everything the backend still lists as open (the agent picks ONE of these) */}
      {evaluated && (
        <div className="p-5 rounded-2xl theme-bg-card border theme-border space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-mono font-bold uppercase tracking-wider theme-text-muted">
              Open items on your application ({openItems.length})
            </span>
            <button
              onClick={askAgain}
              disabled={busy !== 'idle'}
              className="text-xs font-mono px-3 py-1.5 rounded-lg theme-bg-surface hover:theme-bg-subtle border theme-border theme-text-main flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              {busy === 'thinking' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>Ask the agent again</span>
            </button>
          </div>
          {openItems.length === 0 ? (
            <p className="text-sm theme-text-muted">Nothing is open — all checks passed.</p>
          ) : (
            <ul className="space-y-2">
              {openItems.map((g) => (
                <li key={g.id} className="flex items-start gap-2.5 text-sm theme-text-main">
                  <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${g.severity === 'BLOCKING' ? 'text-[#E30613]' : 'text-[#FFD21C]'}`} />
                  <span>
                    {g.message}
                    <span className="ml-2 text-[10px] font-mono theme-text-muted uppercase">{g.kind.replace('_', ' ')}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {askError && (
            <p role="alert" className="text-xs text-[#E30613] bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {askError}
            </p>
          )}
        </div>
      )}

      <div className="pt-2 border-t theme-border flex justify-start">
        <button
          onClick={onBackToQualification}
          className="px-5 py-3 rounded-xl theme-bg-surface hover:theme-bg-subtle border theme-border theme-text-main text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Qualification Check</span>
        </button>
      </div>
    </div>
  );
};
