import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  Brain,
  Check,
  ChevronRight,
  Flame,
  MessageCircle,
  Play,
  Send,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { Lesson, UserProgress } from "../types";
import { getRankInfo } from "../data/lessons";

interface TodayTabProps {
  currentDay: number;
  lesson: Lesson;
  nextLesson: Lesson;
  progress: UserProgress;
  isDayCompleted: boolean;
  onCompleteDay: (reflectionText: string, isReadChecked: boolean) => void;
  onQuickFix: (problem: string) => void;
  onPracticeComplete?: (scenario: string, score: number) => void;
  onRealWorldComplete?: () => void;
  adminNote?: string;
}

const QUICK_FIXES = [
  { label: "Dry conversation", prompt: "Conversation feels dry", color: "#FFE066" },
  { label: "Left on read", prompt: "They left me on read", color: "#FDA4AF" },
  { label: "Don't know what to say", prompt: "I don't know what to say", color: "#A78BFA" },
  { label: "Came on too strong", prompt: "I came on too strong", color: "#BEF264" },
  { label: "Want to ask them out", prompt: "I want to ask them out", color: "#FFE066" },
  { label: "Overthinking", prompt: "I am overthinking this", color: "#FDA4AF" },
];

const SCENARIOS = [
  "New match",
  "Someone I already know",
  "Crush",
  "First date",
  "Asking someone out",
  "Reconnecting",
  "Flirty conversation",
];

function getTodayKey(): string {
  return new Date().toLocaleDateString("en-CA");
}

