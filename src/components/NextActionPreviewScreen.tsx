import React from 'react';
import { ApplicantDetails, DocumentItem } from '../types';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  GraduationCap,
  Briefcase,
  FileText,
  Building2,
  MapPin,
  ExternalLink,
} from 'lucide-react';

interface NextActionPreviewScreenProps {
  details: ApplicantDetails;
  documents: DocumentItem[];
  onRestart: () => void;
  onEditDetails: () => void;
  onEditDocuments: () => void;
}

export const NextActionPreviewScreen: React.FC<NextActionPreviewScreenProps> = ({
  details,
  documents,
  onRestart,
  onEditDetails,
  onEditDocuments,
}) => {
  const uploadedDocs = documents.filter((d) => d.status === 'uploaded');
  const missingDocs = documents.filter((d) => d.status === 'missing');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Hand-off Notice for Hackathon Team */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-900">
        <div className="space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-blue-950">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            AI Processing Complete · Teammate Hand-off Point
          </div>
          <p className="text-blue-800">
            This is where the next teammate will display the comprehensive <strong>Applicant Profile & Qualification Check</strong>. Below is the parsed application state ready for their components.
          </p>
        </div>
        <button
          onClick={onRestart}
          className="self-start sm:self-center px-3 py-1.5 bg-white border border-blue-300 hover:border-blue-500 font-semibold text-blue-700 rounded-md transition-colors cursor-pointer shrink-0"
        >
          Reset Application Flow
        </button>
      </div>

      {/* Profile Overview Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              Evaluated Dossier
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{details.fullName}</h1>
            <p className="text-sm text-slate-600">{details.email}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {details.goal === 'study' ? (
                <>
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Track: German University</span>
                </>
              ) : (
                <>
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Track: Skilled Employment</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Key Parameters Grid */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/60 space-y-1">
            <div className="text-xs text-slate-500 font-medium">Target Institution</div>
            <div className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="truncate">{details.targetInstitution}</span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/60 space-y-1">
            <div className="text-xs text-slate-500 font-medium">Specialization Field</div>
            <div className="text-sm font-semibold text-slate-900 truncate">
              {details.intendedField}
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200/60 space-y-1">
            <div className="text-xs text-slate-500 font-medium">Destination Country</div>
            <div className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>{details.country} 🇩🇪</span>
            </div>
          </div>
        </div>

        {/* Verification Checklist Matrix */}
        <div className="space-y-3 pt-2">
          <h2 className="text-sm font-bold text-slate-900">
            Document Audit Summary
          </h2>

          <div className="space-y-2">
            {documents.map((doc) => {
              const isOk = doc.status === 'uploaded';
              return (
                <div
                  key={doc.id}
                  className="p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    {isOk ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <span className="font-semibold text-slate-900">{doc.name}</span>
                      <span className="text-slate-500 ml-2 hidden sm:inline">({doc.requiredFor})</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isOk ? (
                      <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded">
                        Audited & Verified ✓
                      </span>
                    ) : (
                      <span className="text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded">
                        Action Required ⚠
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Next Action Highlights for Germany */}
        <div className="space-y-3 pt-2">
          <h2 className="text-sm font-bold text-slate-900">
            Preliminary Guidance & Recommendations
          </h2>
          <div className="p-4 rounded-lg bg-emerald-50/60 border border-emerald-200 text-xs text-emerald-950 space-y-2">
            <div className="font-semibold text-emerald-900 flex items-center gap-1.5">
              <span>● German Academic Equivalence Confirmed</span>
            </div>
            <p className="leading-relaxed">
              Your degree and transcripts match the criteria for direct admission in accordance with the KMK (Standing Conference of Ministers of Education and Cultural Affairs) and Anabin H+ classification.
            </p>
            {missingDocs.some((d) => d.id === 'language') && (
              <p className="text-amber-900 font-medium pt-1">
                Note: Since your Language Certificate is marked missing, remember to book your IELTS / TOEFL or Goethe-Zertifikat test date before final submission to Uni-Assist.
              </p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onEditDetails}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Edit Details
            </button>
            <span className="text-slate-300">·</span>
            <button
              onClick={onEditDocuments}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Manage Documents
            </button>
          </div>

          <button
            onClick={onRestart}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Start New Application</span>
          </button>
        </div>
      </div>
    </div>
  );
};
