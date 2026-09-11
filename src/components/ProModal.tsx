import React from "react";
import { Crown, Check, X } from "lucide-react";

interface ProModalProps {
  onClose: () => void;
  onUpgrade: () => void;
}

export const ProModal: React.FC<ProModalProps> = ({ onClose, onUpgrade }) => {
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
                Out of roasts today
              </div>
              <div className="text-[12px] font-bold opacity-60 uppercase tracking-widest">
                Free = 3 per day
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-white border-[2.5px] border-black rounded-full flex items-center justify-center"
          >
            <X size={16} strokeWidth={3} />
          </button>
        </div>

        <div className="bg-white border-[3px] border-black rounded-[20px] p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-[#BEF264] border-[2px] border-black rounded-full flex items-center justify-center">
              <Crown size={14} className="text-black" />
            </div>
            <span className="font-black text-[14px]">
              Pro gets unlimited photo roasts
            </span>
          </div>
          <ul className="space-y-2 text-[13px] font-medium">
            <li className="flex gap-2">
              <Check size={14} className="mt-0.5 shrink-0" strokeWidth={3} />
              Unlimited chat + photo upload roasts
            </li>
            <li className="flex gap-2">
              <Check size={14} className="mt-0.5 shrink-0" strokeWidth={3} />
              Profile roast report (photos, prompts, bio)
            </li>
            <li className="flex gap-2">
              <Check size={14} className="mt-0.5 shrink-0" strokeWidth={3} />
              All lessons unlocked + streak freeze
            </li>
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="h-[48px] bg-white border-[3px] border-black rounded-full font-black text-[13px] uppercase"
          >
            Maybe later
          </button>
          <button
            onClick={onUpgrade}
            className="h-[48px] bg-[#FFE066] border-[3px] border-black rounded-full font-black text-[13px] uppercase brutal-shadow-sm flex items-center justify-center gap-1"
          >
            <Crown size={14} /> Upgrade $9/mo
          </button>
        </div>

        <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest text-center mt-3">
          Mock checkout • Instant unlock • No AI label
        </p>
      </div>
    </div>
  );
};
