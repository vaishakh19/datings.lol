import { supabase } from "./supabase";

/**
 * Client for the database-backed Daily Tasks system.
 *
 * The browser never decides *which* tasks a user gets. It only tells Postgres
 * which calendar day it is locally and asks for that day's set; the
 * `generate_daily_tasks` function owns selection and is idempotent, so a
 * refresh, a second tab, or a second device all return the identical rows.
 */

export type TaskDifficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "BRUTAL";
export type TaskStatus = "pending" | "completed" | "skipped";

export interface DailyTask {
  id: string;
  userId: string;
  templateId: string | null;
  taskDate: string;
  title: string;
  description: string;
  difficulty: TaskDifficulty;
  category: string;
  xpReward: number;
  status: TaskStatus;
  startedAt: string | null;
  completedAt: string | null;
  sortOrder: number;
}

export interface DailyTaskProgress {
  xp: number;
  level: number;
  tasksCompleted: number;
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string | null;
  categoryCounts: Record<string, number>;
}

export interface CompleteTaskOutcome {
  /**
   * `not_available` means the row exists but is not in `pending` (e.g. it was
   * skipped). The server refuses to pay XP for it; the client resyncs.
   */
  status:
    | "completed"
    | "already_completed"
    | "not_available"
    | "not_found"
    | "noop"
    | "reverted";
  xpAwarded: number;
  task: DailyTask | null;
  progress: DailyTaskProgress | null;
}

const CACHE_PREFIX = "datings_daily_tasks_";

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

/**
 * The user's *local* calendar day as YYYY-MM-DD. `en-CA` formats as ISO, and
 * going through the locale (rather than `toISOString`) means someone in UTC+13
 * rolls over to new tasks at their own midnight, not London's.
 *
 * Matches `getTodayStr()` in App.tsx so both systems agree on "today".
 */
export function localDateKey(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA");
}

/**
 * Local development escape hatch for testing Day 1 -> Day 2 without waiting.
 * Set `localStorage.datings_date_override = "2026-10-03"` in the console.
 * Ignored unless the app is running on localhost.
 */
function readDateOverride(): string | null {
  try {
    const host = window.location.hostname;
    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".local") ||
      host.endsWith(".e2b.app");
    if (!isLocal) return null;
    const value = localStorage.getItem("datings_date_override");
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function currentTaskDate(): string {
  return readDateOverride() || localDateKey();
}

/* ------------------------------------------------------------------ */
/* Row mapping                                                         */
/* ------------------------------------------------------------------ */

function mapTask(row: any): DailyTask {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    templateId: row.template_id ? String(row.template_id) : null,
    taskDate: String(row.task_date),
    title: row.title || "Daily task",
    description: row.description || "",
    difficulty: (row.difficulty || "BEGINNER") as TaskDifficulty,
    category: row.category || "general",
    xpReward: Number(row.xp_reward) || 0,
    status: (row.status || "pending") as TaskStatus,
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    sortOrder: Number(row.sort_order) || 0,
  };
}

function mapProgress(row: any): DailyTaskProgress {
  return {
    xp: Number(row?.xp) || 0,
    level: Number(row?.level) || 1,
    tasksCompleted: Number(row?.tasks_completed) || 0,
    currentStreak: Number(row?.current_streak) || 0,
    longestStreak: Number(row?.longest_streak) || 0,
    lastCompletedDate: row?.last_completed_date ?? null,
    categoryCounts:
      row?.category_counts && typeof row.category_counts === "object"
        ? (row.category_counts as Record<string, number>)
        : {},
  };
}

/** Defensive de-duplication so a bad cache or a race can never render twice. */
function dedupe(tasks: DailyTask[]): DailyTask[] {
  const byId = new Map<string, DailyTask>();
  const seenTemplates = new Set<string>();
  for (const task of tasks) {
    if (byId.has(task.id)) continue;
    if (task.templateId) {
      if (seenTemplates.has(task.templateId)) continue;
      seenTemplates.add(task.templateId);
    }
    byId.set(task.id, task);
  }
  return [...byId.values()].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  );
}

