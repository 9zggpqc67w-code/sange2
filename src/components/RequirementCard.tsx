import React from 'react';
import { QualificationRequirement } from '../types';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface RequirementCardProps {
  requirement: QualificationRequirement;
  onFixAction?: () => void;
}

export const RequirementCard: React.FC<RequirementCardProps> = ({
  requirement,
  onFixAction,
}) => {
  const isMet = requirement.status === 'met';
  const isMissing = requirement.status === 'missing';

  return (
    <div
      className={`border rounded-2xl p-5 sm:p-6 transition-all shadow-xl ${
        isMissing
          ? 'bg-red-500/10 border-[#E30613] ring-4 ring-red-500/10'
          : 'theme-bg-card theme-border hover:border-neutral-500'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        {/* Left Side: Icon & Titles */}
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              isMet
                ? 'theme-bg-surface text-[#FFD21C] border theme-border'
                : 'bg-red-500/20 text-[#E30613] border border-red-500/40'
            }`}
          >
            {isMet ? (
              <CheckCircle2 className="w-5 h-5 text-[#FFD21C]" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-[#E30613]" />
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-base font-black theme-text-main">
                {requirement.title}
              </h3>
              <span className="opacity-40" aria-hidden="true">—</span>
              <span
                className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-md ${
                  isMet
                    ? 'theme-bg-surface text-[#FFD21C] border theme-border'
                    : 'bg-red-500/20 text-[#E30613] border border-red-500/40'
                }`}
              >
                {requirement.statusLabel}
              </span>
            </div>

            <p className="text-sm leading-relaxed theme-text-muted">
              {requirement.explanation}
            </p>

            {/* Evidence & Provenance */}
            {requirement.evidence && (
              <div className="pt-2 flex flex-wrap items-center gap-2 text-xs font-mono theme-text-muted">
                <span>Verified by:</span>
                <span className="font-bold theme-text-main">
                  {requirement.evidence}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Button if Missing */}
        {isMissing && onFixAction && (
          <button
            onClick={onFixAction}
            className="px-4 py-2 bg-[#E30613] hover:bg-[#E00018] text-white text-xs font-mono font-bold rounded-xl transition-all shadow-md self-end sm:self-auto cursor-pointer"
          >
            Upload Now
          </button>
        )}
      </div>
    </div>
  );
};
