/**
 * AI Applicant Copilot - Mock Data
 *
 * NOTE FOR YOUR TEAMMATE (BACKEND / AI):
 * This file contains the initial mock data for the application.
 * Once the backend API or database is ready, you can replace
 * these values with real data fetched from your backend endpoints.
 */

import {
  ApplicantDetails,
  DocumentItem,
  ProfileSection,
  QualificationRequirement,
  DashboardStats,
} from '../types';

export const initialDashboardStats: DashboardStats = {
  progressPercentage: 60,
  profileStatus: 'Profile information added',
  documentsUploadedCount: 4,
  documentsTotalCount: 5,
  documentsMissingCount: 1,
  requirementsMetCount: 3,
  requirementsTotalCount: 4,
  requirementsAttentionCount: 1,
  nextActionText: 'Upload your language certificate',
};

export const initialApplicantDetails: ApplicantDetails = {
  fullName: 'Rahul Sharma',
  email: 'rahul.sharma@example.com',
  goal: 'study',
  intendedField: 'Computer Science (M.Sc.)',
  targetInstitution: 'Technical University of Munich (TUM)',
  country: 'Germany',
};

// Documents list for document upload screen and audit summary
export const initialDocuments: DocumentItem[] = [
  {
    id: 'cv',
    name: 'CV',
    shortDescription: 'Tabellarischer Lebenslauf (German standard CV)',
    requiredFor: 'Uni-Assist & Embassy Visa application',
    status: 'uploaded',
    fileName: 'Rahul_Sharma_CV_2025.pdf',
    fileSize: '1.4 MB',
    uploadedAt: 'Today, 10:15 AM',
  },
  {
    id: 'degree',
    name: 'Degree Certificate',
    shortDescription: 'Bachelor of Technology (B.Tech) in Computer Science',
    requiredFor: 'Anabin database equivalency check',
    status: 'uploaded',
    fileName: 'BTech_Degree_Certificate_Official.pdf',
    fileSize: '2.8 MB',
    uploadedAt: 'Today, 10:18 AM',
  },
  {
    id: 'marksheet',
    name: 'Marksheet',
    shortDescription: 'Official transcripts across 8 semesters with grading scale',
    requiredFor: 'Bavarian formula GPA conversion (ECTS check)',
    status: 'uploaded',
    fileName: 'Official_Transcripts_All_Semesters.pdf',
    fileSize: '4.2 MB',
    uploadedAt: 'Today, 10:20 AM',
  },
  {
    id: 'language',
    name: 'Language Certificate',
    shortDescription: 'IELTS / TOEFL or Goethe-Zertifikat German test score',
    requiredFor: 'Language proficiency requirement (CEFR B2/C1)',
    status: 'missing',
  },
  {
    id: 'experience',
    name: 'Experience Letter',
    shortDescription: '2 Years Software Engineering employment reference letter',
    requiredFor: 'Professional track & APS visa bonus points',
    status: 'uploaded',
    fileName: 'TechCorp_Experience_Letter_2Yrs.pdf',
    fileSize: '950 KB',
    uploadedAt: 'Today, 10:24 AM',
  },
];

