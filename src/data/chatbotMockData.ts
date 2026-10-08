/**
 * Mock responses and suggested queries for the SIEG.AI Assistant chatbot.
 * Tailored strictly for the Germany education and career pathway.
 */

export interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
}

export const suggestedChatQuestions = [
  'What documents do I need?',
  'Is my profile complete?',
  'What is missing?',
  'Explain my application status',
];

export const mockChatAnswers: Record<string, string> = {
  'what documents do i need?':
    'For German university and visa applications, you need:\n1. Bachelor/Master Degree Certificate\n2. Consolidated Semester Marksheets (Transcripts)\n3. Tabellarischer Lebenslauf (German standard CV)\n4. Language Certificate (IELTS 6.5+ or Goethe B2/C1)\n5. APS Certificate (India/China/Vietnam)\n6. Experience Letters (if applicable).',

  'is my profile complete?':
    'Your profile is 60% complete. Your B.Tech degree (Anabin H+ verified) and transcripts are approved, but your Language Certificate is still required before official university or Uni-Assist submission.',

  'what is missing?':
    '⚠ Language Certificate Missing: German public universities require verified proof of English (IELTS/TOEFL) or German (TestDaF/Goethe) proficiency.',

  'explain my application status':
    'Your application dossier is audited under German academic standards. Bavarian GPA equivalence is calculated at 1.6 ("Sehr Gut"). All credentials are met except for the language certificate.',
};

export const defaultAiGreeting: ChatMessage = {
  id: 'welcome-1',
  sender: 'ai',
  text: 'Hi! I\'m your SIEG.AI assistant.\nI can help you understand your Germany application.',
  timestamp: 'Just now',
};
