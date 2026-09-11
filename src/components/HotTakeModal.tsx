import React, { useState } from "react";
import { Flame, X, Check, Sparkles, Trophy, ArrowRight, MessageSquareQuote } from "lucide-react";
import { HotTake } from "../data/hotTakes";

interface HotTakeModalProps {
  hotTake: HotTake;
  onVote: (reaction: "agree" | "disagree" | "complicated", xpReward: number) => void;
  onClose: () => void;
}

export const HotTakeModal: React.FC<HotTakeModalProps> = ({
  hotTake,
  onVote,
  onClose,
}) => {
  const [selectedReaction, setSelectedReaction] = useState<"agree" | "disagree" | "complicated" | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  const handleVote = (reaction: "agree" | "disagree" | "complicated") => {
    if (hasVoted) return;

    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate([40, 30, 60]);
      } catch {}
    }

    setSelectedReaction(reaction);
    setHasVoted(true);
    onVote(reaction, hotTake.bonusXp);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-[460px] bg-[#FFFBEB] dark:bg-[#0F0F0F] border-[4px] border-black rounded-[28px] brutal-shadow p-5 sm:p-6 animate-[pop_0.35s_cubic-bezier(0.175,0.885,0.32,1.275)] max-h-[90vh] overflow-y-auto">
        {/* Top Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-[#FFE066] border-[2.5px] border-black rounded-[14px] flex items-center justify-center brutal-shadow-sm text-black">
              <Flame size={22} className="text-black animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider bg-black text-[#FFE066] px-2 py-0.5 rounded-full">
                  Daily Hot Take
                </span>
                <span className="text-[11px] font-black text-[#111] dark:text-[#FFE066] bg-[#BEF264] dark:bg-[#2A2600] px-2 py-0.5 rounded-full border border-black dark:border-[#FFE066]">
                  +{hotTake.bonusXp} XP
                </span>
              </div>
              <div className="text-[11px] font-bold opacity-60 uppercase tracking-widest mt-0.5">
                {hotTake.topic}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close Hot Take"
            className="w-8 h-8 bg-white dark:bg-[#1A1A1A] border-[2.5px] border-black dark:border-[#444] rounded-full flex items-center justify-center hover:bg-black hover:text-white transition-colors"
          >
            <X size={16} strokeWidth={3} />
          </button>
        </div>

        {/* Hot Take Statement Box */}
        <div className="bg-white dark:bg-[#181818] border-[3px] border-black rounded-[22px] p-4 sm:p-5 mb-4 brutal-shadow-sm relative">
          <div className="flex items-start gap-2.5 mb-2">
            <MessageSquareQuote size={20} className="text-[#FFE066] shrink-0 mt-0.5" />
            <h3 className="font-black text-[18px] sm:text-[20px] leading-snug tracking-tight text-[#111] dark:text-white">
              "{hotTake.statement}"
            </h3>
          </div>
          <p className="text-[13px] font-medium opacity-75 leading-relaxed pl-7 text-[#111] dark:text-gray-300">
            {hotTake.subtext}
          </p>
        </div>

        {/* Voting Choices */}
        {!hasVoted ? (
          <div className="space-y-2.5">
            <div className="text-center text-[11px] font-black uppercase tracking-wider opacity-60 mb-1">
              Tap to cast your vote & grab +{hotTake.bonusXp} XP:
            </div>

            <button
              onClick={() => handleVote("agree")}
              className="w-full h-[50px] bg-white hover:bg-[#BEF264] border-[3px] border-black rounded-[18px] font-black text-[15px] uppercase tracking-wide flex items-center justify-between px-5 brutal-shadow-sm hover:translate-y-[-1px] active:translate-y-0 transition-all text-[#111]"
            >
              <span className="flex items-center gap-2">
                <span className="text-[18px]">🔥</span> Based (Agree)
              </span>
              <span className="text-[12px] bg-[#111] text-white px-2 py-0.5 rounded-full font-bold">
                +{hotTake.bonusXp} XP
              </span>
            </button>

            <button
              onClick={() => handleVote("disagree")}
              className="w-full h-[50px] bg-white hover:bg-[#FECACA] border-[3px] border-black rounded-[18px] font-black text-[15px] uppercase tracking-wide flex items-center justify-between px-5 brutal-shadow-sm hover:translate-y-[-1px] active:translate-y-0 transition-all text-[#111]"
            >
              <span className="flex items-center gap-2">
                <span className="text-[18px]">🧢</span> Cap (Disagree)
              </span>
              <span className="text-[12px] bg-[#111] text-white px-2 py-0.5 rounded-full font-bold">
                +{hotTake.bonusXp} XP
              </span>
            </button>

            <button
              onClick={() => handleVote("complicated")}
              className="w-full h-[50px] bg-white hover:bg-[#DDD6FE] border-[3px] border-black rounded-[18px] font-black text-[15px] uppercase tracking-wide flex items-center justify-between px-5 brutal-shadow-sm hover:translate-y-[-1px] active:translate-y-0 transition-all text-[#111]"
            >
              <span className="flex items-center gap-2">
                <span className="text-[18px]">💀</span> It's Complicated
              </span>
              <span className="text-[12px] bg-[#111] text-white px-2 py-0.5 rounded-full font-bold">
                +{hotTake.bonusXp} XP
              </span>
            </button>
          </div>
        ) : (
          /* Results Breakdown & Coach Reaction */
          <div className="space-y-4 animate-[pop_0.3s_ease-out]">
            {/* Poll Breakdown Bars */}
            <div className="bg-white dark:bg-[#181818] border-[3px] border-black rounded-[20px] p-4 brutal-shadow-sm space-y-3">
              <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-wider">
                <span>Community Pulse</span>
                <span className="text-[#BEF264] bg-black px-2 py-0.5 rounded-full">
                  Verified Votes
                </span>
              </div>

              {/* Based / Agree Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[12px] font-black">
                  <span className="flex items-center gap-1.5">
                    🔥 Based {selectedReaction === "agree" && <span className="text-[10px] bg-black text-[#FFE066] px-1.5 py-0.2 rounded-full">You</span>}
                  </span>
                  <span>{hotTake.agreePercent}%</span>
                </div>
                <div className="w-full h-3 bg-gray-200 dark:bg-gray-800 rounded-full border-[1.5px] border-black overflow-hidden">
                  <div
                    className="h-full bg-[#4ADE80] transition-all duration-700 ease-out"
                    style={{ width: `${hotTake.agreePercent}%` }}
                  />
                </div>
              </div>

              {/* Cap / Disagree Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[12px] font-black">
                  <span className="flex items-center gap-1.5">
                    🧢 Cap {selectedReaction === "disagree" && <span className="text-[10px] bg-black text-[#FFE066] px-1.5 py-0.2 rounded-full">You</span>}
                  </span>
                  <span>{hotTake.disagreePercent}%</span>
                </div>
                <div className="w-full h-3 bg-gray-200 dark:bg-gray-800 rounded-full border-[1.5px] border-black overflow-hidden">
                  <div
                    className="h-full bg-[#F87171] transition-all duration-700 ease-out"
                    style={{ width: `${hotTake.disagreePercent}%` }}
                  />
                </div>
              </div>

              {/* Complicated Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[12px] font-black">
                  <span className="flex items-center gap-1.5">
                    💀 Complicated {selectedReaction === "complicated" && <span className="text-[10px] bg-black text-[#FFE066] px-1.5 py-0.2 rounded-full">You</span>}
                  </span>
                  <span>{hotTake.complicatedPercent}%</span>
                </div>
                <div className="w-full h-3 bg-gray-200 dark:bg-gray-800 rounded-full border-[1.5px] border-black overflow-hidden">
                  <div
                    className="h-full bg-[#A78BFA] transition-all duration-700 ease-out"
                    style={{ width: `${hotTake.complicatedPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Coach Insight */}
            {selectedReaction && (
              <div className="bg-[#FFE066] border-[3px] border-black rounded-[20px] p-4 brutal-shadow-sm text-black">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 bg-black text-[#FFE066] rounded-full flex items-center justify-center font-black text-[11px]">
                    👁️
                  </div>
                  <span className="font-black text-[12px] uppercase tracking-wider">
                    Coach Verdict
                  </span>
                </div>
                <p className="text-[13px] font-bold leading-snug">
                  {hotTake.coachInsight[selectedReaction]}
                </p>
              </div>
            )}

            {/* Continue Button */}
            <button
              onClick={onClose}
              className="w-full h-[48px] bg-[#111] text-white border-[3px] border-black rounded-full font-black text-[14px] uppercase tracking-wide flex items-center justify-center gap-2 brutal-shadow-sm hover:bg-black active:scale-98 transition-all"
            >
              <span>Continue to Today's Glow-Up</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
