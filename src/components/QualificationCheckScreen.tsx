import React from 'react';
import { QualificationRequirement } from '../types';
import { RequirementCard } from './RequirementCard';
import {
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

interface QualificationCheckScreenProps {
  applicantName: string;
  /** Shown under the list: the backend's note that these are DEMO requirements. */
  disclaimer?: string;
  requirements: QualificationRequirement[];
  onContinueToNextAction: () => void;
  onBackToProfile: () => void;
  onFixRequirement?: (id: string) => void;
}

export const QualificationCheckScreen: React.FC<QualificationCheckScreenProps> = ({
  applicantName,
  disclaimer,
  requirements,
  onContinueToNextAction,
  onBackToProfile,
  onFixRequirement,
}) => {
  const attention = requirements.filter((r) => r.status !== 'met');
  const metCount = requirements.length - attention.length;
  const first = attention[0];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8 theme-text-main">
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 theme-bg-card text-[#FFD21C] text-xs font-mono font-bold rounded-full border theme-border backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-[#FFD21C]" />
          <span>Screen 2 of 3 · German University Admissions Criteria</span>
        </div>

        <h1 className="text-3xl font-black theme-text-main tracking-tight uppercase">
          Qualification Check
        </h1>
        <p className="text-sm theme-text-muted">
          Cross-checking {applicantName || 'your'} credentials against the application requirements, based on your documents.
        </p>
      </div>

      {/* Prominent Highlighting for Missing Requirement */}
      {requirements.length === 0 && (
        <div className="theme-bg-card border theme-border rounded-2xl p-6 text-sm theme-text-muted">
          Your documents have not been evaluated yet. Upload them and run the scan to see your requirements here.
        </div>
      )}

      {attention.length > 0 && (
        <div className="bg-red-500/10 border-2 border-[#E30613] rounded-3xl p-6 sm:p-8 shadow-2xl flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-[#E30613] flex items-center justify-center shrink-0 border border-red-500/30">
            <AlertTriangle className="w-6 h-6 text-[#E30613]" />
          </div>
          <div className="space-y-1.5 flex-1">
            <div className="text-xs font-mono font-extrabold text-[#E30613] uppercase tracking-wider">
              Action Required
            </div>
            <h3 className="text-xl font-black theme-text-main">
              {first.title}: {first.statusLabel.toLowerCase()}
            </h3>
            <p className="text-sm theme-text-muted leading-relaxed">
              {metCount} of {requirements.length} requirements are met. {first.explanation}
            </p>
          </div>
        </div>
      )}

      {/* Requirements List */}
      <div className="space-y-4">
        {requirements.map((req) => (
          <RequirementCard
            key={req.id}
            requirement={req}
            onFixAction={
              req.status === 'missing' && onFixRequirement
                ? () => onFixRequirement(req.id)
                : undefined
            }
          />
        ))}
      </div>

      {disclaimer && <p className="text-[11px] font-mono theme-text-muted">{disclaimer}</p>}

      {/* Footer Navigation */}
      <div className="pt-4 flex items-center justify-between gap-4 border-t theme-border">
        <button
          onClick={onBackToProfile}
          className="px-5 py-3 rounded-xl theme-bg-surface hover:theme-bg-subtle border theme-border theme-text-main text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Profile</span>
        </button>

        <button
          onClick={onContinueToNextAction}
          className="px-8 py-3.5 bg-[#E30613] hover:bg-[#E00018] text-white font-black text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
        >
          <span>View Next Action Directive</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
