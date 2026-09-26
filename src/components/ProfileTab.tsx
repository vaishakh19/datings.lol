import React, { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Award,
  Camera,
  Check,
  Download,
  Flame,
  Heart,
  Image as ImageIcon,
  KeyRound,
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

import {
  AuthUser,
  AuthView,
  ChatMessage,
  UserProfile,
  UserProgress,
} from "../types";

import { BADGES } from "../data/badges";
import { getRankInfo } from "../data/lessons";
import { processUploadFile } from "../utils/imageCompressor";
import { useAuth } from "../context/AuthContext";

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

type JournalType =
  | "date recap"
  | "rejection"
  | "confidence"
  | "lesson learned"
  | "observation";

interface PrivateJournalEntry {
  id: string;
  title: string;
  content: string;
  type: JournalType;
  createdAt: string;
}

interface AuditReport {
  id: string;
  score: number;
  createdAt: string;
  photos: number;
  personality: number;
  clarity: number;
  fix: string;
}

const SKILLS = [
  "texting",
  "confidence",
  "flirting",
  "storytelling",
  "escalation",
  "asking out",
  "dates",
  "boundaries",
];

const GOALS = [
  "texting",
  "confidence",
  "flirting",
  "dates",
  "relationships",
  "social skills",
];

const BLOCKERS = [
  "ghosted",
  "don't know what to say",
  "overthinking",
  "nervous",
  "can't get dates",
  "conversation dies",
  "asking out",
];

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  profile,
  progress,
  messages = [],
  avatarUrl,
  onUpdateAvatar,
  screenshots,
  onUpdateScreenshots,
  isPro,
  onOpenProModal,
  onResetData,
  onOpenCoachTab,
  onOpenCoachContext,
  onUpdateProfile,
  onAwardXp,
  chatsUsedToday,
  maxFreeChats,
  onDowngradeToFree,
  currentUser,
  onSignOut,
  onOpenAuth,
}) => {
  const { updatePassword } = useAuth();
  const userKey = currentUser?.id || "guest";

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  const [notice, setNotice] = useState("");

  const [audit, setAudit] = useState<AuditReport | null>(() =>
    readJson(`datings_audits_${userKey}`, null)
  );

  const [journal, setJournal] = useState<PrivateJournalEntry[]>(() =>
    readJson(`datings_journal_${userKey}`, [])
  );

  const [journalTitle, setJournalTitle] = useState("");
  const [journalContent, setJournalContent] = useState("");
  const [journalType, setJournalType] =
    useState<JournalType>("observation");
  const [editingJournal, setEditingJournal] = useState<string | null>(null);

  const [badgeFilter, setBadgeFilter] = useState("all");

  const [showReset, setShowReset] = useState(false);
  const [resetText, setResetText] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  const [showAllSkills, setShowAllSkills] = useState(false);

  const rank = getRankInfo(progress.xp);

  const skillScores = useMemo(() => {
    const stored = progress.skillScores || {};

    return Object.fromEntries(
      SKILLS.map((skill, index) => [
        skill,
        Math.max(
          0,
          Math.min(
            100,
            stored[skill] ??
              (profile.goal === skill
                ? 55
                : 35 +
                  Math.min(25, progress.xp / 20) -
                  (profile.blocker === skill ? 10 : 0) +
                  (index % 3) * 3)
          )
        ),
      ])
    );
  }, [
    profile.blocker,
    profile.goal,
    progress.skillScores,
    progress.xp,
  ]);

  const weakestSkill = SKILLS.reduce(
    (weakest, skill) =>
      skillScores[skill] < skillScores[weakest] ? skill : weakest,
    SKILLS[0]
  );

  const unlockedBadges = BADGES.filter((badge) =>
    badge.req(progress, messages, screenshots)
  );

  const filteredBadges = BADGES.filter(
    (badge) =>
      badgeFilter === "all" || badge.category === badgeFilter
  );

  const lessonsCompleted =
    progress.lessonsViewed?.length || 0;

  const levelProgress = Math.min(
    100,
    (progress.xp / rank.next) * 100
  );

  const showNotice = (message: string) => {
    setNotice(message);

    window.setTimeout(() => {
      setNotice("");
    }, 2400);
  };

  const handleAvatarChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }

    if (!file) return;

    if (
      !/^image\/(png|jpe?g|webp)$/i.test(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      showNotice("Use a PNG, JPG, or WEBP under 5MB.");
      return;
    }

    try {
      const result = await processUploadFile(file);

      onUpdateAvatar(result.dataUrl);

      showNotice("Profile photo updated.");
    } catch {
      showNotice("Avatar upload failed.");
    }
  };

  const handleScreenshots = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files: File[] = event.target.files
      ? Array.from(event.target.files)
      : [];

    if (screenshotInputRef.current) {
      screenshotInputRef.current.value = "";
    }

    const available = Math.max(0, 5 - screenshots.length);

    if (!files.length || !available) {
      showNotice("You can keep up to 5 profile screenshots.");
      return;
    }

    try {
      const uploads = await Promise.all(
        files.slice(0, available).map(async (file) => {
          if (
            !/^image\/(png|jpe?g|webp)$/i.test(file.type) ||
            file.size > 5 * 1024 * 1024
          ) {
            throw new Error("invalid");
          }

          return (await processUploadFile(file)).dataUrl;
        })
      );

      onUpdateScreenshots([...screenshots, ...uploads]);

      showNotice(
        `${uploads.length} screenshot${
          uploads.length === 1 ? "" : "s"
        } added.`
      );
    } catch {
      showNotice("Use PNG, JPG, or WEBP screenshots under 5MB.");
    }
  };

  const generateAudit = async () => {
    if (!screenshots.length) {
      showNotice("Upload at least one profile screenshot first.");
      return;
    }

    const next: AuditReport = {
      id: `audit-${Date.now()}`,
      score: Math.min(
        10,
        5.8 + screenshots.length * 0.35
      ),
      createdAt: new Date().toISOString(),
      photos: Math.min(10, 5 + screenshots.length),
      personality: 6.2,
      clarity: 6.8,
      fix:
        "Your profile shows what you do, but not enough about what you are like. Replace one generic line with a specific detail someone can respond to.",
    };

    setAudit(next);

    saveJson(`datings_audits_${userKey}`, next);

    onAwardXp?.(15, "Completed profile audit");

    showNotice("Profile audit saved.");
  };

  const saveJournal = () => {
    if (!journalTitle.trim() || !journalContent.trim()) {
      showNotice("Add a title and reflection first.");
      return;
    }

    const nextEntry: PrivateJournalEntry = {
      id: editingJournal || `journal-${Date.now()}`,
      title: journalTitle.trim(),
      content: journalContent.trim(),
      type: journalType,
      createdAt: new Date().toISOString(),
    };

    const next = editingJournal
      ? journal.map((entry) =>
          entry.id === editingJournal ? nextEntry : entry
        )
      : [nextEntry, ...journal];

    setJournal(next);

    saveJson(`datings_journal_${userKey}`, next);

    setJournalTitle("");
    setJournalContent("");
    setEditingJournal(null);

    onAwardXp?.(5, "Saved a private journal entry");
  };

  const editJournal = (entry: PrivateJournalEntry) => {
    setEditingJournal(entry.id);
    setJournalTitle(entry.title);
    setJournalContent(entry.content);
    setJournalType(entry.type);
  };

  const deleteJournal = (id: string) => {
    const next = journal.filter(
      (entry) => entry.id !== id
    );

    setJournal(next);

    saveJson(`datings_journal_${userKey}`, next);
  };

  const updateSetting = (
    field: keyof UserProfile,
    value: string
  ) => {
    const next = {
      ...profile,
      [field]: value,
    } as UserProfile;

    onUpdateProfile?.(next);
  };

  const exportData = () => {
    const payload = {
      profile,
      progress,
      avatarUrl,
      screenshots,
      audit,
      journal,
      messages,
      exportedAt: new Date().toISOString(),
    };

    const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify(payload, null, 2)],
        { type: "application/json" }
      )
    );

    const link = document.createElement("a");

    link.href = url;
    link.download = "datings-lol-export.json";
    link.click();

    URL.revokeObjectURL(url);

    showNotice("Your data export is ready.");
  };

  const confirmReset = () => {
    if (resetText !== "RESET") return;

    onResetData();

    setShowReset(false);
    setResetText("");
  };

  const savePassword = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!currentUser || newPassword.length < 6) {
      setPasswordMessage(
        "Password must be at least 6 characters."
      );
      return;
    }

    const result = await updatePassword(newPassword);
    setPasswordMessage(result.error ? result.error : "Password updated.");
    if (!result.error) setNewPassword("");
  };

  const visibleSkills = showAllSkills
    ? SKILLS
    : SKILLS.slice(0, 4);

  return (
    <div className="space-y-4 pb-8">

      {/* =========================================================
          HEADER
      ========================================================= */}

      <section className="relative overflow-hidden bg-[#FFE066] border-[3px] border-black rounded-[28px] p-5 brutal-shadow">

        <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full border-[3px] border-black bg-white rotate-12 opacity-70" />

        <div className="relative flex items-center gap-4">

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() =>
                avatarInputRef.current?.click()
              }
              className="w-[82px] h-[82px] rounded-full border-[3px] border-black bg-[#FFFBEB] overflow-hidden flex items-center justify-center brutal-shadow-sm"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Your avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User
                  size={34}
                  className="opacity-40"
                />
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                avatarInputRef.current?.click()
              }
              className="absolute -right-1 -bottom-1 w-8 h-8 rounded-full bg-black text-white border-[2px] border-white flex items-center justify-center"
              aria-label="Change profile photo"
            >
              <Camera size={13} />
            </button>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="min-w-0 flex-1">

            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-black text-[25px] tracking-tighter leading-none">
                {profile.name || "Your Profile"}
                {profile.age ? `, ${profile.age}` : ""}
              </h1>

              {isPro && (
                <span className="bg-black text-[#FFE066] px-2 py-1 rounded-full text-[9px] font-black uppercase">
                  Pro
                </span>
              )}
            </div>

            <p className="text-[11px] font-bold opacity-70 mt-1">
              {rank.emoji} {rank.name} • {progress.xp} XP
            </p>

            <div className="mt-3">
              <div className="flex justify-between text-[9px] font-black uppercase">
                <span>Next level</span>
                <span>
                  {Math.max(
                    0,
                    rank.next - progress.xp
                  )}{" "}
                  XP
                </span>
              </div>

              <div className="h-2.5 bg-white border-[2px] border-black rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-black"
                  style={{
                    width: `${levelProgress}%`,
                  }}
                />
              </div>
            </div>

          </div>
        </div>

        {notice && (
          <div className="relative mt-3 bg-white border-[2px] border-black rounded-full px-3 py-2 text-[10px] font-black">
            {notice}
          </div>
        )}
      </section>


      {/* =========================================================
          DATING SNAPSHOT
      ========================================================= */}

      <section>

        <div className="flex items-end justify-between mb-2 px-1">
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest opacity-50">
              Your current game
            </div>

            <h2 className="font-black text-[19px] tracking-tighter">
              Dating snapshot
            </h2>
          </div>

          <button
            type="button"
            onClick={() =>
              onOpenCoachContext?.(
                `My current goal is ${profile.goal} and my biggest blocker is ${profile.blocker}. Help me decide what I should work on next.`
              )
            }
            className="text-[9px] font-black uppercase underline"
          >
            Ask Coach
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">

          <SnapshotCard
            label="Goal"
            value={titleCase(profile.goal)}
            icon={<Sparkles size={15} />}
            className="bg-[#BEF264]"
          />

          <SnapshotCard
            label="Biggest blocker"
            value={titleCase(profile.blocker)}
            icon={<X size={15} />}
            className="bg-[#FDA4AF]"
          />

          <SnapshotCard
            label="Current streak"
            value={`${progress.streak} days`}
            icon={<Flame size={15} />}
            className="bg-[#FFE066]"
          />

          <SnapshotCard
            label="Lessons"
            value={`${lessonsCompleted} completed`}
            icon={<Check size={15} />}
            className="bg-white"
          />

        </div>
      </section>


      {/* =========================================================
          PROFILE HEALTH
      ========================================================= */}

      <section className="bg-[#111] text-white border-[3px] border-black rounded-[25px] p-5 brutal-shadow">

        <div className="flex justify-between gap-3 mb-4">

          <div>
            <div className="text-[9px] font-black uppercase tracking-widest opacity-50">
              Profile health
            </div>

            <h2 className="font-black text-[22px] tracking-tighter">
              Your dating profile
            </h2>

            <p className="text-[10px] font-bold opacity-60 mt-1">
              Upload screenshots and get actionable feedback.
            </p>
          </div>

          <div className="shrink-0 bg-[#FFE066] text-black border-[2px] border-white rounded-full px-2.5 py-1 h-fit text-[9px] font-black">
            {screenshots.length}/5
          </div>

        </div>

        {screenshots.length ? (
          <div className="grid grid-cols-5 gap-1.5">
            {screenshots.map((url, index) => (
              <div
                key={`${url}-${index}`}
                className="relative"
              >
                <img
                  src={url}
                  alt={`Dating profile ${index + 1}`}
                  className="aspect-[3/4] object-cover rounded-[10px] border-[2px] border-white w-full"
                />

                <button
                  type="button"
                  onClick={() =>
                    onUpdateScreenshots(
                      screenshots.filter(
                        (_, item) =>
                          item !== index
                      )
                    )
                  }
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-[#FDA4AF] text-black border-[2px] border-black rounded-full flex items-center justify-center"
                  aria-label="Remove screenshot"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="border-[2px] border-dashed border-white/30 rounded-[17px] p-6 text-center">
            <ImageIcon
              size={25}
              className="mx-auto opacity-50 mb-2"
            />

            <div className="font-black text-[13px]">
              Your profile is unreviewed
            </div>

            <div className="text-[10px] opacity-50 mt-1">
              Add your dating profile screenshots.
            </div>
          </div>
        )}

        <input
          ref={screenshotInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={handleScreenshots}
        />

        <div className="grid grid-cols-2 gap-2 mt-4">

          <button
            type="button"
            disabled={screenshots.length >= 5}
            onClick={() =>
              screenshotInputRef.current?.click()
            }
            className="h-10 bg-white text-black border-[2px] border-white rounded-full font-black text-[10px] uppercase disabled:opacity-40"
          >
            <Upload
              size={13}
              className="inline mr-1"
            />
            Add photos
          </button>

          <button
            type="button"
            onClick={() => void generateAudit()}
            className="h-10 bg-[#FFE066] text-black border-[2px] border-white rounded-full font-black text-[10px] uppercase"
          >
            <Star
              size={13}
              className="inline mr-1"
            />
            Audit profile
          </button>

        </div>
      </section>


      {/* =========================================================
          AUDIT RESULT
      ========================================================= */}

      {audit && (
        <section className="bg-[#FFE066] border-[3px] border-black rounded-[25px] p-5 brutal-shadow">

          <div className="flex justify-between">

            <div>
              <div className="inline-flex items-center bg-black text-white rounded-full px-2 py-1 text-[9px] font-black uppercase">
                <Trophy size={11} className="mr-1" />
                Profile audit
              </div>

              <div className="text-[38px] font-black tracking-tighter leading-none mt-2">
                {audit.score.toFixed(1)}
                <span className="text-[15px] opacity-50">
                  /10
                </span>
              </div>

              <div className="text-[9px] font-black uppercase opacity-50 mt-1">
                Last audit{" "}
                {new Date(
                  audit.createdAt
                ).toLocaleDateString()}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAudit(null)}
              className="w-8 h-8 bg-white border-[2px] border-black rounded-full flex items-center justify-center"
            >
              <X size={14} />
            </button>

          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              ["Photos", audit.photos],
              ["Personality", audit.personality],
              ["Clarity", audit.clarity],
            ].map(([label, score]) => (
              <div
                key={String(label)}
                className="bg-white border-[2px] border-black rounded-[12px] p-2"
              >
                <div className="text-[8px] font-black uppercase">
                  {label}
                </div>

                <div className="font-black text-[18px]">
                  {score}/10
                </div>
              </div>
            ))}
          </div>

          <div className="bg-black text-white rounded-[14px] p-3 mt-3">
            <div className="text-[9px] font-black uppercase text-[#FFE066]">
              Biggest fix
            </div>

            <p className="text-[11px] font-bold mt-1 leading-relaxed">
              {audit.fix}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              onOpenCoachContext?.(
                `I got a profile audit. Biggest fix: ${audit.fix}`
              )
            }
            className="mt-3 w-full h-10 bg-white text-black border-[2px] border-black rounded-full font-black text-[10px] uppercase"
          >
            Fix this with Coach
            <ArrowRight
              size={13}
              className="inline ml-1"
            />
          </button>

        </section>
      )}


      {/* =========================================================
          SKILLS
      ========================================================= */}

      <section className="bg-white border-[3px] border-black rounded-[25px] p-5 brutal-shadow">

        <div className="flex items-start justify-between gap-3">

          <div>
            <div className="text-[9px] font-black uppercase tracking-widest opacity-40">
              Your development
            </div>

            <h2 className="font-black text-[20px] tracking-tighter">
              Skill map
            </h2>
          </div>

          <div className="bg-[#FDA4AF] border-[2px] border-black rounded-full px-2 py-1 text-[8px] font-black uppercase">
            Focus: {weakestSkill}
          </div>

        </div>

        <div className="space-y-3 mt-4">

          {visibleSkills.map((skill) => (
            <button
              type="button"
              key={skill}
              onClick={() =>
                onOpenCoachContext?.(
                  `I want to improve my ${skill} skill. What should I practice next?`
                )
              }
              className="w-full text-left group"
            >

              <div className="flex justify-between text-[9px] font-black uppercase">
                <span>{skill}</span>

                <span>
                  {skillScores[skill]}
                </span>
              </div>

              <div className="h-2.5 bg-[#FFFBEB] border-[1.5px] border-black rounded-full overflow-hidden mt-1">
                <div
                  className={`h-full transition-all ${
                    skill === weakestSkill
                      ? "bg-[#FDA4AF]"
                      : "bg-[#BEF264]"
                  }`}
                  style={{
                    width: `${skillScores[skill]}%`,
                  }}
                />
              </div>

            </button>
          ))}

        </div>

        <button
          type="button"
          onClick={() =>
            setShowAllSkills((value) => !value)
          }
          className="mt-4 w-full h-9 border-[2px] border-black rounded-full font-black text-[9px] uppercase bg-[#FFFBEB]"
        >
          {showAllSkills
            ? "Show less"
            : `Show all ${SKILLS.length} skills`}
        </button>

        <button
          type="button"
          onClick={() =>
            onOpenCoachContext?.(
              `My weakest dating skill is ${weakestSkill}. Give me one practical exercise I can do today.`
            )
          }
          className="mt-2 w-full h-10 bg-black text-white border-[2px] border-black rounded-full font-black text-[10px] uppercase"
        >
          Practice weakest skill
          <ArrowRight
            size={13}
            className="inline ml-1"
          />
        </button>

      </section>


      {/* =========================================================
          STREAK
      ========================================================= */}

      <section className="bg-[#FDA4AF] border-[3px] border-black rounded-[25px] p-5 brutal-shadow">

        <div className="flex justify-between items-center">

          <div>
            <div className="text-[9px] font-black uppercase opacity-60">
              Consistency
            </div>

            <h2 className="font-black text-[25px] tracking-tighter">
              🔥 {progress.streak} day streak
            </h2>
          </div>

          <div className="text-right">
            <div className="font-black text-[20px]">
              {progress.completedDates.length}
            </div>

            <div className="text-[8px] font-black uppercase opacity-60">
              active days
            </div>
          </div>

        </div>

        <div className="grid grid-cols-10 gap-1.5 mt-4">

          {Array.from(
            { length: 30 },
            (_, index) => {
              const date = new Date();

              date.setDate(
                date.getDate() - (29 - index)
              );

              const key = date.toDateString();

              const done =
                progress.completedDates.includes(
                  key
                );

              return (
                <div
                  key={key}
                  title={key}
                  className={`aspect-square rounded-[5px] border-[2px] border-black flex items-center justify-center text-[8px] ${
                    done
                      ? "bg-black text-white"
                      : "bg-white/60"
                  }`}
                >
                  {done ? "🔥" : ""}
                </div>
              );
            }
          )}

        </div>

      </section>


      {/* =========================================================
          ACHIEVEMENTS
      ========================================================= */}

      <section className="bg-white border-[3px] border-black rounded-[25px] p-5 brutal-shadow">

        <div className="flex items-center justify-between mb-3">

          <div>
            <div className="text-[9px] font-black uppercase opacity-40">
              Progress
            </div>

            <h2 className="font-black text-[19px] tracking-tighter flex items-center gap-2">
              <Award size={18} />
              Achievements
            </h2>
          </div>

          <span className="bg-[#FFE066] border-[2px] border-black rounded-full px-2 py-1 text-[9px] font-black">
            {unlockedBadges.length}/{BADGES.length}
          </span>

        </div>

        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-2">

          {[
            "all",
            "streak",
            "chat",
            "lessons",
            "xp",
            "special",
          ].map((category) => (
            <button
              type="button"
              key={category}
              onClick={() =>
                setBadgeFilter(category)
              }
              className={`shrink-0 px-3 py-1.5 border-[2px] border-black rounded-full text-[9px] font-black uppercase ${
                badgeFilter === category
                  ? "bg-black text-white"
                  : "bg-[#FFFBEB]"
              }`}
            >
              {category}
            </button>
          ))}

        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">

          {filteredBadges.map((badge) => {
            const unlocked = badge.req(
              progress,
              messages,
              screenshots
            );

            const info = badge.getProgress(
              progress,
              messages,
              screenshots
            );

            return (
              <div
                key={badge.id}
                className={`border-[2px] border-black rounded-[14px] p-3 ${
                  unlocked
                    ? "bg-[#FFE066]"
                    : "bg-[#FFFBEB] opacity-70"
                }`}
              >
                <div className="text-[22px]">
                  {badge.emoji}
                </div>

                <div className="font-black text-[11px] leading-tight mt-1">
                  {badge.name}
                </div>

                {unlocked ? (
                  <div className="text-[8px] font-black uppercase mt-2">
                    Unlocked ✓
                  </div>
                ) : (
                  <div className="text-[8px] font-black uppercase opacity-60 mt-2">
                    {info.current}/{info.total}{" "}
                    {info.unit}
                  </div>
                )}
              </div>
            );
          })}

        </div>
      </section>


      {/* =========================================================
          JOURNAL
      ========================================================= */}

      <section className="bg-white border-[3px] border-black rounded-[25px] p-5 brutal-shadow">

        <div className="flex items-center justify-between mb-1">

          <div>
            <div className="text-[9px] font-black uppercase opacity-40">
              Private
            </div>

            <h2 className="font-black text-[20px] tracking-tighter flex items-center gap-2">
              <Heart
                size={18}
                className="text-[#FDA4AF] fill-[#FDA4AF]"
              />
              Dating journal
            </h2>
          </div>

          <span className="text-[8px] font-black uppercase bg-[#FFFBEB] border-[2px] border-black rounded-full px-2 py-1">
            {journal.length + progress.journal.length} entries
          </span>

        </div>

        <p className="text-[10px] font-bold opacity-50 mb-4">
          Turn awkward moments into useful lessons.
        </p>

        <div className="grid sm:grid-cols-[150px_1fr] gap-2">

          <input
            value={journalTitle}
            onChange={(event) =>
              setJournalTitle(event.target.value)
            }
            placeholder="Entry title"
            className="h-10 border-[2px] border-black rounded-full px-3 text-[11px] font-bold outline-none bg-[#FFFBEB]"
          />

          <select
            value={journalType}
            onChange={(event) =>
              setJournalType(
                event.target.value as JournalType
              )
            }
            className="h-10 border-[2px] border-black rounded-full px-3 text-[11px] font-bold outline-none bg-[#FFFBEB]"
          >
            <option>observation</option>
            <option>date recap</option>
            <option>rejection</option>
            <option>confidence</option>
            <option>lesson learned</option>
          </select>

        </div>

        <textarea
          value={journalContent}
          onChange={(event) =>
            setJournalContent(event.target.value)
          }
          placeholder="What happened? What did you learn?"
          className="w-full min-h-[85px] mt-2 border-[2px] border-black rounded-[14px] p-3 text-[11px] font-bold outline-none bg-[#FFFBEB] resize-none"
        />

        <div className="flex gap-2 mt-2">

          <button
            type="button"
            onClick={saveJournal}
            className="h-10 px-4 bg-[#FFE066] border-[2px] border-black rounded-full font-black text-[10px] uppercase"
          >
            {editingJournal
              ? "Update entry"
              : "Save entry"}
          </button>

          {editingJournal && (
            <button
              type="button"
              onClick={() => {
                setEditingJournal(null);
                setJournalTitle("");
                setJournalContent("");
              }}
              className="h-10 px-4 bg-white border-[2px] border-black rounded-full font-black text-[10px] uppercase"
            >
              Cancel
            </button>
          )}

        </div>

        <div className="space-y-2 mt-4 max-h-[360px] overflow-y-auto">

          {journal.map((entry) => (
            <article
              key={entry.id}
              className="bg-[#FFFBEB] border-[2px] border-black rounded-[14px] p-3"
            >

              <div className="flex justify-between gap-2">

                <div>
                  <span className="text-[8px] font-black uppercase bg-[#FDA4AF] border border-black rounded-full px-2 py-0.5">
                    {entry.type}
                  </span>

                  <h3 className="font-black text-[12px] mt-1">
                    {entry.title}
                  </h3>
                </div>

                <div className="flex gap-1">

                  <button
                    type="button"
                    onClick={() =>
                      editJournal(entry)
                    }
                    aria-label="Edit journal entry"
                  >
                    <Pencil size={13} />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      deleteJournal(entry.id)
                    }
                    aria-label="Delete journal entry"
                  >
                    <Trash2 size={13} />
                  </button>

                </div>

              </div>

              <p className="text-[11px] font-medium mt-2 leading-relaxed">
                {entry.content}
              </p>

              <button
                type="button"
                onClick={() =>
                  onOpenCoachContext?.(
                    `I wrote this private journal entry: ${entry.content}`
                  )
                }
                className="mt-2 text-[9px] font-black uppercase underline"
              >
                Ask Coach about this
              </button>

            </article>
          ))}

        </div>
      </section>


      {/* =========================================================
          SETTINGS
      ========================================================= */}

      <section className="bg-[#A78BFA] border-[3px] border-black rounded-[25px] p-5 brutal-shadow">

        <div className="text-[9px] font-black uppercase opacity-60">
          Personalization
        </div>

        <h2 className="font-black text-[21px] tracking-tighter">
          Tune your experience
        </h2>

        <p className="text-[10px] font-bold opacity-60 mt-1 mb-4">
          These settings shape your recommendations and Coach.
        </p>

        <div className="space-y-2">

          <SettingSelect
            label="Goal"
            value={profile.goal}
            options={GOALS}
            onChange={(value) =>
              updateSetting("goal", value)
            }
          />

          <SettingSelect
            label="Blocker"
            value={profile.blocker}
            options={BLOCKERS}
            onChange={(value) =>
              updateSetting("blocker", value)
            }
          />

          <SettingSelect
            label="Vibe"
            value={profile.vibe}
            options={[
              "gentle",
              "direct",
              "roasty",
            ]}
            onChange={(value) =>
              updateSetting(
                "vibe",
                value as UserProfile["vibe"]
              )
            }
          />

          <div className="flex justify-between bg-white border-[2px] border-black rounded-full px-4 py-2.5 text-[10px] font-bold">
            <span>Started</span>
            <span>
              {new Date(
                profile.startedAt
              ).toLocaleDateString()}
            </span>
          </div>

        </div>

      </section>


      {/* =========================================================
          ACCOUNT
      ========================================================= */}

      <section className="bg-white border-[3px] border-black rounded-[25px] p-5 brutal-shadow">

        <div className="flex items-center gap-2 mb-3">

          <ShieldCheck size={18} />

          <div>
            <div className="text-[9px] font-black uppercase opacity-40">
              Account
            </div>

            <h2 className="font-black text-[18px] tracking-tighter">
              Security & data
            </h2>
          </div>

          {currentUser && (
            <span className="ml-auto bg-[#BEF264] border-[2px] border-black rounded-full px-2 py-1 text-[8px] font-black uppercase">
              Logged in
            </span>
          )}

        </div>

        {currentUser && (
          <div className="bg-[#FFFBEB] border-[2px] border-black rounded-[14px] p-3 text-[10px] space-y-2">

            <div className="flex justify-between gap-3">
              <b>Username</b>
              <span>@{currentUser.username}</span>
            </div>

            <div className="flex justify-between gap-3">
              <b>Email</b>
              <span className="truncate">
                {currentUser.email}
              </span>
            </div>

            <div className="flex justify-between gap-3">
              <b>Plan</b>
              <span>
                {isPro
                  ? "Pro"
                  : `Free • ${chatsUsedToday}/${maxFreeChats}`}
              </span>
            </div>

          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mt-3">

          <button
            type="button"
            onClick={() =>
              setShowPassword(
                (value) => !value
              )
            }
            className="h-10 bg-[#FFE066] border-[2px] border-black rounded-full font-black text-[9px] uppercase"
          >
            <KeyRound
              size={12}
              className="inline mr-1"
            />
            Password
          </button>

          <button
            type="button"
            onClick={() =>
              onOpenAuth?.("signin")
            }
            className="h-10 bg-white border-[2px] border-black rounded-full font-black text-[9px] uppercase"
          >
            Switch user
          </button>

        </div>

        {showPassword && (
          <form
            onSubmit={savePassword}
            className="bg-[#FFFBEB] border-[2px] border-black rounded-[14px] p-3 mt-2"
          >

            <input
              type="password"
              value={newPassword}
              onChange={(event) =>
                setNewPassword(event.target.value)
              }
              placeholder="New password"
              className="w-full h-10 border-[2px] border-black rounded-full px-3 text-[11px] font-bold"
            />

            <button
              type="submit"
              className="mt-2 h-9 px-3 bg-[#BEF264] border-[2px] border-black rounded-full font-black text-[9px] uppercase"
            >
              Save password
            </button>

            {passwordMessage && (
              <p className="text-[10px] font-bold mt-2">
                {passwordMessage}
              </p>
            )}

          </form>
        )}

        <div className="grid grid-cols-2 gap-2 mt-2">

          <button
            type="button"
            onClick={exportData}
            className="h-10 bg-white border-[2px] border-black rounded-full font-black text-[9px] uppercase"
          >
            <Download
              size={12}
              className="inline mr-1"
            />
            Export data
          </button>

          <button
            type="button"
            onClick={onSignOut}
            className="h-10 bg-[#FDA4AF] border-[2px] border-black rounded-full font-black text-[9px] uppercase"
          >
            <LogOut
              size={12}
              className="inline mr-1"
            />
            Sign out
          </button>

        </div>

      </section>


      {/* =========================================================
          RESET
      ========================================================= */}

      <section className="border-[2px] border-black/20 rounded-[20px] p-4">

        <div className="flex items-center gap-2">

          <Trash2
            size={15}
            className="opacity-40"
          />

          <div className="flex-1">
            <div className="font-black text-[11px]">
              Reset your journey
            </div>

            <div className="text-[9px] font-bold opacity-50">
              Delete progress, XP, streaks, journal and preferences.
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setShowReset(true)
            }
            className="h-9 px-3 bg-white border-[2px] border-black rounded-full font-black text-[8px] uppercase"
          >
            Reset
          </button>

        </div>

      </section>


      {/* =========================================================
          RESET MODAL
      ========================================================= */}

      {showReset && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">

          <div className="bg-[#FFFBEB] border-[3px] border-black rounded-[22px] p-5 max-w-[380px] w-full brutal-shadow">

            <h2 className="font-black text-[22px] tracking-tighter">
              Reset everything?
            </h2>

            <p className="text-[11px] font-bold mt-2 leading-relaxed">
              This permanently deletes progress, XP, streak,
              achievements, journal, Coach history, audits,
              and preferences.
            </p>

            <input
              value={resetText}
              onChange={(event) =>
                setResetText(event.target.value)
              }
              placeholder="Type RESET"
              className="w-full h-11 border-[2px] border-black rounded-full px-3 mt-4 font-black text-[12px]"
            />

            <div className="grid grid-cols-2 gap-2 mt-3">

              <button
                type="button"
                onClick={() => {
                  setShowReset(false);
                  setResetText("");
                }}
                className="h-10 bg-white border-[2px] border-black rounded-full font-black text-[10px] uppercase"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={resetText !== "RESET"}
                onClick={confirmReset}
                className="h-10 bg-[#FDA4AF] border-[2px] border-black rounded-full font-black text-[10px] uppercase disabled:opacity-40"
              >
                Delete everything
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};


/* =============================================================
   SMALL COMPONENTS
============================================================= */

function SnapshotCard({
  label,
  value,
  icon,
  className = "bg-white",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`${className} border-[3px] border-black rounded-[18px] p-3 brutal-shadow-sm`}
    >
      <div className="flex items-center justify-between">

        <div className="text-[8px] font-black uppercase opacity-60">
          {label}
        </div>

        <div className="opacity-70">
          {icon}
        </div>

      </div>

      <div className="font-black text-[14px] tracking-tight mt-2 leading-tight">
        {value}
      </div>
    </div>
  );
}


function SettingSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 bg-white border-[2px] border-black rounded-full px-4 py-1.5 text-[10px] font-black">

      <span>{titleCase(label)}</span>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="bg-transparent text-right outline-none font-bold capitalize max-w-[58%]"
      >
        {options.map((option) => (
          <option
            key={option}
            value={option}
          >
            {titleCase(option)}
          </option>
        ))}
      </select>

    </label>
  );
}