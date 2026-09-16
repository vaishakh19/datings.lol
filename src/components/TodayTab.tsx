import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  Brain,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  MessageCircle,
  Play,
  Send,
  Sparkles,
  Target,
  Trophy,
  User,
  Calendar,
  Heart,
  HelpCircle,
  Zap,
} from "lucide-react";

import { Lesson, UserProgress } from "../types";
import { getRankInfo } from "../data/lessons";

interface TodayTabProps {
  currentDay: number;
  lesson: Lesson;
  nextLesson: Lesson;
  progress: UserProgress;
  isDayCompleted: boolean;

  onCompleteDay: (
    reflectionText: string,
    isReadChecked: boolean
  ) => void;

  onQuickFix: (problem: string) => void;

  onPracticeComplete?: (
    scenario: string,
    score: number
  ) => void;

  onRealWorldComplete?: () => void;

  adminNote?: string;
}


/* =========================================================
   PROBLEM CATEGORIES
========================================================= */

type ProblemCategory =
  | "talking"
  | "interest"
  | "complicated"
  | "stuck"
  | "profile"
  | "dates";

const PROBLEM_CATEGORIES: {
  id: ProblemCategory;
  title: string;
  description: string;
  color: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "talking",
    title: "We're talking",
    description: "Conversation, replies, texting",
    color: "#FFB7C5",
    icon: <MessageCircle size={21} />,
  },
  {
    id: "interest",
    title: "I like them",
    description: "Making a move, attraction",
    color: "#FFE066",
    icon: <Heart size={21} />,
  },
  {
    id: "complicated",
    title: "It's complicated",
    description: "Mixed signals, uncertainty",
    color: "#C9B6FF",
    icon: <HelpCircle size={21} />,
  },
  {
    id: "stuck",
    title: "I feel stuck",
    description: "Overthinking, confidence",
    color: "#BEF264",
    icon: <Brain size={21} />,
  },
  {
    id: "profile",
    title: "Profile help",
    description: "Bio, photos, getting matches",
    color: "#A8D8FF",
    icon: <User size={21} />,
  },
  {
    id: "dates",
    title: "Dates & beyond",
    description: "First dates, relationships",
    color: "#FFCBA4",
    icon: <Calendar size={21} />,
  },
];


const CATEGORY_PROBLEMS: Record<
  ProblemCategory,
  {
    title: string;
    description: string;
    problems: string[];
  }
> = {
  talking: {
    title: "We're talking",
    description: "What's happening with the conversation?",
    problems: [
      "They're leaving me on read",
      "The conversation feels dry",
      "I don't know what to say",
      "Their replies are really short",
      "I feel like I'm carrying the conversation",
    ],
  },

  interest: {
    title: "I like them",
    description: "Let's figure out your next move.",
    problems: [
      "How do I ask them out?",
      "I don't know if they like me",
      "How do I show interest without being needy?",
      "What should I text them?",
      "I'm scared to make a move",
    ],
  },

  complicated: {
    title: "It's complicated",
    description: "Let's make sense of what's happening.",
    problems: [
      "They're giving me mixed signals",
      "They suddenly became distant",
      "I don't know where we stand",
      "We're in a situationship",
      "I think I messed things up",
    ],
  },

  stuck: {
    title: "I feel stuck",
    description: "Get clarity instead of staying in your head.",
    problems: [
      "I'm overthinking everything",
      "I get nervous talking to them",
      "I'm afraid of rejection",
      "I don't know what my next step should be",
      "I keep checking their messages/profile",
    ],
  },

  profile: {
    title: "Profile help",
    description: "Make your profile say more about you.",
    problems: [
      "Help me write my bio",
      "Which photos should I use?",
      "How can I make my profile more interesting?",
      "I'm not getting matches",
      "I don't know what to write",
    ],
  },

  dates: {
    title: "Dates & beyond",
    description: "From the first date to what comes next.",
    problems: [
      "I'm going on my first date",
      "What should we talk about?",
      "My first date was awkward",
      "How do I ask for a second date?",
      "I want things to become more serious",
    ],
  },
};


