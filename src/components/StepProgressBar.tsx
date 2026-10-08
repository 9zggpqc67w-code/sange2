import React from 'react';
import { ApplicationStep } from '../types';
import { Check } from 'lucide-react';

interface StepProgressBarProps {
  currentStep: ApplicationStep;
  onNavigate: (step: ApplicationStep) => void;
}

const steps: { key: ApplicationStep; label: string; number: number }[] = [
  { key: 'details', label: 'Applicant Details', number: 1 },
  { key: 'documents', label: 'Upload Documents', number: 2 },
  { key: 'processing', label: 'AI Processing', number: 3 },
];

export const StepProgressBar: React.FC<StepProgressBarProps> = ({ currentStep, onNavigate }) => {
  if (currentStep === 'home') return null;

  const getStepIndex = (step: ApplicationStep) => {
    switch (step) {
      case 'details':
        return 1;
      case 'documents':
        return 2;
      case 'processing':
      case 'profile':
      case 'qualification':
      case 'next-action':
        return 3;
      default:
        return 0;
    }
  };

  const currentIndex = getStepIndex(currentStep);

  return (
    <div className="bg-[#050505] border-b border-[#262626] py-3.5 px-4 font-mono">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {steps.map((step, idx) => {
          const isCompleted = currentIndex > step.number;
          const isCurrent = currentIndex === step.number;
          const isClickable = step.number <= currentIndex;

          return (
            <React.Fragment key={step.key}>
              <button
                onClick={() => isClickable && onNavigate(step.key)}
                disabled={!isClickable}
                className={`flex items-center gap-2.5 text-left transition-colors ${
                  isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                    isCompleted
                      ? 'bg-[#151515] text-[#FFD21C] border border-[#FFD21C]/50'
                      : isCurrent
                      ? 'bg-[#E30613] text-white shadow-md'
                      : 'bg-[#151515] text-neutral-500 border border-[#262626]'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : step.number}
                </span>
                <span
                  className={`text-xs font-bold hidden sm:inline ${
                    isCurrent
                      ? 'text-white'
                      : isCompleted
                      ? 'text-neutral-300'
                      : 'text-neutral-500'
                  }`}
                >
                  {step.label}
                </span>
              </button>

              {idx < steps.length - 1 && (
                <div
                  className={`flex-1 h-[2px] mx-3 sm:mx-6 transition-colors ${
                    currentIndex > step.number ? 'bg-[#FFD21C]' : 'bg-[#262626]'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
