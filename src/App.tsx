/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { ApplicationStep, ApplicantDetails } from './types';
import { initialApplicantDetails } from './data/mockData';
import { DOCUMENT_SLOTS } from './data/documentSlots';
import { ThemeProvider } from './theme/ThemeContext';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { JourneyProvider, useJourney } from './journey/JourneyContext';
import { toDashboardStats, toDocumentItems, toProfileSections, toRequirements } from './services/journeyMapper';
import { Navbar } from './components/Navbar';
import { JourneyProgress } from './components/JourneyProgress';
import { AIChatbot } from './components/AIChatbot';
import { HomeScreen } from './components/HomeScreen';
import { ApplicantDetailsScreen } from './components/ApplicantDetailsScreen';
import { ConsentScreen } from './components/ConsentScreen';
import { DocumentUploadScreen } from './components/DocumentUploadScreen';
import { ProcessingScreen } from './components/ProcessingScreen';
import { DashboardScreen } from './components/DashboardScreen';
import { ApplicantProfileScreen } from './components/ApplicantProfileScreen';
import { QualificationCheckScreen } from './components/QualificationCheckScreen';
import { NextActionScreen } from './components/NextActionScreen';
import { LoginScreen } from './components/LoginScreen';

/** Screens that show the applicant's backend journey need an application to exist first. */
const NEEDS_APPLICATION: ApplicationStep[] = ['dashboard', 'profile', 'qualification', 'next-action'];

function EmptyApplication({ onStart, loading }: { onStart: () => void; loading: boolean }) {
  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-5 theme-text-main">
      <h1 className="text-3xl font-black tracking-tight uppercase">
        {loading ? 'Loading your application…' : 'No application yet'}
      </h1>
      {!loading && (
        <>
          <p className="text-sm theme-text-muted">
            Tell us where you are headed and upload your documents. We will check them, show what is missing and tell you the next step.
          </p>
          <button
            onClick={onStart}
            className="px-8 py-3.5 bg-[#E30613] hover:bg-[#E00018] text-white font-black text-sm rounded-xl transition-all shadow-md cursor-pointer"
          >
            Start your application
          </button>
        </>
      )}
    </div>
  );
}

