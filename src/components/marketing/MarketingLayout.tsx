import React, { useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { SORTED_ARTICLES } from "../../data/articles";
import { LEGAL_DOCS } from "../../data/legal";

export interface MarketingNavProps {
  navigate: (path: string) => void;
  isAuthed: boolean;
  currentPath: string;
}

const NAV_LINKS = [
  { label: "Blog", path: "/blog" },
  { label: "Pricing", path: "/pricing" },
  { label: "Manifesto", path: "/about" },
];

export const MarketingNav: React.FC<MarketingNavProps> = ({
  navigate,
  isAuthed,
  currentPath,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (path: string) => {
    setMenuOpen(false);
    navigate(path);
  };

  const isActive = (path: string) =>
    path === "/blog" ? currentPath.startsWith("/blog") : currentPath === path;

  return (
    <header className="sticky top-0 z-40 bg-[#FFFBEB]/90 backdrop-blur-md border-b-[3px] border-black">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 h-[68px] flex items-center justify-between gap-3">
        {/* Brand */}
        <button
          onClick={() => go("/")}
          className="flex items-center gap-2 shrink-0 cursor-pointer"
          aria-label="datings.lol home"
        >
          <div className="w-9 h-9 bg-[#111] text-[#FFFBEB] rounded-full flex items-center justify-center font-black text-[15px] border-[2px] border-black">
            d.
          </div>
          <span className="font-black text-[20px] tracking-tighter">datings.lol</span>
          <span className="hidden md:inline text-[10px] font-black px-2 py-0.5 bg-[#FFE066] text-black border-[2px] border-black rounded-full">
            BETA
          </span>
        </button>

        {/* Desktop links */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <button
              key={link.path}
              onClick={() => go(link.path)}
              className={`px-4 py-2 rounded-full font-black text-[14px] border-[2.5px] transition-all ${
                isActive(link.path)
                  ? "bg-[#FFE066] border-black brutal-shadow-sm translate-y-[-1px]"
                  : "border-transparent hover:border-black hover:bg-white"
              }`}
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* CTAs */}
        <div className="hidden md:flex items-center gap-2">
          {isAuthed ? (
            <button
              onClick={() => go("/dashboard")}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-[#111] text-white border-[2.5px] border-black rounded-full font-black text-[13px] uppercase brutal-shadow-sm hover:translate-y-[-1px] transition-transform"
            >
              Open app <ArrowRight size={15} strokeWidth={3} />
            </button>
          ) : (
            <>
              <button
                onClick={() => go("/login")}
                className="px-4 py-2.5 bg-white border-[2.5px] border-black rounded-full font-black text-[13px] uppercase hover:bg-[#FFE066] transition-colors"
              >
                Log in
              </button>
              <button
                onClick={() => go("/signup")}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-[#111] text-white border-[2.5px] border-black rounded-full font-black text-[13px] uppercase brutal-shadow-sm hover:translate-y-[-1px] transition-transform"
              >
                Get started <ArrowRight size={15} strokeWidth={3} />
              </button>
            </>
          )}
        </div>

        {/* Mobile burger */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden w-10 h-10 bg-white border-[2.5px] border-black rounded-full flex items-center justify-center brutal-shadow-sm"
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={18} strokeWidth={3} /> : <Menu size={18} strokeWidth={3} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t-[3px] border-black bg-[#FFFBEB] px-4 py-4 space-y-2">
          {NAV_LINKS.map((link) => (
            <button
              key={link.path}
              onClick={() => go(link.path)}
              className={`w-full text-left px-4 py-3 rounded-[16px] font-black text-[15px] border-[2.5px] border-black ${
                isActive(link.path) ? "bg-[#FFE066]" : "bg-white"
              }`}
            >
              {link.label}
            </button>
          ))}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {isAuthed ? (
              <button
                onClick={() => go("/dashboard")}
                className="col-span-2 px-4 py-3 bg-[#111] text-white border-[2.5px] border-black rounded-[16px] font-black text-[14px] uppercase"
              >
                Open app →
              </button>
            ) : (
              <>
                <button
                  onClick={() => go("/login")}
                  className="px-4 py-3 bg-white border-[2.5px] border-black rounded-[16px] font-black text-[14px] uppercase"
                >
                  Log in
                </button>
                <button
                  onClick={() => go("/signup")}
                  className="px-4 py-3 bg-[#111] text-white border-[2.5px] border-black rounded-[16px] font-black text-[14px] uppercase"
                >
                  Get started
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export const MarketingFooter: React.FC<{ navigate: (path: string) => void }> = ({
  navigate,
}) => {
  return (
    <footer className="border-t-[3px] border-black bg-[#111] text-[#FFFBEB]">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Brand */}
          <div className="md:col-span-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 bg-[#FFE066] text-black rounded-full flex items-center justify-center font-black text-[16px] border-[2px] border-black">
                d.
              </div>
              <span className="font-black text-[24px] tracking-tighter">datings.lol</span>
            </div>
            <p className="text-[13px] font-bold text-white/60 leading-relaxed max-w-[280px]">
              The brutally honest dating coach. Daily lessons, AI chat roasts, profile
              audits, and a streak you'll actually protect.
            </p>
            <button
              onClick={() => navigate("/signup")}
              className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#FFE066] text-black border-[2.5px] border-black rounded-full font-black text-[13px] uppercase shadow-[3px_3px_0px_#000] hover:translate-y-[-1px] transition-transform"
            >
              Start free <ArrowRight size={14} strokeWidth={3} />
            </button>
          </div>

          {/* Product */}
          <div className="md:col-span-2">
            <div className="text-[11px] font-black uppercase tracking-widest text-white/40 mb-3">
              Product
            </div>
            <ul className="space-y-2 text-[14px] font-bold">
              {[
                { label: "Get started", path: "/signup" },
                { label: "Log in", path: "/login" },
                { label: "Pricing", path: "/pricing" },
                { label: "Manifesto", path: "/about" },
              ].map((l) => (
                <li key={l.path + l.label}>
                  <button
                    onClick={() => navigate(l.path)}
                    className="hover:text-[#FFE066] transition-colors"
                  >
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className="md:col-span-2">
            <div className="text-[11px] font-black uppercase tracking-widest text-white/40 mb-3">
              Legal
            </div>
            <ul className="space-y-2 text-[14px] font-bold">
              {LEGAL_DOCS.map((doc) => (
                <li key={doc.slug}>
                  <button
                    onClick={() => navigate(`/${doc.slug}`)}
                    className="text-left hover:text-[#FFE066] transition-colors"
                  >
                    {doc.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* All articles */}
          <div className="md:col-span-4">
            <div className="text-[11px] font-black uppercase tracking-widest text-white/40 mb-3">
              All articles
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px] font-bold">
              {SORTED_ARTICLES.map((a) => (
                <li key={a.slug}>
                  <button
                    onClick={() => navigate(`/blog/${a.slug}`)}
                    className="text-left hover:text-[#FFE066] transition-colors leading-snug"
                  >
                    <span className="mr-1.5">{a.emoji}</span>
                    {a.title}
                  </button>
                </li>
              ))}
              <li>
                <button
                  onClick={() => navigate("/blog")}
                  className="text-left text-[#FFE066] hover:underline"
                >
                  View the blog →
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t-[2px] border-white/15 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[12px] font-bold text-white/40">
            © {new Date().getFullYear()} datings.lol — get better at dating. brutally.
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[12px] font-bold text-white/50">
            {LEGAL_DOCS.map((doc, i) => (
              <React.Fragment key={doc.slug}>
                {i > 0 && <span className="text-white/25">·</span>}
                <button
                  onClick={() => navigate(`/${doc.slug}`)}
                  className="hover:text-[#FFE066] transition-colors"
                >
                  {doc.label}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};
