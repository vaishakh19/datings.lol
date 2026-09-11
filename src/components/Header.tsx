import React, { useState, useEffect, useRef } from "react";
import { Flame, Zap, User, Sun, Moon, LogIn, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserProgress, AuthUser, AuthView } from "../types";
import { getRankInfo } from "../data/lessons";

interface HeaderProps {
  progress: UserProgress;
  avatarUrl: string | null;
  onOpenProfile: () => void;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
  currentUser?: AuthUser | null;
  onSignOut?: () => void;
  onOpenAuth?: (view?: AuthView) => void;
  isBouncingStreak?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  progress,
  avatarUrl,
  onOpenProfile,
  theme = "light",
  onToggleTheme,
  currentUser,
  onSignOut,
  onOpenAuth,
  isBouncingStreak = false,
}) => {
  const rank = getRankInfo(progress.xp);
  const [isBouncing, setIsBouncing] = useState(false);
  const prevStreakRef = useRef(progress.streak);

  // Trigger bounce animation when prop changes or streak increments
  useEffect(() => {
    if (isBouncingStreak) {
      setIsBouncing(true);
      const timer = setTimeout(() => setIsBouncing(false), 950);
      return () => clearTimeout(timer);
    }
  }, [isBouncingStreak]);

  useEffect(() => {
    if (progress.streak > prevStreakRef.current) {
      setIsBouncing(true);
      const timer = setTimeout(() => setIsBouncing(false), 950);
      prevStreakRef.current = progress.streak;
      return () => clearTimeout(timer);
    }
    prevStreakRef.current = progress.streak;
  }, [progress.streak]);

  const triggerPreviewBounce = () => {
    setIsBouncing(true);
    setTimeout(() => setIsBouncing(false), 950);
  };

  return (
    <header className="sticky top-0 z-20 bg-[#FFFBEB]/90 dark:bg-[#0D0D0D]/90 backdrop-blur-md border-b-[3px] border-black">
      <div className="max-w-[640px] mx-auto px-4 h-[64px] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#111] text-[#FFFBEB] rounded-full flex items-center justify-center font-black text-[14px]">
            d.
          </div>
          <span className="font-black text-[20px] tracking-tighter">
            datings.lol
          </span>
          <span className="hidden sm:inline ml-1 text-[10px] font-black px-2 py-0.5 bg-[#FFE066] text-black border-[2px] border-black rounded-full">
            BETA
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Animated Streak pill */}
          <div className="relative">
            <AnimatePresence>
              {isBouncing && (
                <motion.div
                  key="streak-floating-banner"
                  initial={{ opacity: 0, y: 6, scale: 0.5 }}
                  animate={{ opacity: 1, y: -24, scale: 1 }}
                  exit={{ opacity: 0, y: -32, scale: 0.7 }}
                  transition={{ duration: 0.85, ease: "backOut" }}
                  className="absolute -top-1 left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap bg-[#FF6B00] text-white border-[2px] border-black text-[9.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-[2px_2px_0px_#000] z-30 flex items-center gap-1"
                >
                  <Flame size={11} className="fill-white text-white shrink-0 animate-pulse" />
                  <span>+1 STREAK!</span>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="button"
              id="header-streak-counter"
              onClick={triggerPreviewBounce}
              animate={
                isBouncing
                  ? {
                      scale: [1, 1.4, 0.88, 1.18, 0.96, 1.05, 1],
                      rotate: [0, -8, 8, -4, 4, 0],
                      y: [0, -9, 2, -4, 0],
                    }
                  : {
                      scale: 1,
                      rotate: 0,
                      y: 0,
                    }
              }
              transition={{
                duration: 0.85,
                ease: "easeOut",
                times: [0, 0.2, 0.4, 0.6, 0.75, 0.9, 1],
              }}
              className={`flex items-center gap-1.5 border-[2.5px] border-black rounded-full px-2.5 sm:px-3 py-1.5 cursor-pointer transition-all duration-300 ${
                isBouncing
                  ? "bg-[#FFE066] text-black shadow-[3px_3px_0px_#000] ring-4 ring-orange-500/40"
                  : "bg-white dark:bg-[#1A1A1A] text-black dark:text-white brutal-shadow-sm hover:translate-y-[-1px]"
              }`}
              title={`Dating Streak: ${progress.streak} days • Keep it going!`}
              aria-label={`Dating streak: ${progress.streak} days`}
            >
              <motion.div
                animate={
                  isBouncing
                    ? {
                        scale: [1, 1.55, 0.9, 1.25, 1],
                        rotate: [0, -18, 18, -8, 8, 0],
                      }
                    : {
                        scale: 1,
                        rotate: 0,
                      }
                }
                transition={{ duration: 0.85, ease: "easeOut" }}
                className="flex items-center justify-center"
              >
                <Flame
                  size={15}
                  className={`transition-colors duration-200 ${
                    isBouncing
                      ? "text-[#FF4D00] fill-[#FF4D00] drop-shadow-[0_2px_4px_rgba(255,77,0,0.6)]"
                      : "text-orange-500 fill-orange-500"
                  }`}
                />
              </motion.div>
              <motion.span
                animate={
                  isBouncing
                    ? {
                        scale: [1, 1.35, 0.95, 1.15, 1],
                        color: ["#111111", "#FF4D00", "#111111"],
                      }
                    : {
                        scale: 1,
                      }
                }
                transition={{ duration: 0.65 }}
                className="font-black text-[12px] sm:text-[13px]"
              >
                {progress.streak}
              </motion.span>
            </motion.button>
          </div>

          {/* XP pill */}
          <div className="flex items-center gap-1.5 bg-[#FFE066] text-black border-[2.5px] border-black rounded-full px-2.5 sm:px-3 py-1.5 brutal-shadow-sm">
            <Zap size={13} className="fill-black" />
            <span className="font-black text-[12px] sm:text-[13px]">{progress.xp}</span>
          </div>

          {/* Theme switcher button */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="w-9 h-9 bg-white dark:bg-[#1A1A1A] border-[2.5px] border-black rounded-full flex items-center justify-center brutal-shadow-sm active:translate-y-[1px] active:shadow-none transition-transform cursor-pointer"
              title={`Switch to ${theme === "dark" ? "Brutalist Light" : "Neon Dark"} mode`}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun size={17} className="text-[#FFE066] fill-[#FFE066]" />
              ) : (
                <Moon size={17} className="text-black" />
              )}
            </button>
          )}

          {/* Current User Pill or Sign In Button */}
          {currentUser ? (
            <button
              onClick={onOpenProfile}
              className="h-9 px-2.5 bg-white dark:bg-[#1A1A1A] border-[2.5px] border-black rounded-full flex items-center gap-1.5 brutal-shadow-sm active:translate-y-[1px] active:shadow-none overflow-hidden cursor-pointer"
              title={`Logged in as @${currentUser.username} • View Profile`}
            >
              <div className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center bg-[#FFE066] text-black text-[10px] font-black shrink-0">
                {avatarUrl || currentUser.avatarUrl ? (
                  <img
                    src={avatarUrl || currentUser.avatarUrl}
                    className="w-full h-full object-cover"
                    alt={currentUser.name}
                  />
                ) : (
                  currentUser.username.charAt(0).toUpperCase()
                )}
              </div>
              <span className="font-mono font-bold text-[11px] max-w-[80px] sm:max-w-[100px] truncate hidden xs:inline text-black dark:text-white">
                @{currentUser.username}
              </span>
            </button>
          ) : (
            <button
              onClick={() => onOpenAuth && onOpenAuth("signin")}
              className="h-9 px-3 bg-[#FFE066] text-black border-[2.5px] border-black rounded-full font-black text-[12px] flex items-center gap-1.5 brutal-shadow-sm active:translate-y-[1px] cursor-pointer"
              title="Sign In or Register"
            >
              <LogIn size={14} />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

