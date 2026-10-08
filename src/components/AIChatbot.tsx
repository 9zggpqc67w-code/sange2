import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, MessageSquare, AlertTriangle } from 'lucide-react';
import { useJourney } from '../journey/JourneyContext';
import { api, Journey } from '../services/api';
import { DOC_TYPE_LABEL } from '../data/documentSlots';
import { STAGE_LABEL } from '../services/journeyMapper';

/**
 * The assistant talks to the SIEG.AI backend only (no AI key in the browser). The backend has no
 * free-form chat endpoint, so every answer is real application data: the journey read model,
 * its gaps, or the agent's next action (POST /agent/decide). Nothing here is a canned AI reply.
 */
interface Message {
  id: string;
  sender: 'user' | 'ai' | 'error';
  text: string;
  time: string;
}

type Intent = 'next' | 'missing' | 'status' | 'documents' | 'unknown';

const SUGGESTED = ['What should I do next?', 'What is missing?', 'Is my profile complete?', 'Which documents do I have?'];

const GREETING =
  "Hi! I'm your SIEG.AI assistant. I can tell you where your Germany application stands, what is missing, and what to do next, using your live application data.";

const NOT_SUPPORTED =
  'I can only answer questions about your own application right now: what to do next, what is missing, your status and readiness, and your documents. General Germany questions (Anabin, deadlines, grade conversion) need a chat service that is not connected yet.';

function intentOf(text: string): Intent {
  const t = text.toLowerCase();
  if (/(next|what (should|do) i do|action|step)/.test(t)) return 'next';
  if (/(missing|lack|gap|conflict|problem|issue|wrong)/.test(t)) return 'missing';
  if (/(document|upload|file|certificate)/.test(t)) return 'documents';
  if (/(complete|profile|status|ready|score|qualif|requirement|eligib|where do i stand)/.test(t)) return 'status';
  return 'unknown';
}

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function statusText(j: Journey): string {
  const ev = j.evaluation;
  if (!ev) return 'Your documents have not been evaluated yet. Upload them and run the scan first.';
  const lines = ev.requirements.map((r) => `${r.status === 'MET' ? '✓' : '✗'} ${r.title}: ${r.message}`);
  return [
    `Stage: ${STAGE_LABEL[j.stage]}. Readiness score: ${ev.score}/100 (${ev.verdict}).`,
    ...lines,
    j.isStale ? 'Note: new information arrived after the last evaluation.' : '',
    ev.disclaimer,
  ]
    .filter(Boolean)
    .join('\n');
}

function missingText(j: Journey): string {
  if (!j.evaluation) return 'Your documents have not been evaluated yet, so I cannot tell what is missing. Upload them and run the scan first.';
  if (j.gaps.length === 0) return 'Nothing is missing or in conflict in your latest evaluation.';
  return ['Open items from your latest evaluation:', ...j.gaps.map((g) => `• ${g.message}`)].join('\n');
}

function documentsText(j: Journey): string {
  const have = j.documents.map((d) => `• ${DOC_TYPE_LABEL[d.docType] ?? 'Document'}: ${d.filename} (${d.status === 'DONE' ? 'scanned' : d.status === 'FAILED' ? 'scan failed' : 'not scanned yet'})`);
  const missing = j.gaps.filter((g) => g.kind === 'MISSING_DOC' && g.docType).map((g) => `• ${DOC_TYPE_LABEL[g.docType!] ?? g.docType}: missing`);
  if (have.length + missing.length === 0) return 'You have not uploaded any documents yet.';
  return ['Your documents:', ...have, ...missing].join('\n');
}

