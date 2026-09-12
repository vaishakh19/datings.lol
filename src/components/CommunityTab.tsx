import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ChevronRight,
  Flame,
  Heart,
  LockKeyhole,
  Megaphone,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
} from "lucide-react";
import { AdminSettings, UserProfile, UserProgress } from "../types";
import { COMMUNITY_TEACHINGS, CommunityTeaching } from "../data/community";

interface CommunityTabProps {
  settings: AdminSettings;
  isAdmin: boolean;
  onOpenAdmin: () => void;
  userId?: string;
  profile?: UserProfile | null;
  progress?: UserProgress;
  onOpenCoach?: (context: string) => void;
  onPracticeToday?: (lessonId?: number) => void;
  onAwardXp?: (amount: number, reason: string) => void;
}

const FILTERS = ["ALL", "TEXTING", "FLIRTING", "CONFIDENCE", "DATES", "RELATIONSHIPS", "MINDSET"];
const REACTIONS = ["🔥", "💀", "💡", "❤️"];

function storageKey(userId: string | undefined, suffix: string): string {
  return `datings_community_${userId || "guest"}_${suffix}`;
}

function readSet(key: string): Set<string> {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    return new Set();
  }
}

function writeSet(key: string, values: Set<string>): void {
  localStorage.setItem(key, JSON.stringify([...values]));
}

function getAccentClass(accent: string): string {
  if (accent === "#111") return "bg-[#111] text-white";
  if (accent === "#FDA4AF") return "bg-[#FDA4AF]";
  if (accent === "#BEF264") return "bg-[#BEF264]";
  if (accent === "#A78BFA") return "bg-[#A78BFA]";
  return "bg-[#FFE066]";
}