export const TodayTab: React.FC<TodayTabProps> = ({
  currentDay,
  lesson,
  progress,
  isDayCompleted,
  onCompleteDay,
  onQuickFix,
  onPracticeComplete,
  onRealWorldComplete,
  adminNote,
}) => {
  const rank = getRankInfo(progress.xp);
  const [missionStarted, setMissionStarted] = useState(false);
  const [reflection, setReflection] = useState("");
  const [showPractice, setShowPractice] = useState(false);
  const [scenario, setScenario] = useState(SCENARIOS[0]);
  const [practiceMessages, setPracticeMessages] = useState<string[]>([]);
  const [practiceInput, setPracticeInput] = useState("");
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceFinished, setPracticeFinished] = useState(false);
  const [practiceScore, setPracticeScore] = useState(0);
  const [realWorldDone, setRealWorldDone] = useState(false);

  const xpIntoLevel = progress.xp % 200;
  const xpTarget = 200;
  const progressPercent = Math.min(100, Math.round((xpIntoLevel / xpTarget) * 100));
  const todayEntries = useMemo(
    () => progress.journal.filter((entry) => entry.date.slice(0, 10) === getTodayKey()),
    [progress.journal]
  );
  const actionsComplete = todayEntries.length + (realWorldDone ? 1 : 0);
  const missionTitle = lesson.task.title;
  const missionDescription = lesson.task.desc;
  const difficulty = lesson.task.difficulty === "spicy" ? "advanced" : lesson.task.difficulty;

  const startPractice = () => {
    setShowPractice(true);
    setPracticeFinished(false);
    setPracticeScore(0);
    setPracticeMessages([
      `Scenario: ${scenario}`,
      "okay, you matched. what do you say first?",
    ]);
  };

  const sendPracticeMessage = async () => {
    const clean = practiceInput.trim();
    if (!clean || practiceLoading || practiceFinished) return;
    setPracticeInput("");
    const nextMessages = [...practiceMessages, `you: ${clean}`];
    setPracticeMessages(nextMessages);
    setPracticeLoading(true);
    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Dating simulation. Scenario: ${scenario}. Reply naturally as the other person. Do not coach or reveal the answer. User message: ${clean}`,
          vibe: "direct",
          history: nextMessages.map((text, index) => ({
            role: index % 2 === 0 ? "coach" : "user",
            text,
          })),
        }),
      });
      const data = await response.json();
      setPracticeMessages((current) => [...current, data.text || "interesting... tell me more"]);
    } catch {
      setPracticeMessages((current) => [...current, "hmm okay, now make that more specific and playful."]);
    } finally {
      setPracticeLoading(false);
    }
  };

  const finishPractice = () => {
    const score = Math.min(100, 48 + Math.min(42, Math.max(0, practiceMessages.length - 2) * 8));
    setPracticeScore(score);
    setPracticeFinished(true);
    onPracticeComplete?.(scenario, score);
  };

  const completeMission = () => {
    if (isDayCompleted) return;
    onCompleteDay(reflection || `Completed: ${missionTitle}`, true);
  };

  const completeRealWorld = () => {
    if (realWorldDone) return;
    setRealWorldDone(true);
    onRealWorldComplete?.();
  };

  return (
    <div className="space-y-5">
      <section className="flex items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-black text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3">
            <Target size={12} /> Day {currentDay} • Today
          </div>
          <h1 className="text-[34px] sm:text-[40px] font-black leading-[0.88] tracking-tighter">today&apos;s glow-up</h1>
          <p className="text-[14px] font-bold opacity-60 mt-2">one useful move. that&apos;s it.</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] font-black uppercase opacity-50">Level {Math.floor(progress.xp / 200) + 1}</div>
          <div className="font-black text-[15px] flex items-center gap-1 justify-end">{rank.emoji} {rank.name}</div>
        </div>
      </section>

      <section className="bg-white border-[3px] border-black rounded-[20px] p-4 brutal-shadow-sm">
        <div className="flex items-center justify-between text-[11px] font-black uppercase">
          <span>Progress to next level</span>
          <span>{xpIntoLevel} / {xpTarget} XP</span>
        </div>
        <div className="h-3 bg-[#FFFBEB] border-[2px] border-black rounded-full mt-2 overflow-hidden">
          <div className="h-full bg-[#FFE066] transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
      </section>

      {adminNote && (
        <div className="bg-[#BEF264] border-[3px] border-black rounded-[18px] p-3.5 font-bold text-[13px] flex gap-2">
          <Sparkles size={18} className="shrink-0" /> {adminNote}
        </div>
      )}

      <section className="bg-[#FFE066] border-[3px] border-black rounded-[24px] p-5 brutal-shadow">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest">
              <Flame size={16} /> Today&apos;s mission
            </div>
            <h2 className="text-[27px] sm:text-[31px] font-black tracking-tighter leading-[0.92] mt-2">{missionTitle}</h2>
          </div>
          <div className="bg-black text-[#FFE066] border-[2px] border-black rounded-full px-2.5 py-1 text-[11px] font-black shrink-0">+{lesson.task.xp} XP</div>
        </div>
        <p className="text-[14px] font-bold leading-relaxed max-w-[520px]">{missionDescription}</p>
        <div className="bg-white/70 border-[2px] border-black rounded-[16px] p-3 mt-4">
          <div className="text-[10px] font-black uppercase tracking-widest mb-1">Your move</div>
          <p className="text-[13px] font-bold">Use one specific detail, share something about yourself, and leave them an easy way to respond.</p>
        </div>
        {missionStarted && !isDayCompleted && (
          <textarea
            value={reflection}
            onChange={(event) => setReflection(event.target.value)}
            placeholder="What happened? Drop a quick reflection..."
            className="w-full min-h-[76px] mt-3 bg-[#FFFBEB] border-[2px] border-black rounded-[14px] p-3 text-[13px] font-medium outline-none resize-none"
          />
        )}
        <button
          type="button"
          onClick={() => (missionStarted ? completeMission() : setMissionStarted(true))}
          disabled={isDayCompleted}
          className={`w-full mt-4 h-[50px] rounded-full border-[3px] border-black font-black uppercase text-[13px] flex items-center justify-center gap-2 ${isDayCompleted ? "bg-[#BEF264]" : "bg-black text-white hover:translate-y-[-1px]"}`}
        >
          {isDayCompleted ? <><Check size={18} /> Mission complete</> : missionStarted ? <>Complete mission <Trophy size={17} /></> : <>Start mission <ArrowRight size={17} /></>}
        </button>
      </section>

      <section className="bg-white border-[3px] border-black rounded-[22px] p-4 brutal-shadow-sm">
        <div className="flex items-center gap-2 mb-3"><Zap size={18} className="fill-[#FFE066]" /><h2 className="font-black text-[16px] uppercase tracking-tight">Something feeling off?</h2></div>
        <p className="text-[12px] font-bold opacity-60 mb-3">Pick the problem. Coach opens with context already loaded.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {QUICK_FIXES.map((fix) => (
            <button key={fix.prompt} type="button" onClick={() => onQuickFix(fix.prompt)} className="text-left min-h-[54px] px-2.5 py-2 border-[2px] border-black rounded-[12px] font-black text-[11px] leading-tight hover:translate-y-[-1px]" style={{ background: fix.color }}>
              {fix.label}<ChevronRight size={14} className="inline ml-1" />
            </button>
          ))}
        </div>
      </section>

      <section className="bg-[#A78BFA] border-[3px] border-black rounded-[22px] p-4 brutal-shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div><div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest"><Brain size={16} /> Practice</div><h2 className="font-black text-[22px] tracking-tight mt-1">2-minute AI conversation</h2><p className="text-[12px] font-bold mt-1">Build reps without risking the real chat.</p></div>
          <button type="button" onClick={() => setShowPractice(true)} className="bg-white border-[2px] border-black rounded-full px-3 py-2 font-black text-[11px] uppercase shrink-0"><Play size={13} className="inline mr-1" /> Practice now</button>
        </div>
        {showPractice && (
          <div className="bg-white border-[2px] border-black rounded-[16px] p-3 mt-4">
            <div className="flex flex-wrap gap-1.5 mb-3">{SCENARIOS.map((item) => <button key={item} type="button" onClick={() => { setScenario(item); setPracticeMessages([]); setPracticeFinished(false); }} className={`px-2.5 py-1 rounded-full border-[1.5px] border-black text-[10px] font-black ${scenario === item ? "bg-[#FFE066]" : "bg-[#FFFBEB]"}`}>{item}</button>)}</div>
            {practiceMessages.length === 0 ? <button type="button" onClick={startPractice} className="w-full h-10 bg-black text-white rounded-full font-black text-[12px] uppercase">Start {scenario}</button> : <>
              <div className="space-y-2 max-h-[180px] overflow-y-auto mb-3">{practiceMessages.map((message, index) => <div key={`${message}-${index}`} className={`text-[12px] font-bold p-2.5 rounded-[12px] border-[2px] border-black ${index % 2 ? "bg-[#FFFBEB] ml-6" : "bg-[#BEF264] mr-6"}`}>{message}</div>)}</div>
              {!practiceFinished ? <div className="flex gap-2"><input value={practiceInput} onChange={(event) => setPracticeInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void sendPracticeMessage(); }} placeholder={practiceLoading ? "Coach is thinking..." : "Type your message..."} className="flex-1 min-w-0 h-10 bg-[#FFFBEB] border-[2px] border-black rounded-full px-3 text-[12px] font-bold outline-none" /><button type="button" onClick={() => void sendPracticeMessage()} className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center"><Send size={15} /></button><button type="button" onClick={finishPractice} className="px-3 h-10 bg-[#FFE066] border-[2px] border-black rounded-full font-black text-[10px]">FINISH</button></div> : <div className="bg-[#BEF264] border-[2px] border-black rounded-[12px] p-3 font-black text-[13px]">Score: {practiceScore}/100. Keep the energy specific, curious, and low-pressure.</div>}
            </>}
          </div>
        )}
      </section>

      <section className="bg-[#FDA4AF] border-[3px] border-black rounded-[20px] p-4 flex items-center justify-between gap-3">
        <div><div className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><MessageCircle size={13} /> Real-world move</div><p className="font-black text-[15px] leading-tight mt-1">Ask one open question, then share something about yourself.</p></div>
        <button type="button" onClick={completeRealWorld} disabled={realWorldDone} className={`shrink-0 px-3 py-2 border-[2px] border-black rounded-full font-black text-[10px] uppercase ${realWorldDone ? "bg-[#BEF264]" : "bg-white"}`}>{realWorldDone ? "Done" : "I did it"}</button>
      </section>

      <section className="bg-black text-white border-[3px] border-black rounded-[20px] p-4">
        <div className="flex items-center gap-2 mb-3"><Trophy size={17} className="text-[#FFE066]" /><h2 className="font-black text-[15px] uppercase tracking-widest">Today&apos;s progress</h2></div>
        <div className="grid grid-cols-3 gap-2 text-center"><div><div className="text-[22px] font-black">{Math.min(3, actionsComplete)} / 3</div><div className="text-[9px] font-black uppercase opacity-60">Actions</div></div><div><div className="text-[22px] font-black">+{todayEntries.reduce((sum, entry) => sum + entry.xp, 0) + (realWorldDone ? 15 : 0)} XP</div><div className="text-[9px] font-black uppercase opacity-60">Earned today</div></div><div><div className="text-[22px] font-black">{todayEntries.length}</div><div className="text-[9px] font-black uppercase opacity-60">Completed</div></div></div>
      </section>
    </div>
  );
};
