import React, { useState, useEffect } from "react";
import {
  Calendar,
  Check,
  Eye,
  Target,
  Sparkles,
  Lock,
  Clock,
  X,
  Flame,
  ArrowDown,
  BellRing,
  Pencil,
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
  triggerConfetti: () => void;
  onUpdateDailyFocus?: (focus: string) => void;
  onOpenHotTake?: () => void;
  todayHotTakeTopic?: string;
}

export const TodayTab: React.FC<TodayTabProps> = ({
  currentDay,
  lesson,
  nextLesson,
  progress,
  isDayCompleted,
  onCompleteDay,
  onUpdateDailyFocus,
  onOpenHotTake,
  todayHotTakeTopic,
}) => {
  const [reflection, setReflection] = useState("");
  const [readChecked, setReadChecked] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  // Daily focus state
  const [isEditingFocus, setIsEditingFocus] = useState(false);
  const [focusInput, setFocusInput] = useState(progress.dailyFocus || "");

  useEffect(() => {
    if (progress.dailyFocus !== undefined) {
      setFocusInput(progress.dailyFocus);
    }
  }, [progress.dailyFocus]);

  const handleSaveFocus = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = focusInput.trim();
    if (onUpdateDailyFocus) {
      onUpdateDailyFocus(trimmed);
    }
    setIsEditingFocus(false);
  };

  const handleQuickFocusSelect = (preset: string) => {
    setFocusInput(preset);
    if (onUpdateDailyFocus) {
      onUpdateDailyFocus(preset);
    }
    setIsEditingFocus(false);
  };

  // Daily reminder state tracked via localStorage
  const [lastNotificationTimestamp, setLastNotificationTimestamp] = useState<number | null>(() => {
    const saved = localStorage.getItem("datings_reminder_last_timestamp");
    return saved ? parseInt(saved, 10) : null;
  });

  const [isDismissedToday, setIsDismissedToday] = useState<boolean>(() => {
    const todayStr = new Date().toLocaleDateString("en-CA");
    const dismissedDate = localStorage.getItem("datings_reminder_dismissed_date");
    return dismissedDate === todayStr;
  });

  const [simulatePast6PM, setSimulatePast6PM] = useState<boolean>(false);

  const currentHour = new Date().getHours();
  const isPast6PM = currentHour >= 18 || simulatePast6PM;
  const shouldShowReminder = !isDayCompleted && isPast6PM && !isDismissedToday;

  // Whenever the reminder is active, update the last notification timestamp in localStorage if not already recorded today
  useEffect(() => {
    if (shouldShowReminder) {
      const now = Date.now();
      localStorage.setItem("datings_reminder_last_timestamp", now.toString());
      setLastNotificationTimestamp(now);
    }
  }, [shouldShowReminder]);

  const handleDismissReminder = () => {
    const todayStr = new Date().toLocaleDateString("en-CA");
    const now = Date.now();
    localStorage.setItem("datings_reminder_dismissed_date", todayStr);
    localStorage.setItem("datings_reminder_last_timestamp", now.toString());
    setIsDismissedToday(true);
    setLastNotificationTimestamp(now);
  };

  const handleResetReminderForTest = () => {
    localStorage.removeItem("datings_reminder_dismissed_date");
    setIsDismissedToday(false);
    setSimulatePast6PM(true);
  };

  const scrollToTask = () => {
    const el = document.getElementById("today-task-card");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const rank = getRankInfo(progress.xp);

  const handleComplete = () => {
    if (isDayCompleted) return;

    // 1. Tactile vibration pattern if supported on device (pulse - pause - heavy punch)
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([45, 30, 85]);
      } catch {}
    }

    // 2. Trigger brutalist screen-shake animation
    setIsShaking(true);
    setTimeout(() => {
      setIsShaking(false);
    }, 450);

    // 3. Complete day and claim XP
    onCompleteDay(reflection, readChecked);
  };

  return (
    <div className={`space-y-5 transition-transform ${isShaking ? "screen-shake" : ""}`}>
      {/* 6 PM Daily Streak Reminder Banner */}
      {shouldShowReminder && (
        <div className="bg-[#FEF08A] border-[3px] border-black rounded-[20px] p-4 brutal-shadow-sm transition-all animate-[pop_0.3s_ease-out]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-black text-white flex items-center justify-center shrink-0 mt-0.5 border-[2px] border-black brutal-shadow-sm">
                <BellRing size={20} className="text-[#FFE066] animate-bounce" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-black text-[#FFE066] text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                    ⏰ 6:00 PM Streak Alert
                  </span>
                  {simulatePast6PM && currentHour < 18 && (
                    <span className="bg-white border border-black text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full text-black/60">
                      Simulated 6 PM
                    </span>
                  )}
                </div>
                <h4 className="font-black text-[15px] leading-tight text-[#111]">
                  Don't lose your {progress.streak > 0 ? `${progress.streak}-day ` : ""}streak tonight!
                </h4>
                <p className="text-[12px] font-medium text-[#111]/80 leading-snug">
                  It's past 6 PM and today's lesson isn't finished yet. Take 2 minutes to claim your +{lesson.task.xp} XP before midnight.
                </p>
                {lastNotificationTimestamp && (
                  <div className="text-[10px] font-bold text-[#111]/60 pt-0.5 flex items-center gap-1">
                    <Clock size={11} />
                    Last alert logged: {new Date(lastNotificationTimestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleDismissReminder}
              title="Dismiss reminder for today"
              className="w-7 h-7 rounded-full border-[2px] border-black bg-white flex items-center justify-center shrink-0 hover:bg-black hover:text-white transition-colors"
            >
              <X size={14} strokeWidth={3} />
            </button>
          </div>

          <div className="mt-3 pt-3 border-t-[1.5px] border-black/20 flex items-center justify-between gap-2">
            <button
              onClick={scrollToTask}
              className="bg-[#111] text-white text-[11px] font-black uppercase tracking-wide px-3.5 py-1.5 rounded-full border-[2px] border-black flex items-center gap-1.5 hover:bg-black active:scale-95 transition-transform"
            >
              Finish Today's Task <ArrowDown size={13} />
            </button>
            <button
              onClick={handleDismissReminder}
              className="text-[11px] font-black uppercase text-[#111]/70 hover:text-black underline underline-offset-2"
            >
              Dismiss Today
            </button>
          </div>
        </div>
      )}

      {/* Date Header Banner */}
      <div className="flex justify-between items-start">
        <div>
          <div className="inline-flex items-center gap-2 bg-black text-white px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest mb-2">
            <Calendar size={12} /> Day {currentDay} •{" "}
            {new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </div>
          <h1 className="text-[32px] font-black leading-[0.9] tracking-tighter">
            today's glow-up
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[14px] font-medium opacity-60">
              one lesson. one task. no bs.
            </p>
            {/* Quick reminder test toggle if before 6 PM and not completed */}
            {!isDayCompleted && (
              <button
                onClick={() => {
                  if (shouldShowReminder) {
                    handleDismissReminder();
                  } else {
                    handleResetReminderForTest();
                  }
                }}
                className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-black/30 bg-white/70 hover:bg-white text-black/70 flex items-center gap-1"
                title="Test or toggle the 6 PM daily reminder banner"
              >
                <Clock size={10} />
                {shouldShowReminder ? "Hide 6PM alert" : "Test 6PM alert"}
              </button>
            )}
          </div>
        </div>

        <div className="bg-white border-[3px] border-black rounded-[16px] px-3 py-2 text-center brutal-shadow-sm">
          <div className="text-[10px] font-black uppercase opacity-50">
            Level
          </div>
          <div className="font-black text-[14px] leading-none flex items-center gap-1">
            {rank.emoji} {rank.name}
          </div>
        </div>
      </div>

      {/* Daily Focus Section */}
      {progress.dailyFocus && !isEditingFocus ? (
        <div className="bg-[#FFE066] border-[3px] border-black rounded-[20px] p-4 brutal-shadow-sm transition-all">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-black text-[#FFE066] flex items-center justify-center shrink-0 mt-0.5 border-[2px] border-black font-black text-[14px]">
                🎯
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-black/70">
                    Today's Dating Focus
                  </span>
                  <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
                </div>
                <p className="font-black text-[16px] leading-snug text-[#111] mt-0.5">
                  "{progress.dailyFocus}"
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setFocusInput(progress.dailyFocus || "");
                setIsEditingFocus(true);
              }}
              className="text-[11px] font-black uppercase px-2.5 py-1 rounded-full border-[2px] border-black bg-white hover:bg-black hover:text-white transition-colors flex items-center gap-1 shrink-0 brutal-shadow-sm"
              title="Edit Daily Focus"
            >
              <Pencil size={11} /> Edit
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border-[3px] border-black rounded-[20px] p-4 brutal-shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#FFE066] text-black border-[2px] border-black flex items-center justify-center font-black text-[12px]">
                🎯
              </div>
              <span className="font-black text-[13px] uppercase tracking-wide">
                Set Your Daily Dating Focus
              </span>
            </div>
            {progress.dailyFocus && (
              <button
                type="button"
                onClick={() => setIsEditingFocus(false)}
                className="text-[11px] font-bold text-black/60 hover:text-black uppercase"
              >
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleSaveFocus} className="flex gap-2">
            <input
              type="text"
              value={focusInput}
              onChange={(e) => setFocusInput(e.target.value)}
              placeholder="e.g. Ask for the date, stop double texting, be playful..."
              className="flex-1 px-3.5 py-2 text-[13px] font-medium bg-[#FFFBEB] border-[2px] border-black rounded-full focus:outline-none focus:ring-2 focus:ring-black placeholder:text-black/40"
              maxLength={70}
            />
            <button
              type="submit"
              disabled={!focusInput.trim()}
              className={`px-4 py-2 font-black text-[12px] uppercase rounded-full border-[2px] border-black transition-all ${
                focusInput.trim()
                  ? "bg-[#FFE066] text-black hover:translate-y-[-1px] brutal-shadow-sm active:translate-y-0"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              Save
            </button>
          </form>

          {/* Quick preset chips */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[10px] font-black uppercase opacity-50 mr-1">
              Quick pick:
            </span>
            {[
              "Be playful & tease",
              "Ask for a date",
              "Stop dry texting",
              "No overthinking",
            ].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleQuickFocusSelect(preset)}
                className="text-[10px] font-black px-2.5 py-1 rounded-full border-[1.5px] border-black bg-[#FFFBEB] hover:bg-[#FFE066] active:scale-95 transition-all text-black"
              >
                +{preset}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Daily Hot Take Teaser Banner */}
      {onOpenHotTake && (
        <div
          onClick={onOpenHotTake}
          className="bg-white dark:bg-[#181818] border-[3px] border-black rounded-[20px] p-3.5 brutal-shadow-sm flex items-center justify-between cursor-pointer hover:bg-[#FFFBEB] active:scale-[0.99] transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#FFE066] text-black border-[2px] border-black flex items-center justify-center font-black shrink-0 text-[14px]">
              🔥
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-black text-[#FFE066] px-1.5 py-0.2 rounded-full">
                  Daily Hot Take
                </span>
                <span className="text-[10px] font-black text-black dark:text-[#BEF264] bg-[#BEF264]/40 px-1.5 py-0.2 rounded-full border border-black/30">
                  +25 XP
                </span>
              </div>
              <p className="text-[12px] font-black leading-tight text-[#111] dark:text-white mt-0.5 group-hover:text-black">
                {todayHotTakeTopic ? `Topic: ${todayHotTakeTopic}` : "Vote on today's spicy dating debate"}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-black uppercase px-3 py-1 rounded-full border-[2px] border-black bg-[#BEF264] text-black shrink-0 group-hover:bg-[#a3e635]">
            Vote
          </span>
        </div>
      )}

      {/* Lesson Card */}
      <div className="bg-white border-[3px] border-black rounded-[24px] overflow-hidden brutal-shadow">
        <div className="h-[8px] w-full" style={{ background: lesson.color }} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="px-2.5 py-1 bg-[#111] text-white rounded-full text-[10px] font-black uppercase tracking-widest">
                  Lesson • {lesson.id}
                </div>
                <div
                  className="px-2.5 py-1 border-[2px] border-black rounded-full text-[10px] font-black uppercase"
                  style={{ background: lesson.color }}
                >
                  {lesson.tags[0]}
                </div>
              </div>
              <h2 className="text-[22px] font-black leading-[0.95] tracking-tighter">
                {lesson.title}
              </h2>
              <p className="text-[13px] font-bold opacity-60 mt-1">
                {lesson.subtitle}
              </p>
            </div>
            <div
              className="w-12 h-12 rounded-full border-[3px] border-black flex items-center justify-center text-[20px] shrink-0"
              style={{ background: lesson.color }}
            >
              📖
            </div>
          </div>

          <div className="space-y-3 text-[14px] leading-[1.5] font-medium">
            {lesson.paragraphs.map((p, idx) => (
              <p key={idx} className={idx === 0 ? "font-bold text-[15px]" : ""}>
                {p}
              </p>
            ))}
          </div>

          {/* Good Move vs Trash Move Examples */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
            <div className="bg-[#FFFBEB] border-[2.5px] border-black rounded-[16px] p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-5 h-5 bg-[#BEF264] border-[2px] border-black rounded-full flex items-center justify-center">
                  <Check size={12} strokeWidth={4} />
                </div>
                <span className="font-black text-[11px] uppercase tracking-wide">
                  Good move
                </span>
              </div>
              <p className="text-[13px] font-medium italic">
                "{lesson.goodExample}"
              </p>
            </div>

            <div className="bg-black text-white border-[2.5px] border-black rounded-[16px] p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-5 h-5 bg-[#FDA4AF] border-[2px] border-white rounded-full flex items-center justify-center">
                  <span className="text-black font-black text-[10px]">✕</span>
                </div>
                <span className="font-black text-[11px] uppercase tracking-wide">
                  Trash move
                </span>
              </div>
              <p className="text-[13px] font-medium italic opacity-90">
                "{lesson.badExample}"
              </p>
            </div>
          </div>

          {/* Read Toggle Button */}
          <button
            onClick={() => {
              if (!readChecked) {
                if (typeof window !== "undefined" && "vibrate" in navigator) {
                  try { navigator.vibrate(30); } catch {}
                }
              }
              setReadChecked(!readChecked);
            }}
            disabled={readChecked}
            className={`mt-5 w-full h-[48px] rounded-full border-[3px] border-black font-black text-[14px] uppercase tracking-wide flex items-center justify-center gap-2 transition-all active:scale-98 ${
              readChecked
                ? "bg-[#BEF264] text-black"
                : "bg-[#111] text-white hover:translate-y-[-1px] hover:shadow-[0px_4px_0px_0px_#111] active:translate-y-0 active:shadow-none"
            }`}
          >
            {readChecked ? (
              <>
                <Check size={18} strokeWidth={3} /> Read • +10 XP
              </>
            ) : (
              <>
                <Eye size={18} /> Mark as read • +10 XP
              </>
            )}
          </button>
        </div>
      </div>

      {/* Today's Task Card */}
      <div id="today-task-card" className="bg-[#111] text-white border-[3px] border-black rounded-[24px] overflow-hidden brutal-shadow">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-[#FFE066] text-black border-[2.5px] border-white rounded-full flex items-center justify-center">
                <Target size={18} strokeWidth={3} />
              </div>
              <div>
                <div className="font-black text-[13px] uppercase tracking-widest opacity-60">
                  Today's Task
                </div>
                <div className="font-black text-[18px] leading-none tracking-tight">
                  {lesson.task.title}
                </div>
              </div>
            </div>
            <div
              className={`px-3 py-1 rounded-full border-[2px] border-white text-[10px] font-black uppercase tracking-widest ${
                lesson.task.difficulty === "easy"
                  ? "bg-[#BEF264] text-black"
                  : lesson.task.difficulty === "medium"
                  ? "bg-[#FFE066] text-black"
                  : "bg-[#FDA4AF] text-black"
              }`}
            >
              {lesson.task.difficulty} • +{lesson.task.xp} XP
            </div>
          </div>

          <p className="text-[14px] font-medium opacity-80 leading-[1.4] mb-4">
            {lesson.task.desc}
          </p>

          <div className="bg-white rounded-[16px] border-[3px] border-white p-1">
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="How did it go? What did you learn? Be real..."
              className="w-full min-h-[90px] bg-[#FFFBEB] rounded-[12px] border-[2px] border-black p-3 text-[14px] font-medium text-black placeholder:opacity-40 outline-none resize-none"
            />
          </div>

          <button
            onClick={handleComplete}
            disabled={isDayCompleted}
            className={`mt-4 w-full h-[52px] rounded-full font-black text-[15px] uppercase tracking-wide flex items-center justify-center gap-2 border-[3px] transition-all ${
              isShaking ? "button-punch" : ""
            } ${
              isDayCompleted
                ? "bg-[#BEF264] text-black border-black"
                : "bg-[#FFE066] text-black border-white hover:translate-y-[-2px] hover:shadow-[0px_4px_0px_0px_white] active:translate-y-0 active:shadow-none"
            }`}
          >
            {isDayCompleted ? (
              <>
                <Check size={20} strokeWidth={3} /> Completed • Day {currentDay}{" "}
                Done
              </>
            ) : (
              <>
                Complete Day {currentDay} • Claim XP <Sparkles size={18} />
              </>
            )}
          </button>

          {isDayCompleted && (
            <p className="text-center text-[11px] font-bold uppercase tracking-widest opacity-50 mt-2">
              Come back tomorrow for next lesson
            </p>
          )}
        </div>
      </div>

      {/* Locked Preview Card */}
      <div className="bg-white border-[3px] border-black rounded-[24px] p-4 opacity-60 relative overflow-hidden">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(0,0,0,0.04)_8px,rgba(0,0,0,0.04)_16px)] pointer-events-none" />
        <div className="flex items-center gap-3 relative">
          <div className="w-10 h-10 rounded-full bg-[#FFFBEB] border-[2.5px] border-black flex items-center justify-center">
            <Lock size={18} />
          </div>
          <div className="flex-1">
            <div className="font-black text-[12px] uppercase tracking-widest">
              Tomorrow • Day {currentDay + 1}
            </div>
            <div className="font-bold text-[14px] leading-tight">
              {nextLesson.title}
            </div>
          </div>
          <div className="text-[10px] font-black px-2.5 py-1 bg-black text-white rounded-full uppercase">
            Locked
          </div>
        </div>
      </div>
    </div>
  );
};
