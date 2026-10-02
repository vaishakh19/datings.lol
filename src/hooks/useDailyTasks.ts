import { useCallback, useEffect, useRef, useState } from "react";

import {
  completeDailyTask,
  currentTaskDate,
  DailyTask,
  DailyTaskProgress,
  DailyTasksError,
  fetchDailyTasks,
  fetchTaskProgress,
  markTaskStarted,
  readCachedTasks,
  uncompleteDailyTask,
  writeCachedTasks,
} from "../lib/dailyTasks";

interface UseDailyTasksOptions {
  userId?: string | null;
  /** Called once per task with the XP the server actually awarded. */
  onXpAwarded?: (amount: number, taskId: string, taskTitle: string) => void;
}

interface UseDailyTasksResult {
  tasks: DailyTask[];
  progress: DailyTaskProgress | null;
  taskDate: string;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  errorKind: DailyTasksError["kind"] | null;
  isStale: boolean;
  pendingTaskId: string | null;
  refresh: () => void;
  complete: (taskId: string) => Promise<void>;
  undo: (taskId: string) => Promise<void>;
  start: (taskId: string) => Promise<void>;
}

/**
 * Owns the lifecycle of the current day's tasks: first load, offline fallback,
 * retries, optimistic completion, and the midnight rollover.
 */
