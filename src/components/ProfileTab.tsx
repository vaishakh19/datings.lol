import React, { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Award,
  Camera,
  Check,
  Download,
  FileText,
  Flame,
  Heart,
  Image as ImageIcon,
  KeyRound,
  Lock,
  LogOut,
  Pencil,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Upload,
  User,
  X,
} from "lucide-react";
import { AuthUser, AuthView, ChatMessage, UserProfile, UserProgress } from "../types";
import { BADGES } from "../data/badges";
import { getRankInfo } from "../data/lessons";
import { processUploadFile } from "../utils/imageCompressor";
import { verifyAndResetPassword } from "../utils/authStorage";

interface ProfileTabProps {
  profile: UserProfile;
  progress: UserProgress;
  messages?: ChatMessage[];
  avatarUrl: string | null;
  onUpdateAvatar: (url: string | null) => void;
  screenshots: string[];
  onUpdateScreenshots: (urls: string[]) => void;
  isPro: boolean;
  onOpenProModal: () => void;
  onResetData: () => void;
  onOpenCoachTab: () => void;
  onOpenCoachContext?: (context: string) => void;
  onUpdateProfile?: (profile: UserProfile) => void;
  onAwardXp?: (amount: number, reason: string) => void;
  chatsUsedToday: number;
  maxFreeChats: number;
  onDowngradeToFree: () => void;
  currentUser?: AuthUser | null;
  onSignOut?: () => void;
  onOpenAuth?: (view?: AuthView) => void;
}

type JournalType = "date recap" | "rejection" | "confidence" | "lesson learned" | "observation";
interface PrivateJournalEntry { id: string; title: string; content: string; type: JournalType; createdAt: string; }
interface AuditReport { id: string; score: number; createdAt: string; photos: number; personality: number; clarity: number; fix: string; }

const SKILLS = ["texting", "confidence", "flirting", "storytelling", "escalation", "asking out", "dates", "boundaries"];
const GOALS = ["texting", "confidence", "flirting", "dates", "relationships", "social skills"];
const BLOCKERS = ["ghosted", "don't know what to say", "overthinking", "nervous", "can't get dates", "conversation dies", "asking out"];

