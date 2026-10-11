import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Camera,
  Check,
  ChevronDown,
  MessageCircle,
  Play,
  RefreshCcw,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
  X,
  ArrowRight,
  Heart,
  Brain,
  User,
} from "lucide-react";

import {
  ChatMessage,
  UserProfile,
} from "../types";

import {
  processUploadFile,
} from "../utils/imageCompressor";


/* =========================================================
   TYPES
========================================================= */

interface CoachTabProps {
  profile: UserProfile;

  messages: ChatMessage[];

  onSendMessage: (
    text?: string,
    imageBase64?: string,
    mode?: CoachMode
  ) => Promise<void>;

  isPro: boolean;

  chatsUsedToday: number;

  maxFreeChats: number;

  maxDailyChats: number;

  onOpenProModal: () => void;

  onNewSession?: () => void;

  onMessageFeedback?: (
    messageId: string,
    helpful: boolean
  ) => void;

  isTyping: boolean;

  initialContext?: string;

  savedMode?: CoachMode;

  onModeChange?: (mode: CoachMode) => void;
}

export type CoachMode =
  | "gentle"
  | "direct"
  | "brutal";


/* =========================================================
   MODES
========================================================= */

const MODE_COPY: Record<
  CoachMode,
  {
    label: string;
    color: string;
    description: string;
  }
> = {
  gentle: {
    label: "Gentle",
    color: "#BEF264",
    description: "supportive + reassuring",
  },

  direct: {
    label: "Direct",
    color: "#FFE066",
    description: "clear + practical",
  },

  brutal: {
    label: "Brutal",
    color: "#FDA4AF",
    description: "blunt, never cruel",
  },
};


/* =========================================================
   QUICK ACTIONS
========================================================= */

const QUICK_ACTIONS = [
  {
    label: "Roast my chat",
    prompt:
      "I want a focused analysis of this conversation. Find the biggest mistake, strongest part, energy, pressure, question balance, flirting, and my next move.",
  },

  {
    label: "What do I text back?",
    prompt:
      "What should I text back? Give me one strongest reply and two alternatives: playful and bold.",
  },

  {
    label: "Profile review",
    prompt:
      "Review my dating profile. Ask me for the bio, prompts, or photos you need, then score clarity, personality, and authenticity.",
  },

  {
    label: "I'm nervous",
    prompt:
      "I'm nervous about dating. Ask what specific situation is making me nervous, then give me one practical next step.",
  },
];


/* =========================================================
   PRACTICE
========================================================= */

const PRACTICE_SCENARIOS = [
  "New match",
  "First date",
  "Asking them out",
  "Flirty chat",
  "Reconnecting",
  "Difficult conversation",
];


/* =========================================================
   FORMAT
========================================================= */

