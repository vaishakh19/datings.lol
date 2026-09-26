import React, { useMemo, useState } from "react";
import { ArrowRight, Flame } from "lucide-react";
import {
  ArticleCategory,
  CATEGORY_COLORS,
  SORTED_ARTICLES,
  formatArticleDate,
} from "../../data/articles";

interface BlogPageProps {
  navigate: (path: string) => void;
}

const CATEGORIES: (ArticleCategory | "All")[] = [
  "All",
  "Openers",
  "Texting",
  "Profile Glow-Up",
  "First Dates",
  "Mindset",
  "Hot Takes",
];

export const BlogPage: React.FC<BlogPageProps> = ({ navigate }) => {
  const [category, setCategory] = useState<ArticleCategory | "All">("All");

  const featured = SORTED_ARTICLES.find((a) => a.featured) ?? SORTED_ARTICLES[0];
  const filtered = useMemo(
    () =>
      SORTED_ARTICLES.filter(
        (a) => category === "All" || a.category === category,
      ).filter((a) => !(category === "All" && a.slug === featured.slug)),
    [category, featured.slug],
  );

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-12 sm:py-16">
      {/* Header */}
      <div className="mb-10">
        <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 bg-[#FFE066] border-[2px] border-black rounded-full brutal-shadow-sm">
          📚 The blog
        </span>
        <h1 className="mt-4 font-black tracking-tighter text-[40px] sm:text-[56px] leading-[0.95]">
          Free game.
          <br className="sm:hidden" /> Zero fluff.
        </h1>
        <p className="mt-3 text-[15px] font-bold text-black/60 max-w-[520px]">
          Everything we know about openers, texting, profiles, and first dates —
          written the way your most honest friend would say it.
        </p>
      </div>

      {/* Featured */}
      {category === "All" && (
        <button
          onClick={() => navigate(`/blog/${featured.slug}`)}
          className="w-full text-left mb-10 bg-white border-[3px] border-black rounded-[28px] brutal-shadow overflow-hidden hover:translate-y-[-3px] transition-transform group"
        >
          <div className="grid md:grid-cols-2">
            <div
              className="min-h-[180px] md:min-h-full border-b-[3px] md:border-b-0 md:border-r-[3px] border-black flex items-center justify-center text-[80px]"
              style={{ background: featured.color }}
            >
              {featured.emoji}
            </div>
            <div className="p-7 sm:p-9">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-[#111] text-white border-[2px] border-black rounded-full">
                  <Flame size={11} className="fill-[#FF6B00] text-[#FF6B00]" /> Featured
                </span>
                <span
                  className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 border-[2px] border-black rounded-full"
                  style={{ background: CATEGORY_COLORS[featured.category] }}
                >
                  {featured.category}
                </span>
              </div>
              <h2 className="font-black text-[26px] sm:text-[32px] tracking-tighter leading-[1.05] mb-3">
                {featured.title}
              </h2>
              <p className="text-[14px] font-bold text-black/60 leading-relaxed mb-5">
                {featured.excerpt}
              </p>
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-black uppercase tracking-widest text-black/40">
                  {formatArticleDate(featured.date)} • {featured.readMins} min read
                </div>
                <span className="inline-flex items-center gap-1.5 font-black text-[13px] uppercase group-hover:gap-2.5 transition-all">
                  Read it <ArrowRight size={15} strokeWidth={3} />
                </span>
              </div>
            </div>
          </div>
        </button>
      )}

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map((c) => {
          const active = category === c;
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-4 py-2 rounded-full border-[2.5px] border-black font-black text-[12.5px] uppercase transition-all ${
                active
                  ? "brutal-shadow-sm translate-y-[-1px]"
                  : "bg-white hover:bg-[#FFFBEB]"
              }`}
              style={{
                background: active
                  ? c === "All"
                    ? "#111"
                    : CATEGORY_COLORS[c as ArticleCategory]
                  : undefined,
                color: active && c === "All" ? "#fff" : undefined,
              }}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((a) => (
          <button
            key={a.slug}
            onClick={() => navigate(`/blog/${a.slug}`)}
            className="text-left bg-white border-[3px] border-black rounded-[24px] brutal-shadow-sm overflow-hidden hover:translate-y-[-3px] transition-transform"
          >
            <div
              className="h-[110px] border-b-[3px] border-black flex items-center justify-center text-[44px]"
              style={{ background: a.color }}
            >
              {a.emoji}
            </div>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 border-[2px] border-black rounded-full"
                  style={{ background: CATEGORY_COLORS[a.category] }}
                >
                  {a.category}
                </span>
                <span className="text-[11px] font-bold text-black/50">
                  {a.readMins} min
                </span>
              </div>
              <h3 className="font-black text-[17px] tracking-tight leading-snug mb-1.5">
                {a.title}
              </h3>
              <p className="text-[13px] font-bold text-black/55 leading-relaxed line-clamp-3">
                {a.excerpt}
              </p>
              <div className="mt-3 text-[11px] font-black uppercase tracking-widest text-black/40">
                {formatArticleDate(a.date)}
              </div>
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 font-black text-black/40 uppercase tracking-widest text-[13px]">
          Nothing here yet — the coach is still typing.
        </div>
      )}

      {/* CTA strip */}
      <div className="mt-14 bg-[#111] text-white border-[3px] border-black rounded-[28px] brutal-shadow p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div>
          <h3 className="font-black tracking-tighter text-[24px] sm:text-[28px] leading-tight">
            Reading is step one.
            <br className="sm:hidden" />{" "}
            <span className="text-[#FFE066]">Reps are step two.</span>
          </h3>
          <p className="mt-2 text-[13px] font-bold text-white/60">
            Turn the articles into a daily habit — lessons, tasks, XP, and a coach on call.
          </p>
        </div>
        <button
          onClick={() => navigate("/signup")}
          className="shrink-0 flex items-center gap-2 px-6 py-3.5 bg-[#FFE066] text-black border-[3px] border-black rounded-full font-black text-[14px] uppercase shadow-[3px_3px_0px_#000] hover:translate-y-[-2px] transition-transform"
        >
          Start free <ArrowRight size={16} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
};
