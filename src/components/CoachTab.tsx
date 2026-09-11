import React, { useState, useRef, useEffect } from "react";
import { Camera, Send, Lock, Crown, TriangleAlert } from "lucide-react";
import { ChatMessage, UserProfile } from "../types";
import { processUploadFile } from "../utils/imageCompressor";

interface CoachTabProps {
  profile: UserProfile;
  messages: ChatMessage[];
  onSendMessage: (text?: string, imageBase64?: string) => Promise<void>;
  isPro: boolean;
  chatsUsedToday: number;
  maxFreeChats: number;
  onOpenProModal: () => void;
  isTyping: boolean;
}

export const CoachTab: React.FC<CoachTabProps> = ({
  profile,
  messages,
  onSendMessage,
  isPro,
  chatsUsedToday,
  maxFreeChats,
  onOpenProModal,
  isTyping,
}) => {
  const [inputText, setInputText] = useState("");
  const [statusNotice, setStatusNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isLimitReached = !isPro && chatsUsedToday >= maxFreeChats;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputText.trim();
    if (!text) return;

    if (isLimitReached) {
      onOpenProModal();
      return;
    }

    setInputText("");
    await onSendMessage(text, undefined);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (isLimitReached) {
      onOpenProModal();
      return;
    }

    if (file.size > 2097152) {
      setStatusNotice(`Big file (${(file.size / 1024 / 1024).toFixed(1)}MB) - compressing...`);
      setTimeout(() => setStatusNotice(""), 3000);
    }

    try {
      const { dataUrl } = await processUploadFile(file);
      await onSendMessage("roast this chat / profile 👁️", dataUrl);
    } catch {
      setStatusNotice("Failed to process image. Please try another.");
      setTimeout(() => setStatusNotice(""), 3000);
    }
  };

  const quickActions = [
    "Roast my chat",
    "What do I text back?",
    "Profile review",
    "I'm nervous",
    "Upload screenshot 📸",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] sm:h-[700px] bg-white border-[3px] border-black rounded-[24px] brutal-shadow overflow-hidden">
      {/* Top Coach Header */}
      <div className="min-h-[64px] border-b-[3px] border-black px-4 flex items-center justify-between bg-[#FFFBEB] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#111] border-[2px] border-black flex items-center justify-center text-[16px]">
            👁️
          </div>
          <div>
            <div className="font-black text-[14px] leading-none">
              lol coach
            </div>
            <div className="text-[11px] font-bold opacity-60 flex items-center gap-1">
              <div className="w-2 h-2 bg-[#BEF264] rounded-full border border-black animate-pulse" />
              usually replies instantly •{" "}
              <span className="bg-[#111] text-[#FFE066] px-1.5 py-0.5 rounded-full text-[9px] uppercase">
                Pro gets unlimited photo roasts
              </span>
            </div>
          </div>
        </div>
        <div
          className={`px-2.5 py-1 rounded-full border-[2px] border-black text-[10px] font-black uppercase ${
            profile.vibe === "roasty"
              ? "bg-[#FDA4AF]"
              : profile.vibe === "gentle"
              ? "bg-[#BEF264]"
              : "bg-[#FFE066]"
          }`}
        >
          {profile.vibe} mode
        </div>
      </div>

      {/* Pro Usage Banner */}
      <div className="bg-[#111] text-white border-b-[3px] border-black px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {isPro ? (
            <>
              <div className="w-7 h-7 bg-[#FFE066] border-[2px] border-white rounded-full flex items-center justify-center">
                <Crown size={14} className="text-black" />
              </div>
              <span className="font-black text-[12px] uppercase tracking-widest flex items-center gap-1">
                Unlimited Pro
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-[#FFE066] text-black rounded-full border border-white">
                PRO
              </span>
            </>
          ) : (
            <>
              <div className="w-7 h-7 bg-white border-[2px] border-black rounded-full flex items-center justify-center text-black">
                <Lock size={12} />
              </div>
              <span className="font-black text-[12px] uppercase tracking-widest">
                Free: {Math.max(0, maxFreeChats - chatsUsedToday)}/{maxFreeChats} left today
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isPro ? (
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 rounded-full bg-[#FFE066] border border-white"
                />
              ))}
            </div>
          ) : (
            <div className="flex gap-1">
              {[...Array(maxFreeChats)].map((_, i) => {
                const remaining = maxFreeChats - chatsUsedToday;
                const active = i < remaining;
                return (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full border-[1.5px] border-white transition-all ${
                      active ? "bg-[#FFE066]" : "bg-white/20"
                    }`}
                  />
                );
              })}
            </div>
          )}
          {!isPro && chatsUsedToday >= maxFreeChats && (
            <span className="ml-2 text-[10px] font-black px-2 py-0.5 bg-[#FDA4AF] text-black rounded-full border border-white uppercase">
              Limit hit
            </span>
          )}
        </div>
      </div>

      {statusNotice && (
        <div className="bg-[#FFE066] border-b-[2.5px] border-black px-4 py-2 flex items-center gap-2 text-[12px] font-black">
          <TriangleAlert size={14} /> {statusNotice}
        </div>
      )}

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FFFBEB]">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[82%] ${
                m.role === "user"
                  ? "bg-[#111] text-white border-white"
                  : "bg-white text-black border-black"
              } border-[2.5px] rounded-[20px] px-4 py-2.5 brutal-shadow-sm ${
                m.role === "user" ? "rounded-br-[6px]" : "rounded-bl-[6px]"
              } overflow-hidden`}
            >
              {m.imageUrl && (
                <div className="mb-2 -mx-1">
                  <img
                    src={m.imageUrl}
                    alt="upload"
                    className="w-full max-w-[220px] rounded-[14px] border-[2.5px] border-black object-cover"
                  />
                </div>
              )}
              {m.text && (
                <p className="text-[14px] font-medium leading-[1.35] whitespace-pre-wrap">
                  {m.text}
                </p>
              )}
              {m.options && m.options.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {m.options.map((opt, oIdx) => (
                    <button
                      key={oIdx}
                      onClick={() => handleSend(opt)}
                      className="text-[11px] font-black px-3 py-1.5 rounded-full border-[2px] border-black bg-[#FFE066] text-black hover:translate-y-[-1px] active:translate-y-0 transition-transform"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white border-[2.5px] border-black rounded-[20px] rounded-bl-[6px] px-4 py-3 brutal-shadow-sm">
              <div className="flex gap-1 items-center">
                <div className="w-2 h-2 bg-black rounded-full animate-[bounce_1s_infinite]" />
                <div className="w-2 h-2 bg-black rounded-full animate-[bounce_1s_0.2s_infinite]" />
                <div className="w-2 h-2 bg-black rounded-full animate-[bounce_1s_0.4s_infinite]" />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick Action Chips */}
      <div className="px-3 py-2 border-t-[2.5px] border-black bg-white flex gap-2 overflow-x-auto scrollbar-none">
        {quickActions.map((act) => (
          <button
            key={act}
            onClick={() => {
              if (isLimitReached) {
                onOpenProModal();
                return;
              }
              if (act.includes("Upload")) {
                fileInputRef.current?.click();
                return;
              }
              handleSend(act);
            }}
            className={`shrink-0 text-[11px] font-black px-3 py-1.5 rounded-full border-[2px] border-black transition-colors ${
              isLimitReached
                ? "bg-[#FFFBEB] opacity-50"
                : "bg-[#FFFBEB] hover:bg-[#111] hover:text-white"
            }`}
          >
            {act}
          </button>
        ))}
      </div>

      {/* Message Input Box */}
      <div className="p-3 border-t-[3px] border-black bg-white flex gap-2 shrink-0 items-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />
        <button
          onClick={() => {
            if (isLimitReached) {
              onOpenProModal();
              return;
            }
            fileInputRef.current?.click();
          }}
          className="w-11 h-11 bg-[#111] border-[2.5px] border-black rounded-full flex items-center justify-center brutal-shadow-sm active:translate-y-[1px] active:shadow-none shrink-0 text-white"
          title="Upload image / screenshot"
        >
          <Camera size={18} strokeWidth={2.5} />
        </button>

        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={
            isPro
              ? "paste chat or tell me what happened..."
              : isLimitReached
              ? "Daily limit reached - upgrade to continue"
              : "paste chat or tell me what happened..."
          }
          disabled={isLimitReached}
          className={`flex-1 h-[44px] border-[2.5px] border-black rounded-full px-4 text-[14px] font-medium outline-none placeholder:opacity-40 ${
            isLimitReached ? "bg-gray-100 opacity-60" : "bg-[#FFFBEB]"
          }`}
        />

        <button
          onClick={() => handleSend()}
          className={`w-11 h-11 border-[2.5px] border-black rounded-full flex items-center justify-center brutal-shadow-sm active:translate-y-[1px] active:shadow-none ${
            isLimitReached ? "bg-[#FDA4AF] text-black" : "bg-[#111] text-white"
          }`}
        >
          {isLimitReached ? <Lock size={16} /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
};