/* ------------------------------------------------------------------ */
/* Offline cache                                                       */
/* ------------------------------------------------------------------ */

export function readCachedTasks(userId: string, date: string): DailyTask[] | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${userId}_${date}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? dedupe(parsed as DailyTask[]) : null;
  } catch {
    return null;
  }
}

export function writeCachedTasks(userId: string, date: string, tasks: DailyTask[]): void {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${userId}_${date}`, JSON.stringify(tasks));
    // Keep only the current day's cache per user; yesterday is dead weight.
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(`${CACHE_PREFIX}${userId}_`) && !key.endsWith(`_${date}`)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* Quota errors must never break the feature. */
  }
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

export class DailyTasksError extends Error {
  constructor(message: string, public kind: "offline" | "auth" | "schema" | "unknown") {
    super(message);
    this.name = "DailyTasksError";
  }
}

function classify(error: any): DailyTasksError {
  const message = String(error?.message || error || "");
  const lower = message.toLowerCase();
  if (!navigator.onLine || lower.includes("failed to fetch") || lower.includes("networkerror")) {
    return new DailyTasksError("You're offline. Showing your last saved tasks.", "offline");
  }
  if (lower.includes("authentication required") || error?.code === "PGRST301") {
    return new DailyTasksError("Your session expired. Sign in again to load today's tasks.", "auth");
  }
  // 404 from PostgREST = the function/table isn't deployed yet.
  if (error?.code === "PGRST202" || error?.code === "42P01" || lower.includes("does not exist")) {
    return new DailyTasksError(
      "Daily tasks aren't set up on this database yet. Apply the latest Supabase migration.",
      "schema",
    );
  }
  return new DailyTasksError("Couldn't load today's tasks. Try again in a moment.", "unknown");
}

/**
 * Returns today's task set, creating it on the server the first time the user
 * opens the app on a new day. Safe to call on every mount.
 */
export async function fetchDailyTasks(
  userId: string,
  date: string = currentTaskDate(),
): Promise<DailyTask[]> {
  const { data, error } = await supabase.rpc("generate_daily_tasks", {
    p_user_id: userId,
    p_date: date,
  });

  if (error) {
    // Generation failed, but a set may already exist from an earlier visit.
    const fallback = await supabase
      .from("daily_tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("task_date", date)
      .order("sort_order", { ascending: true });

    if (!fallback.error && fallback.data?.length) {
      return dedupe(fallback.data.map(mapTask));
    }
    throw classify(error);
  }

  return dedupe((data ?? []).map(mapTask));
}

export async function fetchTaskProgress(userId: string): Promise<DailyTaskProgress | null> {
  const { data, error } = await supabase
    .from("user_progress")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return data ? mapProgress(data) : null;
}

export async function markTaskStarted(taskId: string): Promise<void> {
  await supabase
    .from("daily_tasks")
    .update({ started_at: new Date().toISOString() })
    .eq("id", taskId)
    .is("started_at", null);
}

/**
 * Completion is a single RPC: it flips the status, awards XP exactly once,
 * and updates level/streak/category counters in the same transaction.
 */
export async function completeDailyTask(taskId: string): Promise<CompleteTaskOutcome> {
  const { data, error } = await supabase.rpc("complete_daily_task", {
    p_daily_task_id: taskId,
  });
  if (error) throw classify(error);

  const payload = (data ?? {}) as any;
  return {
    status: payload.status ?? "not_found",
    xpAwarded: Number(payload.xpAwarded) || 0,
    task: payload.task ? mapTask(payload.task) : null,
    progress: payload.progress ? mapProgress(payload.progress) : null,
  };
}

export async function uncompleteDailyTask(taskId: string): Promise<CompleteTaskOutcome> {
  const { data, error } = await supabase.rpc("uncomplete_daily_task", {
    p_daily_task_id: taskId,
  });
  if (error) throw classify(error);

  const payload = (data ?? {}) as any;
  return {
    status: payload.status ?? "noop",
    xpAwarded: Number(payload.xpAwarded) || 0,
    task: payload.task ? mapTask(payload.task) : null,
    progress: payload.progress ? mapProgress(payload.progress) : null,
  };
}
