import React from 'react';
import { JourneyStage } from '../types';
import { Check, ArrowRight } from 'lucide-react';

interface JourneyStepperProps {
  currentStage: JourneyStage;
  onSelectStage?: (stage: JourneyStage) => void;
}

const journeyStages: { id: JourneyStage; label: string; description: string; stepNumber: number }[] = [
  { id: 'understand', label: 'Understand', description: 'Extracted Profile', stepNumber: 1 },
  { id: 'check', label: 'Check', description: 'Audited Criteria', stepNumber: 2 },
  { id: 'find-gap', label: 'Find Gap', description: 'Identified Missing Proof', stepNumber: 3 },
  { id: 'decide', label: 'Decide', description: 'Calculated Solution', stepNumber: 4 },
  { id: 'act', label: 'Act', description: 'Take the next step', stepNumber: 5 },
];

export const JourneyStepper: React.FC<JourneyStepperProps> = ({
  currentStage,
  onSelectStage,
}) => {
  const getStageIndex = (stage: JourneyStage) => {
    switch (stage) {
      case 'understand':
        return 1;
      case 'check':
        return 2;
      case 'find-gap':
        return 3;
      case 'decide':
        return 4;
      case 'act':
        return 5;
      default:
        return 5;
    }
  };

  const currentIdx = getStageIndex(currentStage);

  return (
    <div className="w-full bg-[#151515] border border-[#262626] rounded-2xl p-4 sm:p-5 shadow-xl">
      <div className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wider mb-3 text-center sm:text-left">
        SIEG.AI Decision Engine Pipeline
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-1">
        {journeyStages.map((stage, idx) => {
          const isCompleted = currentIdx > stage.stepNumber;
          const isCurrent = currentIdx === stage.stepNumber;

          return (
            <React.Fragment key={stage.id}>
              <div
                onClick={() => onSelectStage && onSelectStage(stage.id)}
                className={`flex-1 flex items-center gap-2.5 p-2.5 rounded-xl transition-all ${
                  isCurrent
                    ? 'bg-[#050505] border border-[#FFD21C]/80 ring-2 ring-amber-400/20 shadow-md'
                    : isCompleted
                    ? 'bg-[#050505]/60 border border-[#262626]'
                    : 'opacity-50'
                } ${onSelectStage ? 'cursor-pointer hover:border-neutral-500' : ''}`}
              >
                {/* Circle badge */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0 transition-colors ${
                    isCurrent
                      ? 'bg-[#E30613] text-white shadow-md'
                      : isCompleted
                      ? 'bg-[#151515] text-[#FFD21C] border border-[#FFD21C]/50'
                      : 'bg-[#222] text-neutral-500'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3] text-[#FFD21C]" /> : stage.stepNumber}
                </div>

                {/* Text labels */}
                <div className="space-y-0.5 min-w-0">
                  <div
                    className={`text-xs font-bold truncate ${
                      isCurrent
                        ? 'text-white'
                        : isCompleted
                        ? 'text-neutral-200'
                        : 'text-neutral-500'
                    }`}
                  >
                    {stage.label}
                  </div>
                  <div className="text-[10px] font-mono text-neutral-500 truncate hidden md:block">
                    {stage.description}
                  </div>
                </div>

                {isCurrent && (
                  <span className="ml-auto text-[9px] font-mono font-black text-white bg-[#E30613] px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                    Now
                  </span>
                )}
              </div>

              {idx < journeyStages.length - 1 && (
                <div className="hidden sm:flex items-center justify-center px-0.5 text-neutral-600 shrink-0">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
