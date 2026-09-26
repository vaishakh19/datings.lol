import React from "react";
import { ArrowLeft, ArrowRight, Check, X, Quote } from "lucide-react";
import {
  Article,
  ArticleBlock,
  CATEGORY_COLORS,
  formatArticleDate,
  getRelatedArticles,
} from "../../data/articles";

interface ArticlePageProps {
  article: Article;
  navigate: (path: string) => void;
}

const BlockRenderer: React.FC<{ block: ArticleBlock; accent: string }> = ({
  block,
  accent,
}) => {
  switch (block.type) {
    case "h2":
      return (
        <h2 className="font-black tracking-tighter text-[24px] sm:text-[28px] leading-tight mt-10 mb-4">
          {block.text}
        </h2>
      );
    case "p":
      return (
        <p className="text-[15.5px] font-medium leading-[1.75] text-black/80 mb-5">
          {block.text}
        </p>
      );
    case "list":
      return (
        <ul className="space-y-2.5 mb-6">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-[15px] font-medium leading-relaxed">
              <span
                className="mt-0.5 w-6 h-6 border-[2.5px] border-black rounded-full flex items-center justify-center shrink-0 font-black text-[11px]"
                style={{ background: accent }}
              >
                {i + 1}
              </span>
              <span className="text-black/80">{item}</span>
            </li>
          ))}
        </ul>
      );
    case "callout":
      return (
        <div
          className="border-[3px] border-black rounded-[20px] brutal-shadow-sm p-5 mb-6"
          style={{ background: accent }}
        >
          <div className="text-[11px] font-black uppercase tracking-widest mb-1.5">
            ⚡ {block.title}
          </div>
          <p className="text-[14.5px] font-bold leading-relaxed">{block.text}</p>
        </div>
      );
    case "example":
      return (
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white border-[3px] border-black rounded-[20px] p-4 brutal-shadow-sm">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-[#BEF264] border-[2px] border-black rounded-full mb-3">
              <Check size={11} strokeWidth={4} /> Send this
            </div>
            <p className="text-[14px] font-bold leading-relaxed">{block.good}</p>
          </div>
          <div className="bg-white border-[3px] border-black rounded-[20px] p-4 brutal-shadow-sm">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-[#FDA4AF] border-[2px] border-black rounded-full mb-3">
              <X size={11} strokeWidth={4} /> Never this
            </div>
            <p className="text-[14px] font-bold leading-relaxed line-through decoration-2 decoration-black/40">
              {block.bad}
            </p>
          </div>
        </div>
      );
    case "quote":
      return (
        <blockquote className="relative bg-[#111] text-[#FFFBEB] border-[3px] border-black rounded-[20px] brutal-shadow p-6 mb-6 rotate-[-0.5deg]">
          <Quote size={20} className="text-[#FFE066] mb-2" />
          <p className="font-black tracking-tight text-[18px] sm:text-[20px] leading-snug">
            {block.text}
          </p>
          {block.by && (
            <div className="mt-3 text-[11px] font-black uppercase tracking-widest text-white/50">
              — {block.by}
            </div>
          )}
        </blockquote>
      );
    default:
      return null;
  }
};

export const ArticlePage: React.FC<ArticlePageProps> = ({ article, navigate }) => {
  const related = getRelatedArticles(article);
  const accent = CATEGORY_COLORS[article.category];

  return (
    <div>
      {/* Hero */}
      <div className="border-b-[3px] border-black" style={{ background: article.color }}>
        <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <button
            onClick={() => navigate("/blog")}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border-[2.5px] border-black rounded-full font-black text-[12px] uppercase brutal-shadow-sm hover:translate-y-[-1px] transition-transform mb-6"
          >
            <ArrowLeft size={14} strokeWidth={3} /> All articles
          </button>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-[#111] text-white border-[2px] border-black rounded-full">
              {article.category}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-white border-[2px] border-black rounded-full">
              {article.readMins} min read
            </span>
          </div>

          <h1 className="font-black tracking-tighter text-[32px] sm:text-[46px] leading-[1.02]">
            {article.title}
          </h1>
          <p className="mt-4 text-[15px] sm:text-[16px] font-bold text-black/70 leading-relaxed">
            {article.excerpt}
          </p>

          <div className="mt-6 flex items-center gap-3">
            <div className="w-11 h-11 bg-[#111] text-[#FFFBEB] border-[2.5px] border-black rounded-full flex items-center justify-center font-black text-[15px]">
              {article.author.avatar}
            </div>
            <div>
              <div className="font-black text-[14px] leading-tight">
                {article.author.name}
              </div>
              <div className="text-[11px] font-bold text-black/60">
                {article.author.role} • {formatArticleDate(article.date)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <article className="max-w-[720px] mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {article.blocks.map((block, i) => (
          <BlockRenderer key={i} block={block} accent={accent} />
        ))}

        {/* Inline CTA */}
        <div className="mt-12 bg-[#111] text-white border-[3px] border-black rounded-[24px] brutal-shadow p-7 text-center">
          <div className="text-[11px] font-black uppercase tracking-widest text-[#FFE066] mb-2">
            Want this as a daily habit?
          </div>
          <h3 className="font-black tracking-tighter text-[24px] leading-tight mb-4">
            Lessons like this, every day —
            <br /> plus a coach that roasts your actual chats.
          </h3>
          <button
            onClick={() => navigate("/signup")}
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#FFE066] text-black border-[3px] border-black rounded-full font-black text-[14px] uppercase shadow-[3px_3px_0px_#000] hover:translate-y-[-2px] transition-transform"
          >
            Start free <ArrowRight size={16} strokeWidth={3} />
          </button>
        </div>
      </article>

      {/* Related */}
      <div className="border-t-[3px] border-black bg-white">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-12">
          <h3 className="font-black tracking-tighter text-[26px] mb-6">Keep reading</h3>
          <div className="grid sm:grid-cols-3 gap-5">
            {related.map((a) => (
              <button
                key={a.slug}
                onClick={() => navigate(`/blog/${a.slug}`)}
                className="text-left bg-[#FFFBEB] border-[3px] border-black rounded-[20px] brutal-shadow-sm overflow-hidden hover:translate-y-[-3px] transition-transform"
              >
                <div
                  className="h-[80px] border-b-[3px] border-black flex items-center justify-center text-[34px]"
                  style={{ background: a.color }}
                >
                  {a.emoji}
                </div>
                <div className="p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">
                    {a.category} • {a.readMins} min
                  </div>
                  <div className="font-black text-[15px] tracking-tight leading-snug">
                    {a.title}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
