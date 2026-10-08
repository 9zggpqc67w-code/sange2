import React from 'react';
import { ProfileSection } from '../types';
import { LucideIcon } from 'lucide-react';

interface ApplicantInfoCardProps {
  section: ProfileSection;
  icon?: LucideIcon;
}

export const ApplicantInfoCard: React.FC<ApplicantInfoCardProps> = ({
  section,
  icon: Icon,
}) => {
  return (
    <div className="theme-bg-card border theme-border rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
      {/* Card Header */}
      <div className="flex items-start justify-between pb-3 border-b theme-border gap-3">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-9 h-9 rounded-xl theme-bg-surface text-[#FFD21C] flex items-center justify-center shrink-0 border theme-border">
              <Icon className="w-4 h-4 text-[#FFD21C]" />
            </div>
          )}
          <div>
            <h3 className="text-base font-black theme-text-main uppercase tracking-tight">
              {section.title}
            </h3>
            {section.description && (
              <p className="text-xs theme-text-muted">{section.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Fields List */}
      <div className="space-y-3">
        {section.fields.map((field, idx) => {
          const isMissing = field.provenance === 'missing';
          const isConflict = field.provenance === 'conflict';

          return (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border transition-all ${
                isMissing
                  ? 'bg-red-500/10 border-red-500/40 text-[#E30613]'
                  : isConflict
                  ? 'bg-amber-500/10 border-amber-500/40 text-[#FFD21C]'
                  : 'theme-bg-surface theme-border hover:border-neutral-500'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-mono font-bold theme-text-muted uppercase tracking-wider">
                    {field.label}
                  </span>
                  <div className="text-sm font-bold theme-text-main flex flex-wrap items-center gap-2">
                    <span className={isMissing ? 'text-[#E30613] font-extrabold' : ''}>
                      {field.value}
                    </span>
                  </div>
                </div>

                {field.sourceDetail && (
                  <div className="flex items-center gap-1.5 text-[11px] font-mono theme-text-muted self-start sm:self-auto shrink-0">
                    <span>Source:</span>
                    <span className="px-2 py-0.5 rounded theme-bg-card theme-border border text-[#FFD21C]">
                      {field.sourceDetail}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