function AppContent() {
  // Navigation State: default to 'home' (Full-screen hero experience)
  const [currentStep, setCurrentStep] = useState<ApplicationStep>('home');

  // Chatbot Open State (can be triggered externally by "Ask AI Assistant" button)
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  // Authentication Context (local sign-in only; the backend has no accounts)
  const {
    user,
    isAuthenticated,
    userData,
    authModalOpen,
    authModalMode,
    openAuthModal,
    closeAuthModal,
    saveCurrentUserData,
  } = useAuth();

  // Backend journey: the source of truth for documents, profile, requirements, gaps and the agent
  const { applicantId, journey, agent, isLoading, saveApplicant, uploadDocument } = useJourney();

  // Only the form fields the backend does not store live here
  const [applicantDetails, setApplicantDetails] = useState<ApplicantDetails>(initialApplicantDetails);

  useEffect(() => {
    if (userData) setApplicantDetails(userData.details);
  }, [userData]);

  // once the applicant exists on the backend, its name/email are the truth
  useEffect(() => {
    if (journey) {
      setApplicantDetails((d) => ({ ...d, fullName: journey.applicant.name, email: journey.applicant.email ?? d.email }));
    }
  }, [journey?.applicant.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const documents = useMemo(() => toDocumentItems(journey), [journey]);
  const profileSections = useMemo(() => toProfileSections(journey), [journey]);
  const requirements = useMemo(() => toRequirements(journey), [journey]);
  const dashboardStats = useMemo(() => toDashboardStats(journey, agent?.message ?? ''), [journey, agent]);

  const persistDetails = (details: ApplicantDetails) => {
    if (user && userData) saveCurrentUserData({ ...userData, details });
  };

  const handleStartApplication = () => {
    if (!isAuthenticated) {
      openAuthModal('login');
    } else {
      setCurrentStep('details');
    }
  };

  const handleNavigate = (step: ApplicationStep) => {
    // If user clicks a protected view while not authenticated, prompt sign-in
    if (step !== 'home' && !isAuthenticated) {
      openAuthModal('login');
      return;
    }
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const needsApplication = NEEDS_APPLICATION.includes(currentStep) && !applicantId;

  return (
    <div className="relative min-h-screen flex flex-col theme-bg-main theme-text-main transition-colors duration-200">
      {/* Top Navbar */}
      <Navbar
        currentStep={currentStep}
        onNavigate={handleNavigate}
        onOpenAuth={(mode) => openAuthModal(mode)}
      />

      {/* Multi-step Journey Progress Header (visible when not on Home) */}
      {currentStep !== 'home' && (
        <div className="border-b theme-border theme-bg-card/90 backdrop-blur-md px-4 py-4 z-20">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <JourneyProgress
              currentStep={currentStep}
              onNavigate={handleNavigate}
            />

            <div className="hidden md:flex items-center gap-2 theme-text-muted text-xs font-mono">
              <span>Applicant:</span>
              <span className="font-bold theme-text-main">
                {applicantDetails.fullName}
              </span>
              <span className="opacity-40">·</span>
              <span className="text-[#FFD21C] font-semibold">
                {applicantDetails.goal === 'work' ? 'Employment in Germany 🇩🇪' : "Master's in Germany 🇩🇪"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 relative z-10 pb-16">
        {/* Step 1: Home (Full-screen hero & Germany intelligence) */}
        {currentStep === 'home' && (
          <HomeScreen
            onStart={handleStartApplication}
            onSelectGoal={(goal) => {
              const updated = { ...applicantDetails, goal };
              setApplicantDetails(updated);
              persistDetails(updated);
            }}
          />
        )}

        {/* Step 2: Applicant Details (saved to the backend on continue) */}
        {currentStep === 'details' && (
          <ApplicantDetailsScreen
            details={applicantDetails}
            onUpdate={(details) => {
              setApplicantDetails(details);
              persistDetails(details);
            }}
            onContinue={async () => {
              await saveApplicant(applicantDetails);
              setCurrentStep('consent');
            }}
            onBack={() => setCurrentStep('home')}
          />
        )}

        {/* Step 3: Consent Screen */}
        {currentStep === 'consent' && (
          <ConsentScreen
            onContinue={() => setCurrentStep('documents')}
            onBack={() => setCurrentStep('details')}
          />
        )}

        {/* Step 4: Upload Documents (real uploads) */}
        {currentStep === 'documents' &&
          (applicantId ? (
            <DocumentUploadScreen
              documents={documents}
              onUpload={async (slotId, file) => {
                const slot = DOCUMENT_SLOTS.find((s) => s.id === slotId);
                await uploadDocument(file, slot?.docType ?? 'UNKNOWN');
              }}
              onContinue={() => setCurrentStep('processing')}
              onBack={() => setCurrentStep('consent')}
            />
          ) : (
            <EmptyApplication onStart={() => setCurrentStep('details')} loading={isLoading} />
          ))}

        {/* Step 5: AI Processing (runs the backend scan) */}
        {currentStep === 'processing' &&
          (applicantId ? (
            <ProcessingScreen
              applicantName={applicantDetails.fullName}
              onComplete={() => setCurrentStep('dashboard')}
              onBack={() => setCurrentStep('documents')}
            />
          ) : (
            <EmptyApplication onStart={() => setCurrentStep('details')} loading={isLoading} />
          ))}

        {needsApplication && <EmptyApplication onStart={() => setCurrentStep('details')} loading={isLoading} />}

        {/* Step 6: DASHBOARD SCREEN (Main Overview Page) */}
        {currentStep === 'dashboard' && applicantId && (
          <DashboardScreen
            details={applicantDetails}
            documents={documents}
            requirements={requirements}
            stats={dashboardStats}
            onNavigateToProfile={() => setCurrentStep('profile')}
            onNavigateToDocuments={() => setCurrentStep('documents')}
            onNavigateToQualification={() => setCurrentStep('qualification')}
            onNavigateToNextAction={() => setCurrentStep('next-action')}
            onOpenChatbot={() => setIsChatbotOpen(true)}
          />
        )}

        {/* Step 7: My Profile */}
        {currentStep === 'profile' && applicantId && (
          <ApplicantProfileScreen
            applicantName={applicantDetails.fullName}
            sections={profileSections}
            onContinueToQualification={() => setCurrentStep('qualification')}
            onBack={() => setCurrentStep('dashboard')}
          />
        )}

        {/* Step 8: Qualification Check */}
        {currentStep === 'qualification' && applicantId && (
          <QualificationCheckScreen
            applicantName={applicantDetails.fullName}
            disclaimer={journey?.evaluation?.disclaimer}
            requirements={requirements}
            onContinueToNextAction={() => setCurrentStep('next-action')}
            onBackToProfile={() => setCurrentStep('profile')}
          />
        )}

        {/* Step 9: Next Action (the backend agent) */}
        {currentStep === 'next-action' && applicantId && (
          <NextActionScreen onBackToQualification={() => setCurrentStep('qualification')} />
        )}
      </main>

      {/* Floating AI Chatbot in Bottom Right */}
      <AIChatbot
        externalIsOpen={isChatbotOpen}
        onOpenChange={setIsChatbotOpen}
      />

      {/* Authentication Modal */}
      {authModalOpen && (
        <LoginScreen
          initialMode={authModalMode}
          onClose={closeAuthModal}
          onAuthSuccess={() => {
            closeAuthModal();
            // Automatically guide user into their application workspace
            if (currentStep === 'home') {
              setCurrentStep('dashboard');
            }
          }}
        />
      )}

      {/* Clean Premium Footer for Application Screens */}
      {currentStep !== 'home' && (
        <footer className="relative z-10 border-t theme-border theme-bg-card py-6 text-center text-xs font-mono theme-text-muted transition-colors">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded bg-[#E30613] text-white font-mono font-bold text-[10px]">
                SIEG.AI
              </span>
              <span className="font-bold theme-text-main">
                AI Applicant Copilot
              </span>
              <span aria-hidden="true" className="opacity-40">·</span>
              <span className="text-[#FFD21C]">
                Germany Application Intelligence 🇩🇪
              </span>
            </div>
            <div className="theme-text-muted opacity-80">
              Requirements shown are DEMO criteria, not official admission rules
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <JourneyProvider>
          <AppContent />
        </JourneyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
