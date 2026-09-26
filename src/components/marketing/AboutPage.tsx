import React from "react";
import { ArrowRight, Flame, HeartCrack, Target, Zap } from "lucide-react";

interface AboutPageProps {
  navigate: (path: string) => void;
}

const BELIEFS = [
  {
    icon: Flame,
    color: "#FFE066",
    title: "Honesty is a feature",
    text: "Most dating advice is either toxic or toothless. We picked a third option: tell you the truth about your 'hey' opener, kindly, and then fix it. The roast is the delivery mechanism. The fix is the point.",
  },
  {
    icon: Zap,
    color: "#A78BFA",
    title: "Reps beat theory",
    text: "You don't get better at dating by watching a 4-hour video course. You get better by sending three real openers today. Every lesson ends in a task. Every task earns XP. That's not gamification for fun — it's how habits actually form.",
  },
  {
    icon: Target,
    color: "#BEF264",
    title: "Small fixes, big swings",
    text: "The gap between 'the apps don't work' and 'I have a date Thursday' is usually five boring fundamentals: photo one, a specific opener, playful texting, closing for the date, and not double-texting at 1 AM. We drill exactly those.",
  },
  {
    icon: HeartCrack,
    color: "#FDA4AF",
    title: "No fake gurus",
    text: "No alpha nonsense, no manipulation 'techniques', no 200-page PDF funnels. If a tactic requires you to pretend to be someone else, it doesn't work and it isn't here.",
  },
];

export const AboutPage: React.FC<AboutPageProps> = ({ navigate }) => {
  return (
    <div>
      {/* Hero */}
      <section className="border-b-[3px] border-black bg-[#FFE066]">
        <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 bg-white border-[2px] border-black rounded-full brutal-shadow-sm">
            ✊ The manifesto
          </span>
          <h1 className="mt-5 font-black tracking-tighter text-[40px] sm:text-[60px] leading-[0.95]">
            Dating advice was broken.
            <br />
            So we roasted it.
          </h1>
          <p className="mt-5 text-[15px] sm:text-[17px] font-bold text-black/70 max-w-[560px] mx-auto leading-relaxed">
            datings.lol exists because the internet's dating advice comes in exactly two
            flavors: creepy manipulation tactics from self-declared gurus, and vague
            "just be yourself!" fluff that fixes nothing. Neither ever got anyone a
            second date.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="max-w-[720px] mx-auto px-4 sm:px-6 py-14">
        <div className="space-y-5 text-[15.5px] font-medium leading-[1.75] text-black/80">
          <p>
            Here's what we noticed: the people who are "good at dating" aren't smoother,
            hotter, or luckier than you. They just don't make the five unforced errors
            everyone else makes on repeat — the lazy opener, the interview texting, the
            sunglasses profile, the pen-pal spiral, the 1 AM double text.
          </p>
          <p>
            Those are all fixable. Not with a personality transplant — with reps. So we
            built the thing we wished existed: a daily two-minute lesson that stings a
            little, a task that forces you to actually do it, and an AI coach you can
            hand your messiest conversation to at 2 AM and get a straight answer.
          </p>
          <p>
            The name is datings.lol because if you can't laugh at your own "hey
            beautiful 😍" era, you can't leave it behind either. We take your results
            seriously. Ourselves? Less so.
          </p>
        </div>
      </section>

      {/* Beliefs */}
      <section className="border-t-[3px] border-black bg-white">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-16">
          <h2 className="font-black tracking-tighter text-[32px] sm:text-[42px] text-center mb-10">
            What we believe
          </h2>
          <div className="grid md:grid-cols-2 gap-5">
            {BELIEFS.map((b) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.title}
                  className="bg-[#FFFBEB] border-[3px] border-black rounded-[24px] brutal-shadow-sm p-6"
                >
                  <div
                    className="w-11 h-11 border-[3px] border-black rounded-full flex items-center justify-center mb-4"
                    style={{ background: b.color }}
                  >
                    <Icon size={20} strokeWidth={2.75} />
                  </div>
                  <h3 className="font-black text-[20px] tracking-tighter mb-2">{b.title}</h3>
                  <p className="text-[14px] font-bold text-black/60 leading-relaxed">
                    {b.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t-[3px] border-black bg-[#111] text-white">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="font-black tracking-tighter text-[32px] sm:text-[44px] leading-[1]">
            Day one is a 2-minute lesson.
            <br />
            <span className="text-[#FFE066]">That's the whole ask.</span>
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => navigate("/signup")}
              className="flex items-center gap-2 px-8 py-4 bg-[#FFE066] text-black border-[3px] border-black rounded-full font-black text-[15px] uppercase shadow-[4px_4px_0px_#000] hover:translate-y-[-2px] transition-transform"
            >
              Start free <ArrowRight size={18} strokeWidth={3} />
            </button>
            <button
              onClick={() => navigate("/blog")}
              className="px-7 py-4 border-[3px] border-white rounded-full font-black text-[15px] uppercase hover:bg-white hover:text-black transition-colors"
            >
              Read the blog first
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