export const CommunityTab: React.FC<CommunityTabProps> = ({
  settings,
  isAdmin,
  onOpenAdmin,
  userId,
  profile,
  progress,
  onOpenCoach,
  onPracticeToday,
  onAwardXp,
}) => {
  const [selectedTeaching, setSelectedTeaching] = useState<CommunityTeaching | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState<Set<string>>(() => readSet(storageKey(userId, "saved")));
  const [completed, setCompleted] = useState<Set<string>>(() => readSet(storageKey(userId, "completed")));
  const [reactions, setReactions] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey(userId, "reactions")) || "{}"); } catch { return {}; }
  });
  const [readProgress, setReadProgress] = useState<Record<string, number>>({});

  const relevantScore = (teaching: CommunityTeaching): number => {
    const profileText = `${profile?.goal || ""} ${profile?.blocker || ""}`.toLowerCase();
    const tags = teaching.tags.join(" ").toLowerCase();
    const relevance = teaching.tags.some((tag) => profileText.includes(tag)) || tags.includes(profile?.goal?.toLowerCase() || "") ? 5 : 0;
    const recentlyViewed = progress?.lessonsViewed.some((id) => id === teaching.lessonId) ? -2 : 0;
    return relevance + (teaching.featured ? 4 : 0) + recentlyViewed;
  };

  const teachings = useMemo(() => {
    const notificationTeachings: CommunityTeaching[] = settings.notifications.filter((item) => item.isActive).map((item) => ({
      id: `admin-${item.id}`,
      category: item.tone === "warning" ? "MINDSET" : "COMMUNICATION",
      type: item.tone === "warning" ? "REMINDER" : "COACH TIP",
      title: item.title,
      subtitle: item.message,
      intro: item.message,
      problem: item.message,
      why: "Fresh guidance from the datings.lol team.",
      doInstead: "Read this drop, then try one small move today.",
      badExample: "Waiting for the perfect moment.",
      betterExample: "One clear action, done today.",
      takeaway: item.message,
      readTime: 1,
      xp: 10,
      accent: item.tone === "warning" ? "#FDA4AF" : item.tone === "win" ? "#BEF264" : "#FFE066",
      tags: ["communication"],
    }));
    return [...COMMUNITY_TEACHINGS, ...notificationTeachings]
      .filter((teaching) => filter === "ALL" || teaching.category === filter || teaching.tags.some((tag) => tag.toUpperCase() === filter))
      .filter((teaching) => `${teaching.title} ${teaching.subtitle} ${teaching.category}`.toLowerCase().includes(search.toLowerCase().trim()))
      .sort((left, right) => relevantScore(right) - relevantScore(left));
  }, [filter, progress?.lessonsViewed, profile?.blocker, profile?.goal, search, settings.notifications]);

  const openTeaching = (teaching: CommunityTeaching) => {
    setSelectedTeaching(teaching);
    setReadProgress((current) => ({ ...current, [teaching.id]: current[teaching.id] || 0 }));
  };

  const toggleSave = (teaching: CommunityTeaching) => {
    const next = new Set<string>(saved);
    if (next.has(teaching.id)) next.delete(teaching.id); else { next.add(teaching.id); onAwardXp?.(2, "Saved a community teaching"); }
    setSaved(next);
    writeSet(storageKey(userId, "saved"), next);
  };

  const completeTeaching = (teaching: CommunityTeaching) => {
    if (completed.has(teaching.id)) return;
    const next = new Set<string>(completed);
    next.add(teaching.id);
    setCompleted(next);
    writeSet(storageKey(userId, "completed"), next);
    onAwardXp?.(teaching.xp, `Completed community teaching: ${teaching.title}`);
  };

  const reactToTeaching = (teaching: CommunityTeaching, reaction: string) => {
    if (reactions[teaching.id]) return;
    const next = { ...reactions, [teaching.id]: reaction };
    setReactions(next);
    localStorage.setItem(storageKey(userId, "reactions"), JSON.stringify(next));
  };

  if (selectedTeaching) {
    const percent = readProgress[selectedTeaching.id] || 0;
    const isComplete = completed.has(selectedTeaching.id);
    return (
      <div className="space-y-5">
        <button type="button" onClick={() => setSelectedTeaching(null)} className="inline-flex items-center gap-2 font-black text-[12px] uppercase"><ArrowLeft size={16} /> Back to teachings</button>
        <article className={`${getAccentClass(selectedTeaching.accent)} border-[3px] border-black rounded-[24px] p-5 brutal-shadow`}>
          <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-widest"><span>{selectedTeaching.category} • {selectedTeaching.type}</span><span>{selectedTeaching.readTime} min read</span></div>
          <h1 className="text-[32px] sm:text-[40px] font-black leading-[0.9] tracking-tighter mt-4">{selectedTeaching.title}</h1>
          <p className="font-bold text-[14px] mt-2 max-w-[560px]">{selectedTeaching.intro}</p>
          <div className="h-3 bg-white/60 border-[2px] border-black rounded-full mt-5 overflow-hidden"><div className="h-full bg-black transition-all" style={{ width: `${percent}%` }} /></div>
          <div className="text-[9px] font-black uppercase mt-1">Reading {percent}%</div>
        </article>

        <div className="bg-white border-[3px] border-black rounded-[22px] p-5 brutal-shadow-sm space-y-5">
          <ReadingSection title="The problem" text={selectedTeaching.problem} />
          <ReadingSection title="Why it happens" text={selectedTeaching.why} />
          <ReadingSection title="What to do instead" text={selectedTeaching.doInstead} />
          <div className="grid sm:grid-cols-2 gap-3"><ExampleCard title="Bad" text={selectedTeaching.badExample} dark /><ExampleCard title="Better" text={selectedTeaching.betterExample} /></div>
          <ReadingSection title="The takeaway" text={selectedTeaching.takeaway} accent />
          <button type="button" onClick={() => { setReadProgress((current) => ({ ...current, [selectedTeaching.id]: 100 })); completeTeaching(selectedTeaching); }} className={`w-full h-12 rounded-full border-[3px] border-black font-black uppercase flex items-center justify-center gap-2 ${isComplete ? "bg-[#BEF264]" : "bg-[#FFE066]"}`}><Check size={18} /> {isComplete ? "Got it" : `Finish teaching • +${selectedTeaching.xp} XP`}</button>
          <div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => toggleSave(selectedTeaching)} className="h-10 border-[2px] border-black rounded-full font-black text-[10px] uppercase flex items-center justify-center gap-1 bg-[#FFFBEB]"><Bookmark size={13} fill={saved.has(selectedTeaching.id) ? "currentColor" : "none"} /> {saved.has(selectedTeaching.id) ? "Saved" : "Save"}</button><button type="button" onClick={() => onOpenCoach?.(`I just read "${selectedTeaching.title}". Help me apply this to my dating situation.`)} className="h-10 border-[2px] border-black rounded-full font-black text-[10px] uppercase flex items-center justify-center gap-1 bg-[#A78BFA]"><MessageBubble /> Ask Coach</button><button type="button" onClick={() => navigator.clipboard?.writeText(selectedTeaching.title)} className="h-10 border-[2px] border-black rounded-full font-black text-[10px] uppercase flex items-center justify-center gap-1 bg-white"><Share2 size={13} /> Share</button></div>
        </div>
        {selectedTeaching.lessonId && <div className="bg-[#BEF264] border-[3px] border-black rounded-[20px] p-4 flex items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-widest">Connected to Today</div><p className="font-black text-[14px] mt-1">Practice this concept in your next move.</p></div><button type="button" onClick={() => onPracticeToday?.(selectedTeaching.lessonId)} className="bg-white border-[2px] border-black rounded-full px-3 py-2 font-black text-[10px] uppercase">Practice <ArrowRight size={13} className="inline" /></button></div>}
        <div className="flex items-center gap-2"><span className="text-[10px] font-black uppercase opacity-60">React</span>{REACTIONS.map((reaction) => <button key={reaction} type="button" disabled={Boolean(reactions[selectedTeaching.id])} onClick={() => reactToTeaching(selectedTeaching, reaction)} className={`w-9 h-9 border-[2px] border-black rounded-full ${reactions[selectedTeaching.id] === reaction ? "bg-[#FFE066]" : "bg-white"}`}>{reaction}</button>)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="bg-[#FDA4AF] border-[3px] border-black rounded-[24px] p-5 brutal-shadow"><div className="flex items-start justify-between gap-3"><div><div className="inline-flex items-center gap-2 bg-white border-[2px] border-black rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest"><Sparkles size={13} /> Community teachings</div><h1 className="text-[30px] font-black leading-none tracking-tighter mt-3">learn the game together</h1><p className="text-[12px] font-bold opacity-75 mt-1">Fresh dating lessons, reminders, and straight-up guidance from the team.</p>{teachings.some((teaching) => !completed.has(teaching.id)) && <div className="inline-flex items-center gap-1 mt-3 bg-[#FFE066] border-[2px] border-black rounded-full px-2.5 py-1 text-[9px] font-black uppercase"><span className="w-2 h-2 bg-[#16A34A] rounded-full border border-black" /> New teaching</div>}</div><div className="w-11 h-11 rounded-full bg-[#FFE066] border-[2.5px] border-black flex items-center justify-center shrink-0"><Flame size={20} /></div></div></section>
      <section className="bg-white border-[3px] border-black rounded-[20px] p-3 brutal-shadow-sm"><div className="flex gap-2 overflow-x-auto scrollbar-none pb-2">{FILTERS.map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`shrink-0 px-3 py-1.5 rounded-full border-[2px] border-black text-[10px] font-black uppercase ${filter === item ? "bg-[#FFE066]" : "bg-[#FFFBEB]"}`}>{item}</button>)}</div><label className="flex items-center gap-2 border-[2px] border-black rounded-full px-3 h-10 bg-[#FFFBEB]"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search teachings..." className="bg-transparent outline-none text-[12px] font-bold w-full" /></label></section>
      <section className="bg-black text-white border-[3px] border-black rounded-[22px] p-5 brutal-shadow"><div className="flex items-center justify-between gap-3"><div><div className="text-[#FFE066] text-[10px] font-black uppercase tracking-widest">This week&apos;s teaching</div><h2 className="text-[25px] font-black leading-[0.95] tracking-tighter mt-2">THE ART OF<br />NOT OVERTHINKING</h2><p className="text-[11px] font-bold opacity-70 mt-2">5 minutes • one useful reset</p></div><div className="w-11 h-11 rounded-full bg-[#FFE066] text-black flex items-center justify-center"><Flame size={21} /></div></div><button type="button" onClick={() => openTeaching(teachings[0])} className="mt-4 h-10 px-4 bg-[#FFE066] text-black border-[2px] border-white rounded-full font-black text-[11px] uppercase">Start <ArrowRight size={14} className="inline" /></button></section>
      {teachings.length === 0 ? <section className="bg-white border-[3px] border-black rounded-[22px] p-5 brutal-shadow text-center"><div className="w-12 h-12 mx-auto rounded-full bg-[#FFE066] border-[2.5px] border-black flex items-center justify-center"><Sparkles size={22} /></div><h2 className="font-black text-[18px] mt-3">No new teachings yet</h2><p className="text-[12px] font-bold opacity-60 mt-1">Check back soon for the next community drop.</p></section> : <section className="space-y-3"><div className="flex items-center gap-2 px-1"><Megaphone size={18} /><h2 className="font-black text-[17px] tracking-tight">The next useful thing</h2></div>{teachings.map((teaching) => <TeachingCard key={teaching.id} teaching={teaching} saved={saved.has(teaching.id)} completed={completed.has(teaching.id)} onOpen={() => openTeaching(teaching)} onSave={() => toggleSave(teaching)} />)}</section>}
      <section className="bg-[#BEF264] border-[3px] border-black rounded-[20px] p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><ZapIcon /> Community challenge</div><h2 className="font-black text-[19px] leading-tight mt-1">Ask one better question today</h2><p className="text-[12px] font-bold mt-1">Skip the interview question. Ask something that reveals personality, then share something about yourself.</p></div><span className="bg-black text-[#FFE066] px-2 py-1 rounded-full text-[10px] font-black shrink-0">+25 XP</span></div><button type="button" onClick={() => onAwardXp?.(25, "Completed community challenge")} className="mt-3 h-10 px-4 bg-white border-[2px] border-black rounded-full font-black text-[11px] uppercase">I&apos;m in <Check size={14} className="inline" /></button></section>
      <section className="bg-[#111] text-white border-[3px] border-black rounded-[22px] p-5 brutal-shadow"><div className="flex items-start gap-3"><div className="w-10 h-10 rounded-full bg-[#FFE066] text-black border-[2px] border-white flex items-center justify-center shrink-0">{isAdmin ? <ShieldCheck size={19} /> : <LockKeyhole size={18} />}</div><div><h2 className="font-black text-[16px]">A one-way teaching channel</h2><p className="text-[11px] font-bold opacity-70 mt-1">Only verified admins publish guidance. Everyone else gets useful lessons without the noise.</p></div></div>{isAdmin && <button type="button" onClick={onOpenAdmin} className="w-full h-11 mt-4 bg-[#FDA4AF] text-black border-[3px] border-white rounded-full font-black text-[12px] uppercase flex items-center justify-center gap-2">Open teaching controls <ArrowRight size={16} /></button>}</section>
    </div>
  );
};