// Screen 1: Applicant Profile (AI-extracted profile sections for Rahul Sharma)
export const applicantProfileSections: ProfileSection[] = [
  {
    id: 'personal',
    title: 'Personal Information',
    description: 'Applicant identity & destination objective',
    fields: [
      {
        label: 'Full Name',
        value: 'Rahul Sharma',
        provenance: 'document-supported',
        sourceDetail: 'Matched passport and degree certificate',
      },
      {
        label: 'Email Address',
        value: 'rahul.sharma@example.com',
        provenance: 'applicant-provided',
        sourceDetail: 'Provided during onboarding registration',
      },
      {
        label: 'Destination Goal',
        value: "Master's in Germany",
        provenance: 'applicant-provided',
        sourceDetail: 'Targeting Computer Science (M.Sc.) at TUM / RWTH Aachen',
      },
      {
        label: 'Target Destination',
        value: 'Germany 🇩🇪',
        provenance: 'applicant-provided',
        sourceDetail: 'German Higher Education (Winter Semester Intake)',
      },
    ],
  },
  {
    id: 'education',
    title: 'Education',
    description: 'Undergraduate academic records & credentials',
    fields: [
      {
        label: 'Degree Title',
        value: 'B.Tech Computer Science',
        provenance: 'document-supported',
        sourceDetail: 'Verified from BTech_Degree_Certificate_Official.pdf',
        subValue: '4-year engineering program (240 credits)',
      },
      {
        label: 'University Recognition',
        value: 'Anabin Status: H+ (Recognized Institution)',
        provenance: 'ai-generated',
        sourceDetail: 'AI verified institution in German KMK Anabin database',
      },
      {
        label: 'Cumulative GPA / Grade',
        value: '8.4 / 10.0 (CGPA)',
        provenance: 'document-supported',
        sourceDetail: 'Calculated across 8 semesters in consolidated transcript',
      },
      {
        label: 'German Grade Equivalent',
        value: '1.6 ("Sehr Gut" / Very Good)',
        provenance: 'ai-generated',
        sourceDetail: 'Calculated using official modified Bavarian formula',
      },
    ],
  },
  {
    id: 'experience',
    title: 'Experience',
    description: 'Professional engineering track record',
    fields: [
      {
        label: 'Total Experience',
        value: '2 Years',
        provenance: 'document-supported',
        sourceDetail: 'Verified from TechCorp_Experience_Letter_2Yrs.pdf',
        subValue: 'Software Engineer (Full-Time)',
      },
      {
        label: 'Job Title & Company',
        value: 'Software Engineer at TechCorp Solutions',
        provenance: 'document-supported',
        sourceDetail: 'Issued by HR department on official letterhead',
      },
      {
        label: 'CV Timeline Match',
        value: 'Dates align with submitted Lebenslauf',
        provenance: 'document-supported',
        sourceDetail: 'July 2023 - Present (no unexplained gaps)',
      },
    ],
  },
  {
    id: 'languages',
    title: 'Languages',
    description: 'Language proficiency declarations and official test certificates',
    fields: [
      {
        label: 'Declared Language Ability',
        value: 'English (Fluent / Medium of Instruction)',
        provenance: 'applicant-provided',
        sourceDetail: 'Indicated in applicant profile and CV',
      },
      {
        label: 'Official Language Certificate',
        value: 'Not Provided (No IELTS / TOEFL / Goethe)',
        provenance: 'missing',
        sourceDetail: 'No test report form or certificate attached',
        subValue: 'Required minimum: IELTS 6.5 or CEFR B2/C1',
      },
      {
        label: 'German Language Knowledge',
        value: 'A1 Basics (Self-reported)',
        provenance: 'applicant-provided',
        sourceDetail: 'No formal Goethe or telc certificate uploaded',
      },
    ],
  },
  {
    id: 'documents',
    title: 'Documents',
    description: 'Document audit and authenticity verification',
    fields: [
      {
        label: 'Curriculum Vitae (CV)',
        value: 'Rahul_Sharma_CV_2025.pdf (1.4 MB)',
        provenance: 'document-supported',
        sourceDetail: 'German tabular standard format',
      },
      {
        label: 'Degree Certificate',
        value: 'BTech_Degree_Certificate_Official.pdf (2.8 MB)',
        provenance: 'document-supported',
        sourceDetail: 'Official university seal present',
      },
      {
        label: 'Semester Marksheets',
        value: 'Official_Transcripts_All_Semesters.pdf (4.2 MB)',
        provenance: 'document-supported',
        sourceDetail: 'All 8 semesters present and legible',
      },
      {
        label: 'Language Certificate',
        value: 'Missing Certificate',
        provenance: 'missing',
        sourceDetail: 'Upload required before Uni-Assist / Visa submission',
      },
      {
        label: 'Experience Letter',
        value: 'TechCorp_Experience_Letter_2Yrs.pdf (950 KB)',
        provenance: 'document-supported',
        sourceDetail: 'Signed employment verification',
      },
    ],
  },
];

