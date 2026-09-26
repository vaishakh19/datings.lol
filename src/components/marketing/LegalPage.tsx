import React from "react";
import { ArrowRight } from "lucide-react";
import {
  LegalDoc,
  LEGAL_DOCS,
  LEGAL_LAST_UPDATED,
} from "../../data/legal";

interface LegalPageProps {
  doc: LegalDoc;
  navigate: (path: string) => void;
}

export const LegalPage: React.FC<LegalPageProps> = ({ doc, navigate }) => {
  return (
    <div>
      {/* Hero */}
      <section className="border-b-[3px] border-black bg-[#FFE066]">
        <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-14 sm:py-16 text-center">
          <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 bg-white border-[2px] border-black rounded-full brutal-shadow-sm">
            {doc.emoji} Legal
          </span>
          <h1 className="mt-5 font-black tracking-tighter text-[38px] sm:text-[54px] leading-[0.95]">
            {doc.title}
          </h1>
          <p className="mt-4 text-[15px] sm:text-[17px] font-bold text-black/70 max-w-[560px] mx-auto leading-relaxed">
            {doc.intro}
          </p>
          <p className="mt-5 inline-block text-[12px] font-black uppercase tracking-widest px-3 py-1 bg-black text-[#FFE066] border-[2px] border-black rounded-full">
            Last updated: {LEGAL_LAST_UPDATED}
          </p>
        </div>
      </section>

      {/* Cross-links to the other legal pages */}
      <section className="border-b-[3px] border-black bg-white">
        <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-4 flex flex-wrap gap-2 justify-center">
          {LEGAL_DOCS.map((d) => {
            const isCurrent = d.slug === doc.slug;
            return (
              <button
                key={d.slug}
                onClick={() => navigate(`/${d.slug}`)}
                aria-current={isCurrent ? "page" : undefined}
                className={`px-4 py-2 rounded-full font-black text-[13px] border-[2.5px] border-black transition-all ${
                  isCurrent
                    ? "bg-[#FFE066] brutal-shadow-sm translate-y-[-1px]"
                    : "bg-white hover:bg-[#FFFBEB]"
                }`}
              >
                <span className="mr-1.5">{d.emoji}</span>
                {d.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Body */}
      <section className="max-w-[760px] mx-auto px-4 sm:px-6 py-14">
        <div className="space-y-9">
          {doc.sections.map((section) => (
            <div key={section.heading}>
              <h2 className="font-black tracking-tighter text-[22px] sm:text-[26px] mb-3">
                {section.heading}
              </h2>
              {section.body?.map((paragraph, i) => (
                <p
                  key={i}
                  className="text-[15px] font-medium leading-[1.75] text-black/80 mb-3"
                >
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="mt-2 space-y-2">
                  {section.bullets.map((bullet, i) => (
                    <li
                      key={i}
                      className="flex gap-3 text-[15px] font-medium leading-[1.65] text-black/80"
                    >
                      <span
                        aria-hidden
                        className="mt-[9px] w-2 h-2 shrink-0 bg-black rounded-full border-[1.5px] border-black"
                      />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <p className="mt-12 text-[13px] font-bold text-black/50 leading-relaxed border-t-[2px] border-black/10 pt-6">
          This document is provided for general information and does not
          constitute legal advice. If you need advice about your specific
          situation, please consult a qualified professional.
        </p>
      </section>

      {/* CTA */}
      <section className="border-t-[3px] border-black bg-[#111] text-white">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-14 text-center">
          <h2 className="font-black tracking-tighter text-[28px] sm:text-[38px] leading-[1]">
            Fine print done.
            <br />
            <span className="text-[#FFE066]">Time to actually get better.</span>
          </h2>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => navigate("/signup")}
              className="flex items-center gap-2 px-8 py-4 bg-[#FFE066] text-black border-[3px] border-black rounded-full font-black text-[15px] uppercase shadow-[4px_4px_0px_#000] hover:translate-y-[-2px] transition-transform"
            >
              Start free <ArrowRight size={18} strokeWidth={3} />
            </button>
            <button
              onClick={() => navigate("/")}
              className="px-7 py-4 border-[3px] border-white rounded-full font-black text-[15px] uppercase hover:bg-white hover:text-black transition-colors"
            >
              Back home
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
