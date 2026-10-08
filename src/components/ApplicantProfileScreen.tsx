import React from 'react';
import { ProfileSection } from '../types';
import { ApplicantInfoCard } from './ApplicantInfoCard';
import {
  User,
  GraduationCap,
  Briefcase,
  Languages,
  FolderArchive,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';

interface ApplicantProfileScreenProps {
  applicantName: string;
  sections: ProfileSection[];
  onContinueToQualification: () => void;
  onBack?: () => void;
}

export const ApplicantProfileScreen: React.FC<ApplicantProfileScreenProps> = ({
  applicantName,
  sections,
  onContinueToQualification,
  onBack,
}) => {
  const getSectionIcon = (id: string) => {
    switch (id) {
      case 'personal':
        return User;
      case 'education':
        return GraduationCap;
      case 'experience':
        return Briefcase;
      case 'languages':
        return Languages;
      case 'documents':
        return FolderArchive;
      default:
        return User;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8 theme-text-main">
      {/* Header Banner */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 theme-bg-card text-[#FFD21C] text-xs font-mono font-bold rounded-full border theme-border backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-[#FFD21C]" />
          <span>Screen 1 of 3 · AI Document Extraction</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black theme-text-main tracking-tight uppercase">
              Applicant Profile
            </h1>
            <p className="text-sm theme-text-muted">
              Information extracted from {applicantName || 'your'} submitted documents and declarations, each with its source.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono theme-text-muted">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span>Every fact shows where it came from</span>
          </div>
        </div>
      </div>

      {/* Grid of Sections */}
      <div className="grid gap-6">
        {sections.map((section) => (
          <ApplicantInfoCard
            key={section.id}
            section={section}
            icon={getSectionIcon(section.id)}
          />
        ))}
      </div>

      {/* Footer Navigation */}
      <div className="pt-4 flex items-center justify-between gap-4 border-t theme-border">
        {onBack ? (
          <button
            onClick={onBack}
            className="px-5 py-3 rounded-xl theme-bg-surface hover:theme-bg-subtle border theme-border theme-text-main text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
        ) : (
          <div />
        )}

        <button
          onClick={onContinueToQualification}
          className="px-8 py-3.5 bg-[#E30613] hover:bg-[#E00018] text-white font-black text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
        >
          <span>Run German Qualification Check</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