// Screen 2: Qualification Check requirements
export const initialRequirements: QualificationRequirement[] = [
  {
    id: 'degree',
    title: 'Degree requirement',
    status: 'met',
    statusLabel: 'Met',
    explanation: '4-year B.Tech degree recognized under German Anabin database (H+ rated institution).',
    evidence: 'BTech_Degree_Certificate_Official.pdf',
    provenance: 'document-supported',
  },
  {
    id: 'academic',
    title: 'Academic requirement',
    status: 'met',
    statusLabel: 'Met',
    explanation: 'CGPA 8.4/10 converts to 1.6 on the German grading scale, exceeding the 2.5 minimum cutoff.',
    evidence: 'Official_Transcripts_All_Semesters.pdf',
    provenance: 'document-supported',
  },
  {
    id: 'language',
    title: 'Language requirement',
    status: 'missing',
    statusLabel: 'Missing certificate',
    explanation: 'Your application is missing proof of language proficiency. German Master\'s programs require an official IELTS, TOEFL, or Goethe test score.',
    evidence: 'No valid language certificate attached',
    provenance: 'missing',
  },
  {
    id: 'experience',
    title: 'Experience requirement',
    status: 'met',
    statusLabel: 'Met',
    explanation: '2 years of professional software engineering experience meets and exceeds program requirements.',
    evidence: 'TechCorp_Experience_Letter_2Yrs.pdf',
    provenance: 'document-supported',
  },
];

export const suggestedFields = [
  'Computer Science & AI',
  'Data Science & Analytics',
  'Mechanical & Automotive Engineering',
  'Renewable Energy & Sustainability',
  'International Business Management',
  'Biomedical Engineering & Biotech',
];

export const suggestedUniversities = [
  'Technical University of Munich (TUM)',
  'RWTH Aachen University',
  'Karlsruhe Institute of Technology (KIT)',
  'Heidelberg University',
  'Technical University of Berlin (TUB)',
  'Ludwig Maximilian University of Munich (LMU)',
];

export const suggestedCompanies = [
  'SAP SE',
  'Siemens AG',
  'Robert Bosch GmbH',
  'BMW Group',
  'Zalando SE',
  'Infineon Technologies',
];

export const samplePrompts: string[] = [
  'How is my Bavarian GPA calculated?',
  'What is the difference between H+ and H- universities?',
  'What are the Winter intake deadlines?',
  'Is IELTS 7.5 enough for TUM?',
];

export const botResponses: Record<string, string> = {
  bavarian:
    'The modified Bavarian formula converts your grade: N = 1 + 3 × [(Nmax - Nd) / (Nmax - Nmin)]. For your CGPA of 8.4/10 with a passing grade of 4.0, your German grade is 1.6 ("Sehr Gut"). Most German competitive technical universities require 2.5 or better.',
  anabin:
    'KMK Anabin categorizes foreign universities into H+ (recognized higher education institution), H- (unrecognized), and H+/- (partially recognized). Your B.Tech degree institution holds H+ status, satisfying the preliminary prerequisite for German Master\'s admission and EU Blue Card recognition.',
  deadlines:
    'Winter Semester (starts October): Applications usually close on July 15. Summer Semester (starts April): Applications usually close on January 15. We recommend submitting documents via Uni-Assist at least 6 weeks before the cutoff.',
  language:
    'Most English-taught Master\'s programs require IELTS Academic 6.5–7.5 or TOEFL iBT 90–100. German-taught programs require TestDaF (TDN 4 in all parts) or Goethe-Zertifikat C1. Your profile currently lacks an attached certificate.',
  'uni-assist':
    'Uni-Assist processes international applications on behalf of over 180 German universities. They verify your foreign school and university certificates and issue a Preliminary Review Documentation (VPD) if required by the university.',
  default:
    'SIEG.AI is configured strictly for Germany admissions and visas. Your current dossier shows 3 of 4 requirements met, with a missing language certificate. Would you like guidance on meeting this requirement or preparing for Uni-Assist?',
};

