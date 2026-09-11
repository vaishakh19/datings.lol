import React from "react";
import { KeyRound, X, ArrowRight, Sparkles, AlertTriangle } from "lucide-react";

interface InvalidCredentialsBlockProps {
  identifier?: string;
  onResetPassword: () => void;
  onUseDemo?: () => void;
  onDismiss: () => void;
}

export const InvalidCredentialsBlock: React.FC<InvalidCredentialsBlockProps> = ({
  identifier = "",
  onResetPassword,
  onUseDemo,
  onDismiss,
}) => {
  return (
    <div
      id="invalid-credentials-error-block"
      role="alert"
      aria-live="assertive"
      className="mt-3 bg-[#FFF0F0] dark:bg-[#221212] border-[3px] border-black rounded-xl p-3.5 sm:p-4 brutal-shadow animate-in fade-in slide-in-from-top-2 duration-200"
    >
      {/* Status Header Stripe */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b-[2px] border-black/20 dark:border-white/20">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-[#FF4D4D] text-black border-[2px] border-black font-mono font-black text-[10.5px] sm:text-[11px] px-2 py-0.5 rounded shadow-[2px_2px_0px_#000] uppercase tracking-wider">
            HTTP 400: INVALID_CREDENTIALS
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-black/70 dark:text-white/70 font-mono">
            SUPABASE AUTH REJECTED
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

      {/* Main Error Body */}
      <div className="pt-2.5 space-y-2.5">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 bg-[#FF4D4D] border-[2px] border-black rounded-lg flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
            <KeyRound size={17} className="text-black stroke-[2.5]" />
          </div>
          <div>
            <h4 className="font-black text-[14px] sm:text-[15px] uppercase tracking-tight text-black dark:text-white leading-tight">
              ACCESS REJECTED: INVALID CREDENTIALS
            </h4>
            <p className="text-[12.5px] sm:text-[13px] font-bold text-black/80 dark:text-white/80 mt-1 leading-snug">
              The password does not match this account
              {identifier ? ` (@${identifier.replace(/^@/, "")})` : ""}.
              Supabase passwords are strictly case-sensitive.
            </p>
          </div>
        </div>

        {/* High-Contrast Troubleshooting Checklist */}
        <div className="bg-white/80 dark:bg-black/40 border-[2px] border-black rounded-lg p-2.5 space-y-1 text-[11.5px] font-bold text-black dark:text-white">
          <div className="text-[10px] font-black uppercase tracking-wider text-black/60 dark:text-white/60 font-mono mb-1">
            VERIFICATION CHECKLIST:
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 bg-black text-white rounded text-[9.5px] font-mono font-black flex items-center justify-center shrink-0">
              1
            </span>
            <span>Check that Caps Lock is turned off.</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 bg-black text-white rounded text-[9.5px] font-mono font-black flex items-center justify-center shrink-0">
              2
            </span>
            <span>Ensure no accidental leading or trailing spaces.</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 bg-black text-white rounded text-[9.5px] font-mono font-black flex items-center justify-center shrink-0">
              3
            </span>
            <span>If you created your profile with another email, try that handle.</span>
          </div>
        </div>

        {/* Action Button Strip */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onResetPassword}
            className="flex-1 min-w-[160px] py-2 px-3 bg-[#FFE066] hover:bg-[#FDD835] text-black border-[2px] border-black rounded-lg font-black text-[12px] uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
          >
            <span>Reset Password Now</span>
            <ArrowRight size={14} className="stroke-[3]" />
          </button>

          {onUseDemo && (
            <button
              type="button"
              onClick={onUseDemo}
              className="py-2 px-3 bg-white dark:bg-[#2D2D2D] hover:bg-neutral-100 dark:hover:bg-neutral-700 text-black dark:text-white border-[2px] border-black rounded-lg font-black text-[12px] uppercase tracking-wide flex items-center gap-1.5 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
            >
              <Sparkles size={13} className="text-amber-500" />
              <span>Use Demo Account</span>
            </button>
          )}

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
