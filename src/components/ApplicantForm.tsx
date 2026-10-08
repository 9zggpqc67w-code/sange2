import React, { useState } from 'react';
import { ApplicantDetails, ApplicantGoal } from '../types';
import { suggestedUniversities, suggestedCompanies } from '../data/mockData';
import {
  GraduationCap,
  Briefcase,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';

interface ApplicantFormProps {
  details: ApplicantDetails;
  onUpdate: (details: ApplicantDetails) => void;
  /** May be async: the form shows a saving state and any error it throws. */
  onContinue: () => void | Promise<void>;
  onBack: () => void;
}

export const ApplicantForm: React.FC<ApplicantFormProps> = ({
  details,
  onUpdate,
  onContinue,
  onBack,
}) => {
  const [formData, setFormData] = useState<ApplicantDetails>(details);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleGoalChange = (newGoal: ApplicantGoal) => {
    const updated = {
      ...formData,
      goal: newGoal,
      targetInstitution:
        newGoal === 'study' ? suggestedUniversities[0] : suggestedCompanies[0],
    };
    setFormData(updated);
    onUpdate(updated);
  };

  const handleChange = (field: keyof ApplicantDetails, value: string) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdate(updated);
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!formData.email.includes('@')) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!formData.intendedField.trim()) {
      newErrors.intendedField = 'Please specify your intended field';
    }
    if (!formData.targetInstitution.trim()) {
      newErrors.targetInstitution =
        formData.goal === 'study'
          ? 'Please enter your target university'
          : 'Please enter your target company';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onUpdate(formData);
    setSubmitError(null);
    setSaving(true);
    try {
      await onContinue();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not save your details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6 theme-text-main">
      {/* Hero Header */}
      <div className="text-center space-y-2.5 max-w-xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full theme-bg-card border theme-border text-[#FFD21C] text-xs font-mono font-bold backdrop-blur-md shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-[#FFD21C]" />
          <span>AI Admissions & Visa Evaluation</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black tracking-tight theme-text-main uppercase">
          Your journey to Germany starts here.
        </h1>

        <p className="text-sm sm:text-base theme-text-muted leading-relaxed font-normal">
          Tell us where you're headed. We'll help you understand what you need for your Germany application.
        </p>
      </div>

      {/* Main Form: Tech Glass Card */}
      <form
        onSubmit={handleSubmit}
        className="theme-bg-card border theme-border rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6"
      >
        {/* Goal Selector (Study / Work) */}
        <div className="space-y-2.5">
          <label className="text-xs font-mono font-bold theme-text-muted uppercase tracking-wider block">
            Primary Goal in Germany *
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleGoalChange('study')}
              className={`p-4 rounded-2xl border-2 flex items-center justify-center gap-3 transition-all cursor-pointer font-bold text-sm sm:text-base ${
                formData.goal === 'study'
                  ? 'bg-[#E30613] border-red-500 text-white shadow-[0_4px_16px_rgba(201,0,22,0.4)]'
                  : 'theme-bg-surface theme-border theme-text-main hover:border-neutral-500'
              }`}
            >
              <GraduationCap className="w-5 h-5 shrink-0" />
              <span>Study (Master's / PhD)</span>
            </button>

            <button
              type="button"
              onClick={() => handleGoalChange('work')}
              className={`p-4 rounded-2xl border-2 flex items-center justify-center gap-3 transition-all cursor-pointer font-bold text-sm sm:text-base ${
                formData.goal === 'work'
                  ? 'bg-[#E30613] border-red-500 text-white shadow-[0_4px_16px_rgba(201,0,22,0.4)]'
                  : 'theme-bg-surface theme-border theme-text-main hover:border-neutral-500'
              }`}
            >
              <Briefcase className="w-5 h-5 shrink-0" />
              <span>Work (EU Blue Card)</span>
            </button>
          </div>
        </div>

        {/* Full Name & Email */}
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold theme-text-muted uppercase tracking-wider block">
              Full Legal Name *
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full px-4 py-3 rounded-xl theme-bg-input border theme-border theme-text-main text-sm focus:outline-none focus:border-[#E30613] transition-colors"
            />
            {errors.fullName && (
              <p className="text-xs text-[#E30613]">{errors.fullName}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold theme-text-muted uppercase tracking-wider block">
              Email Address *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="e.g. rahul.sharma@example.com"
              className="w-full px-4 py-3 rounded-xl theme-bg-input border theme-border theme-text-main text-sm focus:outline-none focus:border-[#E30613] transition-colors"
            />
            {errors.email && (
              <p className="text-xs text-[#E30613]">{errors.email}</p>
            )}
          </div>
        </div>

        {/* Intended Field & Target Institution */}
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold theme-text-muted uppercase tracking-wider block">
              Intended Field of Study / Work *
            </label>
            <input
              type="text"
              value={formData.intendedField}
              onChange={(e) => handleChange('intendedField', e.target.value)}
              placeholder="e.g. Computer Science / Robotics"
              className="w-full px-4 py-3 rounded-xl theme-bg-input border theme-border theme-text-main text-sm focus:outline-none focus:border-[#E30613] transition-colors"
            />
            {errors.intendedField && (
              <p className="text-xs text-[#E30613]">{errors.intendedField}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold theme-text-muted uppercase tracking-wider block">
              {formData.goal === 'study' ? 'Target University in Germany *' : 'Target Employer in Germany *'}
            </label>
            <input
              type="text"
              value={formData.targetInstitution}
              onChange={(e) => handleChange('targetInstitution', e.target.value)}
              placeholder={formData.goal === 'study' ? 'e.g. Technical University of Munich' : 'e.g. SAP / Siemens'}
              className="w-full px-4 py-3 rounded-xl theme-bg-input border theme-border theme-text-main text-sm focus:outline-none focus:border-[#E30613] transition-colors"
            />
            {errors.targetInstitution && (
              <p className="text-xs text-[#E30613]">{errors.targetInstitution}</p>
            )}
          </div>
        </div>

        {submitError && (
          <p role="alert" className="text-sm text-[#E30613] bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            {submitError}
          </p>
        )}

        {/* Buttons */}
        <div className="pt-4 flex items-center justify-between gap-4 border-t theme-border">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-3 rounded-xl theme-bg-surface hover:theme-bg-subtle border theme-border theme-text-main text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3.5 bg-[#E30613] hover:bg-[#E00018] disabled:opacity-60 text-white font-black text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <span>{saving ? 'Saving…' : 'Proceed to Consent'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
