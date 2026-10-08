import React from 'react';
import {
  ApplicantDetails,
  DocumentItem,
  QualificationRequirement,
  DashboardStats,
} from '../types';
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Bot,
  Compass,
} from 'lucide-react';
import { AgentActionPanel } from './AgentActionPanel';
import { useJourney } from '../journey/JourneyContext';

interface DashboardScreenProps {
  details: ApplicantDetails;
  documents: DocumentItem[];
  requirements: QualificationRequirement[];
  stats: DashboardStats;
  onNavigateToProfile: () => void;
  onNavigateToDocuments: () => void;
  onNavigateToQualification: () => void;
  onNavigateToNextAction: () => void;
  onOpenChatbot: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  details,
  documents,
  requirements,
  stats,
  onNavigateToProfile,
  onNavigateToDocuments,
  onNavigateToQualification,
  onNavigateToNextAction,
  onOpenChatbot,
}) => {
  const { journey, error } = useJourney();

  // every number below comes from the backend journey (via the mapper)
  const uploadedCount = stats.documentsUploadedCount;
  const missingCount = stats.documentsMissingCount;
  const metReqCount = stats.requirementsMetCount;
  const attentionReqCount = stats.requirementsAttentionCount;
  const currentProgress = stats.progressPercentage;
  const verdict = journey?.evaluation?.verdict;
  const evaluated = Boolean(journey?.evaluation);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10 theme-text-main">
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b theme-border">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full theme-bg-card border theme-border text-[#FFD21C] text-xs font-mono font-bold backdrop-blur-md">
            <Compass className="w-3.5 h-3.5 text-[#FFD21C]" />
            <span>Command Center · Germany Admissions Intelligence</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black theme-text-main tracking-tight uppercase">
            Your Germany Application
          </h1>

          <p className="text-base sm:text-lg theme-text-muted font-normal">
            Here's where you currently stand.
          </p>
        </div>

        {/* Applicant Tag */}
        <div className="flex items-center gap-3 theme-bg-card px-4 py-2.5 rounded-2xl border theme-border self-start md:self-auto shadow-md">
          <div className="w-9 h-9 rounded-xl bg-[#E30613] text-white font-mono font-bold flex items-center justify-center text-xs shadow-xs">
            {details.fullName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()}
          </div>
          <div>
            <div className="text-xs font-bold theme-text-main flex items-center gap-2">
              <span>{details.fullName || 'Applicant'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 theme-bg-surface text-[#FFD21C] border theme-border rounded">
                DE 🇩🇪
              </span>
            </div>
            <div className="text-[11px] font-mono theme-text-muted truncate max-w-[200px]">
              {details.targetInstitution || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="theme-bg-card border theme-border rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="text-xs font-mono font-bold uppercase tracking-wider theme-text-muted">
              Overall Application Progress
            </div>
            <div className="text-xl sm:text-2xl font-black theme-text-main">
              Application Readiness Score
            </div>
          </div>

          <div className="flex items-baseline gap-2 self-start sm:self-auto">
            <span className="text-3xl sm:text-4xl font-mono font-black text-[#FFD21C]">
              {currentProgress}%
            </span>
            <span className="text-xs font-mono theme-text-muted">
              {verdict === 'READY' ? 'Ready' : stats.profileStatus}
            </span>
          </div>
        </div>

        {/* Progress Bar with German Tri-Color Accent */}
        <div className="space-y-2">
          <div className="w-full h-3.5 theme-bg-surface rounded-full overflow-hidden border theme-border p-0.5 flex">
            <div
              className="h-full bg-gradient-to-r from-[#050505] via-[#E30613] to-[#FFD21C] rounded-full transition-all duration-700 shadow-sm"
              style={{ width: `${currentProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-mono theme-text-muted">
            <span>Dossier Inception</span>
            <span className="text-[#FFD21C] font-semibold">{evaluated ? 'Evaluated' : 'Not evaluated yet'}</span>
            <span>Application ready</span>
          </div>
        </div>
      </div>

      {/* 3 Core Metric Overview Cards */}
      <div className="grid sm:grid-cols-3 gap-5">
        {/* Metric 1: Documents */}
        <div
          onClick={onNavigateToDocuments}
          className="theme-bg-card border theme-border hover:border-[#E30613] p-6 rounded-3xl space-y-3 cursor-pointer transition-all duration-200 group shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider theme-text-muted">
              Documents
            </span>
            <div className="w-7 h-7 rounded-lg theme-bg-surface flex items-center justify-center text-xs font-mono font-bold text-[#FFD21C]">
              {uploadedCount}/{documents.length}
            </div>
          </div>

          <div className="text-2xl font-black theme-text-main">
            {uploadedCount} Uploaded
          </div>

          <div className="text-xs font-mono flex items-center gap-1.5">
            {missingCount === 0 ? (
              <span className="text-emerald-500 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> All files present
              </span>
            ) : (
              <span className="text-[#E30613] font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-[#E30613]" /> {missingCount} document missing
              </span>
            )}
          </div>
        </div>

        {/* Metric 2: Requirements */}
        <div
          onClick={onNavigateToQualification}
          className="theme-bg-card border theme-border hover:border-[#FFD21C] p-6 rounded-3xl space-y-3 cursor-pointer transition-all duration-200 group shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider theme-text-muted">
              Requirements
            </span>
            <div className="w-7 h-7 rounded-lg theme-bg-surface flex items-center justify-center text-xs font-mono font-bold text-[#FFD21C]">
              {metReqCount}/{requirements.length}
            </div>
          </div>

          <div className="text-2xl font-black theme-text-main">
            {metReqCount} Met
          </div>

          <div className="text-xs font-mono flex items-center gap-1.5">
            {!evaluated ? (
              <span className="theme-text-muted font-bold">Not evaluated yet</span>
            ) : attentionReqCount === 0 ? (
              <span className="text-emerald-500 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> All satisfied
              </span>
            ) : (
              <span className="text-[#FFD21C] font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-[#FFD21C]" /> {attentionReqCount} needs attention
              </span>
            )}
          </div>
        </div>

        {/* Metric 3: Target Institution */}
        <div
          onClick={onNavigateToProfile}
          className="theme-bg-card border theme-border hover:border-[#E30613] p-6 rounded-3xl space-y-3 cursor-pointer transition-all duration-200 group shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider theme-text-muted">
              Target
            </span>
            <span className="text-[10px] font-mono text-[#FFD21C] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
              {details.goal === 'work' ? 'WORK' : 'STUDY'}
            </span>
          </div>

          <div className="text-2xl font-black theme-text-main truncate">
            {details.targetInstitution || '—'}
          </div>

          <div className="text-xs font-mono theme-text-muted">
            {details.intendedField || (details.goal === 'work' ? 'Employment' : 'Study')}
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-[#E30613] bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* Primary Directive: the backend agent's single next action */}
      <AgentActionPanel onOpenQualification={onNavigateToQualification} />

      {/* Four Deep-Dive Quick Action Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={onNavigateToProfile}
          className="p-5 rounded-2xl theme-bg-card border theme-border hover:border-[#E30613] text-left space-y-2 cursor-pointer transition-all group shadow-sm"
        >
          <div className="text-xs font-mono font-bold text-[#E30613] uppercase">
            Step 1 · Dossier
          </div>
          <div className="text-base font-black theme-text-main group-hover:text-[#E30613] transition-colors flex items-center justify-between">
            <span>Applicant Profile</span>
            <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-xs theme-text-muted">
            Extracted GPA, credits, university H+ status, and work history.
          </p>
        </button>

        <button
          onClick={onNavigateToDocuments}
          className="p-5 rounded-2xl theme-bg-card border theme-border hover:border-[#E30613] text-left space-y-2 cursor-pointer transition-all group shadow-sm"
        >
          <div className="text-xs font-mono font-bold text-[#E30613] uppercase">
            Step 2 · Repository
          </div>
          <div className="text-base font-black theme-text-main group-hover:text-[#E30613] transition-colors flex items-center justify-between">
            <span>Uploaded Files</span>
            <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-xs theme-text-muted">
            Transcripts, degree certificates, passport copies, and CVs.
          </p>
        </button>

        <button
          onClick={onNavigateToQualification}
          className="p-5 rounded-2xl theme-bg-card border theme-border hover:border-[#FFD21C] text-left space-y-2 cursor-pointer transition-all group shadow-sm"
        >
          <div className="text-xs font-mono font-bold text-[#FFD21C] uppercase">
            Step 3 · Audit
          </div>
          <div className="text-base font-black theme-text-main group-hover:text-[#FFD21C] transition-colors flex items-center justify-between">
            <span>Qualification Check</span>
            <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-xs theme-text-muted">
            Direct comparison against German university admission criteria.
          </p>
        </button>

        <button
          onClick={onNavigateToNextAction}
          className="p-5 rounded-2xl theme-bg-card border theme-border hover:border-[#E30613] text-left space-y-2 cursor-pointer transition-all group shadow-sm"
        >
          <div className="text-xs font-mono font-bold text-[#E30613] uppercase">
            Step 4 · Plan
          </div>
          <div className="text-base font-black theme-text-main group-hover:text-[#E30613] transition-colors flex items-center justify-between">
            <span>Next Action Plan</span>
            <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-xs theme-text-muted">
            Prioritized timeline for submission, deadlines, and embassy visas.
          </p>
        </button>
      </div>

      {/* Floating Assistant Trigger Callout */}
      <div className="theme-bg-surface border theme-border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#E30613] text-white flex items-center justify-center font-bold shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold theme-text-main flex items-center gap-2">
              <span>Need help understanding German requirements?</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <p className="text-xs theme-text-muted">
              Ask questions about Bavarian formula GPA conversions, Uni-Assist deadlines, or blocked accounts.
            </p>
          </div>
        </div>

        <button
          onClick={onOpenChatbot}
          className="px-4 py-2 rounded-xl theme-bg-card hover:theme-bg-subtle border theme-border theme-text-main text-xs font-mono font-bold transition-colors cursor-pointer self-start sm:self-auto shrink-0 shadow-xs"
        >
          Open AI Assistant
        </button>
      </div>

    </div>
  );
};
