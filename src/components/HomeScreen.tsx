import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  ChevronDown,
  GraduationCap,
  Euro,
  Calendar,
  FileCheck,
  Languages,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Cpu,
  Check,
  Compass,
  FileText,
  UserCheck,
  Target,
} from 'lucide-react';
import { UniversityCarousel } from './UniversityCarousel';
import { GermanyHeroCarousel } from './GermanyHeroCarousel';
import { GermanyBackground } from './GermanyBackground';

interface HomeScreenProps {
  onStart: () => void;
  onSelectGoal?: (goal: 'study' | 'work') => void;
}

// 6 Germany Hub Visuals for Feature Showcase
const germanyHubs = [
  {
    city: 'Munich',
    state: 'Bavaria',
    highlight: 'TUM, LMU & High-Tech Industry',
    img: 'https://images.unsplash.com/photo-1595867818082-083862f3d630?q=80&w=1200&auto=format&fit=crop',
  },
  {
    city: 'Berlin',
    state: 'Capital Region',
    highlight: 'Humboldt, FU Berlin & Global Startups',
    img: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?q=80&w=1200&auto=format&fit=crop',
  },
  {
    city: 'Heidelberg',
    state: 'Baden-Württemberg',
    highlight: 'Historic University & Life Sciences',
    img: 'https://images.unsplash.com/photo-1527866959252-deab85ef7d1b?q=80&w=1200&auto=format&fit=crop',
  },
  {
    city: 'Aachen & Cologne',
    state: 'North Rhine-Westphalia',
    highlight: 'RWTH Engineering & Industrial Hub',
    img: 'https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=1200&auto=format&fit=crop',
  },
  {
    city: 'Frankfurt & Rhine-Main',
    state: 'Hesse',
    highlight: 'Goethe University & European Finance',
    img: 'frankfurt.jpg',
  },
  {
    city: 'Hamburg',
    state: 'Northern Germany',
    highlight: 'University of Hamburg & Maritime Tech',
    img: '/hamburg.jpg',
  },
];