function formatCoachText(
  text: string
): {
  heading?: string;
  body: string;
} {
  const match = text.match(
    /^(?:COACH(?:'S)? TAKE|COACH'S TAKE)\s*:?\s*/i
  );

  if (match) {
    return {
      heading: "COACH'S TAKE",
      body: text.slice(match[0].length),
    };
  }

  return {
    body: text,
  };
}


/* =========================================================
   COACH TAB
========================================================= */

export const CoachTab: React.FC<CoachTabProps> = ({
  profile,
  messages,
  onSendMessage,
  isPro,
  chatsUsedToday,
  maxFreeChats,
  maxDailyChats,
  onOpenProModal,
  onNewSession,
  onMessageFeedback,
  isTyping,
  initialContext,
  savedMode,
  onModeChange,
}) => {

  /* =======================================================
     BASIC STATE
  ======================================================= */

  const [inputText, setInputText] =
    useState("");

  const [statusNotice, setStatusNotice] =
    useState("");

  const [mode, setMode] =
    useState<CoachMode>(() => {
      if (savedMode) return savedMode;

      try {
        const saved =
          localStorage.getItem(
            "datings_coach_mode"
          );

        if (
          saved === "gentle" ||
          saved === "direct" ||
          saved === "brutal"
        ) {
          return saved;
        }
      } catch {}

      return profile.vibe === "roasty"
        ? "brutal"
        : profile.vibe === "gentle"
        ? "gentle"
        : "direct";
    });


  const [showModeMenu, setShowModeMenu] =
    useState(false);


  const [showPractice, setShowPractice] =
    useState(false);


  const [practiceScenario, setPracticeScenario] =
    useState(
      PRACTICE_SCENARIOS[0]
    );


  const [practiceMessages, setPracticeMessages] =
    useState<string[]>([]);


  const [practiceInput, setPracticeInput] =
    useState("");


  const [practiceDone, setPracticeDone] =
    useState(false);


  const [practiceLoading, setPracticeLoading] =
    useState(false);


  const fileInputRef =
    useRef<HTMLInputElement>(null);


  const chatEndRef =
    useRef<HTMLDivElement>(null);


  const inputRef =
    useRef<HTMLTextAreaElement>(null);


  /* =======================================================
     LIMIT
  ======================================================= */

  const activeDailyLimit =
    isPro
      ? maxDailyChats
      : maxFreeChats;


  const isLimitReached =
    chatsUsedToday >= activeDailyLimit;


  const remaining =
    Math.max(
      0,
      activeDailyLimit -
        chatsUsedToday
    );


  const handleLimitReached = () => {
    if (!isPro) {
      onOpenProModal();
      return;
    }
    setStatusNotice(
      "Your Pro Coach allowance resets at 00:00 UTC."
    );
  };


  /* =======================================================
     EFFECTS
  ======================================================= */

  useEffect(() => {
    if (onModeChange) {
      onModeChange(mode);
      return;
    }
    try {
      localStorage.setItem(
        "datings_coach_mode",
        mode
      );
    } catch {}
  }, [mode, onModeChange]);


  useEffect(() => {
    if (initialContext) {
      setInputText(initialContext);

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [initialContext]);


  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [
    messages,
    isTyping,
  ]);


  /* =======================================================
     SEND
  ======================================================= */

  const handleSend = async (
    textToSend?: string
  ) => {

    const text =
      (
        textToSend ??
        inputText
      ).trim();


    if (
      !text ||
      isTyping
    ) {
      return;
    }


    if (isLimitReached) {
      handleLimitReached();
      return;
    }


    setInputText("");
    await onSendMessage(
      text,
      undefined,
      mode
    );
  };


  /* =======================================================
     QUICK ACTION
  ======================================================= */

  const handleQuickAction = (
    prompt: string
  ) => {

    if (isLimitReached) {
      handleLimitReached();
      return;
    }


    setInputText(prompt);


    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };


  /* =======================================================
     UPLOAD
  ======================================================= */

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {

    const file =
      event.target.files?.[0];


    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }


    if (!file || isTyping) {
      return;
    }


    if (
      !file.type.match(
        /^image\/(png|jpe?g|webp)$/i
      )
    ) {
      setStatusNotice(
        "Use a PNG, JPG, or WEBP screenshot."
      );

      return;
    }


    if (isLimitReached) {
      handleLimitReached();
      return;
    }


    try {

      const {
        dataUrl,
      } =
        await processUploadFile(
          file
        );


      await onSendMessage(
        undefined,
        dataUrl,
        mode
      );

    } catch {

      setStatusNotice(
        "Coach couldn't read that image. Try another screenshot."
      );

    }
  };


  /* =======================================================
     NEW SESSION
  ======================================================= */

  const handleNewSession = () => {

    setInputText("");

    setPracticeMessages([]);

    setPracticeInput("");

    setPracticeDone(false);

    setStatusNotice("");

    onNewSession?.();
  };


  /* =======================================================
     PRACTICE
  ======================================================= */

  const startPractice = () => {

    setPracticeMessages([
      `Scenario: ${practiceScenario}`,
      "them: haha yeah 😂",
    ]);

    setPracticeDone(false);

    setPracticeInput("");
  };


  const sendPractice = async () => {

    const text =
      practiceInput.trim();


    if (
      !text ||
      practiceLoading ||
      practiceDone
    ) {
      return;
    }


    setPracticeInput("");

    const nextMessages = [
      ...practiceMessages,
      `you: ${text}`,
    ];


    setPracticeMessages(
      nextMessages
    );


    setPracticeLoading(true);


    /*
     * Temporary local practice.
     */

    setTimeout(() => {

      const responses = [
        "them: haha okay, that's actually interesting 👀",

        "them: wait really? tell me more",

        "them: okayyy, I didn't expect that 😂",

        "them: haha I like that answer",

        "them: that's a good question actually",
      ];


      const reply =
        responses[
          Math.floor(
            Math.random() *
              responses.length
          )
        ];


      setPracticeMessages(
        (current) => [
          ...current,
          reply,
        ]
      );


      setPracticeLoading(false);

    }, 600);
  };


  /* =======================================================
     PRACTICE FINISH
  ======================================================= */

  const finishPractice = () => {

    setPracticeDone(true);
  };


  /* =======================================================
     RENDERED MESSAGES
  ======================================================= */

  const renderedMessages = messages.map(
    (message) => ({
      id: message.id,
      role:
        message.role === "user"
          ? "user"
          : "coach",
      text:
        message.text || "",
      imageUrl:
        message.imageUrl,
    })
  );


  /* =======================================================
     RENDER
  ======================================================= */

  return (

    <div className="flex flex-col h-[calc(100vh-160px)] sm:h-[700px] bg-white border-[3px] border-black rounded-[24px] brutal-shadow overflow-hidden">


      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="min-h-[68px] border-b-[3px] border-black px-4 py-2 flex items-center justify-between bg-[#FFFBEB] shrink-0 gap-3">

        <div className="flex items-center gap-3 min-w-0">

          <div className="w-9 h-9 rounded-full bg-black border-[2px] border-black flex items-center justify-center text-white shrink-0">

            <Sparkles
              size={17}
            />

          </div>


          <div className="min-w-0">

            <div className="font-black text-[14px] leading-none">
              lol coach
            </div>

            <div className="text-[9px] font-bold opacity-60 flex items-center gap-1 mt-1">

              <span className="w-2 h-2 bg-[#4ADE80] rounded-full border border-black animate-pulse" />

              ONLINE • usually replies instantly

            </div>

          </div>

        </div>


        {/* MODE */}

        <div className="relative shrink-0">

          <button
            type="button"
            onClick={() =>
              setShowModeMenu(
                (value) => !value
              )
            }
            className="px-2.5 py-1.5 rounded-full border-[2px] border-black text-[9px] font-black uppercase flex items-center gap-1"
            style={{
              background:
                MODE_COPY[mode].color,
            }}
          >

            {MODE_COPY[mode].label}

            <span>
              mode
            </span>

            <ChevronDown
              size={11}
            />

          </button>


          {showModeMenu && (

            <div className="absolute right-0 top-9 z-50 w-44 bg-white border-[2px] border-black rounded-[12px] p-1.5 brutal-shadow-sm">

              {(
                Object.keys(
                  MODE_COPY
                ) as CoachMode[]
              ).map(
                (option) => (

                  <button
                    key={option}
                    type="button"
                    onClick={() => {

                      setMode(option);

                      setShowModeMenu(
                        false
                      );

                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-[#FFFBEB]"
                    style={{
                      background:
                        mode === option
                          ? MODE_COPY[
                              option
                            ].color
                          : undefined,
                    }}
                  >

                    {MODE_COPY[
                      option
                    ].label}


                    <span className="block text-[8px] normal-case opacity-60 mt-0.5">

                      {
                        MODE_COPY[
                          option
                        ].description
                      }

                    </span>

                  </button>

                )
              )}

            </div>

          )}

        </div>

      </div>


      {/* =====================================================
          FREE CHAT BAR
      ===================================================== */}

      <div className="bg-black text-white border-b-[3px] border-black px-4 py-2.5 flex items-center justify-between shrink-0 gap-3">

        <div className="flex items-center gap-2 min-w-0">

          <div className="w-7 h-7 bg-[#FFE066] border-[2px] border-white rounded-full flex items-center justify-center text-black">

            <MessageCircle
              size={14}
            />

          </div>


          <span className="font-black text-[10px] uppercase tracking-widest truncate">

            {isPro
              ? `Pro: ${remaining}/${activeDailyLimit} left today`
              : `Free: ${remaining}/${activeDailyLimit} left today`}

          </span>

        </div>


        {!isPro && (

          <div className="flex gap-1 shrink-0">

            {[
              ...Array(
                maxFreeChats
              ),
            ].map(
              (_, index) => (

                <span
                  key={index}
                  className={`w-2.5 h-2.5 rounded-full border border-white ${
                    index < remaining
                      ? "bg-[#FFE066]"
                      : "bg-white/20"
                  }`}
                />

              )
            )}

          </div>

        )}

      </div>


      {/* =====================================================
          LIMIT NOTICE
      ===================================================== */}

      {isLimitReached && (

        <div className="bg-[#FDA4AF] border-b-[2.5px] border-black px-4 py-3 flex items-center justify-between gap-3">

          <div>

            <div className="font-black text-[11px] uppercase">
              Today's coaching limit hit
            </div>

            <div className="text-[10px] font-bold">
              {isPro
                ? "Your Pro allowance resets at 00:00 UTC."
                : "Your next free coaching session unlocks at 00:00 UTC."}
            </div>

          </div>


          {!isPro && (
            <button
              type="button"
              onClick={
                onOpenProModal
              }
              className="bg-white border-[2px] border-black rounded-full px-3 py-1.5 font-black text-[9px] uppercase"
            >
              See plans
            </button>
          )}

        </div>

      )}


      {/* =====================================================
          STATUS
      ===================================================== */}

      {statusNotice && (

        <div className="bg-[#FFE066] border-b-[2.5px] border-black px-4 py-2 flex items-center gap-2 text-[11px] font-black">

          <TriangleAlert
            size={14}
          />

          <span>
            {statusNotice}
          </span>

          <button
            type="button"
            onClick={() =>
              setStatusNotice("")
            }
            className="ml-auto"
          >
            <X size={14} />
          </button>

        </div>

      )}


      {/* =====================================================
          CHAT AREA
      ===================================================== */}

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FFFBEB]">


        {/* WELCOME */}

        {renderedMessages.length ===
          0 && (

          <div className="max-w-[92%] bg-white border-[3px] border-black rounded-[20px] p-5 brutal-shadow-sm">

            <div className="flex items-center gap-2 mb-3">

              <div className="w-9 h-9 rounded-full bg-[#FFE066] border-[2px] border-black flex items-center justify-center">

                <Sparkles
                  size={17}
                />

              </div>

              <span className="text-[10px] font-black uppercase tracking-widest opacity-50">
                your dating coach
              </span>

            </div>


            <h2 className="font-black text-[22px] leading-none">
              yo, i'm your coach.
            </h2>


            <p className="text-[12px] font-bold opacity-70 mt-2 leading-relaxed">
              paste your chat, tell me what happened, or just tell me what&apos;s going on.
            </p>


            <div className="flex flex-wrap gap-1.5 mt-4">

              <button
                type="button"
                onClick={() =>
                  handleQuickAction(
                    QUICK_ACTIONS[0]
                      .prompt
                  )
                }
                className="text-[9px] font-black px-2.5 py-1.5 rounded-full border-[2px] border-black bg-[#FFE066]"
              >
                Roast my chat
              </button>


              <button
                type="button"
                onClick={() =>
                  handleQuickAction(
                    QUICK_ACTIONS[1]
                      .prompt
                  )
                }
                className="text-[9px] font-black px-2.5 py-1.5 rounded-full border-[2px] border-black bg-[#FFB7C5]"
              >
                What do I text back?
              </button>


              <button
                type="button"
                onClick={() =>
                  handleQuickAction(
                    QUICK_ACTIONS[2]
                      .prompt
                  )
                }
                className="text-[9px] font-black px-2.5 py-1.5 rounded-full border-[2px] border-black bg-[#BEF264]"
              >
                Profile review
              </button>

            </div>

          </div>

        )}


        {/* MESSAGES */}

        {renderedMessages.map(
          (message) => {

            const formatted =
              formatCoachText(
                message.text || ""
              );


            const isUser =
              message.role ===
              "user";


            return (

              <div
                key={message.id}
                className={`flex ${
                  isUser
                    ? "justify-end"
                    : "justify-start"
                }`}
              >

                <div
                  className={`max-w-[88%] ${
                    isUser
                      ? "bg-black text-white border-white"
                      : "bg-white text-black border-black"
                  } border-[2.5px] rounded-[20px] px-4 py-3 brutal-shadow-sm ${
                    isUser
                      ? "rounded-br-[6px]"
                      : "rounded-bl-[6px]"
                  } overflow-hidden`}
                >

                  {/* IMAGE */}

                  {message.imageUrl && (

                    <img
                      src={
                        message.imageUrl
                      }
                      alt="Uploaded conversation"
                      className="w-full max-w-[260px] rounded-[12px] border-[2px] border-black mb-2 object-cover"
                    />

                  )}


                  {/* HEADING */}

                  {formatted.heading && (

                    <div className="text-[9px] font-black uppercase tracking-widest mb-1">

                      {formatted.heading}

                    </div>

                  )}


                  {/* BODY */}

                  {formatted.body && (

                    <p className="text-[13px] font-medium leading-[1.45] whitespace-pre-wrap">

                      {formatted.body}

                    </p>

                  )}


                  {/* FEEDBACK */}

                  {!isUser &&
                    message.id !==
                      "1" && (

                    <div className="flex items-center gap-1 mt-3 pt-2 border-t border-black/10">

                      <span className="text-[8px] font-black uppercase opacity-40 mr-1">
                        Useful?
                      </span>


                      <button
                        type="button"
                        onClick={() =>
                          onMessageFeedback?.(
                            message.id,
                            true
                          )
                        }
                        className="p-1.5 hover:bg-[#BEF264] rounded"
                      >
                        <ThumbsUp
                          size={12}
                        />
                      </button>


                      <button
                        type="button"
                        onClick={() =>
                          onMessageFeedback?.(
                            message.id,
                            false
                          )
                        }
                        className="p-1.5 hover:bg-[#FDA4AF] rounded"
                      >
                        <ThumbsDown
                          size={12}
                        />
                      </button>

                    </div>

                  )}

                </div>

              </div>

            );

          }
        )}


        {/* TYPING */}

        {isTyping && (

          <div className="flex justify-start">

            <div className="bg-white border-[2.5px] border-black rounded-[20px] rounded-bl-[6px] px-4 py-3 brutal-shadow-sm">

              <div className="text-[9px] font-black uppercase tracking-widest mb-2">
                Coach is thinking...
              </div>


              <div className="flex gap-1">

                <span className="w-2 h-2 bg-black rounded-full animate-bounce" />

                <span className="w-2 h-2 bg-black rounded-full animate-bounce [animation-delay:200ms]" />

                <span className="w-2 h-2 bg-black rounded-full animate-bounce [animation-delay:400ms]" />

              </div>

            </div>

          </div>

        )}


        <div
          ref={chatEndRef}
        />

      </div>


      {/* =====================================================
          PRACTICE PANEL
      ===================================================== */}

      {showPractice && (

        <div className="border-t-[3px] border-black bg-[#C9B6FF] p-3 shrink-0">

          <div className="flex items-center justify-between gap-2 mb-2">

            <div className="font-black text-[11px] uppercase flex items-center gap-1">

              <Play
                size={13}
              />

              Practice with me

            </div>


            <button
              type="button"
              onClick={() =>
                setShowPractice(false)
              }
            >
              <X size={16} />
            </button>

          </div>


          {/* SCENARIOS */}

          <div className="flex gap-1.5 overflow-x-auto scrollbar-none mb-2">

            {PRACTICE_SCENARIOS.map(
              (item) => (

                <button
                  key={item}
                  type="button"
                  onClick={() => {

                    setPracticeScenario(
                      item
                    );

                    setPracticeMessages(
                      []
                    );

                    setPracticeDone(
                      false
                    );

                  }}
                  className={`shrink-0 px-2.5 py-1.5 border-[1.5px] border-black rounded-full text-[9px] font-black ${
                    practiceScenario ===
                    item
                      ? "bg-[#FFE066]"
                      : "bg-white"
                  }`}
                >
                  {item}
                </button>

              )
            )}

          </div>


          {/* START */}

          {practiceMessages.length ===
            0 ? (

            <button
              type="button"
              onClick={
                startPractice
              }
              className="w-full h-9 bg-black text-white rounded-full font-black text-[10px] uppercase"
            >
              Start {practiceScenario}
            </button>

          ) : (

            <>

              {/* PRACTICE CHAT */}

              <div className="max-h-[105px] overflow-y-auto space-y-1.5 mb-2">

                {practiceMessages.map(
                  (
                    item,
                    index
                  ) => (

                    <div
                      key={`${item}-${index}`}
                      className={`border-[1.5px] border-black rounded-[10px] px-2.5 py-1.5 text-[10px] font-bold ${
                        item.startsWith(
                          "you:"
                        )
                          ? "bg-[#FFE066] ml-5"
                          : "bg-white mr-5"
                      }`}
                    >
                      {item}
                    </div>

                  )
                )}

                {practiceLoading && (

                  <div className="bg-white border-[1.5px] border-black rounded-[10px] px-2.5 py-1.5 text-[10px] font-black">
                    typing...
                  </div>

                )}

              </div>


              {/* COMPLETE */}

              {practiceDone ? (

                <div className="bg-[#BEF264] border-[2px] border-black rounded-[11px] p-2.5">

                  <div className="font-black text-[11px]">
                    <Check
                      size={13}
                      className="inline mr-1"
                    />

                    Practice complete.
                  </div>

                  <div className="text-[9px] font-bold mt-1">
                    Good reps. Try another scenario when you&apos;re ready.
                  </div>


                  <button
                    type="button"
                    onClick={() => {

                      setPracticeMessages(
                        []
                      );

                      setPracticeDone(
                        false
                      );

                    }}
                    className="mt-2 bg-white border-[2px] border-black rounded-full px-3 py-1.5 text-[9px] font-black uppercase"
                  >
                    Practice again
                  </button>

                </div>

              ) : (

                /* PRACTICE INPUT */

                <div className="flex gap-1.5">

                  <input
                    value={
                      practiceInput
                    }
                    onChange={(
                      event
                    ) =>
                      setPracticeInput(
                        event.target
                          .value
                      )
                    }
                    onKeyDown={(
                      event
                    ) => {

                      if (
                        event.key ===
                        "Enter"
                      ) {
                        void sendPractice();
                      }

                    }}
                    placeholder={
                      practiceLoading
                        ? "Thinking..."
                        : "Your reply..."
                    }
                    disabled={
                      practiceLoading
                    }
                    className="flex-1 min-w-0 h-9 rounded-full border-[2px] border-black px-3 text-[10px] font-bold outline-none bg-white"
                  />


                  <button
                    type="button"
                    onClick={() =>
                      void sendPractice()
                    }
                    disabled={
                      practiceLoading ||
                      !practiceInput.trim()
                    }
                    className="w-9 h-9 bg-black text-white rounded-full flex items-center justify-center disabled:opacity-30"
                  >
                    <Send
                      size={13}
                    />
                  </button>


                  <button
                    type="button"
                    onClick={() =>
                      finishPractice()
                    }
                    disabled={
                      practiceLoading
                    }
                    className="px-2.5 rounded-full border-[2px] border-black bg-[#FFE066] text-[9px] font-black"
                  >
                    DONE
                  </button>

                </div>

              )}

            </>

          )}

        </div>

      )}


      {/* =====================================================
          QUICK ACTION BAR
      ===================================================== */}

      <div className="px-3 py-2 border-t-[2.5px] border-black bg-white flex gap-2 overflow-x-auto scrollbar-none shrink-0">

        {QUICK_ACTIONS.map(
          (action) => (

            <button
              key={action.label}
              type="button"
              onClick={() =>
                handleQuickAction(
                  action.prompt
                )
              }
              disabled={
                isLimitReached
              }
              className="shrink-0 text-[9px] font-black px-3 py-1.5 rounded-full border-[2px] border-black bg-[#FFFBEB] hover:bg-black hover:text-white disabled:opacity-30"
            >
              {action.label}
            </button>

          )
        )}


        {/* SCREENSHOT */}

        <button
          type="button"
          onClick={() =>
            fileInputRef.current?.click()
          }
          disabled={
            isLimitReached
          }
          className="shrink-0 text-[9px] font-black px-3 py-1.5 rounded-full border-[2px] border-black bg-[#BEF264] disabled:opacity-30"
        >

          <Camera
            size={11}
            className="inline mr-1"
          />

          Upload screenshot

        </button>


        {/* PRACTICE */}

        <button
          type="button"
          onClick={() =>
            setShowPractice(
              (value) => !value
            )
          }
          className="shrink-0 text-[9px] font-black px-3 py-1.5 rounded-full border-[2px] border-black bg-[#C9B6FF]"
        >

          <Play
            size={11}
            className="inline mr-1"
          />

          Practice

        </button>

      </div>


      {/* =====================================================
          COMPOSER
      ===================================================== */}

      <div className="p-3 border-t-[3px] border-black bg-white flex gap-2 shrink-0 items-center">


        {/* HIDDEN FILE */}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={
            handleFileUpload
          }
        />


        {/* CAMERA */}

        <button
          type="button"
          onClick={() =>
            fileInputRef.current?.click()
          }
          disabled={
            isLimitReached
          }
          className="w-10 h-10 bg-black border-[2.5px] border-black rounded-full flex items-center justify-center shrink-0 text-white disabled:opacity-50"
          title="Upload screenshot"
        >

          <Camera
            size={17}
          />

        </button>


        {/* INPUT */}

        <textarea
          ref={inputRef}
          value={inputText}
          onChange={(event) =>
            setInputText(
              event.target.value.slice(
                0,
                4000
              )
            )
          }
          onKeyDown={(event) => {

            if (
              event.key ===
                "Enter" &&
              !event.shiftKey
            ) {

              event.preventDefault();

              void handleSend();

            }

          }}
          placeholder={
            isLimitReached
              ? "Next free session unlocks tomorrow"
              : "paste chat or tell me what happened..."
          }
          disabled={
            isLimitReached
          }
          rows={1}
          className="flex-1 min-h-[44px] max-h-[100px] resize-none border-[2.5px] border-black rounded-[22px] px-4 py-2.5 text-[12px] font-medium outline-none placeholder:opacity-40 bg-[#FFFBEB] disabled:bg-gray-100"
        />


        {/* SEND */}

        <button
          type="button"
          onClick={() =>
            void handleSend()
          }
          disabled={
            !inputText.trim() ||
            isTyping ||
            isLimitReached
          }
          className="w-10 h-10 border-[2.5px] border-black rounded-full flex items-center justify-center bg-[#FF6B8A] text-black disabled:bg-neutral-200 disabled:opacity-50"
        >

          <Send
            size={16}
          />

        </button>

      </div>


      {/* =====================================================
          FOOTER
      ===================================================== */}

      <div className="px-3 pb-2 bg-white flex items-center justify-between text-[8px] font-black uppercase opacity-50 shrink-0">

        <span>
          Enter to send • Shift + Enter for newline
        </span>


        <button
          type="button"
          onClick={
            handleNewSession
          }
          className="flex items-center gap-1 hover:opacity-100"
        >

          <RefreshCcw
            size={10}
          />

          New session

        </button>

      </div>

    </div>

  );
};


export default CoachTab;