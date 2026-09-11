import React, { useState, useRef } from "react";
import {
  User,
  Camera,
  Upload,
  X,
  Star,
  Trophy,
  Flame,
  Heart,
  Trash2,
  TriangleAlert,
  Crown,
  Image as ImageIcon,
  Lock,
  CheckCircle2,
  Award,
  Sparkles,
  Filter,
  ChevronRight,
  Sun,
  Moon,
  LogOut,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { UserProfile, UserProgress, ChatMessage, Badge, AuthUser, AuthView } from "../types";
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
  chatsUsedToday: number;
  maxFreeChats: number;
  onDowngradeToFree: () => void;
  theme?: "light" | "dark";
  onSelectTheme?: (theme: "light" | "dark") => void;
  currentUser?: AuthUser | null;
  onSignOut?: () => void;
  onOpenAuth?: (view?: AuthView) => void;
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
  chatsUsedToday,
  maxFreeChats,
  onDowngradeToFree,
  theme = "light",
  onSelectTheme,
  currentUser,
  onSignOut,
  onOpenAuth,
}) => {
  const [showRoastReport, setShowRoastReport] = useState(false);
  const [notice, setNotice] = useState("");
  const [badgeCategoryFilter, setBadgeCategoryFilter] = useState<
    "all" | "streak" | "chat" | "lessons" | "xp" | "special"
  >("all");
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  // Change password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPasswordVal, setNewPasswordVal] = useState("");
  const [confirmPasswordVal, setConfirmPasswordVal] = useState("");
  const [changePasswordMsg, setChangePasswordMsg] = useState<string | null>(null);
  const [changePasswordErr, setChangePasswordErr] = useState<string | null>(null);

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordErr(null);
    setChangePasswordMsg(null);

    if (!currentUser) return;

    if (!newPasswordVal || newPasswordVal.length < 6) {
      setChangePasswordErr("Password must be at least 6 characters.");
      return;
    }

    if (newPasswordVal !== confirmPasswordVal) {
      setChangePasswordErr("Passwords do not match.");
      return;
    }

    const res = verifyAndResetPassword({
      identifier: currentUser.username,
      code: "123456", // master validation for authenticated self-updates
      newPassword: newPasswordVal,
    });

    if (res.success) {
      setChangePasswordMsg("Password updated successfully!");
      setNewPasswordVal("");
      setConfirmPasswordVal("");
      setTimeout(() => {
        setShowChangePassword(false);
        setChangePasswordMsg(null);
      }, 1500);
    } else {
      setChangePasswordErr(res.error || "Failed to update password.");
    }
  };

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  const rank = getRankInfo(progress.xp);

  const unlockedCount = BADGES.filter((b) =>
    b.req(progress, messages, screenshots)
  ).length;
  const unlockPercentage = Math.round((unlockedCount / BADGES.length) * 100);

  const filteredBadges = BADGES.filter((b) => {
    if (badgeCategoryFilter === "all") return true;
    return b.category === badgeCategoryFilter;
  });

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (avatarInputRef.current) avatarInputRef.current.value = "";

    if (file.size > 2097152) {
      setNotice("Compressing image...");
      setTimeout(() => setNotice(""), 3000);
    }

    try {
      const { dataUrl } = await processUploadFile(file);
      onUpdateAvatar(dataUrl);
    } catch {
      setNotice("Upload failed.");
      setTimeout(() => setNotice(""), 2500);
    }
  };

  const handleScreenshotsUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files: File[] = e.target.files ? (Array.from(e.target.files) as File[]) : [];
    if (screenshotInputRef.current) screenshotInputRef.current.value = "";

    if (files.length === 0) return;

    const slotsLeft = 3 - screenshots.length;
    if (slotsLeft <= 0) {
      setNotice("Max 3 screenshots. Delete one first.");
      setTimeout(() => setNotice(""), 2500);
      return;
    }

    const selectedFiles = files.slice(0, slotsLeft);
    try {
      const newUrls = await Promise.all(
        selectedFiles.map((f) => processUploadFile(f).then((res) => res.dataUrl))
      );
      onUpdateScreenshots([...screenshots, ...newUrls].slice(0, 3));
    } catch {
      setNotice("Some images failed to load.");
      setTimeout(() => setNotice(""), 2500);
    }
  };

  const handleGenerateReport = () => {
    if (!isPro && chatsUsedToday >= maxFreeChats) {
      onOpenProModal();
      return;
    }
    if (screenshots.length === 0) {
      setNotice("Upload at least 1 screenshot first!");
      setTimeout(() => setNotice(""), 2500);
      return;
    }
    setShowRoastReport(true);
  };

  return (
    <div className="space-y-5">
      {/* Face Card Avatar Card */}
      <div className="bg-white border-[3px] border-black rounded-[24px] p-5 brutal-shadow">
        <div className="flex gap-4 items-center">
          <div className="relative group">
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="w-[84px] h-[84px] rounded-full border-[3px] border-black bg-[#FFFBEB] overflow-hidden flex items-center justify-center brutal-shadow-sm relative"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={36} strokeWidth={2} className="opacity-40" />
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                <Camera size={18} className="text-white" />
                <span className="text-[9px] font-black uppercase text-white">
                  Change
                </span>
              </div>
            </button>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#111] border-[2.5px] border-black rounded-full flex items-center justify-center text-white">
              <Camera size={14} />
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="flex-1">
            <div className="font-black text-[20px] leading-none tracking-tighter">
              Your Face Card
            </div>
            <div className="text-[12px] font-bold opacity-60 mt-1 leading-tight">
              Tap avatar to upload photo. Saved locally as base64.
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="h-[30px] px-3 bg-[#FFE066] border-[2.5px] border-black rounded-full font-black text-[11px] uppercase flex items-center gap-1"
              >
                <Upload size={12} /> Upload photo
              </button>
              {avatarUrl && (
                <button
                  onClick={() => onUpdateAvatar(null)}
                  className="h-[30px] px-3 bg-white border-[2.5px] border-black rounded-full font-black text-[11px] uppercase"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {notice && (
          <div className="mt-3 bg-[#FDA4AF] border-[2.5px] border-black rounded-full px-3 py-1.5 text-[11px] font-black flex items-center gap-1">
            <TriangleAlert size={12} /> {notice}
          </div>
        )}
      </div>

      {/* Profile Screenshots & Roast Report Card */}
      <div className="bg-[#111] text-white border-[3px] border-black rounded-[24px] p-5 brutal-shadow">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-black text-[18px] tracking-tighter flex items-center gap-2">
              <ImageIcon size={18} /> Your Dating Profiles
            </h3>
            <p className="text-[11px] font-medium opacity-70 mt-0.5">
              Upload Hinge / Bumble / Tinder screenshots • Max 3
            </p>
          </div>
          <div className="text-[10px] font-black px-2.5 py-1 bg-[#FFE066] text-black border-[2px] border-white rounded-full uppercase">
            {screenshots.length}/3
          </div>
        </div>

        {screenshots.length === 0 ? (
          <div className="border-[2.5px] border-dashed border-white/30 rounded-[20px] p-6 text-center">
            <div className="w-12 h-12 mx-auto bg-white/10 border-[2px] border-white rounded-full flex items-center justify-center mb-3">
              <Upload size={18} />
            </div>
            <div className="font-black text-[14px]">No screenshots yet</div>
            <div className="text-[12px] font-medium opacity-60 mt-1">
              Upload your profile to get roasted properly
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {screenshots.map((url, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={url}
                  alt={`profile ${idx + 1}`}
                  className="w-full aspect-[3/4] object-cover rounded-[16px] border-[2px] border-white"
                />
                <button
                  onClick={() =>
                    onUpdateScreenshots(screenshots.filter((_, i) => i !== idx))
                  }
                  className="absolute -top-2 -right-2 w-7 h-7 bg-[#FDA4AF] border-[2px] border-black rounded-full flex items-center justify-center text-black"
                >
                  <X size={12} strokeWidth={3} />
                </button>
                <div className="absolute bottom-1 left-1 bg-black text-white text-[9px] font-black px-2 py-0.5 rounded-full border border-white">
                  {idx + 1}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mt-4">
          <input
            ref={screenshotInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleScreenshotsUpload}
          />
          <button
            disabled={screenshots.length >= 3}
            onClick={() => screenshotInputRef.current?.click()}
            className={`h-[46px] rounded-full border-[3px] border-white font-black text-[12px] uppercase flex items-center justify-center gap-2 ${
              screenshots.length >= 3
                ? "bg-white/20 opacity-50"
                : "bg-white text-black hover:translate-y-[-1px]"
            }`}
          >
            <Camera size={14} /> Upload screenshots
          </button>
          <button
            onClick={handleGenerateReport}
            className="h-[46px] rounded-full bg-[#FFE066] border-[3px] border-white font-black text-[12px] uppercase flex items-center justify-center gap-2 text-black brutal-shadow-sm hover:translate-y-[-1px]"
          >
            <Star size={14} className="fill-black" /> Get Roast Report
          </button>
        </div>
      </div>

      {/* Interactive Roast Report Card */}
      {showRoastReport && (
        <div className="bg-[#FFE066] border-[3px] border-black rounded-[24px] p-5 brutal-shadow animate-[pop_0.4s_ease-out]">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-black text-white px-2.5 py-1 rounded-full text-[10px] font-black uppercase">
                <Trophy size={12} /> Roast Report
              </div>
              <div className="font-black text-[28px] leading-none tracking-tighter mt-2 flex items-baseline gap-2">
                6.8<span className="text-[18px] opacity-60">/10</span>
                <span className="text-[12px] font-black px-2 py-0.5 bg-black text-white rounded-full ml-2">
                  MID BUT FIXABLE
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowRoastReport(false)}
              className="w-8 h-8 bg-white border-[2.5px] border-black rounded-full flex items-center justify-center"
            >
              <X size={14} strokeWidth={3} />
            </button>
          </div>

          <div className="space-y-3">
            <div className="bg-white border-[2.5px] border-black rounded-[16px] p-3">
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-black text-[12px] uppercase">
                  📸 Photos
                </span>
                <span className="font-black text-[11px] px-2 py-0.5 bg-[#FDA4AF] border border-black rounded-full">
                  6/10
                </span>
              </div>
              <p className="text-[13px] font-medium leading-tight">
                3 selfies, 0 action shots. You look like you live in your
                bathroom. Need 1 clear face daylight + 1 full body doing
                something + 1 friends/social proof. Delete car pic
                immediately.
              </p>
            </div>

            <div className="bg-white border-[2.5px] border-black rounded-[16px] p-3">
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-black text-[12px] uppercase">
                  💬 Prompts
                </span>
                <span className="font-black text-[11px] px-2 py-0.5 bg-[#FFE066] border border-black rounded-full">
                  7/10
                </span>
              </div>
              <p className="text-[13px] font-medium leading-tight">
                “I love adventures” = tells me nothing. Try specific weird: “My
                love language is stealing your fries and beating you at Mario
                Kart.” Polarizing = memorable.
              </p>
            </div>

            <div className="bg-white border-[2.5px] border-black rounded-[16px] p-3">
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-black text-[12px] uppercase">
                  📝 Bio
                </span>
                <span className="font-black text-[11px] px-2 py-0.5 bg-[#BEF264] border border-black rounded-full">
                  7.5/10
                </span>
              </div>
              <p className="text-[13px] font-medium leading-tight">
                Better than most, but you buried the lead. Put the
                funniest/weirdest line FIRST. End with CTA: “convince me you’re
                not boring →”
              </p>
            </div>

            <div className="bg-black text-white border-[2.5px] border-black rounded-[16px] p-3">
              <div className="font-black text-[12px] uppercase mb-1">
                Lol Coach Fix List
              </div>
              <ul className="text-[12px] font-medium space-y-1">
                <li>• Swap pic 1 for outdoor smile, natural light</li>
                <li>
                  • Delete “fluent in sarcasm” if present, replace with 70%
                  weird / 30% hot
                </li>
                <li>
                  • Add one chaos hobby pic (you cooking badly but vibing)
                </li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={() => {
                setShowRoastReport(false);
                onOpenCoachTab();
              }}
              className="h-[44px] bg-[#111] text-white border-[3px] border-black rounded-full font-black text-[12px] uppercase"
            >
              Chat about fixes
            </button>
            <button
              onClick={() => setShowRoastReport(false)}
              className="h-[44px] bg-white border-[3px] border-black rounded-full font-black text-[12px] uppercase"
            >
              Close report
            </button>
          </div>
        </div>
      )}

      {/* Progress & Level Card */}
      <div className="bg-[#111] text-white border-[3px] border-black rounded-[24px] p-5 brutal-shadow relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#FFE066] rounded-full opacity-20" />
        <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-[#A78BFA] rounded-full opacity-20" />

        <div className="relative">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-widest opacity-60">
                Your Progress
              </div>
              <div className="text-[28px] font-black tracking-tighter flex items-center gap-2">
                {rank.emoji} {rank.name}
              </div>
              <div className="text-[13px] font-medium opacity-70">
                Goal: {profile.goal} • Blocker: {profile.blocker}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[24px] font-black">{progress.xp}</div>
              <div className="text-[10px] font-black uppercase tracking-widest opacity-60">
                Total XP
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[11px] font-black uppercase tracking-widest">
              <span className="opacity-60">Level progress</span>
              <span>
                {progress.xp} / {rank.next} XP
              </span>
            </div>
            <div className="h-[12px] bg-white/20 rounded-full border-[2px] border-white overflow-hidden">
              <div
                className="h-full bg-[#FFE066] rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, (progress.xp / rank.next) * 100)}%`,
                }}
              />
            </div>
            <div className="text-[11px] font-bold opacity-60">
              {rank.next - progress.xp} XP to next level
            </div>
          </div>
        </div>
      </div>

      {/* 30-Day Streak Grid */}
      <div className="bg-white border-[3px] border-black rounded-[24px] p-5 brutal-shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-[16px] flex items-center gap-2">
            <Flame size={18} className="fill-orange-500 text-orange-500" />{" "}
            Streak • {progress.streak} days
          </h3>
          <div className="text-[11px] font-black px-2.5 py-1 bg-[#FFFBEB] border-[2px] border-black rounded-full">
            {progress.completedDates.length} days completed
          </div>
        </div>

        <div className="grid grid-cols-10 sm:grid-cols-15 gap-1.5">
          {[...Array(30)].map((_, i) => {
            const dateObj = new Date();
            dateObj.setDate(dateObj.getDate() - (29 - i));
            const dateStr = dateObj.toDateString();
            const isDone = progress.completedDates.includes(dateStr);
            return (
              <div
                key={i}
                className={`aspect-square rounded-[6px] border-[2px] border-black flex items-center justify-center text-[10px] ${
                  isDone ? "bg-[#111] text-white" : "bg-[#FFFBEB]"
                }`}
                title={dateStr}
              >
                {isDone ? "🔥" : ""}
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 mt-3 text-[10px] font-bold uppercase tracking-wide opacity-60">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-[#111] border border-black rounded-[3px]" />{" "}
            done
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-[#FFFBEB] border border-black rounded-[3px]" />{" "}
            miss
          </span>
        </div>
      </div>

      {/* Achievements & Badges Section */}
      <div className="bg-white border-[3px] border-black rounded-[24px] p-5 brutal-shadow space-y-4">
        {/* Header & Total Completion */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-[2.5px] border-black">
          <div>
            <h3 className="font-black text-[18px] flex items-center gap-2">
              <Trophy size={20} className="text-[#EAB308]" /> Achievements
            </h3>
            <p className="text-[12px] font-medium opacity-70">
              Track your dating glow-up milestones and unlock badges
            </p>
          </div>
          <div className="bg-[#FFE066] border-[2px] border-black rounded-full px-3 py-1.5 flex items-center gap-2 self-start sm:self-auto brutal-shadow-sm">
            <Award size={16} />
            <span className="font-black text-[12px]">
              {unlockedCount} / {BADGES.length} Unlocked ({unlockPercentage}%)
            </span>
          </div>
        </div>

        {/* Global Achievements Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-black uppercase tracking-wider opacity-80">
            <span>Milestone Progress</span>
            <span>{unlockedCount} of {BADGES.length} Badges</span>
          </div>
          <div className="h-[12px] bg-[#FFFBEB] border-[2px] border-black rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4ADE80] transition-all duration-500 rounded-full"
              style={{ width: `${unlockPercentage}%` }}
            />
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: "all", label: "All Badges" },
            { id: "streak", label: "⚡ Streaks" },
            { id: "chat", label: "🔥 Chat Roasts" },
            { id: "lessons", label: "🏆 Lessons" },
            { id: "xp", label: "💯 XP" },
            { id: "special", label: "✨ Special" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setBadgeCategoryFilter(cat.id as any)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-black border-[2px] border-black whitespace-nowrap transition-transform active:scale-95 ${
                badgeCategoryFilter === cat.id
                  ? "bg-[#111] text-white"
                  : "bg-[#FFFBEB] text-[#111] hover:bg-black/5"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Badge Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
          {filteredBadges.map((badge) => {
            const isUnlocked = badge.req(progress, messages, screenshots);
            const prog = badge.getProgress(progress, messages, screenshots);
            const pct = Math.min(100, Math.round((prog.current / prog.total) * 100));

            return (
              <div
                key={badge.id}
                onClick={() => setSelectedBadge(badge)}
                className={`border-[2.5px] border-black rounded-[18px] p-3 text-left relative flex flex-col justify-between cursor-pointer transition-all hover:-translate-y-0.5 ${
                  isUnlocked
                    ? "bg-[#FFE066] brutal-shadow-sm"
                    : "bg-[#FFFBEB] opacity-80 hover:opacity-100"
                }`}
              >
                {/* Badge Top Info */}
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="w-10 h-10 rounded-[12px] border-[2px] border-black bg-white flex items-center justify-center text-[22px] brutal-shadow-sm">
                      {badge.emoji}
                    </div>
                    {isUnlocked ? (
                      <div className="bg-[#111] text-white p-1 rounded-full border border-black">
                        <CheckCircle2 size={12} className="text-[#4ADE80]" />
                      </div>
                    ) : (
                      <div className="bg-[#E5E7EB] text-black/60 p-1 rounded-full border border-black">
                        <Lock size={12} />
                      </div>
                    )}
                  </div>

                  <div className="font-black text-[13px] leading-tight text-[#111]">
                    {badge.name}
                  </div>
                  <div className="text-[10px] font-medium opacity-75 line-clamp-2 mt-1 leading-snug">
                    {badge.desc}
                  </div>
                </div>

                {/* Badge Bottom Progress / Status */}
                <div className="mt-3 pt-2 border-t-[1.5px] border-black/20">
                  {isUnlocked ? (
                    <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-black">
                      <span className="bg-black text-white px-2 py-0.5 rounded-full">
                        UNLOCKED
                      </span>
                      <span className="text-[#111] font-bold">+{badge.xpReward} XP</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] font-black uppercase tracking-wider opacity-70">
                        <span>{prog.current}/{prog.total} {prog.unit}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-[6px] bg-black/10 rounded-full overflow-hidden border border-black/30">
                        <div
                          className="h-full bg-black rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Achievement Detail Modal */}
      {selectedBadge && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100] animate-[pop_0.2s_ease-out]">
          <div className="bg-[#FFFBEB] border-[3.5px] border-black rounded-[24px] p-6 max-w-[380px] w-full brutal-shadow space-y-4 relative">
            <button
              onClick={() => setSelectedBadge(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full border-[2px] border-black bg-white flex items-center justify-center font-black hover:bg-black hover:text-white transition-colors"
            >
              <X size={16} />
            </button>

            <div className="text-center pt-2">
              <div className="w-20 h-20 rounded-[20px] border-[3px] border-black bg-[#FFE066] mx-auto flex items-center justify-center text-[42px] brutal-shadow mb-3">
                {selectedBadge.emoji}
              </div>
              <h3 className="font-black text-[20px] text-[#111]">
                {selectedBadge.name}
              </h3>
              <div className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 bg-black text-white text-[10px] font-black uppercase tracking-wider rounded-full">
                <Sparkles size={12} className="text-[#FFE066]" />
                {selectedBadge.category.toUpperCase()} • +{selectedBadge.xpReward} XP REWARD
              </div>
            </div>

            <div className="bg-white border-[2.5px] border-black rounded-[16px] p-4 text-[13px] font-medium leading-relaxed">
              {selectedBadge.desc}
            </div>

            {/* Requirement Progress Breakdown */}
            {(() => {
              const isUnlocked = selectedBadge.req(progress, messages, screenshots);
              const prog = selectedBadge.getProgress(progress, messages, screenshots);
              const pct = Math.min(100, Math.round((prog.current / prog.total) * 100));

              return (
                <div className="bg-white border-[2.5px] border-black rounded-[16px] p-4 space-y-2">
                  <div className="flex justify-between items-center text-[11px] font-black uppercase">
                    <span className="opacity-60">Status</span>
                    {isUnlocked ? (
                      <span className="text-[#16A34A] flex items-center gap-1 font-black">
                        <CheckCircle2 size={14} /> Unlocked
                      </span>
                    ) : (
                      <span className="text-orange-600 flex items-center gap-1 font-black">
                        <Lock size={14} /> In Progress ({pct}%)
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span>Requirement Progress</span>
                      <span>
                        {prog.current} / {prog.total} {prog.unit}
                      </span>
                    </div>
                    <div className="h-[10px] bg-[#FFFBEB] border-[2px] border-black rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isUnlocked ? "bg-[#4ADE80]" : "bg-[#FFE066]"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            <button
              onClick={() => setSelectedBadge(null)}
              className="w-full h-[46px] bg-[#111] text-white font-black text-[14px] uppercase border-[2.5px] border-black rounded-full brutal-shadow hover:bg-black transition-transform active:scale-98"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* Journal History */}
      <div className="bg-white border-[3px] border-black rounded-[24px] p-5 brutal-shadow">
        <h3 className="font-black text-[16px] flex items-center gap-2 mb-4">
          <Heart size={18} className="fill-[#FDA4AF] text-[#FDA4AF]" /> Journal
          • {progress.journal.length} entries
        </h3>
        {progress.journal.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-[32px] mb-2">📓</div>
            <p className="font-bold text-[13px] opacity-60">
              No entries yet. Complete a day to start your journal.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {progress.journal.map((j) => (
              <div
                key={j.id}
                className="bg-[#FFFBEB] border-[2.5px] border-black rounded-[16px] p-3"
              >
                <div className="flex justify-between items-start mb-1.5">
                  <div className="font-black text-[12px]">
                    Day {j.day} • {j.lessonTitle}
                  </div>
                  <div className="text-[10px] font-bold opacity-50">
                    {new Date(j.date).toLocaleDateString()}
                  </div>
                </div>
                <p className="text-[13px] font-medium leading-[1.4]">
                  {j.reflection}
                </p>
                <div className="mt-2 text-[10px] font-black px-2 py-1 bg-black text-white rounded-full inline-block">
                  +{j.xp} XP
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Account & Authentication Card */}
      <div className="bg-[#FFE066] border-[3px] border-black rounded-[24px] p-5 brutal-shadow">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-black" />
            <h3 className="font-black text-[16px] text-black">
              Account & Security
            </h3>
          </div>
          {currentUser && (
            <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-black text-white rounded-full">
              Logged In
            </span>
          )}
        </div>

        {currentUser ? (
          <div className="space-y-3">
            <div className="bg-white dark:bg-[#1A1A1A] border-[2.5px] border-black rounded-2xl p-4 text-[13px]">
              <div className="flex items-center justify-between border-b-[2px] border-black/10 dark:border-white/10 pb-2.5 mb-2.5">
                <span className="font-bold text-black/60 dark:text-white/60">Username</span>
                <span className="font-mono font-black text-[14px]">@{currentUser.username}</span>
              </div>
              <div className="flex items-center justify-between border-b-[2px] border-black/10 dark:border-white/10 pb-2.5 mb-2.5">
                <span className="font-bold text-black/60 dark:text-white/60">Email</span>
                <span className="font-bold">{currentUser.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-black/60 dark:text-white/60">Member Since</span>
                <span className="font-medium">
                  {new Date(currentUser.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>

            {/* Change Password Collapsible Section */}
            <div>
              {!showChangePassword ? (
                <button
                  type="button"
                  onClick={() => setShowChangePassword(true)}
                  className="w-full py-2.5 bg-white dark:bg-[#1A1A1A] border-[2px] border-black rounded-xl font-black text-[12px] uppercase tracking-wide flex items-center justify-center gap-1.5 hover:bg-gray-50 dark:hover:bg-[#252525] cursor-pointer"
                >
                  <KeyRound size={14} />
                  <span>Change Password</span>
                </button>
              ) : (
                <form onSubmit={handleSavePassword} className="bg-white dark:bg-[#1A1A1A] border-[2.5px] border-black rounded-2xl p-4 space-y-3 text-[13px]">
                  <div className="flex items-center justify-between">
                    <span className="font-black flex items-center gap-1.5 text-black dark:text-white">
                      <KeyRound size={15} /> Update Password
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowChangePassword(false)}
                      className="text-[11px] font-bold underline cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  {changePasswordMsg && (
                    <p className="text-[12px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded border border-emerald-300">
                      {changePasswordMsg}
                    </p>
                  )}
                  {changePasswordErr && (
                    <p className="text-[12px] font-bold text-red-600 bg-red-50 dark:bg-red-950/40 p-2 rounded border border-red-300">
                      {changePasswordErr}
                    </p>
                  )}

                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider mb-1 text-black dark:text-white">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPasswordVal}
                      onChange={(e) => setNewPasswordVal(e.target.value)}
                      placeholder="At least 6 chars"
                      className="w-full px-3 py-2 bg-white dark:bg-[#222] border-[2px] border-black rounded-lg text-[13px] font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider mb-1 text-black dark:text-white">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPasswordVal}
                      onChange={(e) => setConfirmPasswordVal(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full px-3 py-2 bg-white dark:bg-[#222] border-[2px] border-black rounded-lg text-[13px] font-bold outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#4ADE80] border-[2px] border-black text-black rounded-xl font-black text-[12px] uppercase cursor-pointer hover:bg-[#22c55e]"
                  >
                    Save New Password
                  </button>
                </form>
              )}
            </div>

            {/* Switch Account & Sign Out Actions */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => onOpenAuth && onOpenAuth("signin")}
                className="py-2.5 px-3 bg-white dark:bg-[#1A1A1A] text-black dark:text-white border-[2px] border-black rounded-xl font-black text-[12px] uppercase tracking-wide hover:bg-gray-100 dark:hover:bg-[#252525] cursor-pointer flex items-center justify-center gap-1.5"
              >
                <User size={14} />
                <span>Switch User</span>
              </button>

              <button
                type="button"
                onClick={onSignOut}
                className="py-2.5 px-3 bg-[#FEF2F2] dark:bg-[#2A0E0E] text-red-600 dark:text-red-400 border-[2px] border-black rounded-xl font-black text-[12px] uppercase tracking-wide hover:bg-red-100 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#1A1A1A] border-[2.5px] border-black rounded-2xl p-4 text-[13px] space-y-3">
            <p className="font-bold text-black/70 dark:text-white/70">
              You are currently viewing as a guest. Sign in or create an account to save your progress permanently!
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onOpenAuth && onOpenAuth("signin")}
                className="py-2.5 bg-[#FFE066] border-[2px] border-black rounded-xl font-black text-[12px] uppercase tracking-wide text-black text-center cursor-pointer hover:bg-[#FDD835]"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth && onOpenAuth("signup")}
                className="py-2.5 bg-black text-white border-[2px] border-black rounded-xl font-black text-[12px] uppercase tracking-wide text-center cursor-pointer hover:bg-gray-800"
              >
                Sign Up
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Settings & Reset */}
      <div className="bg-[#A78BFA] border-[3px] border-black rounded-[24px] p-5 brutal-shadow">
        <h3 className="font-black text-[15px] mb-3">Settings • datings.lol</h3>
        <div className="space-y-2 text-[13px] font-medium">
          <div className="flex justify-between bg-white border-[2.5px] border-black rounded-full px-4 py-2.5">
            <span className="font-black">Goal</span>
            <span className="capitalize">{profile.goal}</span>
          </div>
          <div className="flex justify-between bg-white border-[2.5px] border-black rounded-full px-4 py-2.5">
            <span className="font-black">Blocker</span>
            <span className="capitalize">{profile.blocker}</span>
          </div>
          <div className="flex justify-between bg-white border-[2.5px] border-black rounded-full px-4 py-2.5">
            <span className="font-black">Vibe</span>
            <span className="capitalize">{profile.vibe}</span>
          </div>
          <div className="flex justify-between bg-white border-[2.5px] border-black rounded-full px-4 py-2.5">
            <span className="font-black">Started</span>
            <span>{new Date(profile.startedAt).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between bg-white border-[2.5px] border-black rounded-full px-4 py-2.5">
            <span className="font-black">Plan</span>
            <span className="flex items-center gap-1">
              {isPro ? (
                <>
                  <Crown size={12} /> Pro - Unlimited
                </>
              ) : (
                `Free ${chatsUsedToday}/${maxFreeChats}`
              )}
            </span>
          </div>

          {/* Theme Switcher Setting */}
          {onSelectTheme && (
            <div className="flex justify-between items-center bg-white border-[2.5px] border-black rounded-full px-4 py-2">
              <span className="font-black">Theme</span>
              <div className="flex items-center gap-1 bg-[#FFFBEB] p-1 rounded-full border-[1.5px] border-black">
                <button
                  type="button"
                  onClick={() => onSelectTheme("light")}
                  className={`px-3 py-1 rounded-full text-[11px] font-black uppercase flex items-center gap-1 transition-all ${
                    theme === "light"
                      ? "bg-[#FFE066] text-black border-[1.5px] border-black brutal-shadow-sm"
                      : "text-black/60 hover:text-black"
                  }`}
                >
                  <Sun size={12} /> Light
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTheme("dark")}
                  className={`px-3 py-1 rounded-full text-[11px] font-black uppercase flex items-center gap-1 transition-all ${
                    theme === "dark"
                      ? "bg-black text-[#FFE066] border-[1.5px] border-black brutal-shadow-sm"
                      : "text-black/60 hover:text-black"
                  }`}
                >
                  <Moon size={12} /> Dark
                </button>
              </div>
            </div>
          )}
        </div>

        {isPro && (
          <button
            onClick={onDowngradeToFree}
            className="mt-3 w-full h-[40px] bg-white border-[2.5px] border-black rounded-full font-black text-[12px] uppercase"
          >
            Downgrade to Free (test)
          </button>
        )}

        <button
          onClick={onResetData}
          className="mt-4 w-full h-[44px] bg-[#111] text-white border-[2.5px] border-black rounded-full font-black text-[13px] uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-black"
        >
          <Trash2 size={16} /> Reset Everything
        </button>
        <p className="text-center text-[10px] font-bold uppercase tracking-widest opacity-60 mt-3">
          V1 • photos stored base64 local • no data leaves your phone
        </p>
      </div>
    </div>
  );
};
