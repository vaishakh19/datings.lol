import React, { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { UserProfile } from "../types";

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const steps = [
    {
      q: "What's your main goal rn?",
      key: "goal",
      options: [
        { id: "dates", label: "Get more dates", emoji: "📅", desc: "I want actual plans" },
        { id: "confidence", label: "Be more confident", emoji: "💪", desc: "Stop second guessing" },
        { id: "texting", label: "Fix my texting", emoji: "💬", desc: "I fumble the chat" },
        { id: "relationship", label: "Better relationship", emoji: "💖", desc: "Keep the spark alive" },
      ],
    },
    {
      q: "What's blocking you most?",
      key: "blocker",
      options: [
        { id: "shy", label: "I'm shy af", emoji: "🫣", desc: "Hard to approach" },
        { id: "overthink", label: "I overthink everything", emoji: "🧠", desc: "Spiral central" },
        { id: "ghosted", label: "I get ghosted", emoji: "👻", desc: "Left on read a lot" },
        { id: "profile", label: "Profile sucks", emoji: "📸", desc: "No matches" },
      ],
    },
    {
      q: "Your experience level?",
      key: "experience",
      options: [
        { id: "new", label: "New to dating", emoji: "🌱", desc: "Starting from zero" },
        { id: "some", label: "Some dates", emoji: "🌿", desc: "Been around" },
        { id: "pro", label: "Talking stage pro", emoji: "🗣️", desc: "Stuck in limbo" },
      ],
    },
    {
      q: "Pick your coach vibe",
      key: "vibe",
      options: [
        { id: "roasty", label: "Roasty & Funny", emoji: "🔥", desc: "Be brutally honest lol" },
        { id: "gentle", label: "Gentle & Supportive", emoji: "🧸", desc: "Hype me up pls" },
        { id: "direct", label: "Direct & No BS", emoji: "🎯", desc: "Just tell me straight" },
      ],
    },
  ];

  const currentStep = steps[stepIndex] || steps[0];

  const handleNext = () => {
    if (!selectedOption) return;
    const newAnswers = { ...answers, [currentStep.key]: selectedOption };
    setAnswers(newAnswers);
    setSelectedOption(null);

    if (stepIndex >= steps.length - 1) {
      onComplete({
        goal: newAnswers.goal || "dates",
        blocker: newAnswers.blocker || "shy",
        experience: newAnswers.experience || "new",
        vibe: (newAnswers.vibe as "roasty" | "gentle" | "direct") || "roasty",
        startedAt: new Date().toISOString(),
      });
    } else {
      setStepIndex((prev) => prev + 1);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFBEB] text-[#111] flex flex-col items-center px-4 py-8 font-sans selection:bg-[#FFE066]">
      {/* Top Header */}
      <div className="w-full max-w-[480px] flex justify-between items-center mb-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#111] text-[#FFFBEB] rounded-full flex items-center justify-center font-black text-[14px]">
            d.
          </div>
          <span className="font-black text-[20px] tracking-tighter">
            datings.lol
          </span>
        </div>
        <div className="text-[12px] font-bold px-3 py-1 bg-white border-[2px] border-black rounded-full">
          step {stepIndex + 1}/{steps.length}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-[480px] h-[8px] bg-white border-[2px] border-black rounded-full overflow-hidden mb-10">
        <div
          className="h-full bg-[#111] transition-all duration-500"
          style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
        />
      </div>

      {/* Step Question & Cards */}
      <div className="w-full max-w-[480px] flex-1">
        <h1 className="text-[36px] font-black leading-[0.95] tracking-tighter mb-2">
          {currentStep.q}
        </h1>
        <p className="text-[16px] font-medium opacity-60 mb-8">
          We’ll tailor everything to you. No cap.
        </p>

        <div className="grid gap-3">
          {currentStep.options.map((opt) => {
            const isSelected = selectedOption === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setSelectedOption(opt.id)}
                className={`text-left border-[3px] border-black rounded-[20px] p-4 flex items-center gap-4 transition-all group ${
                  isSelected
                    ? "bg-[#111] text-white shadow-[4px_4px_0px_0px_#111] translate-x-[2px] translate-y-[-2px]"
                    : "bg-white hover:translate-x-[2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_#111] active:translate-x-0 active:translate-y-0 active:shadow-none"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-full border-[2px] border-black flex items-center justify-center text-[22px] transition-transform ${
                    isSelected
                      ? "bg-[#FFE066] scale-110"
                      : "bg-[#FFFBEB] group-hover:scale-110"
                  }`}
                >
                  {opt.emoji}
                </div>
                <div className="flex-1">
                  <div className="font-black text-[16px] leading-tight">
                    {opt.label}
                  </div>
                  <div
                    className={`text-[13px] font-medium ${
                      isSelected ? "opacity-70 text-white" : "opacity-60"
                    }`}
                  >
                    {opt.desc}
                  </div>
                </div>
                <div
                  className={`w-8 h-8 rounded-full border-[2px] flex items-center justify-center transition-opacity ${
                    isSelected
                      ? "border-white bg-white text-black opacity-100"
                      : "border-black opacity-30 group-hover:opacity-100"
                  }`}
                >
                  {isSelected ? (
                    <Check size={16} strokeWidth={3} />
                  ) : (
                    <ArrowRight size={16} strokeWidth={3} />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Continue Button */}
        <button
          onClick={handleNext}
          disabled={!selectedOption}
          className={`mt-6 w-full h-[52px] rounded-full border-[3px] border-black font-black text-[15px] uppercase tracking-wide flex items-center justify-center gap-2 transition-all ${
            selectedOption
              ? "bg-[#FFE066] text-black brutal-shadow translate-y-[-2px] hover:translate-y-[-1px]"
              : "bg-white text-black/30"
          }`}
        >
          {stepIndex === steps.length - 1 ? "Start my glow-up" : "Continue"}
          <ArrowRight size={18} strokeWidth={3} />
        </button>
      </div>

      <div className="w-full max-w-[480px] mt-10 flex justify-center">
        <p className="text-[11px] font-bold opacity-40 uppercase tracking-widest">
          built for main characters only • datings.lol
        </p>
      </div>
    </div>
  );
};
