import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ChevronRight,
  Flame,
  LockKeyhole,
  Megaphone,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Zap,
  MessageCircle,
} from "lucide-react";
import { AdminSettings, UserProfile, UserProgress } from "../types";
import { COMMUNITY_TEACHINGS, CommunityTeaching } from "../data/community";

interface CommunityTabProps {
  settings: AdminSettings;
  isAdmin: boolean;
  onOpenAdmin: () => void;
  userId?: string;
  profile?: UserProfile | null;
  progress?: UserProgress;
  onOpenCoach?: (context: string) => void;
  onPracticeToday?: (lessonId?: number) => void;
  onAwardXp?: (amount: number, reason: string) => void;
}

const FILTERS = [
  "ALL",
  "TEXTING",
  "FLIRTING",
  "CONFIDENCE",
  "DATES",
  "RELATIONSHIPS",
  "MINDSET",
];

const PROBLEMS = [
  {
    id: "overthinking",
    label: "Overthinking",
    description: "I keep reading into everything",
    tags: ["overthinking", "mindset", "confidence"],
    accent: "#FDA4AF",
  },
  {
    id: "texting",
    label: "Dry conversations",
    description: "Our chat is going nowhere",
    tags: ["texting", "communication", "conversation"],
    accent: "#FFE066",
  },
  {
    id: "making-a-move",
    label: "Making a move",
    description: "I don't know when to act",
    tags: ["flirting", "confidence", "communication"],
    accent: "#A78BFA",
  },
  {
    id: "confidence",
    label: "Confidence",
    description: "I second-guess myself",
    tags: ["confidence", "mindset"],
    accent: "#BEF264",
  },
  {
    id: "dates",
    label: "First dates",
    description: "I want dates to feel natural",
    tags: ["dates", "dating", "conversation"],
    accent: "#FFE066",
  },
  {
    id: "mixed-signals",
    label: "Mixed signals",
    description: "I don't know where I stand",
    tags: ["relationships", "mindset", "communication"],
    accent: "#FDA4AF",
  },
];

function storageKey(userId: string | undefined, suffix: string): string {
  return `datings_community_${userId || "guest"}_${suffix}`;
}

function readSet(key: string): Set<string> {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    return new Set();
  }
}

function writeSet(key: string, values: Set<string>): void {
  localStorage.setItem(key, JSON.stringify([...values]));
}