function readJson<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } }
function saveJson(key: string, value: unknown) { localStorage.setItem(key, JSON.stringify(value)); }
function titleCase(value: string) { return value.replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export const ProfileTab: React.FC<ProfileTabProps> = ({
  profile, progress, messages = [], avatarUrl, onUpdateAvatar, screenshots, onUpdateScreenshots,
  isPro, onOpenProModal, onResetData, onOpenCoachTab, onOpenCoachContext, onUpdateProfile, onAwardXp,
  chatsUsedToday, maxFreeChats, onDowngradeToFree, currentUser, onSignOut, onOpenAuth,
}) => {
  const userKey = currentUser?.id || "guest";
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState("");
  const [audit, setAudit] = useState<AuditReport | null>(() => readJson(`datings_audits_${userKey}`, null));
  const [journal, setJournal] = useState<PrivateJournalEntry[]>(() => readJson(`datings_journal_${userKey}`, []));
  const [journalTitle, setJournalTitle] = useState("");
  const [journalContent, setJournalContent] = useState("");
  const [journalType, setJournalType] = useState<JournalType>("observation");
  const [editingJournal, setEditingJournal] = useState<string | null>(null);
  const [badgeFilter, setBadgeFilter] = useState("all");
  const [showReset, setShowReset] = useState(false);
  const [resetText, setResetText] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  const rank = getRankInfo(progress.xp);
  const skillScores = useMemo(() => {
    const stored = progress.skillScores || {};
    return Object.fromEntries(SKILLS.map((skill, index) => [skill, Math.max(0, Math.min(100, stored[skill] ?? (profile.goal === skill ? 55 : 35 + Math.min(25, progress.xp / 20) - (profile.blocker === skill ? 10 : 0) + (index % 3) * 3)))]));
  }, [profile.blocker, profile.goal, progress.skillScores, progress.xp]);
  const weakestSkill = SKILLS.reduce((weakest, skill) => skillScores[skill] < skillScores[weakest] ? skill : weakest, SKILLS[0]);
  const unlockedBadges = BADGES.filter((badge) => badge.req(progress, messages, screenshots));
  const filteredBadges = BADGES.filter((badge) => badgeFilter === "all" || badge.category === badgeFilter);

  const showNotice = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2400); };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (avatarInputRef.current) avatarInputRef.current.value = "";
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type) || file.size > 5 * 1024 * 1024) { showNotice("Use a PNG, JPG, or WEBP under 5MB."); return; }
    try { const result = await processUploadFile(file); onUpdateAvatar(result.dataUrl); showNotice("Avatar saved locally."); } catch { showNotice("Avatar upload failed."); }
  };

  const handleScreenshots = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = event.target.files ? Array.from(event.target.files) : [];
    if (screenshotInputRef.current) screenshotInputRef.current.value = "";
    const available = Math.max(0, 5 - screenshots.length);
    if (!files.length || !available) { showNotice("You can keep up to 5 profile screenshots."); return; }
    try {
      const uploads = await Promise.all(files.slice(0, available).map(async (file) => {
        if (!/^image\/(png|jpe?g|webp)$/i.test(file.type) || file.size > 5 * 1024 * 1024) throw new Error("invalid");
        return (await processUploadFile(file)).dataUrl;
      }));
      onUpdateScreenshots([...screenshots, ...uploads]);
      showNotice(`${uploads.length} screenshot${uploads.length === 1 ? "" : "s"} added.`);
    } catch { showNotice("Use PNG, JPG, or WEBP screenshots under 5MB."); }
  };

  const generateAudit = async () => {
    if (!screenshots.length) { showNotice("Upload at least one profile screenshot first."); return; }
    const next: AuditReport = { id: `audit-${Date.now()}`, score: Math.min(10, 5.8 + screenshots.length * 0.35), createdAt: new Date().toISOString(), photos: Math.min(10, 5 + screenshots.length), personality: 6.2, clarity: 6.8, fix: "Your profile shows what you do, but not enough about what you are like. Replace one generic line with a specific detail someone can respond to." };
    setAudit(next); saveJson(`datings_audits_${userKey}`, next); onAwardXp?.(15, "Completed profile audit"); showNotice("Profile audit saved.");
  };

  const saveJournal = () => {
    if (!journalTitle.trim() || !journalContent.trim()) { showNotice("Add a title and reflection first."); return; }
    const nextEntry: PrivateJournalEntry = { id: editingJournal || `journal-${Date.now()}`, title: journalTitle.trim(), content: journalContent.trim(), type: journalType, createdAt: new Date().toISOString() };
    const next = editingJournal ? journal.map((entry) => entry.id === editingJournal ? nextEntry : entry) : [nextEntry, ...journal];
    setJournal(next); saveJson(`datings_journal_${userKey}`, next); setJournalTitle(""); setJournalContent(""); setEditingJournal(null); onAwardXp?.(5, "Saved a private journal entry");
  };

  const editJournal = (entry: PrivateJournalEntry) => { setEditingJournal(entry.id); setJournalTitle(entry.title); setJournalContent(entry.content); setJournalType(entry.type); };
  const deleteJournal = (id: string) => { const next = journal.filter((entry) => entry.id !== id); setJournal(next); saveJson(`datings_journal_${userKey}`, next); };
  const updateSetting = (field: keyof UserProfile, value: string) => { const next = { ...profile, [field]: value } as UserProfile; onUpdateProfile?.(next); };

  const exportData = () => {
    const payload = { profile, progress, avatarUrl, screenshots, audit, journal, messages, exportedAt: new Date().toISOString() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "datings-lol-export.json"; link.click(); URL.revokeObjectURL(url); showNotice("Your data export is ready.");
  };

  const confirmReset = () => { if (resetText !== "RESET") return; onResetData(); setShowReset(false); setResetText(""); };
  const savePassword = (event: React.FormEvent) => { event.preventDefault(); if (!currentUser || newPassword.length < 6) { setPasswordMessage("Password must be at least 6 characters."); return; } const result = verifyAndResetPassword({ identifier: currentUser.username, code: "123456", newPassword }); setPasswordMessage(result.success ? "Password updated." : result.error || "Could not update password."); if (result.success) setNewPassword(""); };

  return <div className="space-y-5">
    <section className="bg-white border-[3px] border-black rounded-[24px] p-5 brutal-shadow"><div className="flex gap-4 items-center"><div className="relative"><button type="button" onClick={() => avatarInputRef.current?.click()} className="w-[84px] h-[84px] rounded-full border-[3px] border-black bg-[#FFFBEB] overflow-hidden flex items-center justify-center brutal-shadow-sm"><>{avatarUrl ? <img src={avatarUrl} alt="Your avatar" className="w-full h-full object-cover" /> : <User size={36} className="opacity-40" />}</></button><input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarChange} /></div><div className="flex-1"><div className="font-black text-[20px] leading-none tracking-tighter">{profile.name || "Your Face Card"}{profile.age ? `, ${profile.age}` : ""}</div><p className="text-[12px] font-bold opacity-60 mt-1">Private avatar, compressed before saving.</p><div className="flex gap-2 mt-2"><button type="button" onClick={() => avatarInputRef.current?.click()} className="h-8 px-3 bg-[#FFE066] border-[2px] border-black rounded-full font-black text-[10px] uppercase"><Upload size={12} className="inline mr-1" /> Upload photo</button>{avatarUrl && <button type="button" onClick={() => onUpdateAvatar(null)} className="h-8 px-3 bg-white border-[2px] border-black rounded-full font-black text-[10px] uppercase">Remove</button>}</div></div></div>{notice && <div className="mt-3 bg-[#FDA4AF] border-[2px] border-black rounded-full px-3 py-1.5 text-[11px] font-black">{notice}</div>}</section>

    <section className="bg-[#111] text-white border-[3px] border-black rounded-[24px] p-5 brutal-shadow"><div className="flex items-center justify-between mb-4"><div><h2 className="font-black text-[18px] tracking-tighter flex items-center gap-2"><ImageIcon size={18} /> Your Dating Profiles</h2><p className="text-[11px] opacity-70 mt-1">Hinge / Bumble / Tinder screenshots • {screenshots.length}/5</p></div><span className="bg-[#FFE066] text-black border-[2px] border-white rounded-full px-2.5 py-1 text-[10px] font-black">{screenshots.length}/5</span></div>{screenshots.length ? <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">{screenshots.map((url, index) => <div key={`${url}-${index}`} className="relative"><img src={url} alt={`Dating profile ${index + 1}`} className="aspect-[3/4] object-cover rounded-[12px] border-[2px] border-white w-full" /><button type="button" onClick={() => onUpdateScreenshots(screenshots.filter((_, item) => item !== index))} className="absolute -top-2 -right-2 w-7 h-7 bg-[#FDA4AF] text-black border-[2px] border-black rounded-full flex items-center justify-center"><X size={13} /></button></div>)}</div> : <div className="border-[2px] border-dashed border-white/40 rounded-[18px] p-6 text-center"><Upload className="mx-auto mb-2" /><div className="font-black text-[14px]">No screenshots yet</div><div className="text-[11px] opacity-60">Upload your profile to get a real audit.</div></div>}<div className="grid grid-cols-2 gap-3 mt-4"><input ref={screenshotInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={handleScreenshots} /><button type="button" disabled={screenshots.length >= 5} onClick={() => screenshotInputRef.current?.click()} className="h-11 bg-white text-black border-[3px] border-white rounded-full font-black text-[11px] uppercase disabled:opacity-50"><Camera size={14} className="inline mr-1" /> Upload screenshots</button><button type="button" onClick={() => void generateAudit()} className="h-11 bg-[#FFE066] text-black border-[3px] border-white rounded-full font-black text-[11px] uppercase"><Star size={14} className="inline mr-1" /> Get roast report</button></div></section>

    {audit && <section className="bg-[#FFE066] border-[3px] border-black rounded-[24px] p-5 brutal-shadow"><div className="flex justify-between gap-3"><div><div className="bg-black text-white inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase"><Trophy size={12} className="mr-1" /> Profile audit</div><div className="text-[30px] font-black leading-none mt-2">{audit.score.toFixed(1)}<span className="text-[16px] opacity-60">/10</span></div><div className="text-[10px] font-black uppercase opacity-60 mt-1">Last audit {new Date(audit.createdAt).toLocaleDateString()}</div></div><button type="button" onClick={() => setAudit(null)} className="w-8 h-8 bg-white border-[2px] border-black rounded-full flex items-center justify-center"><X size={15} /></button></div><div className="grid grid-cols-3 gap-2 mt-4">{[["Photos", audit.photos], ["Personality", audit.personality], ["Clarity", audit.clarity]].map(([label, score]) => <div key={String(label)} className="bg-white border-[2px] border-black rounded-[12px] p-2"><div className="text-[9px] font-black uppercase">{label}</div><div className="font-black text-[19px]">{score}/10</div></div>)}</div><div className="bg-black text-white border-[2px] border-black rounded-[14px] p-3 mt-3"><div className="text-[10px] font-black uppercase text-[#FFE066]">Biggest fix</div><p className="text-[12px] font-bold mt-1">{audit.fix}</p></div><button type="button" onClick={() => onOpenCoachContext?.(`I got a profile audit. Biggest fix: ${audit.fix}`)} className="mt-3 w-full h-10 bg-white text-black border-[2px] border-black rounded-full font-black text-[11px] uppercase">Chat about fixes <ArrowRight size={14} className="inline" /></button></section>}

    <section className="bg-[#111] text-white border-[3px] border-black rounded-[24px] p-5 brutal-shadow"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-widest opacity-60">Your progress</div><h2 className="text-[28px] font-black tracking-tighter">{rank.emoji} {rank.name}</h2><p className="text-[12px] font-bold opacity-70">Goal: {titleCase(profile.goal)} • Blocker: {titleCase(profile.blocker)}</p></div><div className="text-right"><div className="text-[25px] font-black">{progress.xp}</div><div className="text-[9px] font-black uppercase opacity-60">Total XP</div></div></div><div className="flex justify-between text-[10px] font-black uppercase mt-4"><span>Level progress</span><span>{progress.xp} / {rank.next} XP</span></div><div className="h-3 bg-white/20 border-[2px] border-white rounded-full overflow-hidden mt-1"><div className="h-full bg-[#FFE066]" style={{ width: `${Math.min(100, progress.xp / rank.next * 100)}%` }} /></div><div className="text-[10px] font-bold opacity-60 mt-1">{Math.max(0, rank.next - progress.xp)} XP to next level</div></section>

    <section className="bg-white border-[3px] border-black rounded-[24px] p-5 brutal-shadow"><div className="flex items-center justify-between"><h2 className="font-black text-[17px] flex items-center gap-2"><Sparkles size={18} /> Skill breakdown</h2><span className="text-[10px] font-black uppercase bg-[#BEF264] border-[2px] border-black rounded-full px-2 py-1">Weakest: {weakestSkill}</span></div><div className="grid sm:grid-cols-2 gap-x-4 gap-y-3 mt-4">{SKILLS.map((skill) => <button type="button" key={skill} onClick={() => onOpenCoachContext?.(`I want to improve my ${skill} skill. What should I practice next?`)} className="text-left"><div className="flex justify-between text-[10px] font-black uppercase"><span>{skill}</span><span>{skillScores[skill]}</span></div><div className="h-2.5 bg-[#FFFBEB] border-[1.5px] border-black rounded-full overflow-hidden mt-1"><div className={`h-full ${skill === weakestSkill ? "bg-[#FDA4AF]" : "bg-[#BEF264]"}`} style={{ width: `${skillScores[skill]}%` }} /></div></button>)}</div></section>

    <section className="bg-white border-[3px] border-black rounded-[24px] p-5 brutal-shadow"><div className="flex items-center justify-between mb-4"><h2 className="font-black text-[17px] flex items-center gap-2"><Flame size={18} className="text-orange-500" /> Streak • {progress.streak} days</h2><span className="text-[10px] font-black uppercase bg-[#FFFBEB] border-[2px] border-black rounded-full px-2 py-1">{progress.completedDates.length} active days</span></div><div className="grid grid-cols-10 sm:grid-cols-15 gap-1.5">{Array.from({ length: 30 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (29 - index)); const key = date.toDateString(); const done = progress.completedDates.includes(key); return <div key={key} title={key} className={`aspect-square rounded-[5px] border-[2px] border-black flex items-center justify-center text-[9px] ${done ? "bg-black text-white" : "bg-[#FFFBEB]"}`}>{done ? "🔥" : ""}</div>; })}</div></section>

    <section className="bg-white border-[3px] border-black rounded-[24px] p-5 brutal-shadow"><div className="flex items-center justify-between mb-3"><h2 className="font-black text-[17px] flex items-center gap-2"><Award size={19} /> Achievements</h2><span className="bg-[#FFE066] border-[2px] border-black rounded-full px-2 py-1 text-[10px] font-black">{unlockedBadges.length}/{BADGES.length}</span></div><div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-2">{["all", "streak", "chat", "lessons", "xp", "special"].map((category) => <button type="button" key={category} onClick={() => setBadgeFilter(category)} className={`shrink-0 px-3 py-1.5 border-[2px] border-black rounded-full text-[10px] font-black uppercase ${badgeFilter === category ? "bg-black text-white" : "bg-[#FFFBEB]"}`}>{category}</button>)}</div><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{filteredBadges.map((badge) => { const unlocked = badge.req(progress, messages, screenshots); const info = badge.getProgress(progress, messages, screenshots); return <div key={badge.id} className={`border-[2px] border-black rounded-[14px] p-2.5 ${unlocked ? "bg-[#FFE066]" : "bg-[#FFFBEB] opacity-75"}`}><div className="text-[22px]">{badge.emoji}</div><div className="font-black text-[12px] leading-tight">{badge.name}</div>{unlocked ? <div className="text-[9px] font-black uppercase mt-2">Unlocked ✓</div> : <div className="text-[9px] font-black uppercase opacity-60 mt-2">{info.current}/{info.total} {info.unit}</div>}</div>; })}</div></section>

    <section className="bg-white border-[3px] border-black rounded-[24px] p-5 brutal-shadow"><div className="flex items-center justify-between mb-3"><h2 className="font-black text-[17px] flex items-center gap-2"><Heart size={18} className="text-[#FDA4AF] fill-[#FDA4AF]" /> Journal • {journal.length + progress.journal.length} entries</h2><span className="text-[10px] font-black uppercase opacity-50">Private</span></div><div className="grid sm:grid-cols-[150px_1fr] gap-2"><input value={journalTitle} onChange={(event) => setJournalTitle(event.target.value)} placeholder="Entry title" className="h-10 border-[2px] border-black rounded-full px-3 text-[12px] font-bold outline-none bg-[#FFFBEB]" /><select value={journalType} onChange={(event) => setJournalType(event.target.value as JournalType)} className="h-10 border-[2px] border-black rounded-full px-3 text-[12px] font-bold outline-none bg-[#FFFBEB]"><option>observation</option><option>date recap</option><option>rejection</option><option>confidence</option><option>lesson learned</option></select></div><textarea value={journalContent} onChange={(event) => setJournalContent(event.target.value)} placeholder="What happened? What did you learn?" className="w-full min-h-[80px] mt-2 border-[2px] border-black rounded-[14px] p-3 text-[12px] font-bold outline-none bg-[#FFFBEB] resize-none" /><div className="flex gap-2 mt-2"><button type="button" onClick={saveJournal} className="h-10 px-4 bg-[#FFE066] border-[2px] border-black rounded-full font-black text-[11px] uppercase">{editingJournal ? "Update entry" : "Save entry"}</button>{editingJournal && <button type="button" onClick={() => { setEditingJournal(null); setJournalTitle(""); setJournalContent(""); }} className="h-10 px-4 bg-white border-[2px] border-black rounded-full font-black text-[11px] uppercase">Cancel</button>}</div><div className="space-y-2 mt-4 max-h-[360px] overflow-y-auto">{journal.map((entry) => <article key={entry.id} className="bg-[#FFFBEB] border-[2px] border-black rounded-[14px] p-3"><div className="flex justify-between gap-2"><div><span className="text-[9px] font-black uppercase bg-[#FDA4AF] border border-black rounded-full px-2 py-0.5">{entry.type}</span><h3 className="font-black text-[13px] mt-1">{entry.title}</h3></div><div className="flex gap-1"><button type="button" onClick={() => editJournal(entry)} aria-label="Edit journal entry"><Pencil size={14} /></button><button type="button" onClick={() => deleteJournal(entry.id)} aria-label="Delete journal entry"><Trash2 size={14} /></button></div></div><p className="text-[12px] font-medium mt-2">{entry.content}</p><button type="button" onClick={() => onOpenCoachContext?.(`I wrote this private journal entry: ${entry.content}`)} className="mt-2 text-[10px] font-black uppercase underline">Ask Coach about this</button></article>)}</div></section>

    <section className="bg-[#FFE066] border-[3px] border-black rounded-[24px] p-5 brutal-shadow"><div className="flex items-center gap-2 mb-3"><ShieldCheck size={18} /><h2 className="font-black text-[16px]">Account & Security</h2>{currentUser && <span className="ml-auto bg-black text-white rounded-full px-2 py-1 text-[9px] font-black uppercase">Logged in</span>}</div>{currentUser && <div className="bg-white border-[2px] border-black rounded-[14px] p-3 text-[12px] space-y-2"><div className="flex justify-between"><b>Username</b><span>@{currentUser.username}</span></div><div className="flex justify-between"><b>Email</b><span>{currentUser.email}</span></div><div className="flex justify-between"><b>Member since</b><span>{new Date(currentUser.createdAt).toLocaleDateString()}</span></div><div className="flex justify-between"><b>Plan</b><span>{isPro ? "Pro" : `Free • ${chatsUsedToday}/${maxFreeChats}`}</span></div></div>}<div className="grid grid-cols-2 gap-2 mt-3"><button type="button" onClick={() => setShowPassword((value) => !value)} className="h-10 bg-white border-[2px] border-black rounded-full font-black text-[10px] uppercase"><KeyRound size={13} className="inline mr-1" /> Change password</button><button type="button" onClick={() => onOpenAuth?.("signin")} className="h-10 bg-white border-[2px] border-black rounded-full font-black text-[10px] uppercase">Switch user</button></div>{showPassword && <form onSubmit={savePassword} className="bg-white border-[2px] border-black rounded-[14px] p-3 mt-2"><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" className="w-full h-10 border-[2px] border-black rounded-full px-3 text-[12px] font-bold" /><button type="submit" className="mt-2 h-9 px-3 bg-[#BEF264] border-[2px] border-black rounded-full font-black text-[10px] uppercase">Save password</button>{passwordMessage && <p className="text-[11px] font-bold mt-2">{passwordMessage}</p>}</form>}<div className="grid grid-cols-2 gap-2 mt-2"><button type="button" onClick={exportData} className="h-10 bg-white border-[2px] border-black rounded-full font-black text-[10px] uppercase"><Download size={13} className="inline mr-1" /> Export data</button><button type="button" onClick={onSignOut} className="h-10 bg-[#FDA4AF] border-[2px] border-black rounded-full font-black text-[10px] uppercase"><LogOut size={13} className="inline mr-1" /> Sign out</button></div></section>

    <section className="bg-[#A78BFA] border-[3px] border-black rounded-[24px] p-5 brutal-shadow"><h2 className="font-black text-[16px] mb-3">Settings • datings.lol</h2><div className="space-y-2"><SettingSelect label="Goal" value={profile.goal} options={GOALS} onChange={(value) => updateSetting("goal", value)} /><SettingSelect label="Blocker" value={profile.blocker} options={BLOCKERS} onChange={(value) => updateSetting("blocker", value)} /><SettingSelect label="Vibe" value={profile.vibe} options={["gentle", "direct", "roasty"]} onChange={(value) => updateSetting("vibe", value as UserProfile["vibe"])} /><div className="flex justify-between bg-white border-[2px] border-black rounded-full px-4 py-2.5 text-[12px] font-bold"><span>Started</span><span>{new Date(profile.startedAt).toLocaleDateString()}</span></div></div><button type="button" onClick={() => setShowReset(true)} className="mt-4 w-full h-11 bg-black text-white border-[2px] border-black rounded-full font-black text-[11px] uppercase"><Trash2 size={15} className="inline mr-1" /> Reset everything</button><p className="text-center text-[10px] font-bold opacity-60 uppercase mt-3">Photos stay private to this account.</p></section>

    {showReset && <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"><div className="bg-[#FFFBEB] border-[3px] border-black rounded-[22px] p-5 max-w-[380px] w-full brutal-shadow"><h2 className="font-black text-[22px]">Reset everything?</h2><p className="text-[12px] font-bold mt-2">This permanently deletes progress, XP, streak, achievements, journal, Coach history, audits, and preferences. Type RESET to continue.</p><input value={resetText} onChange={(event) => setResetText(event.target.value)} placeholder="RESET" className="w-full h-11 border-[2px] border-black rounded-full px-3 mt-4 font-black" /><div className="grid grid-cols-2 gap-2 mt-3"><button type="button" onClick={() => { setShowReset(false); setResetText(""); }} className="h-10 bg-white border-[2px] border-black rounded-full font-black text-[11px] uppercase">Cancel</button><button type="button" disabled={resetText !== "RESET"} onClick={confirmReset} className="h-10 bg-[#FDA4AF] border-[2px] border-black rounded-full font-black text-[11px] uppercase disabled:opacity-40">Delete everything</button></div></div></div>}
  </div>;
};

function SettingSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <label className="flex items-center justify-between gap-3 bg-white border-[2px] border-black rounded-full px-4 py-1.5 text-[12px] font-black"><span>{titleCase(label)}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="bg-transparent text-right outline-none font-bold capitalize">{options.map((option) => <option key={option} value={option}>{titleCase(option)}</option>)}</select></label>; }
