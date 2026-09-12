import React, { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  ChevronDown,
  Crown,
  Lock,
  MessageCircle,
  Play,
  RefreshCcw,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
  X,
} from "lucide-react";
import { ChatMessage, UserProfile } from "../types";
import { processUploadFile } from "../utils/imageCompressor";

interface CoachTabProps {
  profile: UserProfile;
  messages: ChatMessage[];
  onSendMessage: (text?: string, imageBase64?: string, mode?: CoachMode) => Promise<void>;
  isPro: boolean;
  chatsUsedToday: number;
  maxFreeChats: number;
  onOpenProModal: () => void;
  onNewSession?: () => void;
  onMessageFeedback?: (messageId: string, helpful: boolean) => void;
  isTyping: boolean;
  initialContext?: string;
}

export type CoachMode = "gentle" | "direct" | "brutal";

const MODE_COPY: Record<CoachMode, { label: string; color: string; description: string }> = {
  gentle: { label: "Gentle", color: "#BEF264", description: "supportive + reassuring" },
  direct: { label: "Direct", color: "#FFE066", description: "clear + practical" },
  brutal: { label: "Brutal", color: "#FDA4AF", description: "blunt, never cruel" },
};

const QUICK_ACTIONS = [
  { label: "Roast my chat", prompt: "I want a focused analysis of this conversation. Find the biggest mistake, strongest part, energy, pressure, question balance, flirting, and my next move." },
  { label: "What do I text back?", prompt: "What should I text back? Give me one strongest reply and two alternatives: playful and bold." },
  { label: "Profile review", prompt: "Review my dating profile. Ask me for the bio, prompts, or photos you need, then score clarity, personality, and authenticity." },
  { label: "I'm nervous", prompt: "I'm nervous about dating. Ask what specific situation is making me nervous, then give me one practical next step." },
];

const PRACTICE_SCENARIOS = ["New match", "First date", "Asking them out", "Flirty chat", "Reconnecting", "Difficult conversation"];