function getAccentClass(accent: string): string {
  if (accent === "#111") return "bg-[#111] text-white";
  if (accent === "#FDA4AF") return "bg-[#FDA4AF]";
  if (accent === "#BEF264") return "bg-[#BEF264]";
  if (accent === "#A78BFA") return "bg-[#A78BFA]";
  return "bg-[#FFE066]";
}

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function matchesProblem(
  teaching: CommunityTeaching,
  problem: (typeof PROBLEMS)[number]
): boolean {
  const teachingText = [
    teaching.title,
    teaching.subtitle,
    teaching.category,
    teaching.problem,
    teaching.tags.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return problem.tags.some((tag) => teachingText.includes(tag));
}

export const CommunityTab: React.FC<CommunityTabProps> = ({
  settings,
  isAdmin,
  onOpenAdmin,
  userId,
  profile,
  progress,
  onOpenCoach,
  onPracticeToday,
  onAwardXp,
}) => {
  const [selectedTeaching, setSelectedTeaching] =
    useState<CommunityTeaching | null>(null);

  const [selectedProblem, setSelectedProblem] = useState<string | null>(null);

  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const [saved, setSaved] = useState<Set<string>>(() =>
    readSet(storageKey(userId, "saved"))
  );

  const [completed, setCompleted] = useState<Set<string>>(() =>
    readSet(storageKey(userId, "completed"))
  );

  const [reactions, setReactions] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(
        localStorage.getItem(storageKey(userId, "reactions")) || "{}"
      );
    } catch {
      return {};
    }
  });

  const [readProgress, setReadProgress] = useState<Record<string, number>>(
    {}
  );

  /*
   * ADMIN DROPS
   */
  const notificationTeachings: CommunityTeaching[] = useMemo(
    () =>
      settings.notifications
        .filter((item) => item.isActive)
        .map((item) => ({
          id: `admin-${item.id}`,
          category:
            item.tone === "warning" ? "MINDSET" : "COMMUNICATION",
          type:
            item.tone === "warning" ? "REMINDER" : "COACH TIP",
          title: item.title,
          subtitle: item.message,
          intro: item.message,
          problem: item.message,
          why: "Fresh guidance from the datings.lol team.",
          doInstead: "Read this drop, then try one small move today.",
          badExample: "Waiting for the perfect moment.",
          betterExample: "One clear action, done today.",
          takeaway: item.message,
          readTime: 1,
          xp: 10,
          accent:
            item.tone === "warning"
              ? "#FDA4AF"
              : item.tone === "win"
              ? "#BEF264"
              : "#FFE066",
          tags: ["communication"],
        })),
    [settings.notifications]
  );

  /*
   * ALL TEACHINGS
   */
  const allTeachings = useMemo(
    () => [...COMMUNITY_TEACHINGS, ...notificationTeachings],
    [notificationTeachings]
  );

  /*
   * PERSONALIZATION
   *
   * We use:
   * - profile goal
   * - profile blocker
   * - completed lessons
   * - viewed lessons
   * - featured lessons
   */
  const personalizedTeachings = useMemo(() => {
    const profileText = normalize(
      `${profile?.goal || ""} ${profile?.blocker || ""} ${
        profile?.vibe || ""
      }`
    );

    return [...allTeachings]
      .map((teaching) => {
        const text = normalize(
          `${teaching.title} ${teaching.subtitle} ${
            teaching.problem
          } ${teaching.category} ${teaching.tags.join(" ")}`
        );

        let score = 0;

        teaching.tags.forEach((tag) => {
          if (profileText.includes(normalize(tag))) {
            score += 6;
          }
        });

        if (profileText.includes(normalize(teaching.category))) {
          score += 4;
        }

        if (teaching.featured) {
          score += 3;
        }

        if (completed.has(teaching.id)) {
          score -= 8;
        }

        if (progress?.lessonsViewed?.includes(teaching.lessonId)) {
          score -= 2;
        }

        if (text.includes("beginner")) {
          score += 1;
        }

        return {
          teaching,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .map((item) => item.teaching);
  }, [
    allTeachings,
    profile?.goal,
    profile?.blocker,
    profile?.vibe,
    completed,
    progress?.lessonsViewed,
  ]);

  /*
   * FILTERED LESSONS
   */
  const teachings = useMemo(() => {
    const query = normalize(search);

    return personalizedTeachings.filter((teaching) => {
      const matchesFilter =
        filter === "ALL" ||
        teaching.category === filter ||
        teaching.tags.some(
          (tag) => normalize(tag) === normalize(filter)
        );

      const matchesSearch =
        !query ||
        normalize(
          `${teaching.title} ${teaching.subtitle} ${
            teaching.category
          } ${teaching.problem} ${teaching.tags.join(" ")}`
        ).includes(query);

      const selected =
        !selectedProblem ||
        matchesProblem(
          teaching,
          PROBLEMS.find((p) => p.id === selectedProblem)!
        );

      return matchesFilter && matchesSearch && selected;
    });
  }, [
    personalizedTeachings,
    filter,
    search,
    selectedProblem,
  ]);

  /*
   * PROGRESS
   */
  const totalLessons = allTeachings.length;

  const completedCount = allTeachings.filter((teaching) =>
    completed.has(teaching.id)
  ).length;

  const progressPercent =
    totalLessons === 0
      ? 0
      : Math.round((completedCount / totalLessons) * 100);

  /*
   * RECOMMENDED LESSON
   */
  const recommendedTeaching =
    personalizedTeachings.find(
      (teaching) => !completed.has(teaching.id)
    ) || personalizedTeachings[0];

  /*
   * OPEN TEACHING
   */
  const openTeaching = (teaching: CommunityTeaching) => {
    setSelectedTeaching(teaching);

    setReadProgress((current) => ({
      ...current,
      [teaching.id]: current[teaching.id] || 0,
    }));
  };

  /*
   * SAVE
   */
  const toggleSave = (teaching: CommunityTeaching) => {
    const next = new Set<string>(saved);

    if (next.has(teaching.id)) {
      next.delete(teaching.id);
    } else {
      next.add(teaching.id);
      onAwardXp?.(2, "Saved a community teaching");
    }

    setSaved(next);
    writeSet(storageKey(userId, "saved"), next);
  };

  /*
   * COMPLETE
   */
  const completeTeaching = (teaching: CommunityTeaching) => {
    if (completed.has(teaching.id)) return;

    const next = new Set<string>(completed);

    next.add(teaching.id);

    setCompleted(next);

    writeSet(storageKey(userId, "completed"), next);

    onAwardXp?.(
      teaching.xp,
      `Completed community teaching: ${teaching.title}`
    );
  };

  /*
   * REACTION
   */
  const reactToTeaching = (
    teaching: CommunityTeaching,
    reaction: string
  ) => {
    if (reactions[teaching.id]) return;

    const next = {
      ...reactions,
      [teaching.id]: reaction,
    };

    setReactions(next);

    localStorage.setItem(
      storageKey(userId, "reactions"),
      JSON.stringify(next)
    );
  };

  /*
   * LESSON READER
   */
  if (selectedTeaching) {
    const percent = readProgress[selectedTeaching.id] || 0;

    const isComplete = completed.has(selectedTeaching.id);

    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => setSelectedTeaching(null)}
          className="inline-flex items-center gap-2 font-black text-[12px] uppercase"
        >
          <ArrowLeft size={16} />
          Back to community
        </button>

        <article
          className={`${getAccentClass(
            selectedTeaching.accent
          )} border-[3px] border-black rounded-[24px] p-5 brutal-shadow`}
        >
          <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-widest">
            <span>
              {selectedTeaching.category} •{" "}
              {selectedTeaching.type}
            </span>

            <span>{selectedTeaching.readTime} min read</span>
          </div>

          <h1 className="text-[32px] sm:text-[42px] font-black leading-[0.9] tracking-tighter mt-4">
            {selectedTeaching.title}
          </h1>

          <p className="font-bold text-[14px] mt-3 max-w-[600px]">
            {selectedTeaching.intro}
          </p>

          <div className="mt-5">
            <div className="flex items-center justify-between text-[9px] font-black uppercase mb-1">
              <span>Lesson progress</span>
              <span>{percent}%</span>
            </div>

            <div className="h-3 bg-white/60 border-[2px] border-black rounded-full overflow-hidden">
              <div
                className="h-full bg-black transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </article>

        <div className="bg-white border-[3px] border-black rounded-[22px] p-5 brutal-shadow-sm space-y-6">
          <ReadingSection
            title="The problem"
            text={selectedTeaching.problem}
          />

          <ReadingSection
            title="Why it happens"
            text={selectedTeaching.why}
          />

          <ReadingSection
            title="What to do instead"
            text={selectedTeaching.doInstead}
          />

          <div className="grid sm:grid-cols-2 gap-3">
            <ExampleCard
              title="Bad"
              text={selectedTeaching.badExample}
              dark
            />

            <ExampleCard
              title="Better"
              text={selectedTeaching.betterExample}
            />
          </div>

          <ReadingSection
            title="The takeaway"
            text={selectedTeaching.takeaway}
            accent
          />

          <button
            type="button"
            onClick={() => {
              setReadProgress((current) => ({
                ...current,
                [selectedTeaching.id]: 100,
              }));

              completeTeaching(selectedTeaching);
            }}
            className={`w-full h-12 rounded-full border-[3px] border-black font-black uppercase flex items-center justify-center gap-2 ${
              isComplete
                ? "bg-[#BEF264]"
                : "bg-[#FFE066]"
            }`}
          >
            <Check size={18} />

            {isComplete
              ? "Lesson completed"
              : `Finish lesson • +${selectedTeaching.xp} XP`}
          </button>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => toggleSave(selectedTeaching)}
              className="h-10 border-[2px] border-black rounded-full font-black text-[10px] uppercase flex items-center justify-center gap-1 bg-[#FFFBEB]"
            >
              <Bookmark
                size={13}
                fill={
                  saved.has(selectedTeaching.id)
                    ? "currentColor"
                    : "none"
                }
              />

              {saved.has(selectedTeaching.id)
                ? "Saved"
                : "Save"}
            </button>

            <button
              type="button"
              onClick={() =>
                onOpenCoach?.(
                  `I just completed the lesson "${selectedTeaching.title}". Help me apply what I learned to my actual dating situation.`
                )
              }
              className="h-10 border-[2px] border-black rounded-full font-black text-[10px] uppercase flex items-center justify-center gap-1 bg-[#A78BFA]"
            >
              <MessageCircle size={13} />
              Ask Coach
            </button>

            <button
              type="button"
              onClick={() =>
                navigator.clipboard?.writeText(
                  selectedTeaching.title
                )
              }
              className="h-10 border-[2px] border-black rounded-full font-black text-[10px] uppercase flex items-center justify-center gap-1 bg-white"
            >
              <Share2 size={13} />
              Share
            </button>
          </div>
        </div>

        {selectedTeaching.lessonId && (
          <div className="bg-[#BEF264] border-[3px] border-black rounded-[20px] p-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest">
                Connected to Today
              </div>

              <p className="font-black text-[14px] mt-1">
                Don't just learn it. Practice it.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                onPracticeToday?.(
                  selectedTeaching.lessonId
                )
              }
              className="bg-white border-[2px] border-black rounded-full px-3 py-2 font-black text-[10px] uppercase shrink-0"
            >
              Practice
              <ArrowRight
                size={13}
                className="inline ml-1"
              />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase opacity-60">
            React
          </span>

          {["🔥", "💀", "💡", "❤️"].map(
            (reaction) => (
              <button
                key={reaction}
                type="button"
                disabled={Boolean(
                  reactions[selectedTeaching.id]
                )}
                onClick={() =>
                  reactToTeaching(
                    selectedTeaching,
                    reaction
                  )
                }
                className={`w-9 h-9 border-[2px] border-black rounded-full ${
                  reactions[selectedTeaching.id] ===
                  reaction
                    ? "bg-[#FFE066]"
                    : "bg-white"
                }`}
              >
                {reaction}
              </button>
            )
          )}
        </div>
      </div>
    );
  }

  /*
   * MAIN COMMUNITY
   */
  return (
    <div className="space-y-5">
      {/* HERO */}
      <section className="bg-[#FDA4AF] border-[3px] border-black rounded-[24px] p-5 brutal-shadow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-white border-[2px] border-black rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest">
              <Sparkles size={13} />
              Community
            </div>

            <h1 className="text-[34px] sm:text-[42px] font-black leading-[0.88] tracking-tighter mt-3">
              learn the game.
              <br />
              actually use it.
            </h1>

            <p className="text-[13px] font-bold opacity-75 mt-2 max-w-[500px]">
              Short lessons built around the problems
              you actually run into while dating.
            </p>
          </div>

          <div className="w-12 h-12 rounded-full bg-[#FFE066] border-[2.5px] border-black flex items-center justify-center shrink-0">
            <Flame size={21} />
          </div>
        </div>
      </section>

      {/* PROBLEM PICKER */}
      <section>
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest opacity-50">
              Start with a problem
            </div>

            <h2 className="text-[22px] font-black tracking-tight">
              What are you dealing with?
            </h2>
          </div>

          {selectedProblem && (
            <button
              type="button"
              onClick={() => setSelectedProblem(null)}
              className="text-[10px] font-black uppercase underline"
            >
              Clear
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PROBLEMS.map((problem) => {
            const active =
              selectedProblem === problem.id;

            return (
              <button
                key={problem.id}
                type="button"
                onClick={() =>
                  setSelectedProblem(problem.id)
                }
                className={`text-left border-[3px] border-black rounded-[18px] p-3 transition-transform ${
                  active
                    ? "translate-x-[2px] translate-y-[2px] shadow-none"
                    : "brutal-shadow-sm"
                }`}
                style={{
                  backgroundColor: active
                    ? "#111"
                    : problem.accent,
                  color: active ? "white" : "black",
                }}
              >
                <div className="font-black text-[14px] leading-tight">
                  {problem.label}
                </div>

                <div
                  className={`text-[10px] font-bold mt-1 ${
                    active ? "opacity-70" : "opacity-60"
                  }`}
                >
                  {problem.description}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* LEARNING PROGRESS */}
      <section className="bg-white border-[3px] border-black rounded-[20px] p-4 brutal-shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-60">
              <Trophy size={14} />
              Your learning
            </div>

            <div className="text-[25px] font-black tracking-tighter mt-1">
              {completedCount} / {totalLessons}
              <span className="text-[13px] opacity-50 ml-2">
                lessons completed
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[20px] font-black">
              {progressPercent}%
            </div>

            <div className="text-[9px] font-black uppercase opacity-50">
              complete
            </div>
          </div>
        </div>

        <div className="h-3 bg-[#FFFBEB] border-[2px] border-black rounded-full mt-3 overflow-hidden">
          <div
            className="h-full bg-[#BEF264] transition-all duration-500"
            style={{
              width: `${progressPercent}%`,
            }}
          />
        </div>

        <div className="flex items-center gap-2 mt-3 text-[10px] font-bold opacity-60">
          <Target size={13} />
          Keep finishing lessons to build your dating toolkit.
        </div>
      </section>

      {/* PERSONALIZED RECOMMENDATION */}
      {recommendedTeaching && (
        <section className="bg-black text-white border-[3px] border-black rounded-[22px] p-5 brutal-shadow">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[#FFE066] text-[10px] font-black uppercase tracking-widest">
                Made for you
              </div>

              <h2 className="text-[28px] sm:text-[32px] font-black leading-[0.92] tracking-tighter mt-2">
                {recommendedTeaching.title}
              </h2>

              <p className="text-[12px] font-bold opacity-70 mt-2 max-w-[520px]">
                {recommendedTeaching.subtitle}
              </p>

              <div className="flex items-center gap-2 mt-4">
                <span className="bg-white/10 border border-white/20 rounded-full px-2.5 py-1 text-[9px] font-black uppercase">
                  {recommendedTeaching.readTime} min
                </span>

                <span className="bg-[#FFE066] text-black rounded-full px-2.5 py-1 text-[9px] font-black uppercase">
                  +{recommendedTeaching.xp} XP
                </span>
              </div>
            </div>

            <div className="w-11 h-11 rounded-full bg-[#FFE066] text-black flex items-center justify-center shrink-0">
              <Sparkles size={20} />
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              openTeaching(recommendedTeaching)
            }
            className="mt-5 h-11 px-5 bg-[#FFE066] text-black border-[2px] border-white rounded-full font-black text-[11px] uppercase"
          >
            Continue learning
            <ArrowRight
              size={14}
              className="inline ml-1"
            />
          </button>
        </section>
      )}

      {/* FILTER + SEARCH */}
      <section className="bg-white border-[3px] border-black rounded-[20px] p-3 brutal-shadow-sm">
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-3">
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`shrink-0 px-3 py-1.5 rounded-full border-[2px] border-black text-[10px] font-black uppercase ${
                filter === item
                  ? "bg-[#FFE066]"
                  : "bg-[#FFFBEB]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 border-[2px] border-black rounded-full px-3 h-10 bg-[#FFFBEB]">
          <Search size={15} />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search lessons..."
            className="bg-transparent outline-none text-[12px] font-bold w-full"
          />
        </label>
      </section>

      {/* LESSON LIST */}
      {teachings.length === 0 ? (
        <section className="bg-white border-[3px] border-black rounded-[22px] p-6 brutal-shadow text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#FFE066] border-[2.5px] border-black flex items-center justify-center">
            <Search size={21} />
          </div>

          <h2 className="font-black text-[19px] mt-3">
            No lessons here yet
          </h2>

          <p className="text-[12px] font-bold opacity-60 mt-1">
            Try another problem or clear your filters.
          </p>

          <button
            type="button"
            onClick={() => {
              setSelectedProblem(null);
              setFilter("ALL");
              setSearch("");
            }}
            className="mt-4 bg-[#FFE066] border-[2px] border-black rounded-full px-4 py-2 font-black text-[10px] uppercase"
          >
            Show everything
          </button>
        </section>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <Megaphone size={17} />
              <h2 className="font-black text-[18px] tracking-tight">
                {selectedProblem
                  ? PROBLEMS.find(
                      (p) => p.id === selectedProblem
                    )?.label
                  : "All lessons"}
              </h2>
            </div>

            <span className="text-[9px] font-black uppercase opacity-50">
              {teachings.length} lessons
            </span>
          </div>

          {teachings.map((teaching) => (
            <TeachingCard
              key={teaching.id}
              teaching={teaching}
              saved={saved.has(teaching.id)}
              completed={completed.has(teaching.id)}
              onOpen={() => openTeaching(teaching)}
              onSave={() => toggleSave(teaching)}
            />
          ))}
        </section>
      )}

      {/* CHALLENGE */}
      <section className="bg-[#BEF264] border-[3px] border-black rounded-[20px] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
              <Zap size={14} />
              Community challenge
            </div>

            <h2 className="font-black text-[20px] leading-tight mt-1">
              Ask one better question today
            </h2>

            <p className="text-[12px] font-bold mt-1">
              Skip the interview question. Ask something
              that reveals personality, then share something
              about yourself.
            </p>
          </div>

          <span className="bg-black text-[#FFE066] px-2 py-1 rounded-full text-[10px] font-black shrink-0">
            +25 XP
          </span>
        </div>

        <button
          type="button"
          onClick={() =>
            onAwardXp?.(
              25,
              "Completed community challenge"
            )
          }
          className="mt-3 h-10 px-4 bg-white border-[2px] border-black rounded-full font-black text-[11px] uppercase"
        >
          I'm in
          <Check size={14} className="inline ml-1" />
        </button>
      </section>

      {/* ADMIN */}
      <section className="bg-[#111] text-white border-[3px] border-black rounded-[22px] p-5 brutal-shadow">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#FFE066] text-black border-[2px] border-white flex items-center justify-center shrink-0">
            {isAdmin ? (
              <ShieldCheck size={19} />
            ) : (
              <LockKeyhole size={18} />
            )}
          </div>

          <div>
            <h2 className="font-black text-[16px]">
              A one-way teaching channel
            </h2>

            <p className="text-[11px] font-bold opacity-70 mt-1">
              Only verified admins publish guidance.
              Everyone else gets useful lessons without
              the noise.
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={onOpenAdmin}
            className="w-full h-11 mt-4 bg-[#FDA4AF] text-black border-[3px] border-white rounded-full font-black text-[12px] uppercase flex items-center justify-center gap-2"
          >
            Open teaching controls
            <ArrowRight size={16} />
          </button>
        )}
      </section>
    </div>
  );
};

/* ---------------- LESSON CARD ---------------- */

function TeachingCard({
  teaching,
  saved,
  completed,
  onOpen,
  onSave,
}: {
  key?: string;
  teaching: CommunityTeaching;
  saved: boolean;
  completed: boolean;
  onOpen: () => void;
  onSave: () => void;
}) {
  return (
    <article
      className={`${getAccentClass(
        teaching.accent
      )} border-[3px] border-black rounded-[22px] p-4 brutal-shadow-sm`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[10px] font-black uppercase tracking-widest">
          {teaching.category} • {teaching.type}
        </span>

        <button
          type="button"
          onClick={onSave}
          aria-label={
            saved
              ? "Remove saved lesson"
              : "Save lesson"
          }
        >
          <Bookmark
            size={17}
            fill={
              saved ? "currentColor" : "none"
            }
          />
        </button>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="font-black text-[22px] tracking-tight leading-none">
            {teaching.title}
          </h3>

          <p className="mt-2 text-[13px] font-bold leading-relaxed max-w-[560px]">
            {teaching.subtitle}
          </p>
        </div>

        {completed && (
          <div className="w-8 h-8 bg-[#BEF264] border-[2px] border-black rounded-full flex items-center justify-center shrink-0">
            <Check size={16} />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase">
          {teaching.readTime} min • +{teaching.xp} XP
          {completed ? " • Done" : ""}
        </span>

        <button
          type="button"
          onClick={onOpen}
          className="bg-white/80 text-black border-[2px] border-black rounded-full px-3 py-1.5 text-[10px] font-black uppercase"
        >
          {completed ? "Review" : "Read lesson"}
          <ChevronRight
            size={13}
            className="inline ml-1"
          />
        </button>
      </div>
    </article>
  );
}

/* ---------------- READING ---------------- */

function ReadingSection({
  title,
  text,
  accent = false,
}: {
  title: string;
  text: string;
  accent?: boolean;
}) {
  return (
    <section
      className={
        accent
          ? "bg-[#FFE066] border-[2px] border-black rounded-[14px] p-3"
          : ""
      }
    >
      <h2 className="text-[11px] font-black uppercase tracking-widest mb-1">
        {title}
      </h2>

      <p className="text-[14px] font-bold leading-relaxed">
        {text}
      </p>
    </section>
  );
}

function ExampleCard({
  title,
  text,
  dark = false,
}: {
  title: string;
  text: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`${
        dark
          ? "bg-black text-white"
          : "bg-[#BEF264]"
      } border-[2px] border-black rounded-[14px] p-3`}
    >
      <div className="text-[10px] font-black uppercase tracking-widest mb-1">
        {title}
      </div>

      <p className="text-[13px] font-bold italic">
        "{text}"
      </p>
    </div>
  );
}