interface AIChatbotProps {
  externalIsOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const AIChatbot: React.FC<AIChatbotProps> = ({ externalIsOpen, onOpenChange }) => {
  const { applicantId } = useJourney();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = (val: boolean) => (onOpenChange ? onOpenChange(val) : setInternalIsOpen(val));

  const [messages, setMessages] = useState<Message[]>([{ id: 'greeting', sender: 'ai', text: GREETING, time: now() }]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const push = (m: Omit<Message, 'id' | 'time'>) =>
    setMessages((prev) => [...prev, { ...m, id: `${Date.now()}-${prev.length}`, time: now() }]);

  const answer = async (text: string): Promise<string> => {
    if (!applicantId) return 'Start your application first (add your details and documents), then I can answer questions about it.';
    const intent = intentOf(text);
    if (intent === 'unknown') return NOT_SUPPORTED;
    if (intent === 'next') {
      const journey = await api.getJourney(applicantId);
      if (!journey.evaluation) return 'Your documents have not been evaluated yet. Upload them and run the scan first, then I can recommend your next step.';
      let view = await api.getNextAction(applicantId);
      if (!view.action || view.isCurrent === false) view = await api.decide(applicantId);
      const why = view.action?.decision?.decision?.rationale;
      return view.message + (why && view.action?.type !== 'NO_ACTION' ? `\n\nWhy: ${why}` : '');
    }
    const journey = await api.getJourney(applicantId);
    if (intent === 'missing') return missingText(journey);
    if (intent === 'documents') return documentsText(journey);
    return statusText(journey);
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? inputValue).trim();
    if (!text || isTyping) return;
    push({ sender: 'user', text });
    if (!textToSend) setInputValue('');
    setIsTyping(true);
    try {
      push({ sender: 'ai', text: await answer(text) });
    } catch (err) {
      push({ sender: 'error', text: err instanceof Error ? err.message : 'Something went wrong. Please try again.' });
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Pill Trigger */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-[#E30613] hover:bg-[#E00018] active:bg-[#A00012] text-white px-5 py-3.5 rounded-full shadow-[0_6px_25px_rgba(201,0,22,0.45)] flex items-center gap-2.5 font-bold text-sm transition-all transform hover:scale-105 cursor-pointer border border-red-400/40 group"
          aria-label="Open SIEG.AI Copilot Chat"
        >
          <div className="w-2 h-2 rounded-full bg-[#FFD21C] animate-pulse shadow-[0_0_8px_#FFD21C]" />
          <span>Ask SIEG.AI</span>
          <MessageSquare className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* Chat Drawer Window */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[420px] h-[580px] theme-bg-card border-2 theme-border rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="theme-bg-surface p-4 border-b theme-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#E30613] text-white flex items-center justify-center font-bold shadow-md">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black theme-text-main">SIEG.AI Copilot</span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 theme-bg-card text-[#FFD21C] border theme-border rounded">
                    {applicantId ? 'LIVE DATA' : 'NO APPLICATION'}
                  </span>
                </div>
                <span className="text-[10px] theme-text-muted font-mono">Answers from your application on the server</span>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 theme-text-muted hover:theme-text-main rounded-lg hover:theme-bg-subtle transition-colors cursor-pointer"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 theme-bg-main">
            {messages.map((msg) => {
              const isAssistant = msg.sender !== 'user';
              return (
                <div key={msg.id} className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed shadow-sm whitespace-pre-line break-words ${
                      msg.sender === 'error'
                        ? 'bg-red-500/10 border border-[#E30613]/50 text-[#E30613] rounded-tl-xs'
                        : isAssistant
                        ? 'theme-bg-card theme-border border theme-text-main rounded-tl-xs'
                        : 'bg-[#E30613] text-white rounded-tr-xs'
                    }`}
                  >
                    {msg.sender === 'error' && <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />}
                    {msg.text}
                  </div>
                  <span className="text-[10px] theme-text-muted font-mono mt-1 px-1">{msg.time}</span>
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-center gap-2 text-xs theme-text-muted font-mono p-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E30613] animate-bounce" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#FFD21C] animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:0.4s]" />
                <span>Checking your application…</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Prompts */}
          <div className="px-4 py-2 theme-bg-surface border-t theme-border flex gap-2 overflow-x-auto no-scrollbar">
            {SUGGESTED.map((prompt) => (
              <button
                key={prompt}
                onClick={() => void handleSend(prompt)}
                disabled={isTyping}
                className="whitespace-nowrap px-2.5 py-1 rounded-lg theme-bg-card hover:theme-bg-subtle border theme-border text-[11px] font-mono theme-text-muted hover:theme-text-main transition-colors shrink-0 cursor-pointer disabled:opacity-40"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <div className="p-3 theme-bg-surface border-t theme-border">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask what to do next, what is missing, your status..."
                className="flex-1 theme-bg-input border theme-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm theme-text-main focus:outline-none focus:border-[#E30613] transition-colors"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isTyping}
                className="p-2.5 bg-[#E30613] hover:bg-[#E00018] text-white rounded-xl transition-all disabled:opacity-40 disabled:hover:bg-[#E30613] cursor-pointer"
                aria-label="Send query"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
