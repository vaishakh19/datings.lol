import React from "react";
import {
  AlertTriangle,
  Check,
  CloudOff,
  Flame,
  ListChecks,
  Loader2,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";

import { DailyTask } from "../lib/dailyTasks";
import { useDailyTasks } from "../hooks/useDailyTasks";

interface DailyTasksCardProps {
  userId?: string | null;
  onXpAwarded?: (amount: number, taskId: string, taskTitle: string) => void;
  onAllComplete?: () => void;
}

const DIFFICULTY_STYLE: Record<string, { label: string; bg: string }> = {
  BEGINNER: { label: "Easy", bg: "#BEF264" },
  INTERMEDIATE: { label: "Medium", bg: "#FFE066" },
  ADVANCED: { label: "Spicy", bg: "#FFB7C5" },
  BRUTAL: { label: "Brutal", bg: "#FF6B8A" },
};

const CATEGORY_LABEL: Record<string, string> = {
  confidence: "Confidence",
  conversation: "Conversation",
  texting: "Texting",
  social: "Social",
  dating: "Dating",
  mindset: "Mindset",
  general: "General",
};

function TaskRow({
  task,
  isPending,
  onComplete,
  onUndo,
}: {
  task: DailyTask;
  isPending: boolean;
  onComplete: () => void;
  onUndo: () => void;
}) {
  const done = task.status === "completed";
  const difficulty = DIFFICULTY_STYLE[task.difficulty] || DIFFICULTY_STYLE.BEGINNER;

  return (
    <li
      className={`border-[2px] border-black rounded-[16px] p-3 transition-colors ${
        done ? "bg-[#BEF264]" : "bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={done ? onUndo : onComplete}
          disabled={isPending}
          aria-label={done ? `Undo ${task.title}` : `Complete ${task.title}`}
          className={`w-[30px] h-[30px] shrink-0 border-[2px] border-black rounded-[9px] flex items-center justify-center mt-0.5 ${
            done ? "bg-black text-[#BEF264]" : "bg-[#FFFBEB]"
          } ${isPending ? "opacity-60" : ""}`}
        >
          {isPending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : done ? (
            <Check size={16} />
          ) : null}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={`font-black text-[13px] leading-tight tracking-tight ${
                done ? "line-through opacity-70" : ""
              }`}
            >
              {task.title}
            </h3>

            <span className="bg-black text-white border-[2px] border-black rounded-full px-2 py-0.5 text-[9px] font-black shrink-0">
              +{task.xpReward} XP
            </span>
          </div>

          <p className="text-[11.5px] font-bold leading-relaxed opacity-80 mt-1">
            {task.description}
          </p>

          <div className="flex items-center gap-1.5 mt-2">
            <span
              className="border-[2px] border-black rounded-full px-2 py-[1px] text-[8.5px] font-black uppercase tracking-widest"
              style={{ backgroundColor: difficulty.bg }}
            >
              {difficulty.label}
            </span>
            <span className="bg-[#FFFBEB] border-[2px] border-black rounded-full px-2 py-[1px] text-[8.5px] font-black uppercase tracking-widest">
              {CATEGORY_LABEL[task.category] || task.category}
            </span>
            {done && (
              <span className="text-[8.5px] font-black uppercase tracking-widest opacity-50 inline-flex items-center gap-1">
                <RotateCcw size={10} />
                Tap to undo
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function SkeletonRow() {
  return (
    <li className="border-[2px] border-black rounded-[16px] p-3 bg-white">
      <div className="flex items-start gap-3 animate-pulse">
        <div className="w-[30px] h-[30px] shrink-0 border-[2px] border-black rounded-[9px] bg-[#FFFBEB]" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-2/3 bg-black/15 rounded-full" />
          <div className="h-2.5 w-full bg-black/10 rounded-full" />
          <div className="h-2.5 w-4/5 bg-black/10 rounded-full" />
        </div>
      </div>
    </li>
  );
}

/**
 * The Daily Tasks block inside the Today tab. Generation, XP, and streaks all
 * happen in Postgres; this component only renders what the server returned and
 * keeps the brutalist design language of the surrounding page.
 */
export const DailyTasksCard: React.FC<DailyTasksCardProps> = ({
  userId,
  onXpAwarded,
  onAllComplete,
}) => {
  const {
    tasks,
    progress,
    status,
    error,
    errorKind,
    isStale,
    pendingTaskId,
    refresh,
    complete,
    undo,
  } = useDailyTasks({ userId, onXpAwarded });

  const completedCount = tasks.filter((task) => task.status === "completed").length;
  const total = tasks.length;
  const allDone = total > 0 && completedCount === total;
  const earnedToday = tasks
    .filter((task) => task.status === "completed")
    .reduce((sum, task) => sum + task.xpReward, 0);

  const firedRef = React.useRef(false);
  React.useEffect(() => {
    if (allDone && !firedRef.current) {
      firedRef.current = true;
      onAllComplete?.();
    }
    if (!allDone) firedRef.current = false;
  }, [allDone, onAllComplete]);

  /* ---------------- Signed out / guest ---------------- */
  if (!userId) {
    return (
      <section className="bg-[#C9B6FF] border-[3px] border-black rounded-[22px] p-5 brutal-shadow">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
          <ListChecks size={16} />
          Daily tasks
        </div>
        <p className="text-[13px] font-bold leading-relaxed mt-2">
          Create an account to get a fresh set of personalized tasks every day, with XP and
          streaks that follow you across devices.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-[#C9B6FF] border-[3px] border-black rounded-[22px] p-5 brutal-shadow">
      {/* ---------------- Header ---------------- */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
            <ListChecks size={16} />
            Daily tasks
          </div>
          <h2 className="text-[22px] sm:text-[25px] font-black tracking-tighter leading-[0.95] mt-1.5">
            {allDone ? "Today is cleared." : "Pick one. Start now."}
          </h2>
        </div>

        {total > 0 && (
          <div className="bg-black text-white border-[2px] border-black rounded-full px-3 py-1 text-[11px] font-black shrink-0">
            {completedCount}/{total}
          </div>
        )}
      </div>

      {/* ---------------- Progress strip ---------------- */}
      {total > 0 && (
        <div className="mt-3">
          <div className="h-[10px] bg-[#FFFBEB] border-[2px] border-black rounded-full overflow-hidden">
            <div
              className="h-full bg-black transition-all duration-500"
              style={{ width: `${Math.round((completedCount / total) * 100)}%` }}
            />
          </div>
          <div className="flex items-center gap-3 mt-2 text-[9px] font-black uppercase tracking-widest">
            <span className="inline-flex items-center gap-1">
              <Sparkles size={11} />+{earnedToday} XP today
            </span>
            {progress && (
              <>
                <span className="inline-flex items-center gap-1">
                  <Flame size={11} />
                  {progress.currentStreak} day streak
                </span>
                <span className="inline-flex items-center gap-1">
                  <Target size={11} />
                  Level {progress.level}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---------------- Degraded / error banners ---------------- */}
      {error && (
        <div
          className={`mt-3 border-[2px] border-black rounded-[14px] p-3 flex items-start gap-2 ${
            errorKind === "offline" ? "bg-[#FFE066]" : "bg-[#FFB7C5]"
          }`}
        >
          {errorKind === "offline" ? (
            <CloudOff size={15} className="shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-bold leading-snug">{error}</p>
            {errorKind !== "auth" && (
              <button
                type="button"
                onClick={refresh}
                className="mt-2 h-[30px] px-3 bg-black text-white border-[2px] border-black rounded-full text-[9.5px] font-black uppercase tracking-widest"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      )}

      {isStale && !error && (
        <p className="mt-2 text-[9px] font-black uppercase tracking-widest opacity-50">
          Syncing…
        </p>
      )}

      {/* ---------------- Body ---------------- */}
      <div className="mt-4">
        {status === "loading" && (
          <ul className="space-y-2.5">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </ul>
        )}

        {status === "error" && (
          <div className="bg-white border-[2px] border-black rounded-[16px] p-4 text-center">
            <p className="text-[12px] font-bold leading-relaxed">
              We couldn&apos;t build today&apos;s task set. Your progress is safe.
            </p>
            <button
              type="button"
              onClick={refresh}
              className="w-full h-[42px] mt-3 bg-black text-white border-[2px] border-black rounded-full text-[10px] font-black uppercase tracking-widest"
            >
              Retry generation
            </button>
          </div>
        )}

        {status === "ready" && total === 0 && (
          <div className="bg-white border-[2px] border-black rounded-[16px] p-4 text-center">
            <p className="text-[12px] font-bold leading-relaxed">
              No tasks for today yet. Tap below and we&apos;ll build your set.
            </p>
            <button
              type="button"
              onClick={refresh}
              className="w-full h-[42px] mt-3 bg-black text-white border-[2px] border-black rounded-full text-[10px] font-black uppercase tracking-widest"
            >
              Generate today&apos;s tasks
            </button>
          </div>
        )}

        {total > 0 && (
          <ul className="space-y-2.5">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                isPending={pendingTaskId === task.id}
                onComplete={() => complete(task.id)}
                onUndo={() => undo(task.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {allDone && (
        <div className="bg-black text-white border-[2px] border-black rounded-[14px] p-3 mt-3 flex items-center gap-2">
          <Check size={16} className="text-[#BEF264]" />
          <p className="text-[11px] font-black uppercase tracking-widest">
            All done. New set unlocks tomorrow.
          </p>
        </div>
      )}
    </section>
  );
};
