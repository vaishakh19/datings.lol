import React from "react";
import {
  ArrowRight,
  Calendar,
  Flame,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
  User,
  Zap,
  Check,
} from "lucide-react";
import { SORTED_ARTICLES, formatArticleDate } from "../../data/articles";

interface LandingPageProps {
  navigate: (path: string) => void;
  isAuthed: boolean;
}

const MARQUEE_ITEMS = [
  "🔥 'hey' is not an opener",
  "💬 roast my chat",
  "⚡ 5 messages → date",
  "👻 ghosted? 24hr rule",
  "📸 delete the sunglasses pics",
  "🌶️ daily hot takes",
  "🏆 protect the streak",
  "💀 no more double texts",
  "🎯 photo one is 70% of the swipe",
];

const FEATURES = [
  {
    icon: Calendar,
    color: "#FFE066",
    tag: "TODAY",
    title: "One brutal lesson a day",
    desc: "Short, punchy daily lessons on openers, texting, photos, and dates — each with a real-world task and XP on the line. No 4-hour video courses. Ever.",
    points: ["2-minute reads, zero fluff", "Daily tasks with XP rewards", "Streaks you'll actually defend"],
  },
  {
    icon: MessageCircle,
    color: "#A78BFA",
    tag: "COACH",
    title: "AI coach that roasts your chats",
    desc: "Paste the conversation. Get told exactly where it died, what to text back, and why your opener deserved to be left on read. Instant, honest, useful.",
    points: ["Roast my chat", "What do I text back?", "Full profile reviews"],
  },
  {
    icon: Users,
    color: "#FDA4AF",
    tag: "COMMUNITY",
    title: "Hot takes & the community wall",
    desc: "One spicy dating debate a day. Vote, argue, earn XP, and find out how unhinged your opinions actually are compared to everyone else's.",
    points: ["Daily hot take votes", "Community results", "Bonus XP for showing up"],
  },
  {
    icon: User,
    color: "#BEF264",
    tag: "PROFILE",
    title: "Track the glow-up",
    desc: "XP, ranks, badges, journal, and a streak counter that judges you. Watch yourself go from 'hey' sender to someone with actual game.",
    points: ["Rank up with XP", "Earn badges", "Progress journal"],
  },
];

const TESTIMONIALS = [
  {
    quote:
      "The coach roasted my opener so hard I rewrote it on the spot. New one got a reply in 20 minutes. I'm scared and grateful.",
    name: "Marco, 26",
    color: "#FFE066",
  },
  {
    quote:
      "The 24-hour no-double-text rule saved me from myself at least four times. That alone is worth it.",
    name: "Priya, 29",
    color: "#A78BFA",
  },
  {
    quote:
      "Deleted two photos after the audit lesson. Matches went up that week. Turns out the sunglasses WERE the problem.",
    name: "Dan, 31",
    color: "#BEF264",
  },
  {
    quote:
      "It's like Duolingo, if the owl swore at you about your texting habits. 34-day streak and counting.",
    name: "Jess, 24",
    color: "#FDA4AF",
  },
  {
    quote:
      "Pasted a dead conversation into the coach. It found the exact message where I turned into an interviewer. Brutal. Accurate.",
    name: "Tomi, 27",
    color: "#7DD3FC",
  },
  {
    quote:
      "The hot takes are a menace. I've argued with strangers about ketchup on dates twice this week. 10/10.",
    name: "Alba, 30",
    color: "#FDBA74",
  },
];

const STATS = [
  { value: "0.8s", label: "How long your first photo gets before the swipe" },
  { value: "3/day", label: "Free coach roasts. Pro goes unlimited." },
  { value: "2 min", label: "Length of a daily lesson. That's the whole ask." },
  { value: "24hrs", label: "The double-text rule that saves your dignity" },
];

