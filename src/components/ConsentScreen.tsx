import React, { useState } from 'react';
import { ShieldCheck, Lock, ArrowRight, ArrowLeft } from 'lucide-react';

interface ConsentScreenProps {
  onContinue: () => void;
  onBack: () => void;
}

export const ConsentScreen: React.FC<ConsentScreenProps> = ({ onContinue, onBack }) => {
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [agreedAnabin, setAgreedAnabin] = useState(true);

  const canContinue = agreedTerms && agreedAnabin;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-6 theme-text-main">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full theme-bg-card border theme-border text-[#FFD21C] text-xs font-mono font-bold backdrop-blur-md">
          <Lock className="w-3.5 h-3.5 text-[#FFD21C]" />
          <span>EU / German Data Protection (GDPR / DSGVO)</span>
        </div>
        <h1 className="text-3xl font-black theme-text-main tracking-tight uppercase">
          Document Processing Consent
        </h1>
        <p className="text-sm theme-text-muted max-w-md mx-auto">
          Please confirm authorization to evaluate your academic records against official German admission standards.
        </p>
      </div>

      {/* Tech Glass Card */}
      <div className="theme-bg-card border theme-border rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex items-center gap-3 p-4 theme-bg-surface rounded-2xl border theme-border">
          <ShieldCheck className="w-6 h-6 text-[#FFD21C] shrink-0" />
          <p className="text-xs theme-text-muted leading-relaxed">
            Your documents are processed securely in compliance with the German Federal Data Protection Act (BDSG) solely for academic recognition and visa preparation.
          </p>
        </div>

        {/* Checkbox Options */}
        <div className="space-y-4 pt-1">
          <label className="flex items-start gap-3.5 p-4 rounded-2xl border theme-border theme-bg-surface hover:theme-bg-subtle transition-colors cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreedTerms}
              onChange={(e) => setAgreedTerms(e.target.checked)}
              className="mt-1 w-4 h-4 accent-[#E30613] rounded cursor-pointer"
            />
            <div className="text-xs space-y-1">
              <span className="font-bold theme-text-main block">
                Consent to Automated Document Verification
              </span>
              <span className="theme-text-muted">
                I authorize SIEG.AI to extract academic credentials, calculate Bavarian grade equivalents, and cross-reference records with the KMK Anabin database.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3.5 p-4 rounded-2xl border theme-border theme-bg-surface hover:theme-bg-subtle transition-colors cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreedAnabin}
              onChange={(e) => setAgreedAnabin(e.target.checked)}
              className="mt-1 w-4 h-4 accent-[#E30613] rounded cursor-pointer"
            />
            <div className="text-xs space-y-1">
              <span className="font-bold theme-text-main block">
                Official Recognition & Advisory Standards
              </span>
              <span className="theme-text-muted">
                I acknowledge that SIEG.AI provides automated guidance. Formal admissions decisions are determined solely by German higher education institutions and Uni-Assist.
              </span>
            </div>
          </label>
        </div>

        {/* Navigation Buttons */}
        <div className="pt-4 flex items-center justify-between gap-4 border-t theme-border">
          <button
            onClick={onBack}
            className="px-5 py-3 rounded-xl theme-bg-surface hover:theme-bg-subtle border theme-border theme-text-main text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <button
            onClick={onContinue}
            disabled={!canContinue}
            className={`px-8 py-3.5 rounded-xl font-black text-sm flex items-center gap-2 transition-all ${
              canContinue
                ? 'bg-[#E30613] hover:bg-[#E00018] text-white shadow-md cursor-pointer'
                : 'theme-bg-surface theme-text-muted opacity-50 cursor-not-allowed'
            }`}
          >
            <span>Agree & Continue to Upload</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