export function useDailyTasks({ userId, onXpAwarded }: UseDailyTasksOptions): UseDailyTasksResult {
  const [taskDate, setTaskDate] = useState<string>(() => currentTaskDate());
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [progress, setProgress] = useState<DailyTaskProgress | null>(null);
  const [status, setStatus] = useState<UseDailyTasksResult["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<DailyTasksError["kind"] | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Guards against a stale in-flight request overwriting newer state after a
  // sign-out, a day rollover, or a fast retry.
  const requestRef = useRef(0);

  const refresh = useCallback(() => setReloadToken((value) => value + 1), []);

  /* ----------------------------------------------------------------
     Day rollover: re-check the local date on an interval and whenever
     the tab regains focus, so a session left open overnight picks up
     tomorrow's tasks without a manual reload.
  ---------------------------------------------------------------- */
  useEffect(() => {
    const check = () => {
      const next = currentTaskDate();
      setTaskDate((previous) => (previous === next ? previous : next));
    };
    const interval = window.setInterval(check, 60_000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  /* ----------------------------------------------------------------
     Load (and generate, server-side) the set for the current day.
  ---------------------------------------------------------------- */
  useEffect(() => {
    if (!userId) {
      setTasks([]);
      setProgress(null);
      setStatus("idle");
      setError(null);
      setErrorKind(null);
      return;
    }

    const requestId = ++requestRef.current;
    let cancelled = false;

    // Paint the cached set immediately so a slow network never shows an empty
    // Daily Tasks card to a returning user.
    const cached = readCachedTasks(userId, taskDate);
    if (cached?.length) {
      setTasks(cached);
      setStatus("ready");
      setIsStale(true);
    } else {
      setStatus("loading");
    }
    setError(null);
    setErrorKind(null);

    (async () => {
      try {
        const [nextTasks, nextProgress] = await Promise.all([
          fetchDailyTasks(userId, taskDate),
          fetchTaskProgress(userId),
        ]);
        if (cancelled || requestRef.current !== requestId) return;

        setTasks(nextTasks);
        setProgress(nextProgress);
        setIsStale(false);
        setStatus("ready");
        writeCachedTasks(userId, taskDate, nextTasks);
      } catch (caught) {
        if (cancelled || requestRef.current !== requestId) return;
        const failure =
          caught instanceof DailyTasksError
            ? caught
            : new DailyTasksError("Couldn't load today's tasks.", "unknown");
        setError(failure.message);
        setErrorKind(failure.kind);
        // Offline with a cache is a degraded success, not a failure screen.
        setStatus(cached?.length ? "ready" : "error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, taskDate, reloadToken]);

  /* ----------------------------------------------------------------
     Retry automatically when the browser comes back online.
  ---------------------------------------------------------------- */
  useEffect(() => {
    if (!userId) return;
    const onOnline = () => {
      if (errorKind === "offline" || isStale) refresh();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [userId, errorKind, isStale, refresh]);

  const start = useCallback(
    async (taskId: string) => {
      setTasks((previous) =>
        previous.map((task) =>
          task.id === taskId && !task.startedAt
            ? { ...task, startedAt: new Date().toISOString() }
            : task,
        ),
      );
      try {
        await markTaskStarted(taskId);
      } catch {
        /* Cosmetic only — never block the user on this. */
      }
    },
    [],
  );

  const complete = useCallback(
    async (taskId: string) => {
      if (!userId || pendingTaskId) return;
      const target = tasks.find((task) => task.id === taskId);
      if (!target || target.status === "completed") return;

      setPendingTaskId(taskId);
      setError(null);
      setErrorKind(null);

      // Optimistic flip; rolled back if the server disagrees.
      setTasks((previous) =>
        previous.map((task) =>
          task.id === taskId
            ? { ...task, status: "completed", completedAt: new Date().toISOString() }
            : task,
        ),
      );

      try {
        const outcome = await completeDailyTask(taskId);

        // Either the row vanished or it is not in `pending` (e.g. skipped).
        // Both mean our local copy is wrong, so roll back and resync.
        if (outcome.status === "not_found" || outcome.status === "not_available") {
          setTasks((previous) =>
            previous.map((task) =>
              task.id === taskId ? { ...task, status: "pending", completedAt: null } : task,
            ),
          );
          setError("That task is no longer available. Refreshing.");
          setErrorKind("unknown");
          refresh();
          return;
        }

        if (outcome.task) {
          setTasks((previous) => {
            const next = previous.map((task) =>
              task.id === taskId ? { ...task, ...outcome.task! } : task,
            );
            writeCachedTasks(userId, taskDate, next);
            return next;
          });
        }
        if (outcome.progress) setProgress(outcome.progress);

        // `already_completed` returns 0 XP, which is exactly the guarantee
        // that a double tap can never be paid twice.
        if (outcome.status === "completed" && outcome.xpAwarded > 0) {
          onXpAwarded?.(outcome.xpAwarded, taskId, target.title);
        }
      } catch (caught) {
        setTasks((previous) =>
          previous.map((task) =>
            task.id === taskId ? { ...task, status: "pending", completedAt: null } : task,
          ),
        );
        const failure =
          caught instanceof DailyTasksError
            ? caught
            : new DailyTasksError("Couldn't save that. Try again.", "unknown");
        setError(failure.message);
        setErrorKind(failure.kind);
      } finally {
        setPendingTaskId(null);
      }
    },
    [userId, tasks, pendingTaskId, taskDate, onXpAwarded, refresh],
  );

  const undo = useCallback(
    async (taskId: string) => {
      if (!userId || pendingTaskId) return;
      setPendingTaskId(taskId);
      try {
        const outcome = await uncompleteDailyTask(taskId);
        if (outcome.task) {
          setTasks((previous) => {
            const next = previous.map((task) =>
              task.id === taskId ? { ...task, ...outcome.task! } : task,
            );
            writeCachedTasks(userId, taskDate, next);
            return next;
          });
        }
        if (outcome.progress) setProgress(outcome.progress);
      } catch (caught) {
        const failure =
          caught instanceof DailyTasksError
            ? caught
            : new DailyTasksError("Couldn't undo that. Try again.", "unknown");
        setError(failure.message);
        setErrorKind(failure.kind);
      } finally {
        setPendingTaskId(null);
      }
    },
    [userId, pendingTaskId, taskDate],
  );

  return {
    tasks,
    progress,
    taskDate,
    status,
    error,
    errorKind,
    isStale,
    pendingTaskId,
    refresh,
    complete,
    undo,
    start,
  };
}
