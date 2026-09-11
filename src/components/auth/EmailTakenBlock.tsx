import React from "react";
import { Mail, X, ArrowRight, LogIn } from "lucide-react";

interface EmailTakenBlockProps {
  email: string;
  onSignIn: () => void;
  onDismiss: () => void;
}

export const EmailTakenBlock: React.FC<EmailTakenBlockProps> = ({
  email,
  onSignIn,
  onDismiss,
}) => {
  return (
    <div
      id="email-taken-error-block"
      role="alert"
      aria-live="assertive"
      className="mt-3 bg-[#FFF7ED] dark:bg-[#24170F] border-[3px] border-black rounded-xl p-3.5 sm:p-4 brutal-shadow animate-in fade-in slide-in-from-top-2 duration-200"
    >
      {/* Header Stripe */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b-[2px] border-black/20 dark:border-white/20">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-[#FF6B4A] text-black border-[2px] border-black font-mono font-black text-[10.5px] sm:text-[11px] px-2 py-0.5 rounded shadow-[2px_2px_0px_#000] uppercase tracking-wider">
            HTTP 409: EMAIL_REGISTERED
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-black/70 dark:text-white/70 font-mono">
            SUPABASE IDENTITY CONFLICT
          </span>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="w-6 h-6 bg-white dark:bg-[#2D2D2D] text-black dark:text-white border-[2px] border-black rounded flex items-center justify-center font-black hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer shadow-[1.5px_1.5px_0px_#000] active:translate-y-[1px]"
          title="Dismiss error message"
          aria-label="Dismiss error"
        >
          <X size={13} className="stroke-[3]" />
        </button>
      </div>

      {/* Body */}
      <div className="pt-2.5 space-y-3">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 bg-[#FF6B4A] border-[2px] border-black rounded-lg flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
            <Mail size={17} className="text-black stroke-[2.5]" />
          </div>
          <div>
            <h4 className="font-black text-[14px] sm:text-[15px] uppercase tracking-tight text-black dark:text-white leading-tight">
              ACCOUNT EXISTS: EMAIL ALREADY REGISTERED
            </h4>
            <p className="text-[12.5px] sm:text-[13px] font-bold text-black/80 dark:text-white/80 mt-1 leading-snug">
              An account with &ldquo;{email || "this email"}&rdquo; already exists in Supabase Auth.
            </p>
          </div>
        </div>

        {/* Action Row */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={onSignIn}
            className="flex-1 min-w-[170px] py-2 px-3 bg-[#FFE066] hover:bg-[#FDD835] text-black border-[2px] border-black rounded-lg font-black text-[12px] uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
          >
            <LogIn size={14} className="stroke-[2.5]" />
            <span>Sign In With This Email</span>
          </button>

          <button
            type="button"
            onClick={onDismiss}
            className="py-2 px-2.5 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-black dark:text-white border-[2px] border-black rounded-lg font-black text-[11px] uppercase cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
