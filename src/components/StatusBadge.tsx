import React from 'react';
import { ProvenanceType } from '../types';
import { Check, Circle, AlertTriangle, AlertCircle, Sparkles } from 'lucide-react';

interface StatusBadgeProps {
  type: ProvenanceType;
  customLabel?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  type,
  customLabel,
  size = 'sm',
}) => {
  const sizeClasses = size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[11px] px-2 py-0.5';

  switch (type) {
    case 'document-supported':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-mono font-bold rounded-md bg-[#050505] text-[#FFD21C] border border-[#333] ${sizeClasses}`}
          title="Information directly extracted and verified from official submitted document"
        >
          <Check className="w-3 h-3 stroke-[3] text-[#FFD21C] shrink-0" />
          <span>{customLabel || 'Document-supported'}</span>
        </span>
      );

    case 'applicant-provided':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-mono font-medium rounded-md bg-[#1F1F1F] text-neutral-300 border border-[#333] ${sizeClasses}`}
          title="Information reported by applicant during profile setup or CV text"
        >
          <Circle className="w-2 h-2 fill-neutral-400 text-neutral-400 shrink-0" />
          <span>{customLabel || 'Applicant-provided'}</span>
        </span>
      );

    case 'missing':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-mono font-bold rounded-md bg-red-950/80 text-red-300 border border-red-700/80 ${sizeClasses}`}
          title="Required document or credential is currently missing"
        >
          <AlertTriangle className="w-3 h-3 stroke-[2.5] text-[#FFD21C] shrink-0" />
          <span>{customLabel || 'Missing'}</span>
        </span>
      );

    case 'conflict':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-mono font-bold rounded-md bg-red-900 text-white border border-red-500 ${sizeClasses}`}
          title="Discrepancy found between submitted documents or applicant declaration"
        >
          <AlertCircle className="w-3 h-3 stroke-[2.5] text-white shrink-0" />
          <span>{customLabel || 'Conflict'}</span>
        </span>
      );

    case 'ai-generated':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-mono font-bold rounded-md bg-amber-950/80 text-[#FFD21C] border border-amber-800/80 ${sizeClasses}`}
          title="Synthesized by AI engine based on Anabin database or Bavarian grade formula"
        >
          <Sparkles className="w-3 h-3 text-[#FFD21C] shrink-0" />
          <span>{customLabel || 'AI-generated'}</span>
        </span>
      );

    default:
      return null;
  }
};
