import React, { useEffect } from "react";
import { MarketingNav, MarketingFooter } from "./MarketingLayout";
import { LandingPage } from "./LandingPage";
import { BlogPage } from "./BlogPage";
import { ArticlePage } from "./ArticlePage";
import { PricingPage } from "./PricingPage";
import { AboutPage } from "./AboutPage";
import { LegalPage } from "./LegalPage";
import { getArticleBySlug } from "../../data/articles";
import { getLegalDoc, LEGAL_DOCS } from "../../data/legal";

const LEGAL_PATHS = new Set(LEGAL_DOCS.map((doc) => `/${doc.slug}`));

/** All paths served by the public marketing site. */
export function isMarketingPath(path: string): boolean {
  return (
    path === "/" ||
    path === "/blog" ||
    path.startsWith("/blog/") ||
    path === "/pricing" ||
    path === "/about" ||
    LEGAL_PATHS.has(path)
  );
}

interface MarketingSiteProps {
  pathname: string;
  navigate: (path: string) => void;
  isAuthed: boolean;
}

const NotFound: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => (
  <div className="max-w-[640px] mx-auto px-4 py-24 text-center">
    <div className="text-[64px] mb-4">👻</div>
    <h1 className="font-black tracking-tighter text-[36px] mb-2">
      This page ghosted you.
    </h1>
    <p className="font-bold text-black/60 mb-8">
      It read your request and never replied. Classic.
    </p>
    <button
      onClick={() => navigate("/blog")}
      className="px-6 py-3.5 bg-[#FFE066] border-[3px] border-black rounded-full font-black text-[14px] uppercase brutal-shadow-sm hover:translate-y-[-2px] transition-transform"
    >
      Back to the blog
    </button>
  </div>
);

export const MarketingSite: React.FC<MarketingSiteProps> = ({
  pathname,
  navigate,
  isAuthed,
}) => {
  // Scroll to top + set the document title on every marketing navigation.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    const base = "datings.lol — Dating Coach & Chat Roaster";
    if (pathname === "/blog") {
      document.title = `Blog • ${base}`;
    } else if (pathname.startsWith("/blog/")) {
      const article = getArticleBySlug(pathname.slice("/blog/".length));
      document.title = article ? `${article.title} • datings.lol` : base;
    } else if (pathname === "/pricing") {
      document.title = `Pricing • ${base}`;
    } else if (pathname === "/about") {
      document.title = `Manifesto • ${base}`;
    } else if (LEGAL_PATHS.has(pathname)) {
      const doc = getLegalDoc(pathname.slice(1));
      document.title = doc ? `${doc.title} • datings.lol` : base;
    } else {
      document.title = base;
    }
    return () => {
      document.title = base;
    };
  }, [pathname]);

  let page: React.ReactNode;
  if (pathname === "/") {
    page = <LandingPage navigate={navigate} isAuthed={isAuthed} />;
  } else if (pathname === "/blog") {
    page = <BlogPage navigate={navigate} />;
  } else if (pathname.startsWith("/blog/")) {
    const article = getArticleBySlug(pathname.slice("/blog/".length));
    page = article ? (
      <ArticlePage article={article} navigate={navigate} />
    ) : (
      <NotFound navigate={navigate} />
    );
  } else if (pathname === "/pricing") {
    page = <PricingPage navigate={navigate} />;
  } else if (pathname === "/about") {
    page = <AboutPage navigate={navigate} />;
  } else if (LEGAL_PATHS.has(pathname)) {
    const doc = getLegalDoc(pathname.slice(1));
    page = doc ? (
      <LegalPage doc={doc} navigate={navigate} />
    ) : (
      <NotFound navigate={navigate} />
    );
  } else {
    page = <NotFound navigate={navigate} />;
  }

  return (
    <div className="min-h-screen bg-[#FFFBEB] text-[#111] font-sans selection:bg-[#FFE066] flex flex-col">
      <MarketingNav navigate={navigate} isAuthed={isAuthed} currentPath={pathname} />
      <main className="flex-1">{page}</main>
      <MarketingFooter navigate={navigate} />
    </div>
  );
};