function TeachingCard({ teaching, saved, completed, onOpen, onSave }: { key?: string; teaching: CommunityTeaching; saved: boolean; completed: boolean; onOpen: () => void; onSave: () => void }) {
  return <article className={`${getAccentClass(teaching.accent)} border-[3px] border-black rounded-[22px] p-4 brutal-shadow-sm`}><div className="flex items-center justify-between gap-3 mb-3"><span className="text-[10px] font-black uppercase tracking-widest">{teaching.category} • {teaching.type}</span><button type="button" onClick={onSave} aria-label={saved ? "Remove saved teaching" : "Save teaching"}><Bookmark size={17} fill={saved ? "currentColor" : "none"} /></button></div><h3 className="font-black text-[22px] tracking-tight leading-none">{teaching.title}</h3><p className="mt-2 text-[13px] font-bold leading-relaxed max-w-[520px]">{teaching.subtitle}</p><div className="mt-4 flex items-center justify-between gap-3"><span className="text-[10px] font-black uppercase">{teaching.readTime} min read • +{teaching.xp} XP {completed ? "• Done" : ""}</span><button type="button" onClick={onOpen} className="bg-white/80 text-black border-[2px] border-black rounded-full px-3 py-1.5 text-[10px] font-black uppercase">Read teaching <ChevronRight size={13} className="inline" /></button></div></article>;
}

function ReadingSection({ title, text, accent = false }: { title: string; text: string; accent?: boolean }) {
  return <section className={accent ? "bg-[#FFE066] border-[2px] border-black rounded-[14px] p-3" : ""}><h2 className="text-[11px] font-black uppercase tracking-widest mb-1">{title}</h2><p className="text-[14px] font-bold leading-relaxed">{text}</p></section>;
}

function ExampleCard({ title, text, dark = false }: { title: string; text: string; dark?: boolean }) {
  return <div className={`${dark ? "bg-black text-white" : "bg-[#BEF264]"} border-[2px] border-black rounded-[14px] p-3`}><div className="text-[10px] font-black uppercase tracking-widest mb-1">{title}</div><p className="text-[13px] font-bold italic">&quot;{text}&quot;</p></div>;
}

function MessageBubble() { return <MessageCircleFallback />; }
function MessageCircleFallback() { return <span className="text-[13px]">💬</span>; }
function ZapIcon() { return <span>⚡</span>; }