export const HomeScreen: React.FC<HomeScreenProps> = ({ onStart }) => {
  const [activeHubIndex, setActiveHubIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveHubIndex((prev) => (prev + 1) % germanyHubs.length);
    }, 5500);
    return () => clearInterval(timer);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-24 sm:space-y-36">
      {/* ========================================================
          1. FULL-SCREEN HERO SECTION (EDITORIAL GERMAN TECH)
          ======================================================== */}
      <section className="relative min-h-[92vh] flex flex-col justify-between overflow-hidden border-b theme-border">
        {/* Background image & theme overlay layer (strictly absolute, never in document flow) */}
        <GermanyBackground intervalMs={6000} />

        {/* Hero content layer */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-8 pb-12 flex-1 flex flex-col justify-between">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center flex-1 my-auto">
            {/* LEFT 55–58%: HUGE CONDENSED EDITORIAL HEADLINE & CTAS */}
            <div className="lg:col-span-7 space-y-6 sm:space-y-8">
              {/* German Application Intelligence Badge */}
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#050505]/80 border border-white/20 text-xs font-mono font-bold tracking-wider uppercase backdrop-blur-md shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[#FFD21C] animate-pulse shadow-[0_0_8px_#FFD21C]" />
                <span className="text-white">GERMANY APPLICATION INTELLIGENCE</span>
                <span>🇩🇪</span>
              </div>

              {/* Large Hero Headline - Editorial German Tech */}
              <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-8xl xl:text-9xl font-black uppercase tracking-tight leading-[0.92] select-none drop-shadow-[0_4px_24px_rgba(0,0,0,0.85)]">
                <span className="text-[#FFFFFF]">YOUR JOURNEY</span>
                <br />
                <span className="text-[#FFFFFF]">TO </span>
                <span className="text-[#E30613] inline-block hover:scale-[1.02] transition-transform">GERMANY</span>
                <br />
                <span className="text-[#FFD21C]">STARTS HERE.</span>
              </h1>

              {/* Supporting Text */}
              <p className="text-base sm:text-xl md:text-2xl text-neutral-200 font-normal leading-relaxed max-w-2xl drop-shadow-sm">
                From your documents to your next step — SIEG.AI helps you understand, verify, and navigate your Germany application.
              </p>

              {/* Primary & Secondary CTAs */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <button
                  onClick={onStart}
                  className="px-8 sm:px-10 py-4 sm:py-5 bg-[#E30613] hover:bg-[#ff1e2d] active:bg-[#c0000e] text-white font-black text-base sm:text-lg rounded-2xl shadow-[0_8px_30px_rgba(227,6,19,0.5)] transition-all duration-200 flex items-center justify-center gap-3 cursor-pointer transform hover:-translate-y-0.5 border border-red-400/40"
                >
                  <span>START YOUR GERMANY JOURNEY</span>
                  <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                </button>

                <button
                  onClick={() => scrollToSection('germany-at-a-glance')}
                  className="px-6 py-4 sm:py-5 bg-[#050505]/80 text-white font-bold text-sm sm:text-base rounded-2xl backdrop-blur-md border border-white/20 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:border-[#FFD21C]"
                >
                  <span>EXPLORE THE JOURNEY</span>
                  <ChevronDown className="w-4 h-4 text-[#FFD21C] animate-bounce" />
                </button>
              </div>
            </div>

            {/* RIGHT 42–45%: VISIBLE CONTINUOUS HORIZONTAL GERMANY CAROUSEL */}
            <div className="lg:col-span-5 w-full mt-4 lg:mt-0 overflow-hidden">
              <GermanyHeroCarousel />
            </div>
          </div>

          {/* Micro Trust Bar with German Tri-Color Accent */}
          <div className="pt-8 mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/15 text-xs font-mono text-neutral-300">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full flag-stripe" />
              <span className="font-bold text-white tracking-wide">
                Built exclusively for Germany admissions & employment.
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 text-neutral-200">
                <ShieldCheck className="w-3.5 h-3.5 text-[#FFD21C]" />
                Anabin H+ Verification
              </span>
              <span aria-hidden="true" className="opacity-40">·</span>
              <span className="flex items-center gap-1.5 text-neutral-200">
                <FileCheck className="w-3.5 h-3.5 text-[#E30613]" />
                Uni-Assist Readiness
              </span>
              <span aria-hidden="true" className="opacity-40">·</span>
              <span className="flex items-center gap-1.5 text-neutral-200">
                <Cpu className="w-3.5 h-3.5 text-[#FFD21C]" />
                Bavarian Formula GPA
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          2. GERMANY AT A GLANCE
          ======================================================== */}
      <section
        id="germany-at-a-glance"
        className="relative py-24 sm:py-32 border-y theme-border px-4 sm:px-6 lg:px-8 overflow-hidden"
      >
        {/* Cinematic Germany Background Scenery (Historic University & Scenic Scenery) */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img
            src="https://images.unsplash.com/photo-1527866959252-deab85ef7d1b?q=80&w=1920&auto=format&fit=crop"
            alt="Scenic Heidelberg Germany"
            className="w-full h-full object-cover object-center"
          />
          {/* Subtle dark overlay so scenery is clearly visible behind content */}
          <div className="absolute inset-0 bg-[#050505]/75" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/50 to-[#050505]/80" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto space-y-14">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#050505]/80 text-[#FFD21C] text-xs font-mono font-bold uppercase tracking-wider border border-[#FFD21C]/40 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E30613]" />
              <span>Essential Country Guidance</span>
            </div>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white uppercase drop-shadow-md">
              GERMANY AT A <span className="text-[#FFD21C]">GLANCE</span>
            </h2>
            <p className="text-base sm:text-lg text-neutral-300 font-normal leading-relaxed drop-shadow-sm">
              Everything international applicants must know about Germany's world-class university and career ecosystem.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1: Study */}
            <div className="bg-[#050505]/85 backdrop-blur-md rounded-2xl border border-white/15 p-8 shadow-xl hover:shadow-2xl hover:border-[#E30613] transition-all duration-300 space-y-4 group">
              <div className="w-12 h-12 rounded-xl bg-white/10 text-[#E30613] flex items-center justify-center font-bold border border-white/10 group-hover:bg-[#E30613] group-hover:text-white transition-colors">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-white">
                  🎓 Study
                </h3>
                <p className="text-xs font-mono font-bold text-[#E30613] uppercase tracking-wider">
                  German Universities & Programs
                </p>
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed">
                Over 400 state-accredited higher education institutions, TU9 technical universities, and universities of applied sciences offering renowned Bachelor's, Master's, and PhD degrees.
              </p>
            </div>

            {/* Card 2: Tuition */}
            <div className="bg-[#050505]/85 backdrop-blur-md rounded-2xl border border-white/15 p-8 shadow-xl hover:shadow-2xl hover:border-[#FFD21C] transition-all duration-300 space-y-4 group">
              <div className="w-12 h-12 rounded-xl bg-white/10 text-[#FFD21C] flex items-center justify-center font-bold border border-white/10 group-hover:bg-[#FFD21C] group-hover:text-black transition-colors">
                <Euro className="w-6 h-6 text-[#FFD21C] group-hover:text-black" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-white">
                  💶 Tuition
                </h3>
                <p className="text-xs font-mono font-bold text-[#FFD21C] uppercase tracking-wider">
                  €0 Public University Tuition
                </p>
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed">
                Most German public universities charge zero tuition fees for domestic and international students alike. Students pay only a nominal semester contribution (Semesterbeitrag ~€150–€350).
              </p>
            </div>

            {/* Card 3: Intakes */}
            <div className="bg-[#050505]/85 backdrop-blur-md rounded-2xl border border-white/15 p-8 shadow-xl hover:shadow-2xl hover:border-[#E30613] transition-all duration-300 space-y-4 group">
              <div className="w-12 h-12 rounded-xl bg-white/10 text-white flex items-center justify-center font-bold border border-white/10 group-hover:bg-[#E30613] group-hover:text-white transition-colors">
                <Calendar className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-white">
                  📅 Intakes
                </h3>
                <p className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wider">
                  Winter & Summer Intakes
                </p>
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed">
                Main intake begins in October (Winter Semester, application deadline typically July 15). Secondary intake begins in April (Summer Semester, deadline typically January 15).
              </p>
            </div>

            {/* Card 4: APS */}
            <div className="bg-[#050505]/85 backdrop-blur-md rounded-2xl border border-white/15 p-8 shadow-xl hover:shadow-2xl hover:border-[#E30613] transition-all duration-300 space-y-4 group">
              <div className="w-12 h-12 rounded-xl bg-white/10 text-[#E30613] flex items-center justify-center font-bold border border-white/10 group-hover:bg-[#E30613] group-hover:text-white transition-colors">
                <FileCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-white">
                  📄 APS Certificate
                </h3>
                <p className="text-xs font-mono font-bold text-[#E30613] uppercase tracking-wider">
                  Academic Evaluation Centre
                </p>
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed">
                Mandatory document verification procedure for applicants from India, China, and Vietnam to certify authenticity of school and university degrees before visa issuance.
              </p>
            </div>

            {/* Card 5: Language */}
            <div className="bg-[#050505]/85 backdrop-blur-md rounded-2xl border border-white/15 p-8 shadow-xl hover:shadow-2xl hover:border-[#FFD21C] transition-all duration-300 space-y-4 group">
              <div className="w-12 h-12 rounded-xl bg-white/10 text-[#FFD21C] flex items-center justify-center font-bold border border-white/10 group-hover:bg-[#FFD21C] group-hover:text-black transition-colors">
                <Languages className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-white">
                  🗣 Language Requirements
                </h3>
                <p className="text-xs font-mono font-bold text-[#FFD21C] uppercase tracking-wider">
                  English & German Tracks
                </p>
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed">
                Thousands of Master's degrees taught entirely in English (require IELTS 6.5+ or TOEFL 90+). German programs typically ask for TestDaF (TDN 4) or Goethe-Zertifikat C1.
              </p>
            </div>

            {/* Card 6: Career & Visas */}
            <div className="bg-[#050505]/85 backdrop-blur-md rounded-2xl border border-white/15 p-8 shadow-xl hover:shadow-2xl hover:border-[#E30613] transition-all duration-300 space-y-4 group">
              <div className="w-12 h-12 rounded-xl bg-white/10 text-white flex items-center justify-center font-bold border border-white/10 group-hover:bg-[#E30613] group-hover:text-white transition-colors">
                <Briefcase className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-white">
                  💼 Post-Study Career
                </h3>
                <p className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wider">
                  18-Month Job Seeking Visa & EU Blue Card
                </p>
              </div>
              <p className="text-sm text-neutral-300 leading-relaxed">
                International graduates receive an 18-month residence permit to find skilled employment. Fast-track permanent settlement permit available after just 21–27 months on EU Blue Card.
              </p>
            </div>
          </div>
        </div>
      </section>


      {/* ========================================================
          3. GERMAN UNIVERSITIES SLIDER / MARQUEE
          ======================================================== */}
      <section className="space-y-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <span className="text-xs font-mono font-bold text-[#E30613] uppercase tracking-wider">
              Accredited Higher Education Network
            </span>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight theme-text-main uppercase">
              TOP GERMAN UNIVERSITIES & TU9 INSTITUTIONS
            </h2>
          </div>
          <div className="text-xs font-mono theme-text-muted">
            Continuous TU9 & Excellence Initiative Network
          </div>
        </div>

        <UniversityCarousel />
      </section>

      {/* ========================================================
          4. THE JOURNEY (8 STEP CARDS)
          ======================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full theme-bg-card text-[#FFD21C] text-xs font-mono font-bold uppercase tracking-wider theme-border border">
            <Sparkles className="w-3.5 h-3.5 text-[#FFD21C]" />
            <span>End-to-End Pipeline</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight theme-text-main uppercase">
            YOUR ROADMAP TO GERMANY
          </h2>
          <p className="text-base sm:text-lg theme-text-muted font-normal leading-relaxed">
            The precise step-by-step pathway from initial document preparation to university enrollment and visa stamping.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              step: '01',
              title: 'Explore & Profile',
              desc: 'Select your field, target universities, and study or career objectives.',
              status: 'Start Here',
              color: 'text-[#E30613]',
              icon: Compass,
            },
            {
              step: '02',
              title: 'Consent & Security',
              desc: 'Authorize GDPR-compliant document scanning and KMK Anabin verification.',
              status: 'Required',
              color: 'text-[#E30613]',
              icon: ShieldCheck,
            },
            {
              step: '03',
              title: 'Upload Documents',
              desc: 'Provide your transcripts, degree certificate, CV, and passport.',
              status: 'Interactive',
              color: 'text-[#FFD21C]',
              icon: FileText,
            },
            {
              step: '04',
              title: 'AI Processing',
              desc: 'Automated Bavarian GPA calculation, credit analysis, and document parsing.',
              status: 'Automated',
              color: 'text-[#E30613]',
              icon: Cpu,
            },
            {
              step: '05',
              title: 'Applicant Profile',
              desc: 'Structured dossier of personal data, education, and credentials.',
              status: 'Verified',
              color: 'text-[#E30613]',
              icon: UserCheck,
            },
            {
              step: '06',
              title: 'Qualification Check',
              desc: 'Audited against Uni-Assist and German university admission bars.',
              status: 'Audit',
              color: 'text-[#E30613]',
              icon: CheckCircle2,
            },
            {
              step: '07',
              title: 'Next Action Plan',
              desc: 'Clear, prioritized guidance on language exams, APS, or missing items.',
              status: 'Directive',
              color: 'text-[#FFD21C]',
              icon: AlertTriangle,
            },
            {
              step: '08',
              title: 'Submit Application',
              desc: 'Finalized dossier ready for Uni-Assist, university portals, or visa booking.',
              status: 'Success',
              color: 'text-emerald-500',
              icon: Target,
            },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="relative rounded-2xl theme-bg-card theme-border border p-6 space-y-4 hover:border-[#E30613] transition-all duration-300 shadow-md group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold theme-text-muted">
                      {item.step}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        item.step === '03' || item.step === '07'
                          ? 'bg-amber-500/10 text-[#FFD21C] border border-amber-500/30'
                          : 'theme-bg-subtle theme-text-muted theme-border border'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <div className={`w-9 h-9 rounded-xl theme-bg-surface flex items-center justify-center ${item.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  <h3 className="text-sm font-black theme-text-main tracking-tight">
                    {item.title}
                  </h3>

                  <p className="text-xs theme-text-muted leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================
          5. WHY SIEG.AI?
          ======================================================== */}
      <section className="py-24 sm:py-32 theme-bg-surface theme-text-main border-y theme-border px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full theme-bg-card text-[#E30613] text-xs font-mono font-bold uppercase tracking-wider theme-border border">
              <span>Platform Advantages</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight theme-text-main uppercase">
              WHY SIEG.AI?
            </h2>
            <p className="text-base sm:text-lg theme-text-muted font-normal leading-relaxed">
              Engineered exclusively for the legal and academic requirements of higher education in Germany.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'One unified applicant profile', desc: 'Consolidate your academic records, degrees, and career objectives in a single structured dossier.' },
              { title: 'Centralized documents', desc: 'Securely store and manage transcripts, CVs, and references aligned with German format standards.' },
              { title: 'AI-powered document understanding', desc: 'Automated extraction of semester grades, credit weightings, and university institutional seals.' },
              { title: 'Detect missing information', desc: 'Pinpoint missing transcripts, language certificates, or module descriptions before you apply.' },
              { title: 'Identify conflicts across documents', desc: 'Spot discrepancies in birth dates, naming spelling, or dates across your passport and marksheets.' },
              { title: 'Germany-specific requirement checking', desc: 'Rigorous auditing against Anabin H+ database, Bavarian GPA conversions, and Uni-Assist guidelines.' },
              { title: 'Personalized next actions', desc: 'Clear, prioritized task recommendations so you always know your exact next move.' },
            ].map((card, idx) => (
              <div
                key={idx}
                className="theme-bg-card rounded-2xl theme-border border p-6 shadow-sm hover:shadow-xl hover:border-[#E30613] transition-all space-y-3"
              >
                <div className="flex items-center gap-2.5 text-[#E30613] font-bold text-sm">
                  <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 stroke-[3] text-[#E30613]" />
                  </div>
                  <span className="theme-text-main font-black text-base">{card.title}</span>
                </div>
                <p className="text-xs sm:text-sm theme-text-muted leading-relaxed pl-8">
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================
          6. GERMAN-RED FEATURE SECTION (SIGNATURE #E30613 ACCENT)
          ======================================================== */}
      <section className="py-24 sm:py-32 bg-[#E30613] text-white px-4 sm:px-6 lg:px-8 relative overflow-hidden shadow-2xl">
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

        <div className="max-w-7xl mx-auto space-y-12 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#050505]/50 text-[#FFD21C] text-xs font-mono font-bold uppercase tracking-wider border border-white/20 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-[#FFD21C]" />
              <span>Dedicated Germany Focus</span>
            </div>

            <h2 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white uppercase leading-[0.95]">
              ONE DESTINATION.<br />
              ONE CLEAR PATH.<br />
              <span className="text-[#FFD21C]">GERMANY 🇩🇪</span>
            </h2>

            <p className="text-base sm:text-xl text-white/95 font-normal leading-relaxed max-w-2xl mx-auto">
              We don't divide attention across dozens of countries. Our intelligence platform is dedicated 100% to navigating admissions and visa pathways in Germany.
            </p>
          </div>

          {/* Large HD Rotating Visual Showcase - Cinematic Video Treatment */}
          <div className="relative rounded-3xl overflow-hidden shadow-2xl h-[420px] sm:h-[500px] border-2 border-white/20">
            {germanyHubs.map((hub, idx) => {
              const isActive = idx === activeHubIndex;
              return (
                <div
                  key={hub.city}
                  className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                    isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
                  }`}
                >
                  <img
                    src={hub.img}
                    alt={`${hub.city}, Germany`}
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050505]/90 via-[#050505]/35 to-transparent" />

                  <div className="absolute bottom-8 left-8 right-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-white">
                    <div className="space-y-1.5">
                      <span className="px-3 py-1 rounded-full bg-[#E30613] text-white font-mono font-bold text-xs uppercase tracking-wider shadow-md">
                        {hub.state} · Germany 🇩🇪
                      </span>
                      <h3 className="text-3xl sm:text-5xl font-black text-white">{hub.city}</h3>
                      <p className="text-sm sm:text-base text-[#FFD21C] font-mono font-bold">
                        {hub.highlight}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      {germanyHubs.map((h, dotIdx) => (
                        <button
                          key={h.city}
                          onClick={() => setActiveHubIndex(dotIdx)}
                          className={`h-2.5 rounded-full transition-all cursor-pointer ${
                            dotIdx === activeHubIndex
                              ? 'w-8 bg-[#FFD21C]'
                              : 'w-2.5 bg-white/40 hover:bg-white/70'
                          }`}
                          aria-label={`Show ${h.city}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================
          7. APPLICANT DASHBOARD PREVIEW
          ======================================================== */}
      <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full theme-bg-card text-[#FFD21C] theme-border border text-xs font-mono font-bold uppercase tracking-wider">
            <span>Direct Admissions Clarity</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight theme-text-main uppercase">
            YOUR APPLICATION STATUS AT A GLANCE
          </h2>
          <p className="text-base sm:text-lg theme-text-muted font-normal leading-relaxed">
            SIEG.AI transforms ambiguous foreign university admission criteria into a prioritized, actionable roadmap.
          </p>
        </div>

        {/* Interactive Application Audit Preview Card */}
        <div className="theme-bg-card rounded-3xl theme-border border p-6 sm:p-10 shadow-2xl space-y-8">
          <div className="grid lg:grid-cols-3 gap-8 items-center">
            {/* Left Col: Overall Status */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b theme-border">
                <div>
                  <h3 className="text-xl font-black tracking-tight theme-text-main">
                    APPLICATION PROGRESS
                  </h3>
                  <p className="text-xs font-mono theme-text-muted">
                    Target: Technical University of Munich (TUM) · Germany 🇩🇪
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-[#FFD21C] bg-[#FFD21C]/10 border border-[#FFD21C]/30 px-3 py-1 rounded-full">
                  82% Readiness
                </span>
              </div>

              {/* Progress Line Items */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm p-3.5 rounded-xl theme-bg-surface theme-border border">
                  <span className="font-semibold theme-text-main">Profile</span>
                  <span className="text-[#FFD21C] font-bold flex items-center gap-1.5 font-mono">
                    <CheckCircle2 className="w-4 h-4 text-[#FFD21C]" />
                    <span>✓ Complete</span>
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm p-3.5 rounded-xl theme-bg-surface theme-border border">
                  <span className="font-semibold theme-text-main">Documents</span>
                  <span className="theme-text-main font-mono font-bold">
                    4 of 5 Uploaded
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm p-3.5 rounded-xl theme-bg-surface theme-border border">
                  <span className="font-semibold theme-text-main">AI Analysis</span>
                  <span className="text-[#FFD21C] font-bold flex items-center gap-1.5 font-mono">
                    <span className="w-2 h-2 rounded-full bg-[#FFD21C] animate-ping" />
                    <span>In Progress</span>
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm p-3.5 rounded-xl theme-bg-surface theme-border border">
                  <span className="font-semibold theme-text-main">Requirements</span>
                  <span className="theme-text-main font-mono font-bold">
                    3 Met / 1 Attention
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm p-3.5 rounded-xl bg-red-500/10 border border-[#E30613]/40">
                  <span className="font-semibold text-[#E30613]">Next Action</span>
                  <span className="text-[#E30613] font-bold flex items-center gap-1.5 font-mono">
                    <AlertTriangle className="w-4 h-4 text-[#E30613]" />
                    <span>Upload Language Certificate</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right Col: Prominent "YOUR NEXT STEP" Card */}
            <div className="theme-bg-surface border-2 border-[#E30613] rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 ring-4 ring-red-500/10">
              <div className="space-y-2">
                <span className="text-[11px] font-mono font-extrabold uppercase tracking-wider text-white bg-[#E30613] px-2.5 py-1 rounded-md">
                  Priority Directive
                </span>
                <h3 className="text-2xl font-black theme-text-main uppercase tracking-tight">
                  YOUR NEXT STEP
                </h3>
              </div>

              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-[#E30613] space-y-2">
                <div className="font-bold theme-text-main flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-[#E30613] shrink-0" />
                  <span>Upload Language Certificate</span>
                </div>
                <p className="leading-relaxed theme-text-muted">
                  German university admissions require verified proof of English (IELTS/TOEFL) or German (TestDaF/Goethe) to clear preliminary review.
                </p>
              </div>

              <button
                onClick={onStart}
                className="w-full py-4 px-5 bg-[#E30613] hover:bg-[#ff1e2d] text-white font-black rounded-xl text-sm transition-all shadow-[0_4px_16px_rgba(227,6,19,0.4)] cursor-pointer text-center flex items-center justify-center gap-2"
              >
                <span>Go to Applicant Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          8. CALL TO ACTION (GERMANY JOURNEY)
          ======================================================== */}
      <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center space-y-8">
        <div className="space-y-4">
          <h2 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight theme-text-main uppercase">
            READY TO START<br />
            YOUR <span className="text-[#E30613]">GERMANY</span> JOURNEY?
          </h2>
          <p className="text-base sm:text-xl theme-text-muted max-w-2xl mx-auto leading-relaxed">
            Let SIEG.AI help you understand, audit, and organize your application before you take the next step.
          </p>
        </div>

        <div className="pt-2">
          <button
            onClick={onStart}
            className="px-10 py-5 bg-[#E30613] hover:bg-[#ff1e2d] active:bg-[#c0000e] text-white font-black text-lg rounded-2xl shadow-[0_8px_30px_rgba(227,6,19,0.4)] transition-all duration-200 inline-flex items-center gap-3 cursor-pointer transform hover:-translate-y-0.5 border border-red-500/40"
          >
            <span>START APPLICATION</span>
            <ArrowRight className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </section>

      {/* ========================================================
          9. FOOTER
          ======================================================== */}
      <footer className="theme-bg-surface theme-text-muted py-16 px-4 sm:px-6 lg:px-8 border-t theme-border">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 pb-12 border-b theme-border">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded bg-[#E30613] text-white font-mono font-bold text-xs tracking-wider">
                  SIEG.AI
                </span>
                <span className="text-xl font-black theme-text-main tracking-tight">
                  Germany Application Intelligence 🇩🇪
                </span>
              </div>
              <p className="text-xs theme-text-muted max-w-md">
                Empowering international applicants to study and work in Germany with automated Anabin recognition and admissions clarity.
              </p>
            </div>

            {/* Links */}
            <div className="flex flex-wrap items-center gap-6 text-sm font-semibold theme-text-main">
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="hover:text-[#E30613] transition-colors cursor-pointer"
              >
                Overview
              </button>
              <button
                onClick={onStart}
                className="hover:text-[#E30613] transition-colors cursor-pointer"
              >
                My Journey
              </button>
              <button
                onClick={onStart}
                className="hover:text-[#E30613] transition-colors cursor-pointer"
              >
                Documents
              </button>
              <button
                onClick={onStart}
                className="hover:text-[#E30613] transition-colors cursor-pointer"
              >
                Profile
              </button>
              <span className="opacity-40">|</span>
              <span className="text-xs theme-text-muted">Privacy (EU GDPR / DSGVO)</span>
              <span className="text-xs theme-text-muted">Terms</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono theme-text-muted">
            <div>
              © 2026 SIEG.AI · Dedicated exclusively to Germany higher education & employment pathways.
            </div>
            <div>
              Academic standards aligned with KMK Anabin & Uni-Assist.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