export const LandingPage: React.FC<LandingPageProps> = ({ navigate, isAuthed }) => {
  const latestArticles = SORTED_ARTICLES.slice(0, 3);
  const primaryCta = () => navigate(isAuthed ? "/dashboard" : "/signup");

  return (
    <div>
      {/* ============================== HERO ============================== */}
      <section className="relative overflow-hidden">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 pt-14 pb-10 sm:pt-20 sm:pb-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 bg-[#FFE066] border-[2px] border-black rounded-full brutal-shadow-sm">
                  🔥 Dating coach & chat roaster
                </span>
                <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 bg-white border-[2px] border-black rounded-full">
                  Free to start
                </span>
              </div>

              <h1 className="font-black tracking-tighter leading-[0.95] text-[44px] sm:text-[64px]">
                Get better at dating.{" "}
                <span className="relative inline-block">
                  <span className="relative z-10">Brutally.</span>
                  <span className="absolute inset-x-[-4px] bottom-1 h-[38%] bg-[#FFE066] border-[2px] border-black -z-0 rotate-[-1deg]" />
                </span>
              </h1>

              <p className="mt-5 text-[16px] sm:text-[18px] font-bold text-black/70 leading-relaxed max-w-[480px]">
                Daily lessons that fix your texting, an AI coach that roasts your chats
                and profile, and a streak that keeps you honest. No gurus. No 200-page
                PDFs. Just reps.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  onClick={primaryCta}
                  className="flex items-center gap-2 px-7 py-4 bg-[#111] text-white border-[3px] border-black rounded-full font-black text-[15px] uppercase brutal-shadow hover:translate-y-[-2px] transition-transform"
                >
                  {isAuthed ? "Open the app" : "Start free"}{" "}
                  <ArrowRight size={18} strokeWidth={3} />
                </button>
                <button
                  onClick={() => navigate("/blog")}
                  className="px-6 py-4 bg-white border-[3px] border-black rounded-full font-black text-[15px] uppercase brutal-shadow-sm hover:bg-[#FFE066] transition-colors"
                >
                  Read the blog
                </button>
              </div>

              <div className="mt-6 flex items-center gap-2 text-[12px] font-bold text-black/50">
                <ShieldCheck size={15} />
                No credit card. 3 free coach roasts a day, forever.
              </div>
            </div>

            {/* Product mock cards */}
            <div className="relative hidden sm:block">
              <div className="relative mx-auto max-w-[420px]">
                {/* Coach chat card */}
                <div className="bg-white border-[3px] border-black rounded-[24px] brutal-shadow p-5 rotate-[-2deg]">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-[#A78BFA] border-[2px] border-black rounded-full flex items-center justify-center">
                      <MessageCircle size={15} strokeWidth={3} />
                    </div>
                    <span className="font-black text-[14px]">Coach</span>
                    <span className="ml-auto text-[10px] font-black uppercase px-2 py-0.5 bg-[#BEF264] border-[2px] border-black rounded-full">
                      Online
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="max-w-[85%] bg-[#FFFBEB] border-[2.5px] border-black rounded-[16px] rounded-tl-[4px] px-3.5 py-2.5 text-[13px] font-bold">
                      yo, paste your chat. let's see the damage 👁️
                    </div>
                    <div className="max-w-[85%] ml-auto bg-[#FFE066] border-[2.5px] border-black rounded-[16px] rounded-tr-[4px] px-3.5 py-2.5 text-[13px] font-bold">
                      I opened with "hey" and got left on read…
                    </div>
                    <div className="max-w-[85%] bg-[#FFFBEB] border-[2.5px] border-black rounded-[16px] rounded-tl-[4px] px-3.5 py-2.5 text-[13px] font-bold">
                      of course you did. 'hey' is a receipt confirming you exist.
                      here's what we're sending instead 👇
                    </div>
                  </div>
                </div>

                {/* Streak card */}
                <div className="absolute -right-3 -top-6 bg-[#111] text-white border-[3px] border-black rounded-[20px] brutal-shadow px-4 py-3 rotate-[3deg] flex items-center gap-2">
                  <Flame size={18} className="text-[#FF6B00] fill-[#FF6B00]" />
                  <div>
                    <div className="font-black text-[18px] leading-none">17 days</div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-white/60">
                      Streak
                    </div>
                  </div>
                </div>

                {/* XP card */}
                <div className="absolute -left-4 -bottom-6 bg-[#BEF264] border-[3px] border-black rounded-[20px] brutal-shadow px-4 py-3 rotate-[-3deg] flex items-center gap-2">
                  <Zap size={18} strokeWidth={3} />
                  <div>
                    <div className="font-black text-[18px] leading-none">+30 XP</div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-black/60">
                      Task complete
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Marquee */}
        <div className="border-y-[3px] border-black bg-[#111] text-[#FFFBEB] py-3 overflow-hidden">
          <div className="flex whitespace-nowrap marquee-track">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex shrink-0" aria-hidden={dup === 1}>
                {MARQUEE_ITEMS.map((item, i) => (
                  <span
                    key={`${dup}-${i}`}
                    className="mx-6 text-[13px] font-black uppercase tracking-widest"
                  >
                    {item}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ FEATURES ============================ */}
      <section className="max-w-[1100px] mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-12">
          <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 bg-[#A78BFA] border-[2px] border-black rounded-full brutal-shadow-sm">
            The system
          </span>
          <h2 className="mt-4 font-black tracking-tighter text-[34px] sm:text-[46px] leading-[1]">
            Everything you need.
            <br />
            Nothing you'll skip.
          </h2>
          <p className="mt-3 text-[15px] font-bold text-black/60 max-w-[520px] mx-auto">
            Four tabs. One habit. datings.lol turns "getting better at dating" from a
            vague wish into a daily rep you actually do.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.tag}
                className="bg-white border-[3px] border-black rounded-[24px] brutal-shadow p-6 sm:p-7 hover:translate-y-[-3px] transition-transform"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-11 h-11 border-[3px] border-black rounded-full flex items-center justify-center"
                    style={{ background: f.color }}
                  >
                    <Icon size={20} strokeWidth={2.75} />
                  </div>
                  <span
                    className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 border-[2px] border-black rounded-full"
                    style={{ background: f.color }}
                  >
                    {f.tag}
                  </span>
                </div>
                <h3 className="font-black text-[22px] tracking-tighter leading-tight mb-2">
                  {f.title}
                </h3>
                <p className="text-[14px] font-bold text-black/60 leading-relaxed mb-4">
                  {f.desc}
                </p>
                <ul className="space-y-1.5">
                  {f.points.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-[13px] font-bold">
                      <span
                        className="w-5 h-5 border-[2px] border-black rounded-full flex items-center justify-center shrink-0"
                        style={{ background: f.color }}
                      >
                        <Check size={11} strokeWidth={4} />
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* ============================== STATS ============================= */}
      <section className="border-y-[3px] border-black bg-[#FFE066]">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((s) => (
            <div key={s.value} className="text-center">
              <div className="font-black tracking-tighter text-[38px] sm:text-[46px] leading-none">
                {s.value}
              </div>
              <div className="mt-2 text-[12px] font-bold text-black/70 leading-snug max-w-[200px] mx-auto">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =========================== TESTIMONIALS ========================== */}
      <section className="max-w-[1100px] mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-12">
          <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 bg-[#FDA4AF] border-[2px] border-black rounded-full brutal-shadow-sm">
            Receipts
          </span>
          <h2 className="mt-4 font-black tracking-tighter text-[34px] sm:text-[46px] leading-[1]">
            People we've roasted, lovingly.
          </h2>
        </div>

        <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 [&>div]:mb-5">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="break-inside-avoid bg-white border-[3px] border-black rounded-[24px] brutal-shadow-sm p-6"
            >
              <div
                className="w-8 h-8 border-[2.5px] border-black rounded-full flex items-center justify-center font-black text-[16px] mb-3"
                style={{ background: t.color }}
              >
                "
              </div>
              <p className="text-[14px] font-bold leading-relaxed mb-4">{t.quote}</p>
              <div className="text-[12px] font-black uppercase tracking-widest text-black/50">
                — {t.name}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =========================== BLOG PREVIEW ========================== */}
      <section className="border-t-[3px] border-black bg-white">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 bg-[#BEF264] border-[2px] border-black rounded-full brutal-shadow-sm">
                From the blog
              </span>
              <h2 className="mt-4 font-black tracking-tighter text-[34px] sm:text-[46px] leading-[1]">
                Free game. Take it.
              </h2>
            </div>
            <button
              onClick={() => navigate("/blog")}
              className="flex items-center gap-2 px-5 py-3 bg-[#FFFBEB] border-[3px] border-black rounded-full font-black text-[13px] uppercase brutal-shadow-sm hover:bg-[#FFE066] transition-colors"
            >
              All articles <ArrowRight size={15} strokeWidth={3} />
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {latestArticles.map((a) => (
              <button
                key={a.slug}
                onClick={() => navigate(`/blog/${a.slug}`)}
                className="text-left bg-[#FFFBEB] border-[3px] border-black rounded-[24px] brutal-shadow-sm overflow-hidden hover:translate-y-[-3px] transition-transform"
              >
                <div
                  className="h-[110px] border-b-[3px] border-black flex items-center justify-center text-[44px]"
                  style={{ background: a.color }}
                >
                  {a.emoji}
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-white border-[2px] border-black rounded-full">
                      {a.category}
                    </span>
                    <span className="text-[11px] font-bold text-black/50">
                      {a.readMins} min read
                    </span>
                  </div>
                  <h3 className="font-black text-[17px] tracking-tight leading-snug mb-1.5">
                    {a.title}
                  </h3>
                  <p className="text-[13px] font-bold text-black/55 leading-relaxed line-clamp-2">
                    {a.excerpt}
                  </p>
                  <div className="mt-3 text-[11px] font-black uppercase tracking-widest text-black/40">
                    {formatArticleDate(a.date)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ============================= BIG CTA ============================ */}
      <section className="border-t-[3px] border-black bg-[#111] text-[#FFFBEB]">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-20 text-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-3 py-1 bg-[#FFE066] text-black border-[2px] border-black rounded-full mb-6">
            <Sparkles size={13} /> Day 1 starts today
          </div>
          <h2 className="font-black tracking-tighter text-[38px] sm:text-[56px] leading-[0.98]">
            Your matches aren't the problem.
            <br />
            <span className="text-[#FFE066]">Your 'hey' is.</span>
          </h2>
          <p className="mt-5 text-[15px] sm:text-[17px] font-bold text-white/60 max-w-[480px] mx-auto">
            Join free, take today's lesson, and let the coach roast one chat. If it
            doesn't sting a little, we'll be shocked.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              onClick={primaryCta}
              className="flex items-center gap-2 px-8 py-4 bg-[#FFE066] text-black border-[3px] border-black rounded-full font-black text-[15px] uppercase shadow-[4px_4px_0px_#000] hover:translate-y-[-2px] transition-transform"
            >
              {isAuthed ? "Open the app" : "Get started free"}{" "}
              <ArrowRight size={18} strokeWidth={3} />
            </button>
            <button
              onClick={() => navigate("/pricing")}
              className="px-7 py-4 bg-transparent text-white border-[3px] border-white rounded-full font-black text-[15px] uppercase hover:bg-white hover:text-black transition-colors"
            >
              See pricing
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
