import React, { useState } from "react";
import { Crown, Check, LoaderCircle, X } from "lucide-react";

interface ProModalProps {
  onClose: () => void;
  onUpgrade: () => Promise<void>;
  proDailyLimit: number;
  billingConfigured: boolean;
  error?: string;
}

export const ProModal: React.FC<ProModalProps> = ({
  onClose,
  onUpgrade,
  proDailyLimit,
  billingConfigured,
  error,
}) => {
  const [loading, setLoading] = useState(false);

  const startCheckout = async () => {
    if (loading || !billingConfigured) return;
    setLoading(true);
    try {
      await onUpgrade();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-[420px] bg-[#FFFBEB] border-[4px] border-black rounded-[28px] brutal-shadow p-6 animate-[pop_0.3s_ease-out]">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-[#111] text-[#FFE066] rounded-full border-[3px] border-black flex items-center justify-center">
              <Crown size={20} />
            </div>
            <div>
              <div className="font-black text-[20px] leading-none tracking-tighter">
                More coaching, same honesty
              </div>
              <div className="text-[12px] font-bold opacity-60 uppercase tracking-widest">
                Free = 3 chats per day
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 bg-white border-[2.5px] border-black rounded-full flex items-center justify-center"
            aria-label="Close Pro upgrade"
          >
            <X size={16} strokeWidth={3} />
          </button>
        </div>

        <div className="bg-white border-[3px] border-black rounded-[20px] p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-[#BEF264] border-[2px] border-black rounded-full flex items-center justify-center">
              <Crown size={14} className="text-black" />
            </div>
            <span className="font-black text-[14px]">Pro • $9/month</span>
          </div>
          <ul className="space-y-2 text-[13px] font-medium">
            <li className="flex gap-2">
              <Check size={14} className="mt-0.5 shrink-0" strokeWidth={3} />
              Up to {proDailyLimit} AI Coach chats per day
            </li>
            <li className="flex gap-2">
              <Check size={14} className="mt-0.5 shrink-0" strokeWidth={3} />
              Chat and photo coaching within that allowance
            </li>
            <li className="flex gap-2">
              <Check size={14} className="mt-0.5 shrink-0" strokeWidth={3} />
              Hosted billing management and cancellation
            </li>
          </ul>
        </div>

        {(!billingConfigured || error) && (
          <div className="mb-3 bg-[#FDA4AF] border-[2px] border-black rounded-[14px] p-3 text-[11px] font-bold">
            {error || "Test checkout is not configured yet. Add the server billing variables first."}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-[48px] bg-white border-[3px] border-black rounded-full font-black text-[13px] uppercase"
          >
            Maybe later
          </button>
          <button
            type="button"
            onClick={() => void startCheckout()}
            disabled={loading || !billingConfigured}
            className="h-[48px] bg-[#FFE066] border-[3px] border-black rounded-full font-black text-[13px] uppercase brutal-shadow-sm flex items-center justify-center gap-1 disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? <LoaderCircle size={15} className="animate-spin" /> : <Crown size={14} />}
            {loading ? "Opening…" : "Upgrade $9/mo"}
          </button>
        </div>

        <p className="text-[9px] font-bold opacity-50 uppercase tracking-widest text-center mt-3 leading-relaxed">
          Dodo Payments test mode • Pro starts only after a verified webhook
        </p>
      </div>
    </div>
  );
};
