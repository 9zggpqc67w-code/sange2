import React from 'react';
import { ApplicationStep } from '../types';
import { Check, ArrowRight } from 'lucide-react';

interface JourneyProgressProps {
  currentStep: ApplicationStep;
  onNavigate?: (step: ApplicationStep) => void;
}

const steps = [
  {
    stepId: 'details' as ApplicationStep,
    matchSteps: ['details', 'consent'],
    number: '01',
    label: 'Profile',
    description: 'Applicant details',
  },
  {
    stepId: 'documents' as ApplicationStep,
    matchSteps: ['documents'],
    number: '02',
    label: 'Documents',
    description: 'Required credentials',
  },
  {
    stepId: 'dashboard' as ApplicationStep,
    matchSteps: ['processing', 'dashboard', 'profile', 'qualification', 'next-action'],
    number: '03',
    label: 'AI Intelligence',
    description: 'Verification & Actions',
  },
];

export const JourneyProgress: React.FC<JourneyProgressProps> = ({
  currentStep,
  onNavigate,
}) => {
  // If on landing/home, hide journey progress
  if (currentStep === 'home') return null;

  const getStepIndex = (step: ApplicationStep) => {
    switch (step) {
      case 'details':
      case 'consent':
        return 0;
      case 'documents':
        return 1;
      case 'processing':
      case 'dashboard':
      case 'profile':
      case 'qualification':
      case 'next-action':
        return 2;
      default:
        return 0;
    }
  };

  const currentIdx = getStepIndex(currentStep);

  return (
    <div className="w-full theme-bg-surface/90 backdrop-blur-md border-b theme-border py-3 px-4 transition-all">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {steps.map((step, idx) => {
          const isCompleted = currentIdx > idx;
          const isCurrent = currentIdx === idx;
          const isClickable = onNavigate && (idx <= currentIdx + 1);

          return (
            <React.Fragment key={step.number}>
              <button
                type="button"
                onClick={() => isClickable && onNavigate && onNavigate(step.stepId)}
                disabled={!isClickable}
                className={`flex items-center gap-2.5 text-left transition-all ${
                  isClickable ? 'cursor-pointer' : 'cursor-default'
                } group`}
              >
                {/* Number Badge */}
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs font-mono font-bold transition-all shadow-xs ${
                    isCurrent
                      ? 'bg-[#E30613] text-white ring-2 ring-[#FFD21C] shadow-[0_0_12px_rgba(227,6,19,0.5)] scale-105'
                      : isCompleted
                      ? 'theme-bg-card text-[#FFD21C] border border-[#FFD21C]/50'
                      : 'theme-bg-card theme-text-muted border theme-border'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5 stroke-[3] text-[#FFD21C]" />
                  ) : (
                    <span>{step.number}</span>
                  )}
                </div>

                {/* Text Label */}
                <div className="flex flex-col">
                  <span
                    className={`text-xs sm:text-sm font-bold tracking-tight transition-colors ${
                      isCurrent
                        ? 'theme-text-main'
                        : isCompleted
                        ? 'theme-text-main opacity-90'
                        : 'theme-text-muted'
                    }`}
                  >
                    {step.label}
                  </span>
                  <span className="text-[10px] theme-text-muted font-mono hidden md:inline">
                    {step.description}
                  </span>
                </div>
              </button>

              {idx < steps.length - 1 && (
                <div className="flex-1 max-w-[80px] sm:max-w-[140px] flex items-center px-2">
                  <div
                    className={`h-[2px] w-full transition-all duration-300 ${
                      currentIdx > idx ? 'bg-[#FFD21C]' : 'theme-border bg-current opacity-25'
                    }`}
                  />
                  <ArrowRight
                    className={`w-3.5 h-3.5 ml-1 transition-colors shrink-0 ${
                      currentIdx > idx ? 'text-[#FFD21C]' : 'theme-text-muted opacity-40'
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
