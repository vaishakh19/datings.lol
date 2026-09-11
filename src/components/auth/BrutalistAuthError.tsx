import React, { useState, useEffect } from "react";
import {
  AlertOctagon,
  X,
  ArrowRight,
  RefreshCw,
  KeyRound,
  LogIn,
  UserCheck,
  Clock,
  MailCheck,
  Sparkles,
  ChevronDown,
  Info,
} from "lucide-react";
import { ParsedSupabaseError } from "../../utils/supabaseErrors";

interface BrutalistAuthErrorProps {
  error: ParsedSupabaseError;
  onDismiss: () => void;
  onAction?: (actionType: string, value?: string) => void;
}

export const BrutalistAuthError: React.FC<BrutalistAuthErrorProps> = ({
  error,
  onDismiss,
  onAction,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number | null>(
    error.code === "over_request_rate_limit" ? 60 : null
  );

  // Rate limit countdown effect
  useEffect(() => {
    if (cooldownRemaining === null || cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const handleActionClick = () => {
    if (error.actionType === "resend_confirmation") {
      setResendSent(true);
      setTimeout(() => setResendSent(false), 4000);
    }
    if (onAction && error.actionType) {
      onAction(error.actionType, error.suggestedValue);
    }
  };

  // Icon selector based on error code
  const renderIcon = () => {
    switch (error.code) {
      case "invalid_credentials":
        return <KeyRound size={20} className="text-black stroke-[2.5]" />;
      case "username_taken":
      case "email_taken":
        return <AlertOctagon size={20} className="text-black stroke-[2.5]" />;
      case "over_request_rate_limit":
        return <Clock size={20} className="text-black stroke-[2.5]" />;
      case "email_not_confirmed":
        return <MailCheck size={20} className="text-black stroke-[2.5]" />;
      default:
        return <AlertOctagon size={20} className="text-black stroke-[2.5]" />;
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mb-5 bg-[#FFF] dark:bg-[#181818] border-[3px] border-black rounded-2xl overflow-hidden brutal-shadow transition-all"
    >
      {/* Top Banner Stripe */}
      <div className="bg-[#FF4D4D] text-black px-3.5 py-2.5 border-b-[2.5px] border-black flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white border-[2px] border-black rounded-lg flex items-center justify-center shrink-0 brutal-shadow-sm">
            {renderIcon()}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[10.5px] sm:text-[11px] font-black uppercase tracking-wider bg-black text-white px-2 py-0.5 rounded">
              {error.statusLabel}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-black/80 hidden xs:inline">
              SUPABASE AUTH ERROR
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="w-7 h-7 bg-white dark:bg-[#222] text-black dark:text-white border-[2px] border-black rounded-lg flex items-center justify-center font-black hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer active:translate-y-[1px]"
          title="Dismiss error"
          aria-label="Dismiss error"
        >
          <X size={15} className="stroke-[3]" />
        </button>
      </div>

      {/* Main Body Content */}
      <div className="p-4 sm:p-5 space-y-3">
        {/* Title */}
        <h3 className="font-black text-[15px] sm:text-[16px] tracking-tight uppercase leading-snug text-black dark:text-white">
          {error.title}
        </h3>

        {/* Descriptive Message */}
        <p className="text-[13px] sm:text-[13.5px] font-medium leading-relaxed text-black/80 dark:text-white/80 bg-red-50/70 dark:bg-red-950/25 border-[1.5px] border-red-200 dark:border-red-900/50 p-3 rounded-xl">
          {error.description}
        </p>

        {/* Live Cooldown Status for 429 */}
        {error.code === "over_request_rate_limit" && (
          <div className="bg-[#FFE066] border-[2px] border-black p-2.5 rounded-xl flex items-center justify-between font-mono text-[12px] font-bold text-black">
            <div className="flex items-center gap-1.5">
              <Clock size={15} />
              <span>Cooldown Security Lock:</span>
            </div>
            <span className="font-black">
              {cooldownRemaining !== null && cooldownRemaining > 0
                ? `${cooldownRemaining}s remaining`
                : "Unlocked! You can retry now."}
            </span>
          </div>
        )}

        {/* Resend Confirmation Notification */}
        {resendSent && (
          <div className="bg-[#4ADE80] border-[2px] border-black p-2.5 rounded-xl font-bold text-[12px] text-black flex items-center gap-2">
            <MailCheck size={16} />
            <span>New verification link dispatched to your inbox!</span>
          </div>
        )}

        {/* Troubleshooting / Steps Accordion */}
        {error.troubleshooting && error.troubleshooting.length > 0 && (
          <div className="border-[2px] border-black/15 dark:border-white/15 rounded-xl overflow-hidden bg-neutral-50 dark:bg-[#1F1F1F]">
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              className="w-full px-3 py-2 flex items-center justify-between text-[11.5px] font-black uppercase tracking-wider text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Info size={13} />
                <span>How to resolve this ({error.troubleshooting.length} steps)</span>
              </span>
              <ChevronDown
                size={14}
                className={`transition-transform ${showDetails ? "rotate-180" : ""}`}
              />
            </button>

            {showDetails && (
              <ul className="px-3.5 pb-3 pt-1 space-y-1.5 text-[12px] font-medium text-black/80 dark:text-white/80 border-t border-black/10 dark:border-white/10">
                {error.troubleshooting.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-black text-[10px] bg-black text-white px-1.5 py-0.2 rounded shrink-0 mt-0.5 font-mono">
                      0{idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Action Button Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {error.actionLabel && (
            <button
              type="button"
              onClick={handleActionClick}
              disabled={error.code === "over_request_rate_limit" && (cooldownRemaining || 0) > 0 && error.actionType === "retry"}
              className="flex-1 min-w-[170px] py-2.5 px-3.5 bg-[#FFE066] hover:bg-[#FDD835] active:translate-y-[1px] text-black border-[2.5px] border-black rounded-xl font-black text-[12px] sm:text-[13px] uppercase tracking-wide flex items-center justify-center gap-2 brutal-shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{error.actionLabel}</span>
              <ArrowRight size={14} className="stroke-[3]" />
            </button>
          )}

          {error.code === "username_taken" && error.suggestedValue && (
            <button
              type="button"
              onClick={() => onAction && onAction("apply_username", error.suggestedValue)}
              className="py-2.5 px-3 bg-[#4ADE80] hover:bg-[#22c55e] text-black border-[2px] border-black rounded-xl font-black text-[12px] flex items-center gap-1.5 brutal-shadow-sm cursor-pointer"
              title="Apply suggested unique handle"
            >
              <UserCheck size={14} />
              <span>Use @{error.suggestedValue}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onDismiss}
            className="py-2.5 px-3 bg-white dark:bg-[#252525] hover:bg-neutral-100 dark:hover:bg-neutral-700 text-black dark:text-white border-[2px] border-black rounded-xl font-black text-[12px] uppercase tracking-wide cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
