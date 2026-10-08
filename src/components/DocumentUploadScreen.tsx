import React, { useRef } from 'react';
import { DocumentItem } from '../types';
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  X,
  FileCheck,
  Sparkles,
  Loader2,
} from 'lucide-react';

interface DocumentUploadScreenProps {
  documents: DocumentItem[];
  /** Uploads one file to the backend for the given slot. Rejects with a readable message. */
  onUpload: (docId: string, file: File) => Promise<void>;
  onContinue: () => void;
  onBack: () => void;
}

const PROCESSING_LABEL: Record<NonNullable<DocumentItem['processingStatus']>, string> = {
  UPLOADED: 'Uploaded · waiting for scan',
  PROCESSING: 'Scanning…',
  DONE: 'Scanned',
  FAILED: 'Scan failed',
};

export const DocumentUploadScreen: React.FC<DocumentUploadScreenProps> = ({
  documents,
  onUpload,
  onContinue,
  onBack,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeDocId, setActiveDocId] = React.useState<string | null>(null);
  const [uploadingId, setUploadingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const docId = activeDocId;
    setActiveDocId(null);
    if (!file || !docId) return;
    setError(null);
    setUploadingId(docId);
    try {
      await onUpload(docId, file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingId(null);
    }
  };

  const triggerUploadClick = (docId: string) => {
    setActiveDocId(docId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const uploadedCount = documents.filter((d) => d.status === 'uploaded').length;
  const missingCount = documents.filter((d) => d.status === 'missing').length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8 theme-text-main">
      {/* Hidden file input: files go to the backend */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg"
      />

      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 theme-bg-card text-[#FFD21C] text-xs font-mono font-bold rounded-full border theme-border backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-[#FFD21C]" />
          <span>Step 02 · Required Credentials</span>
        </div>
        <h1 className="text-3xl font-black theme-text-main tracking-tight uppercase">
          Upload Documents
        </h1>
        <p className="text-sm theme-text-muted">
          Submit your official academic and professional files for German admissions & Anabin verification.
        </p>
      </div>

      {/* Upload Summary Bar */}
      <div className="theme-bg-card border theme-border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl theme-bg-surface text-[#FFD21C] flex items-center justify-center font-bold border theme-border">
            <FileCheck className="w-5 h-5 text-[#FFD21C]" />
          </div>
          <div>
            <span className="text-sm font-bold theme-text-main block">
              Document Portfolio Status
            </span>
            <span className="text-xs font-mono theme-text-muted">
              {uploadedCount} of {documents.length} credentials attached
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto font-mono text-xs">
          <span className="px-3 py-1.5 rounded-lg theme-bg-surface text-[#FFD21C] border theme-border font-bold">
            ✓ {uploadedCount} Uploaded
          </span>
          {missingCount > 0 && (
            <span className="px-3 py-1.5 rounded-lg bg-red-500/10 text-[#E30613] border border-red-500/30 font-bold">
              ⚠ {missingCount} Missing
            </span>
          )}
        </div>
      </div>

      {/* Warning Box if Language Cert is missing */}
      {documents.some((d) => d.id === 'language' && d.status === 'missing') && (
        <div className="bg-red-500/10 border border-[#E30613]/40 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 text-xs text-[#E30613]">
          <AlertTriangle className="w-5 h-5 text-[#E30613] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold theme-text-main block">
              German Admissions Directive: Language Proficiency Missing
            </span>
            <p className="theme-text-muted">
              You haven't attached your IELTS, TOEFL, or Goethe certificate yet. You can still scan and evaluate your transcripts now, but this certificate is required before final visa appointment.
            </p>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-[#E30613] bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {/* Document Items List */}
      <div className="space-y-3">
        {documents.map((doc) => {
          const isUploaded = doc.status === 'uploaded';

          return (
            <div
              key={doc.id}
              className={`p-5 rounded-2xl border transition-all theme-bg-card ${
                isUploaded
                  ? 'theme-border hover:border-neutral-500'
                  : 'border-[#E30613]/60 bg-red-500/5'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                      isUploaded
                        ? 'theme-bg-surface text-[#FFD21C] theme-border'
                        : 'bg-red-500/10 text-[#E30613] border-red-500/30'
                    }`}
                  >
                    <FileText className="w-5 h-5" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold theme-text-main">
                        {doc.name}
                      </h3>
                      {doc.requiredFor && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#E30613] text-white font-bold uppercase">
                          {doc.requiredFor}
                        </span>
                      )}
                    </div>
                    <p className="text-xs theme-text-muted">{doc.shortDescription}</p>

                    {isUploaded && doc.fileName && (
                      <div className="pt-1 flex items-center gap-3 text-[11px] font-mono theme-text-muted">
                        <span className="text-[#FFD21C] font-semibold">{doc.fileName}</span>
                        <span>·</span>
                        <span
                          className={`flex items-center gap-1 font-bold ${
                            doc.processingStatus === 'FAILED' ? 'text-[#E30613]' : doc.processingStatus === 'DONE' ? 'text-emerald-500' : 'theme-text-muted'
                          }`}
                        >
                          {doc.processingStatus === 'DONE' && <CheckCircle2 className="w-3 h-3" />}
                          {doc.processingStatus === 'FAILED' && <AlertTriangle className="w-3 h-3" />}
                          {doc.processingStatus ? PROCESSING_LABEL[doc.processingStatus] : 'Uploaded'}
                        </span>
                      </div>
                    )}
                    {doc.processingStatus === 'FAILED' && doc.error && (
                      <p className="pt-1 text-[11px] text-[#E30613] leading-snug">{doc.error}</p>
                    )}
                  </div>
                </div>

                {/* Upload or Toggle Buttons */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 font-mono text-xs">
                  <button
                    onClick={() => triggerUploadClick(doc.id)}
                    disabled={uploadingId !== null}
                    className={`px-4 py-2.5 rounded-xl font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                      isUploaded
                        ? 'theme-bg-surface hover:theme-bg-subtle border theme-border theme-text-muted hover:theme-text-main shadow-none'
                        : 'bg-[#E30613] hover:bg-[#E00018] text-white'
                    }`}
                  >
                    {uploadingId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>{uploadingId === doc.id ? 'Uploading…' : isUploaded ? 'Upload another' : 'Upload File'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Action Footer */}
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
          disabled={uploadedCount === 0 || uploadingId !== null}
          className="px-8 py-3.5 bg-[#E30613] hover:bg-[#E00018] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
        >
          <span>Launch AI Document Scan</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