function formatCoachText(text: string): { heading?: string; body: string } {
  const match = text.match(/^(?:COACH(?:'S)? TAKE|COACH'S TAKE)\s*:?\s*/i);
  return match ? { heading: "COACH'S TAKE", body: text.slice(match[0].length) } : { body: text };
}

export const CoachTab: React.FC<CoachTabProps> = ({
  profile,
  messages,
  onSendMessage,
  isPro,
  chatsUsedToday,
  maxFreeChats,
  onOpenProModal,
  onNewSession,
  onMessageFeedback,
  isTyping,
  initialContext,
}) => {
  const [inputText, setInputText] = useState("");
  const [statusNotice, setStatusNotice] = useState("");
  const [mode, setMode] = useState<CoachMode>(() => {
    const saved = localStorage.getItem("datings_coach_mode");
    return saved === "gentle" || saved === "direct" || saved === "brutal" ? saved : profile.vibe === "roasty" ? "brutal" : profile.vibe === "gentle" ? "gentle" : "direct";
  });
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showPractice, setShowPractice] = useState(false);
  const [practiceScenario, setPracticeScenario] = useState(PRACTICE_SCENARIOS[0]);
  const [practiceMessages, setPracticeMessages] = useState<string[]>([]);
  const [practiceInput, setPracticeInput] = useState("");
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceDone, setPracticeDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isLimitReached = !isPro && chatsUsedToday >= maxFreeChats;
  const remaining = Math.max(0, maxFreeChats - chatsUsedToday);

  useEffect(() => {
    localStorage.setItem("datings_coach_mode", mode);
  }, [mode]);

  useEffect(() => {
    if (initialContext) setInputText(initialContext);
  }, [initialContext]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? inputText).trim();
    if (!text || isTyping) return;
    if (isLimitReached) {
      onOpenProModal();
      return;
    }
    setInputText("");
    await onSendMessage(text, undefined, mode);
  };

  const handleQuickAction = (prompt: string) => {
    if (isLimitReached) {
      onOpenProModal();
      return;
    }
    setInputText(prompt);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    if (!file.type.match(/^image\/(png|jpe?g|webp)$/i)) {
      setStatusNotice("Use a PNG, JPG, or WEBP screenshot.");
      return;
    }
    if (isLimitReached) {
      onOpenProModal();
      return;
    }
    try {
      const { dataUrl } = await processUploadFile(file);
      await onSendMessage("Analyze this screenshot. Extract the conversation and give me the biggest fix plus my next move.", dataUrl, mode);
    } catch {
      setStatusNotice("Coach couldn't read that image. Try another screenshot.");
    }
  };

  const startPractice = () => {
    setPracticeMessages([`Scenario: ${practiceScenario}`, "them: haha yeah 😂"]);
    setPracticeDone(false);
  };

  const sendPractice = async () => {
    const text = practiceInput.trim();
    if (!text || practiceLoading || practiceDone) return;
    setPracticeInput("");
    const next = [...practiceMessages, `you: ${text}`];
    setPracticeMessages(next);
    setPracticeLoading(true);
    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Practice as the other person in a ${practiceScenario} dating conversation. Reply naturally to: ${text}. Do not coach yet.`,
          vibe: mode,
          history: next.map((item, index) => ({ role: index % 2 ? "user" : "coach", text: item })),
        }),
      });
      const data = await response.json();
      setPracticeMessages((current) => [...current, `them: ${data.text || "interesting... tell me more"}`]);
    } catch {
      setPracticeMessages((current) => [...current, "them: okay, now tell me something I couldn't guess from your profile."]);
    } finally {
      setPracticeLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] sm:h-[700px] bg-white border-[3px] border-black rounded-[24px] brutal-shadow overflow-hidden">
      <div className="min-h-[68px] border-b-[3px] border-black px-4 py-2 flex items-center justify-between bg-[#FFFBEB] shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-[#111] border-[2px] border-black flex items-center justify-center text-[16px] shrink-0">👁️</div>
          <div className="min-w-0">
            <div className="font-black text-[14px] leading-none">lol coach</div>
            <div className="text-[10px] font-bold opacity-60 flex items-center gap-1 mt-1"><span className="w-2 h-2 bg-[#4ADE80] rounded-full border border-black animate-pulse" /> ONLINE • usually replies instantly</div>
          </div>
        </div>
        <div className="relative shrink-0">
          <button type="button" onClick={() => setShowModeMenu((value) => !value)} className="px-2.5 py-1 rounded-full border-[2px] border-black text-[10px] font-black uppercase flex items-center gap-1" style={{ background: MODE_COPY[mode].color }}>
            {MODE_COPY[mode].label} mode <ChevronDown size={12} />
          </button>
          {showModeMenu && <div className="absolute right-0 top-9 z-20 w-40 bg-white border-[2px] border-black rounded-[12px] p-1.5 brutal-shadow-sm">
            {(Object.keys(MODE_COPY) as CoachMode[]).map((option) => <button key={option} type="button" onClick={() => { setMode(option); setShowModeMenu(false); }} className="w-full text-left px-2 py-2 rounded-lg text-[11px] font-black uppercase hover:bg-[#FFFBEB]" style={{ background: mode === option ? MODE_COPY[option].color : undefined }}>{MODE_COPY[option].label}<span className="block text-[9px] normal-case opacity-60">{MODE_COPY[option].description}</span></button>)}
          </div>}
        </div>
      </div>

      <div className="bg-[#111] text-white border-b-[3px] border-black px-4 py-2.5 flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-2 min-w-0"><div className="w-7 h-7 bg-[#FFE066] border-[2px] border-white rounded-full flex items-center justify-center text-black"><MessageCircle size={14} /></div><span className="font-black text-[11px] uppercase tracking-widest truncate">{isPro ? "Unlimited coaching" : `Free: ${remaining}/${maxFreeChats} left today`}</span></div>
        {!isPro && <div className="flex gap-1 shrink-0">{[...Array(maxFreeChats)].map((_, index) => <span key={index} className={`w-2.5 h-2.5 rounded-full border border-white ${index < remaining ? "bg-[#FFE066]" : "bg-white/20"}`} />)}</div>}
      </div>

      {isLimitReached && <div className="bg-[#FDA4AF] border-b-[2.5px] border-black px-4 py-3 flex items-center justify-between gap-3"><div><div className="font-black text-[12px] uppercase">Today&apos;s coaching limit hit</div><div className="text-[11px] font-bold">Your next free coaching session unlocks tomorrow.</div></div><button type="button" onClick={onOpenProModal} className="bg-white border-[2px] border-black rounded-full px-3 py-1.5 font-black text-[10px] uppercase">See plans</button></div>}
      {statusNotice && <div className="bg-[#FFE066] border-b-[2.5px] border-black px-4 py-2 flex items-center gap-2 text-[12px] font-black"><TriangleAlert size={14} /> {statusNotice}<button type="button" onClick={() => setStatusNotice("")} className="ml-auto"><X size={14} /></button></div>}

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FFFBEB]">
        {messages.length === 0 && <div className="bg-white border-[3px] border-black rounded-[20px] p-5 brutal-shadow-sm"><div className="text-[24px] mb-2">👁️</div><h2 className="font-black text-[20px]">yo, i&apos;m your coach.</h2><p className="text-[13px] font-bold opacity-70 mt-1">paste your chat, tell me what happened, or just tell me what&apos;s going on.</p></div>}
        {messages.map((message) => {
          const formatted = formatCoachText(message.text || "");
          return <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] ${message.role === "user" ? "bg-[#111] text-white border-white" : "bg-white text-black border-black"} border-[2.5px] rounded-[20px] px-4 py-3 brutal-shadow-sm ${message.role === "user" ? "rounded-br-[6px]" : "rounded-bl-[6px]"} overflow-hidden`}>
            {message.imageUrl && <img src={message.imageUrl} alt="Uploaded conversation" className="w-full max-w-[260px] rounded-[12px] border-[2px] border-black mb-2 object-cover" />}
            {formatted.heading && <div className="text-[10px] font-black uppercase tracking-widest mb-1">{formatted.heading}</div>}
            {formatted.body && <p className="text-[14px] font-medium leading-[1.4] whitespace-pre-wrap">{formatted.body}</p>}
            {message.options?.length ? <div className="flex flex-wrap gap-1.5 mt-3">{message.options.slice(0, 3).map((option) => <button key={option} type="button" onClick={() => handleQuickAction(option)} className="text-[11px] font-black px-3 py-1.5 rounded-full border-[2px] border-black bg-[#FFE066] text-black">{option}</button>)}</div> : null}
            {message.role === "coach" && message.id !== "1" && <div className="flex items-center gap-1 mt-3 pt-2 border-t border-black/10"><span className="text-[9px] font-black uppercase opacity-50 mr-1">Useful?</span><button type="button" onClick={() => onMessageFeedback?.(message.id, true)} className="p-1 hover:bg-[#BEF264] rounded"><ThumbsUp size={12} /></button><button type="button" onClick={() => onMessageFeedback?.(message.id, false)} className="p-1 hover:bg-[#FDA4AF] rounded"><ThumbsDown size={12} /></button></div>}
          </div></div>;
        })}
        {isTyping && <div className="flex justify-start"><div className="bg-white border-[2.5px] border-black rounded-[20px] rounded-bl-[6px] px-4 py-3 brutal-shadow-sm"><div className="text-[10px] font-black uppercase tracking-widest mb-1">Coach is thinking...</div><div className="flex gap-1"><span className="w-2 h-2 bg-black rounded-full animate-[bounce_1s_infinite]" /><span className="w-2 h-2 bg-black rounded-full animate-[bounce_1s_0.2s_infinite]" /><span className="w-2 h-2 bg-black rounded-full animate-[bounce_1s_0.4s_infinite]" /></div></div></div>}
        <div ref={chatEndRef} />
      </div>

      {showPractice && <div className="border-t-[3px] border-black bg-[#A78BFA] p-3 shrink-0"><div className="flex items-center justify-between gap-2 mb-2"><div className="font-black text-[12px] uppercase flex items-center gap-1"><Play size={13} /> Practice with me</div><button type="button" onClick={() => setShowPractice(false)}><X size={16} /></button></div><div className="flex gap-1.5 overflow-x-auto scrollbar-none mb-2">{PRACTICE_SCENARIOS.map((scenario) => <button key={scenario} type="button" onClick={() => { setPracticeScenario(scenario); setPracticeMessages([]); setPracticeDone(false); }} className={`shrink-0 px-2 py-1 border-[1.5px] border-black rounded-full text-[10px] font-black ${practiceScenario === scenario ? "bg-[#FFE066]" : "bg-white"}`}>{scenario}</button>)}</div>{practiceMessages.length === 0 ? <button type="button" onClick={startPractice} className="w-full h-9 bg-black text-white rounded-full font-black text-[11px] uppercase">Start {practiceScenario}</button> : <><div className="max-h-[100px] overflow-y-auto space-y-1.5 mb-2">{practiceMessages.map((item, index) => <div key={`${item}-${index}`} className="bg-white border-[1.5px] border-black rounded-[10px] px-2 py-1.5 text-[11px] font-bold">{item}</div>)}</div>{practiceDone ? <div className="bg-[#BEF264] border-[2px] border-black rounded-[10px] p-2 text-[11px] font-black">Practice complete. You stayed natural. Next rep: add a little more playful escalation.</div> : <div className="flex gap-1.5"><input value={practiceInput} onChange={(event) => setPracticeInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void sendPractice(); }} placeholder={practiceLoading ? "Coach is thinking..." : "Your reply..."} className="flex-1 min-w-0 h-9 rounded-full border-[2px] border-black px-3 text-[11px] font-bold outline-none" /><button type="button" onClick={() => void sendPractice()} className="w-9 h-9 bg-black text-white rounded-full flex items-center justify-center"><Send size={14} /></button><button type="button" onClick={() => setPracticeDone(true)} className="px-2 rounded-full border-[2px] border-black bg-[#FFE066] text-[10px] font-black">DONE</button></div>}</>}</div>}

      <div className="px-3 py-2 border-t-[2.5px] border-black bg-white flex gap-2 overflow-x-auto scrollbar-none shrink-0">{QUICK_ACTIONS.map((action) => <button key={action.label} type="button" onClick={() => handleQuickAction(action.prompt)} className="shrink-0 text-[11px] font-black px-3 py-1.5 rounded-full border-[2px] border-black bg-[#FFFBEB] hover:bg-[#111] hover:text-white">{action.label}</button>)}<button type="button" onClick={() => fileInputRef.current?.click()} className="shrink-0 text-[11px] font-black px-3 py-1.5 rounded-full border-[2px] border-black bg-[#BEF264]"><Camera size={12} className="inline mr-1" /> Upload screenshot</button><button type="button" onClick={() => setShowPractice((value) => !value)} className="shrink-0 text-[11px] font-black px-3 py-1.5 rounded-full border-[2px] border-black bg-[#A78BFA]"><Play size={12} className="inline mr-1" /> Practice</button></div>

      <div className="p-3 border-t-[3px] border-black bg-white flex gap-2 shrink-0 items-center"><input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileUpload} /><button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLimitReached} className="w-11 h-11 bg-[#111] border-[2.5px] border-black rounded-full flex items-center justify-center brutal-shadow-sm shrink-0 text-white disabled:opacity-50" title="Upload screenshot"><Camera size={18} strokeWidth={2.5} /></button><textarea value={inputText} onChange={(event) => setInputText(event.target.value.slice(0, 4000))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void handleSend(); } }} placeholder={isLimitReached ? "Next free session unlocks tomorrow" : "paste chat or tell me what happened..."} disabled={isLimitReached} rows={1} className="flex-1 min-h-[44px] max-h-[100px] resize-none border-[2.5px] border-black rounded-[22px] px-4 py-2.5 text-[14px] font-medium outline-none placeholder:opacity-40 bg-[#FFFBEB] disabled:bg-gray-100" /><button type="button" onClick={() => void handleSend()} disabled={!inputText.trim() || isTyping || isLimitReached} className="w-11 h-11 border-[2.5px] border-black rounded-full flex items-center justify-center brutal-shadow-sm bg-[#111] text-white disabled:bg-[#FDA4AF] disabled:text-black"><Send size={16} /></button></div>
      <div className="px-3 pb-2 bg-white flex items-center justify-between text-[9px] font-black uppercase opacity-50 shrink-0"><span>Enter to send • Shift + Enter for newline</span><button type="button" onClick={onNewSession} className="flex items-center gap-1 hover:opacity-100"><RefreshCcw size={11} /> New session</button></div>
    </div>
  );
};
