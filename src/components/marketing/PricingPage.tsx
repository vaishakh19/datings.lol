import React from "react";
import { ArrowRight, Check, Crown, X } from "lucide-react";

interface PricingPageProps {
  navigate: (path: string) => void;
}

const FREE_FEATURES = [
  { text: "Daily brutal lesson + task", included: true },
  { text: "3 coach roasts per day", included: true },
  { text: "Streaks, XP, ranks & badges", included: true },
  { text: "Daily hot take votes", included: true },
  { text: "Unlimited chat + photo roasts", included: false },
  { text: "Full profile roast report", included: false },
  { text: "Streak freeze", included: false },
];

const PRO_FEATURES = [
  { text: "Everything in Free", included: true },
  { text: "Unlimited chat + photo upload roasts", included: true },
  { text: "Profile roast report (photos, prompts, bio)", included: true },
  { text: "All lessons unlocked", included: true },
  { text: "Streak freeze — protect the grind", included: true },
  { text: "Coach on call 24/7, no daily cap", included: true },
];

const FAQS = [
  {
    q: "Is the free plan actually free?",
    a: "Yes. No card, no trial countdown, no bait. You get a real daily lesson and 3 coach roasts a day, forever. Pro exists for people who want the coach on unlimited call.",
  },
  {
    q: "What does the coach actually do?",
    a: "You paste a conversation (or upload a screenshot) and it tells you where things went sideways, what to send next, and what to never send again. It also reviews profiles: photos, prompts, bio — the whole crime scene.",
  },
  {
    q: "Is this going to be mean?",
    a: "Honest, not cruel. The roast is the delivery mechanism; the payload is always a concrete fix. You pick your vibe during onboarding — from 'gentle' to 'roast me into a better person'.",
  },
  {
    q: "Can I cancel Pro anytime?",
    a: "Yep. One tap, no guilt trip, no 'are you sure? but why? please stay' maze. Your streak and XP stay yours either way.",
  },
];

export const PricingPage: React.FC<PricingPageProps> = ({ navigate }) => {
  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-12 sm:py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 bg-[#BEF264] border-[2px] border-black rounded-full brutal-shadow-sm">
          💸 Pricing
        </span>
        <h1 className="mt-4 font-black tracking-tighter text-[40px] sm:text-[56px] leading-[0.95]">
          Cheaper than one bad date.
        </h1>
        <p className="mt-3 text-[15px] font-bold text-black/60 max-w-[460px] mx-auto">
          Start free. Upgrade when you want the coach on unlimited call. That's the
          whole pricing page, but here it is in card form:
        </p>
      </div>

      {/* Plans */}
      <div className="grid md:grid-cols-2 gap-6 max-w-[820px] mx-auto items-stretch">
        {/* Free */}
        <div className="bg-white border-[3px] border-black rounded-[28px] brutal-shadow p-7 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 bg-[#FFFBEB] border-[2px] border-black rounded-full">
              Free
            </span>
          </div>
          <div className="mb-1 flex items-end gap-1">
            <span className="font-black tracking-tighter text-[52px] leading-none">$0</span>
            <span className="font-bold text-black/50 text-[14px] mb-1.5">/ forever</span>
          </div>
          <p className="text-[13px] font-bold text-black/60 mb-6">
            The daily habit. Enough to fix the fundamentals.
          </p>
          <ul className="space-y-2.5 mb-8">
            {FREE_FEATURES.map((f) => (
              <li
                key={f.text}
                className={`flex items-start gap-2.5 text-[14px] font-bold ${
                  f.included ? "" : "text-black/35"
                }`}
              >
                <span
                  className={`mt-0.5 w-5 h-5 border-[2px] border-black rounded-full flex items-center justify-center shrink-0 ${
                    f.included ? "bg-[#BEF264]" : "bg-white border-black/30"
                  }`}
                >
                  {f.included ? (
                    <Check size={11} strokeWidth={4} />
                  ) : (
                    <X size={11} strokeWidth={4} className="text-black/30" />
                  )}
                </span>
                {f.text}
              </li>
            ))}
          </ul>
          <button
            onClick={() => navigate("/signup")}
            className="mt-auto w-full h-[52px] bg-white border-[3px] border-black rounded-full font-black text-[14px] uppercase brutal-shadow-sm hover:bg-[#FFE066] transition-colors"
          >
            Start free
          </button>
        </div>

        {/* Pro */}
        <div className="relative bg-[#111] text-white border-[3px] border-black rounded-[28px] brutal-shadow p-7 flex flex-col">
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-[#FFE066] text-black border-[2px] border-black rounded-full">
            Most roasted
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-3 py-1 bg-[#FFE066] text-black border-[2px] border-black rounded-full">
              <Crown size={12} /> Pro
            </span>
          </div>
          <div className="mb-1 flex items-end gap-1">
            <span className="font-black tracking-tighter text-[52px] leading-none">$9</span>
            <span className="font-bold text-white/50 text-[14px] mb-1.5">/ month</span>
          </div>
          <p className="text-[13px] font-bold text-white/60 mb-6">
            The coach on unlimited call. No daily cap, no mercy.
          </p>
          <ul className="space-y-2.5 mb-8">
            {PRO_FEATURES.map((f) => (
              <li key={f.text} className="flex items-start gap-2.5 text-[14px] font-bold">
                <span className="mt-0.5 w-5 h-5 bg-[#FFE066] border-[2px] border-black rounded-full flex items-center justify-center shrink-0 text-black">
                  <Check size={11} strokeWidth={4} />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
          <button
            onClick={() => navigate("/signup")}
            className="mt-auto w-full h-[52px] bg-[#FFE066] text-black border-[3px] border-black rounded-full font-black text-[14px] uppercase shadow-[3px_3px_0px_#000] hover:translate-y-[-2px] transition-transform flex items-center justify-center gap-2"
          >
            <Crown size={16} /> Go Pro — $9/mo
          </button>
        </div>
      </div>

      <p className="text-center text-[11px] font-bold text-black/40 uppercase tracking-widest mt-6">
        Upgrade from inside the app • Cancel anytime • Streak stays yours
      </p>

      {/* FAQ */}
      <div className="max-w-[720px] mx-auto mt-16">
        <h2 className="font-black tracking-tighter text-[30px] sm:text-[36px] text-center mb-8">
          Questions people actually ask
        </h2>
        <div className="space-y-4">
          {FAQS.map((f) => (
            <div
              key={f.q}
              className="bg-white border-[3px] border-black rounded-[20px] brutal-shadow-sm p-5"
            >
              <h3 className="font-black text-[16px] tracking-tight mb-1.5">{f.q}</h3>
              <p className="text-[14px] font-bold text-black/60 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <button
            onClick={() => navigate("/signup")}
            className="inline-flex items-center gap-2 px-8 py-4 bg-[#111] text-white border-[3px] border-black rounded-full font-black text-[15px] uppercase brutal-shadow hover:translate-y-[-2px] transition-transform"
          >
            Start free, upgrade never (or later) <ArrowRight size={17} strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
};