/* =========================================================
   PRACTICE SCENARIOS
========================================================= */

const SCENARIOS = [
  "New match",
  "Someone I already know",
  "Crush",
  "First date",
  "Asking someone out",
  "Reconnecting",
  "Flirty conversation",
];


/* =========================================================
   HELPERS
========================================================= */

function getTodayKey(): string {
  return new Date().toLocaleDateString("en-CA");
}


/* =========================================================
   TODAY TAB
========================================================= */

export const TodayTab: React.FC<TodayTabProps> = ({
  currentDay,
  lesson,
  nextLesson,
  progress,
  isDayCompleted,
  onCompleteDay,
  onQuickFix,
  onPracticeComplete,
  onRealWorldComplete,
  adminNote,
}) => {
  const rank = getRankInfo(progress.xp);

  /* -------------------------------------------------------
     MISSION
  ------------------------------------------------------- */

  const [missionStarted, setMissionStarted] =
    useState(false);

  const [reflection, setReflection] =
    useState("");


  /* -------------------------------------------------------
     PRACTICE
  ------------------------------------------------------- */

  const [showPractice, setShowPractice] =
    useState(false);

  const [scenario, setScenario] =
    useState(SCENARIOS[0]);

  const [practiceMessages, setPracticeMessages] =
    useState<string[]>([]);

  const [practiceInput, setPracticeInput] =
    useState("");

  const [practiceLoading, setPracticeLoading] =
    useState(false);

  const [practiceFinished, setPracticeFinished] =
    useState(false);

  const [practiceScore, setPracticeScore] =
    useState(0);


  /* -------------------------------------------------------
     REAL WORLD
  ------------------------------------------------------- */

  const [realWorldDone, setRealWorldDone] =
    useState(false);


  /* -------------------------------------------------------
     PROBLEM FLOW
  ------------------------------------------------------- */

  const [problemInput, setProblemInput] =
    useState("");

  const [selectedCategory, setSelectedCategory] =
    useState<ProblemCategory | null>(null);

  const [selectedProblem, setSelectedProblem] =
    useState("");

  const [problemContext, setProblemContext] =
    useState("");


  /* -------------------------------------------------------
     PROGRESS
  ------------------------------------------------------- */

  const xpIntoLevel = progress.xp % 200;

  const xpTarget = 200;

  const progressPercent = Math.min(
    100,
    Math.round(
      (xpIntoLevel / xpTarget) * 100
    )
  );


  const todayEntries = useMemo(
    () =>
      progress.journal.filter(
        (entry) =>
          entry.date.slice(0, 10) ===
          getTodayKey()
      ),
    [progress.journal]
  );


  const actionsComplete =
    todayEntries.length +
    (realWorldDone ? 1 : 0);


  const missionTitle =
    lesson.task.title;

  const missionDescription =
    lesson.task.desc;


  /* =========================================================
     PROBLEM FLOW FUNCTIONS
  ========================================================= */

  const openCategory = (
    category: ProblemCategory
  ) => {
    setSelectedCategory(category);
    setSelectedProblem("");
    setProblemContext("");
  };


  const goBackToCategories = () => {
    setSelectedCategory(null);
    setSelectedProblem("");
    setProblemContext("");
  };


  const openCoach = () => {
    if (!selectedProblem) return;

    const fullContext = problemContext.trim()
      ? `${selectedProblem}. Additional context: ${problemContext.trim()}`
      : selectedProblem;

    onQuickFix(fullContext);
  };


  const submitProblem = () => {
    const clean = problemInput.trim();

    if (!clean) return;

    onQuickFix(clean);
  };


  /* =========================================================
     MISSION FUNCTIONS
  ========================================================= */

  const completeMission = () => {
    if (isDayCompleted) return;

    onCompleteDay(
      reflection ||
        `Completed: ${missionTitle}`,
      true
    );
  };


  /* =========================================================
     PRACTICE FUNCTIONS
  ========================================================= */

  const startPractice = () => {
    setShowPractice(true);

    setPracticeFinished(false);

    setPracticeScore(0);

    setPracticeMessages([
      `Scenario: ${scenario}`,
      "okay, you matched. what do you say first?",
    ]);
  };


  const sendPracticeMessage = async () => {
    const clean = practiceInput.trim();

    if (
      !clean ||
      practiceLoading ||
      practiceFinished
    ) {
      return;
    }

    setPracticeInput("");

    const nextMessages = [
      ...practiceMessages,
      `you: ${clean}`,
    ];

    setPracticeMessages(nextMessages);

    setPracticeLoading(true);

    try {
      const response = await fetch(
        "/api/coach",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            message:
              `Dating simulation. Scenario: ${scenario}. ` +
              `Reply naturally as the other person. ` +
              `Do not coach or reveal the answer. ` +
              `User message: ${clean}`,

            vibe: "direct",

            history:
              nextMessages.map(
                (text, index) => ({
                  role:
                    index % 2 === 0
                      ? "coach"
                      : "user",
                  text,
                })
              ),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Practice request failed: ${response.status}`
        );
      }

      const data =
        await response.json();

      setPracticeMessages(
        (current) => [
          ...current,
          data.text ||
            "interesting... tell me more",
        ]
      );
    } catch {
      setPracticeMessages(
        (current) => [
          ...current,
          "hmm okay, now make that more specific and playful.",
        ]
      );
    } finally {
      setPracticeLoading(false);
    }
  };


  const finishPractice = () => {
    const score = Math.min(
      100,
      48 +
        Math.min(
          42,
          Math.max(
            0,
            practiceMessages.length - 2
          ) * 8
        )
    );

    setPracticeScore(score);

    setPracticeFinished(true);

    onPracticeComplete?.(
      scenario,
      score
    );
  };


  const resetPractice = () => {
    setPracticeMessages([]);

    setPracticeInput("");

    setPracticeFinished(false);

    setPracticeScore(0);
  };


  /* =========================================================
     REAL WORLD
  ========================================================= */

  const completeRealWorld = () => {
    if (realWorldDone) return;

    setRealWorldDone(true);

    onRealWorldComplete?.();
  };


  /* =========================================================
     SELECTED CATEGORY
  ========================================================= */

  const selectedCategoryData =
    selectedCategory
      ? CATEGORY_PROBLEMS[
          selectedCategory
        ]
      : null;


  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="space-y-5 pb-8">


      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="flex items-end justify-between gap-4">

        <div>

          <div className="inline-flex items-center gap-2 bg-black text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-3">
            <Target size={12} />

            Day {currentDay}

            <span className="opacity-50">
              •
            </span>

            Today
          </div>


          <h1 className="text-[34px] sm:text-[42px] font-black leading-[0.9] tracking-tighter">
            hey there,
            <br />
            what&apos;s on your mind?
          </h1>


          <p className="text-[14px] font-bold opacity-60 mt-3">
            Tell me what&apos;s happening. We&apos;ll figure out your next move.
          </p>

        </div>


        {/* LEVEL */}

        <div className="text-right shrink-0">

          <div className="text-[10px] font-black uppercase opacity-50">
            Level{" "}
            {Math.floor(
              progress.xp / 200
            ) + 1}
          </div>

          <div className="font-black text-[14px] flex items-center gap-1 justify-end">
            {rank.emoji} {rank.name}
          </div>

        </div>

      </section>


      {/* =====================================================
          XP
      ===================================================== */}

      <section className="bg-[#FFE066] border-[3px] border-black rounded-[20px] p-4 brutal-shadow-sm">

        <div className="flex items-center justify-between text-[11px] font-black uppercase">

          <span>
            Progress to next level
          </span>

          <span>
            {xpIntoLevel} / {xpTarget} XP
          </span>

        </div>


        <div className="h-3 bg-white border-[2px] border-black rounded-full mt-2 overflow-hidden">

          <div
            className="h-full bg-black transition-all duration-500"
            style={{
              width: `${progressPercent}%`,
            }}
          />

        </div>

      </section>


      {/* =====================================================
          ADMIN NOTE
      ===================================================== */}

      {adminNote && (

        <div className="bg-[#BEF264] border-[3px] border-black rounded-[18px] p-3.5 font-bold text-[13px] flex gap-2">

          <Sparkles
            size={18}
            className="shrink-0"
          />

          <span>
            {adminNote}
          </span>

        </div>

      )}


      {/* =====================================================
          PROBLEM SOLVER
      ===================================================== */}

      {!selectedCategory ? (

        <section>

          {/* INPUT */}

          <div className="mb-5">

            <div className="flex items-center gap-2 mb-2">

              <span className="h-2 w-2 rounded-full bg-[#FF6B8A]" />

              <label className="text-[11px] font-black uppercase tracking-widest">
                Tell me what&apos;s happening
              </label>

            </div>


            <div className="flex bg-white border-[3px] border-black rounded-[16px] overflow-hidden brutal-shadow-sm">

              <input
                value={problemInput}
                onChange={(event) =>
                  setProblemInput(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    submitProblem();
                  }
                }}
                placeholder="e.g. They haven't replied in 2 days..."
                className="flex-1 min-w-0 bg-transparent px-4 h-[52px] text-[13px] font-bold outline-none placeholder:opacity-40"
              />


              <button
                type="button"
                onClick={submitProblem}
                disabled={
                  !problemInput.trim()
                }
                className="m-1 w-[44px] rounded-[11px] bg-black text-white flex items-center justify-center disabled:opacity-20"
              >
                <ArrowRight size={19} />
              </button>

            </div>

          </div>


          {/* CATEGORIES */}

          <div>

            <div className="flex items-end justify-between mb-3">

              <div>

                <div className="text-[10px] font-black uppercase tracking-widest opacity-50">
                  Need a little direction?
                </div>

                <h2 className="text-[20px] font-black tracking-tight">
                  What do you need help with?
                </h2>

              </div>

              <span className="text-[10px] font-black opacity-40">
                6 areas
              </span>

            </div>


            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">

              {PROBLEM_CATEGORIES.map(
                (category) => (

                  <button
                    key={category.id}
                    type="button"
                    onClick={() =>
                      openCategory(
                        category.id
                      )
                    }
                    className="group min-h-[92px] bg-white border-[3px] border-black rounded-[16px] p-3 flex items-center gap-3 text-left brutal-shadow-sm hover:-translate-y-0.5 transition-transform"
                  >

                    <div
                      className="w-[43px] h-[43px] shrink-0 border-[2px] border-black rounded-[12px] flex items-center justify-center group-hover:scale-105 transition-transform"
                      style={{
                        backgroundColor:
                          category.color,
                      }}
                    >
                      {category.icon}
                    </div>


                    <div className="flex-1 min-w-0">

                      <div className="font-black text-[13px]">
                        {category.title}
                      </div>

                      <div className="text-[11px] font-bold opacity-50 mt-1 leading-tight">
                        {category.description}
                      </div>

                    </div>


                    <ChevronRight
                      size={17}
                      className="opacity-30 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                    />

                  </button>

                )
              )}

            </div>

          </div>

        </section>

      ) : (

        /* =====================================================
           CATEGORY DETAIL
        ===================================================== */

        <section className="bg-white border-[3px] border-black rounded-[20px] overflow-hidden brutal-shadow">

          {/* HEADER */}

          <div className="bg-[#F1EBFF] p-5 border-b-[3px] border-black">

            <button
              type="button"
              onClick={
                goBackToCategories
              }
              className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider opacity-60 hover:opacity-100 mb-4"
            >
              <ChevronLeft size={16} />

              Back
            </button>


            <div className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">
              {selectedCategoryData?.title}
            </div>

            <h2 className="text-[25px] font-black tracking-tight leading-none">
              {selectedCategoryData?.description}
            </h2>

          </div>


          {/* OPTIONS */}

          <div className="p-4">

            <div className="text-[11px] font-black uppercase tracking-wider mb-3">
              What&apos;s closest to your situation?
            </div>


            <div className="space-y-2">

              {selectedCategoryData?.problems.map(
                (problem) => {

                  const selected =
                    selectedProblem ===
                    problem;

                  return (

                    <button
                      key={problem}
                      type="button"
                      onClick={() =>
                        setSelectedProblem(
                          problem
                        )
                      }
                      className={`w-full min-h-[48px] px-3 py-3 border-[2px] border-black rounded-[12px] text-left flex items-center gap-3 font-bold text-[12px] transition ${
                        selected
                          ? "bg-black text-white"
                          : "bg-[#FFFBEB] hover:bg-neutral-100"
                      }`}
                    >

                      <span
                        className={`w-[19px] h-[19px] shrink-0 border-[2px] rounded-full flex items-center justify-center ${
                          selected
                            ? "border-white"
                            : "border-black"
                        }`}
                      >

                        {selected && (
                          <span className="w-2 h-2 bg-white rounded-full" />
                        )}

                      </span>


                      {problem}

                    </button>

                  );
                }
              )}

            </div>


            {/* CONTEXT */}

            {selectedProblem && (

              <div className="mt-5">

                <label className="text-[11px] font-black uppercase tracking-wider">
                  Give me more context
                  <span className="opacity-40 ml-1 normal-case">
                    optional
                  </span>
                </label>


                <textarea
                  value={problemContext}
                  onChange={(event) =>
                    setProblemContext(
                      event.target.value
                    )
                  }
                  placeholder="What happened? What did they say? How long has this been going on?"
                  rows={4}
                  className="w-full mt-2 bg-[#FFFBEB] border-[2px] border-black rounded-[12px] p-3 text-[12px] font-bold outline-none resize-none"
                />


                <button
                  type="button"
                  onClick={openCoach}
                  className="w-full h-[48px] mt-2 bg-[#FF6B8A] border-[3px] border-black rounded-full font-black text-[12px] uppercase flex items-center justify-center gap-2 brutal-shadow-sm"
                >
                  Get personalized advice

                  <ArrowRight
                    size={17}
                  />

                </button>

              </div>

            )}

          </div>

        </section>

      )}


      {/* =====================================================
          TODAY'S MISSION
      ===================================================== */}

      <section className="bg-[#FFE066] border-[3px] border-black rounded-[22px] p-5 brutal-shadow">

        <div className="flex items-start justify-between gap-3 mb-4">

          <div>

            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">

              <Flame size={16} />

              Today&apos;s mission

            </div>


            <h2 className="text-[25px] sm:text-[29px] font-black tracking-tighter leading-[0.95] mt-2">
              {missionTitle}
            </h2>

          </div>


          <div className="bg-black text-[#FFE066] border-[2px] border-black rounded-full px-2.5 py-1 text-[10px] font-black shrink-0">

            +{lesson.task.xp} XP

          </div>

        </div>


        <p className="text-[13px] font-bold leading-relaxed">
          {missionDescription}
        </p>


        <div className="bg-white/70 border-[2px] border-black rounded-[14px] p-3 mt-4">

          <div className="text-[9px] font-black uppercase tracking-widest mb-1">
            Your move
          </div>

          <p className="text-[12px] font-bold leading-relaxed">
            Use one specific detail, share something about yourself, and leave them an easy way to respond.
          </p>

        </div>


        {/* REFLECTION */}

        {missionStarted &&
          !isDayCompleted && (

            <textarea
              value={reflection}
              onChange={(event) =>
                setReflection(
                  event.target.value
                )
              }
              placeholder="What happened? Drop a quick reflection..."
              className="w-full min-h-[75px] mt-3 bg-[#FFFBEB] border-[2px] border-black rounded-[13px] p-3 text-[12px] font-medium outline-none resize-none"
            />

          )}


        {/* MISSION BUTTON */}

        <button
          type="button"
          onClick={() => {

            if (isDayCompleted) {
              return;
            }

            if (!missionStarted) {
              setMissionStarted(true);
              return;
            }

            completeMission();

          }}
          disabled={isDayCompleted}
          className={`w-full mt-4 h-[48px] rounded-full border-[3px] border-black font-black uppercase text-[11px] flex items-center justify-center gap-2 ${
            isDayCompleted
              ? "bg-[#BEF264] text-black"
              : "bg-black text-white hover:-translate-y-0.5"
          }`}
        >

          {isDayCompleted ? (

            <>
              <Check size={17} />
              Mission complete
            </>

          ) : missionStarted ? (

            <>
              Complete mission
              <Trophy size={16} />
            </>

          ) : (

            <>
              Start mission
              <ArrowRight size={16} />
            </>

          )}

        </button>

      </section>


      {/* =====================================================
          PRACTICE
      ===================================================== */}

      <section className="bg-[#C9B6FF] border-[3px] border-black rounded-[22px] p-4 brutal-shadow-sm">

        <div className="flex items-start justify-between gap-3">

          <div>

            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">

              <Brain size={16} />

              Practice

            </div>


            <h2 className="font-black text-[21px] tracking-tight mt-1">
              2-minute AI conversation
            </h2>


            <p className="text-[11px] font-bold mt-1">
              Build reps without risking the real chat.
            </p>

          </div>


          {!showPractice && (

            <button
              type="button"
              onClick={() =>
                setShowPractice(true)
              }
              className="bg-white border-[2px] border-black rounded-full px-3 py-2 font-black text-[10px] uppercase shrink-0 hover:-translate-y-0.5"
            >

              <Play
                size={12}
                className="inline mr-1"
              />

              Practice now

            </button>

          )}

        </div>


        {showPractice && (

          <div className="bg-white border-[2px] border-black rounded-[16px] p-3 mt-4">

            {/* SCENARIOS */}

            <div className="flex flex-wrap gap-1.5 mb-3">

              {SCENARIOS.map(
                (item) => (

                  <button
                    key={item}
                    type="button"
                    onClick={() => {

                      setScenario(item);

                      resetPractice();

                    }}
                    className={`px-2.5 py-1.5 rounded-full border-[1.5px] border-black text-[9px] font-black ${
                      scenario === item
                        ? "bg-[#FFE066]"
                        : "bg-[#FFFBEB]"
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
                onClick={startPractice}
                className="w-full h-10 bg-black text-white rounded-full font-black text-[11px] uppercase"
              >
                Start {scenario}
              </button>

            ) : (

              <>

                {/* CHAT */}

                <div className="space-y-2 max-h-[190px] overflow-y-auto mb-3">

                  {practiceMessages.map(
                    (message, index) => (

                      <div
                        key={`${message}-${index}`}
                        className={`text-[11px] font-bold p-2.5 rounded-[12px] border-[2px] border-black ${
                          index % 2
                            ? "bg-[#FFFBEB] ml-6"
                            : "bg-[#BEF264] mr-6"
                        }`}
                      >
                        {message}
                      </div>

                    )
                  )}


                  {practiceLoading && (

                    <div className="bg-[#F1EBFF] border-[2px] border-black rounded-[12px] p-2.5 mr-6 text-[11px] font-black">
                      Coach is thinking...
                    </div>

                  )}

                </div>


                {/* FINISHED */}

                {practiceFinished ? (

                  <div className="bg-[#BEF264] border-[2px] border-black rounded-[12px] p-3">

                    <div className="font-black text-[14px]">
                      Score: {practiceScore}/100
                    </div>

                    <p className="text-[11px] font-bold mt-1">
                      Keep the energy specific, curious, and low-pressure.
                    </p>


                    <button
                      type="button"
                      onClick={resetPractice}
                      className="mt-3 bg-white border-[2px] border-black rounded-full px-4 py-2 font-black text-[10px] uppercase"
                    >
                      Practice again
                    </button>

                  </div>

                ) : (

                  /* INPUT */

                  <div className="flex gap-2">

                    <input
                      value={practiceInput}
                      onChange={(event) =>
                        setPracticeInput(
                          event.target.value
                        )
                      }
                      onKeyDown={(event) => {

                        if (
                          event.key ===
                          "Enter"
                        ) {
                          void sendPracticeMessage();
                        }

                      }}
                      disabled={
                        practiceLoading
                      }
                      placeholder={
                        practiceLoading
                          ? "Coach is thinking..."
                          : "Type your message..."
                      }
                      className="flex-1 min-w-0 h-10 bg-[#FFFBEB] border-[2px] border-black rounded-full px-3 text-[11px] font-bold outline-none"
                    />


                    <button
                      type="button"
                      onClick={() =>
                        void sendPracticeMessage()
                      }
                      disabled={
                        practiceLoading ||
                        !practiceInput.trim()
                      }
                      className="w-10 h-10 shrink-0 bg-black text-white rounded-full flex items-center justify-center disabled:opacity-30"
                    >
                      <Send size={14} />
                    </button>


                    <button
                      type="button"
                      onClick={
                        finishPractice
                      }
                      disabled={
                        practiceLoading
                      }
                      className="px-3 h-10 bg-[#FFE066] border-[2px] border-black rounded-full font-black text-[9px] disabled:opacity-40"
                    >
                      FINISH
                    </button>

                  </div>

                )}

              </>

            )}

          </div>

        )}

      </section>


      {/* =====================================================
          REAL WORLD MOVE
      ===================================================== */}

      <section className="bg-[#FFB7C5] border-[3px] border-black rounded-[20px] p-4 flex items-center justify-between gap-3 brutal-shadow-sm">

        <div>

          <div className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1">

            <MessageCircle size={13} />

            Real-world move

          </div>


          <p className="font-black text-[14px] leading-tight mt-1">
            Ask one open question, then share something about yourself.
          </p>

        </div>


        <button
          type="button"
          onClick={
            completeRealWorld
          }
          disabled={realWorldDone}
          className={`shrink-0 px-3 py-2 border-[2px] border-black rounded-full font-black text-[9px] uppercase ${
            realWorldDone
              ? "bg-[#BEF264]"
              : "bg-white"
          }`}
        >

          {realWorldDone
            ? "Done"
            : "I did it"}

          {realWorldDone && (
            <Check
              size={12}
              className="inline ml-1"
            />
          )}

        </button>

      </section>


      {/* =====================================================
          TODAY'S PROGRESS
      ===================================================== */}

      <section className="bg-black text-white border-[3px] border-black rounded-[20px] p-4">

        <div className="flex items-center gap-2 mb-3">

          <Trophy
            size={17}
            className="text-[#FFE066]"
          />

          <h2 className="font-black text-[13px] uppercase tracking-widest">
            Today&apos;s progress
          </h2>

        </div>


        <div className="grid grid-cols-3 gap-2 text-center">

          {/* ACTIONS */}

          <div>

            <div className="text-[21px] font-black">
              {Math.min(
                3,
                actionsComplete
              )}{" "}
              / 3
            </div>

            <div className="text-[8px] font-black uppercase opacity-60">
              Actions
            </div>

          </div>


          {/* XP */}

          <div>

            <div className="text-[21px] font-black">

              +
              {todayEntries.reduce(
                (sum, entry) =>
                  sum + entry.xp,
                0
              ) +
                (realWorldDone
                  ? 15
                  : 0)}{" "}
              XP

            </div>

            <div className="text-[8px] font-black uppercase opacity-60">
              Earned today
            </div>

          </div>


          {/* COMPLETED */}

          <div>

            <div className="text-[21px] font-black">
              {todayEntries.length}
            </div>

            <div className="text-[8px] font-black uppercase opacity-60">
              Completed
            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          NEXT LESSON
      ===================================================== */}

      {nextLesson && (

        <div className="bg-white border-[2px] border-black rounded-[16px] p-3 flex items-center justify-between gap-3">

          <div>

            <div className="text-[8px] font-black uppercase tracking-widest opacity-40">
              Up next
            </div>

            <div className="font-black text-[12px] mt-1">
              {nextLesson.task.title}
            </div>

          </div>


          <ArrowRight
            size={16}
            className="opacity-40"
          />

        </div>

      )}

    </div>
  );
};

export default TodayTab;