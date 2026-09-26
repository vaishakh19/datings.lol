import React, { useState, useEffect, useRef } from "react";
import {
  UserProfile,
  UserProgress,
  ChatMessage,
  AuthUser,
  AuthView,
  AdminSettings,
  AppTab,
  CoachFeedback,
  CommunityUserState,
  PrivateJournalEntry,
  ProfileAuditReport,
  UserAppState,
} from "./types";
import { LESSONS } from "./data/lessons";
import { Onboarding } from "./components/Onboarding";
import { Header } from "./components/Header";
import { Navigation } from "./components/Navigation";
import { TodayTab } from "./components/TodayTab";
import { CoachTab } from "./components/CoachTab";
import { ProfileTab } from "./components/ProfileTab";
import { SupportTab } from "./components/SupportTab";
import { CommunityTab } from "./components/CommunityTab";
import { ProModal } from "./components/ProModal";
import { HotTakeModal } from "./components/HotTakeModal";
import { AuthContainer } from "./components/auth/AuthContainer";
import { AuthCallbackPage, ForgotPasswordPage, ResetPasswordPage } from "./components/auth/AuthRoutes";
import { MarketingSite, isMarketingPath } from "./components/marketing/MarketingSite";

/** Paths that render the auth UI for signed-out visitors. */
const PUBLIC_AUTH_PATHS = new Set(["/", "/login", "/signup", "/forgot-password"]);
/** Supabase redirect targets that must never be rewritten to /login. */
const AUTH_CALLBACK_PATHS = new Set(["/auth/callback", "/auth/reset-password"]);
import { useAuth } from "./context/AuthContext";
import { getTodayHotTake } from "./data/hotTakes";
import {
  cacheUserAppState,
  createDefaultCommunityState,
  createDefaultUserAppState,
  createEmptyProgress,
  loadUserAppState,
  readCachedUserAppState,
  readLegacyUserAppState,
  saveUserAppState,
} from "./lib/userState";
import {
  getActiveAdminNotification,
  getAdminSettings,
  saveAdminSettings,
} from "./utils/adminStorage";
import { loadPublicAdminSettings, verifyAdminSession } from "./lib/adminApi";
import { loadAccountEntitlements } from "./lib/api";

const MAX_FREE_CHATS = 3;

// The operations workspace is intentionally split from the member app; its
// dense tables and controls should not increase the initial customer bundle.
const AdminTab = React.lazy(() =>
  import("./components/AdminTab").then((module) => ({ default: module.AdminTab })),
);

function getTodayStr(): string {
  return new Date().toLocaleDateString("en-CA");
}

export default function App() {
  const {
    user: supabaseUser,
    session,
    loading: authLoading,
    signOut: supabaseSignOut,
    updatePassword,
  } = useAuth();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [showAuthView, setShowAuthView] = useState<AuthView | null>(null);

  // Current URL path as React state so SPA navigation (marketing site <-> auth
  // <-> app) re-renders without a full page reload.
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const navigate = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
    setPathname(path);
  };
  useEffect(() => {
    const syncPath = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [progress, setProgress] = useState<UserProgress>(() => createEmptyProgress());

  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    const path = window.location.pathname;
    if (path === "/coach") return "coach";
    if (path === "/community") return "community";
    if (path === "/profile") return "profile";
    if (path === "/admin") return "admin";
    return "today";
  });
  const [adminSettings, setAdminSettings] = useState<AdminSettings>(() => getAdminSettings());
  const [adminAccess, setAdminAccess] = useState<"checking" | "allowed" | "denied">("checking");
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>(
    () => createDefaultUserAppState().messages,
  );

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [chatsUsedToday, setChatsUsedToday] = useState(0);
  const [lastChatDate, setLastChatDate] = useState<string>("");
  const [lastHotTakeDate, setLastHotTakeDate] = useState("");
  const [awardedXpKeys, setAwardedXpKeys] = useState<string[]>([]);
  const [coachFeedback, setCoachFeedback] = useState<CoachFeedback[]>([]);
  const [coachMode, setCoachMode] = useState<"gentle" | "direct" | "brutal">("direct");
  const [communityState, setCommunityState] = useState<CommunityUserState>(
    () => createDefaultCommunityState(),
  );
  const [privateJournal, setPrivateJournal] = useState<PrivateJournalEntry[]>([]);
  const [profileAudit, setProfileAudit] = useState<ProfileAuditReport | null>(null);
  const [syncStatus, setSyncStatus] = useState<"loading" | "synced" | "saving" | "offline">(
    "loading",
  );
  const [syncError, setSyncError] = useState("");
  const hydratedUserIdRef = useRef<string | null>(null);
  const entitlementsLoadedForRef = useRef<string | null>(null);
  const latestStateRef = useRef<UserAppState>(createDefaultUserAppState());
  const saveTimerRef = useRef<number | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [showProModal, setShowProModal] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isDayCompleted, setIsDayCompleted] = useState(false);
  const [isBouncingStreak, setIsBouncingStreak] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Daily Hot Take state
  const [showHotTakeModal, setShowHotTakeModal] = useState(false);

  useEffect(() => {
    if (!supabaseUser) {
      setCurrentUser(null);
      return;
    }
    const email = supabaseUser.email || "";
    setCurrentUser({
      id: supabaseUser.id,
      username: supabaseUser.user_metadata?.username || email.split("@")[0] || "member",
      email,
      name: supabaseUser.user_metadata?.display_name || email.split("@")[0] || "Member",
      passwordHash: "",
      createdAt: supabaseUser.created_at,
      lastLoginAt: new Date().toISOString(),
      profile: profile || undefined,
      progress,
      messages,
    });
  }, [messages, profile, progress, supabaseUser]);

  // Remove the retired dark-mode preference from existing sessions.
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.removeItem("datings_theme");
  }, []);

  useEffect(() => {
    const refreshAdminSettings = () => setAdminSettings(getAdminSettings());
    window.addEventListener("storage", refreshAdminSettings);
    window.addEventListener("datings_admin_settings_updated", refreshAdminSettings);
    return () => {
      window.removeEventListener("storage", refreshAdminSettings);
      window.removeEventListener("datings_admin_settings_updated", refreshAdminSettings);
    };
  }, []);

  // Published operations settings come from the server so broadcasts and daily
  // programming are consistent across devices. localStorage remains only a
  // fast fallback for a temporarily offline session.
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    void loadPublicAdminSettings()
      .then((settings) => {
        if (!settings || cancelled) return;
        saveAdminSettings(settings);
        setAdminSettings(settings);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [authLoading, supabaseUser?.id]);

  // Admin visibility is derived from the same server-side authorization used
  // by every admin API route; user-editable profile metadata is never trusted.
  useEffect(() => {
    if (authLoading) return;
    if (!supabaseUser) {
      setAdminAccess("denied");
      return;
    }
    let cancelled = false;
    setAdminAccess("checking");
    void verifyAdminSession()
      .then(() => {
        if (!cancelled) setAdminAccess("allowed");
      })
      .catch(() => {
        if (!cancelled) setAdminAccess("denied");
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, supabaseUser?.id]);

  const applyUserState = (state: UserAppState) => {
    const today = getTodayStr();
    const nextState = {
      ...state,
      chatsUsedToday: state.lastChatDate === today ? state.chatsUsedToday : 0,
      lastChatDate: today,
    };

    setProfile(nextState.profile);
    setProgress(nextState.progress);
    setMessages(nextState.messages);
    setAvatarUrl(nextState.avatarUrl);
    setScreenshots(nextState.screenshots);
    setIsPro(nextState.isPro);
    setChatsUsedToday(nextState.chatsUsedToday);
    setLastChatDate(nextState.lastChatDate);
    setLastHotTakeDate(nextState.lastHotTakeDate);
    setDismissedNotificationIds(nextState.dismissedNotificationIds);
    setAwardedXpKeys(nextState.awardedXpKeys);
    setCoachFeedback(nextState.coachFeedback);
    setCoachMode(nextState.coachMode);
    setCommunityState(nextState.community);
    setPrivateJournal(nextState.privateJournal);
    setProfileAudit(nextState.profileAudit);
    setIsDayCompleted(
      nextState.progress.lastCompletedDate === new Date().toDateString(),
    );
    latestStateRef.current = nextState;
  };

  const persistUserState = (userId: string, state: UserAppState): Promise<void> => {
    const task = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveUserAppState(userId, state));
    saveQueueRef.current = task;
    return task;
  };

  // Supabase is the source of truth. A per-user browser cache is only used if
  // the device is offline, and pre-cloud local data is imported once.
  useEffect(() => {
    const userId = supabaseUser?.id;
    if (!userId) {
      hydratedUserIdRef.current = null;
      entitlementsLoadedForRef.current = null;
      setSyncStatus("loading");
      return;
    }

    let cancelled = false;
    hydratedUserIdRef.current = null;
    setSyncStatus("loading");
    setSyncError("");

    const hydrate = async () => {
      try {
        const remoteState = await loadUserAppState(userId);
        if (cancelled) return;

        const state =
          remoteState ||
          readCachedUserAppState(userId) ||
          readLegacyUserAppState(userId) ||
          createDefaultUserAppState();

        applyUserState(state);
        cacheUserAppState(userId, state);
        hydratedUserIdRef.current = userId;
        setSyncStatus(remoteState ? "synced" : "saving");

        if (!remoteState) {
          await persistUserState(userId, state);
          if (!cancelled) setSyncStatus("synced");
        }
      } catch (error) {
        if (cancelled) return;
        const fallback =
          readCachedUserAppState(userId) ||
          readLegacyUserAppState(userId) ||
          createDefaultUserAppState();
        applyUserState(fallback);
        hydratedUserIdRef.current = userId;
        setSyncStatus("offline");
        setSyncError(
          error instanceof Error ? error.message : "Cloud sync is temporarily unavailable.",
        );
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [supabaseUser?.id]);

  // Paid access is an account entitlement, not a client preference. Reconcile
  // the synchronized UI payload with the authoritative subscriptions table
  // after hydration so admin plan changes take effect on every device.
  useEffect(() => {
    const userId = supabaseUser?.id;
    if (
      !userId ||
      syncStatus === "loading" ||
      hydratedUserIdRef.current !== userId ||
      entitlementsLoadedForRef.current === userId
    ) {
      return;
    }
    entitlementsLoadedForRef.current = userId;
    void loadAccountEntitlements()
      .then((entitlements) => {
        if (entitlements && hydratedUserIdRef.current === userId) {
          setIsPro(entitlements.isPro);
        }
      })
      .catch(() => {
        entitlementsLoadedForRef.current = null;
      });
  }, [supabaseUser?.id, syncStatus]);

  // Keep a fast per-user cache and debounce writes into one ordered Supabase
  // upsert. Ordering prevents an older request from overwriting a newer state.
  useEffect(() => {
    const userId = supabaseUser?.id;
    const state: UserAppState = {
      version: 1,
      profile,
      progress,
      messages,
      avatarUrl,
      screenshots,
      isPro,
      chatsUsedToday,
      lastChatDate,
      lastHotTakeDate,
      dismissedNotificationIds,
      awardedXpKeys,
      coachFeedback,
      coachMode,
      community: communityState,
      privateJournal,
      profileAudit,
    };
    latestStateRef.current = state;

    if (!userId || hydratedUserIdRef.current !== userId) return;
    cacheUserAppState(userId, state);
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    setSyncStatus((status) => (status === "loading" ? status : "saving"));

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void persistUserState(userId, latestStateRef.current)
        .then(() => {
          if (hydratedUserIdRef.current === userId) {
            setSyncStatus("synced");
            setSyncError("");
          }
        })
        .catch((error) => {
          if (hydratedUserIdRef.current === userId) {
            setSyncStatus("offline");
            setSyncError(
              error instanceof Error ? error.message : "Cloud sync is temporarily unavailable.",
            );
          }
        });
    }, 500);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [
    supabaseUser?.id,
    profile,
    progress,
    messages,
    avatarUrl,
    screenshots,
    isPro,
    chatsUsedToday,
    lastChatDate,
    lastHotTakeDate,
    dismissedNotificationIds,
    awardedXpKeys,
    coachFeedback,
    coachMode,
    communityState,
    privateJournal,
    profileAudit,
  ]);

  // Flush the newest state when the page is backgrounded so mobile tab
  // suspension does not lose the last action.
  useEffect(() => {
    const flush = () => {
      const userId = supabaseUser?.id;
      if (
        document.visibilityState !== "hidden" ||
        !userId ||
        hydratedUserIdRef.current !== userId
      ) {
        return;
      }
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      void persistUserState(userId, latestStateRef.current).catch(() => undefined);
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [supabaseUser?.id]);

  useEffect(() => {
    if (syncStatus !== "offline" || !supabaseUser?.id) return;
    const userId = supabaseUser.id;
    let retrying = false;
    const retry = async () => {
      if (retrying || hydratedUserIdRef.current !== userId) return;
      retrying = true;
      try {
        await persistUserState(userId, latestStateRef.current);
        setSyncStatus("synced");
        setSyncError("");
      } catch {
        // Keep the local cache and try again while this session remains open.
      } finally {
        retrying = false;
      }
    };
    const timer = window.setInterval(() => void retry(), 15_000);
    return () => window.clearInterval(timer);
  }, [supabaseUser?.id, syncStatus]);

  useEffect(() => {
    if (syncStatus === "loading" || !profile || lastHotTakeDate === getTodayStr()) return;
    const timer = window.setTimeout(() => setShowHotTakeModal(true), 750);
    return () => window.clearTimeout(timer);
  }, [lastHotTakeDate, profile, syncStatus]);

  const adminAllowed = adminAccess === "allowed";

  useEffect(() => {
    const handleRouteChange = () => {
      const path = window.location.pathname;
      if (path === "/coach") setActiveTab("coach");
      else if (path === "/community") setActiveTab("community");
      else if (path === "/profile") setActiveTab("profile");
      else if (path === "/admin") setActiveTab("admin");
      else setActiveTab("today");
    };

    window.addEventListener("popstate", handleRouteChange);
    return () => window.removeEventListener("popstate", handleRouteChange);
  }, []);

  // Keep the URL aligned with auth state. This has to live in an effect:
  // calling history.replaceState / setActiveTab straight from the render body
  // triggers React's "Cannot update a component while rendering" warning and
  // makes the redirect depend on render timing.
  useEffect(() => {
    if (authLoading) return;
    const path = pathname;
    if (AUTH_CALLBACK_PATHS.has(path)) return;

    if (!supabaseUser && !isGuest) {
      // Marketing pages (landing, blog, pricing, about) are public.
      if (!PUBLIC_AUTH_PATHS.has(path) && !isMarketingPath(path)) {
        window.history.replaceState({}, "", "/login");
        setPathname("/login");
      }
      return;
    }

    if (supabaseUser && PUBLIC_AUTH_PATHS.has(path)) {
      window.history.replaceState({}, "", "/dashboard");
      setPathname("/dashboard");
      setActiveTab("today");
    }
  }, [authLoading, supabaseUser, isGuest, pathname]);

  useEffect(() => {
    if (activeTab === "admin" && adminAccess === "denied") {
      if (window.location.pathname === "/admin") {
        window.history.replaceState({}, "", "/dashboard");
        setPathname("/dashboard");
      }
      setActiveTab("today");
    }
  }, [activeTab, adminAccess]);

  const handleSelectTab = (tab: AppTab) => {
    setActiveTab(tab);
    const nextPath = tab === "admin" ? "/admin" : tab === "today" ? "/dashboard" : `/${tab}`;
    navigate(nextPath);
  };

  const handleAuthSuccess = (user: AuthUser) => {
    // Supabase's auth event performs the real hydration. This callback remains
    // for the modal contract and never treats browser storage as account data.
    setCurrentUser(user);
    setIsGuest(false);
    setShowAuthView(null);
  };

  const handleSignOut = async () => {
    const userId = supabaseUser?.id;
    if (userId && hydratedUserIdRef.current === userId) {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      try {
        await persistUserState(userId, latestStateRef.current);
      } catch {
        // The per-user cache will be retried the next time this account signs in.
      }
    }
    await supabaseSignOut();
    setIsGuest(false);
    setShowAuthView(null);
  };

  const handleOpenAuth = (view: AuthView = "signin") => {
    setShowAuthView(view);
  };

  // Compute calculated values
  const currentDay = profile
    ? Math.max(1, Math.floor((Date.now() - new Date(profile.startedAt).getTime()) / 86400000) + 1)
    : 1;

  // Filter lessons according to user's goals & blockers
  const filteredLessons = LESSONS.filter((l) => {
    if (!profile) return true;
    return l.tags.includes(profile.goal) || l.blockers.includes(profile.blocker);
  });

  const currentLesson =
    LESSONS.find((lesson) => lesson.id === adminSettings.dailyOverride.lessonId) ||
    filteredLessons[Math.min(currentDay - 1, filteredLessons.length - 1)] ||
    LESSONS[0];
  const nextLesson =
    filteredLessons[Math.min(currentDay, filteredLessons.length - 1)] || LESSONS[1];

  const handleOnboardingComplete = (newProfile: UserProfile) => {
    setProfile(newProfile);
    if (lastHotTakeDate !== getTodayStr()) {
      setTimeout(() => setShowHotTakeModal(true), 800);
    }
  };

  const handleVoteHotTake = (_reaction: "agree" | "disagree" | "complicated", xpReward: number) => {
    setLastHotTakeDate(getTodayStr());
    setProgress((previous) => ({ ...previous, xp: previous.xp + xpReward }));
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2500);
  };

  const handleCloseHotTakeModal = () => {
    setLastHotTakeDate(getTodayStr());
    setShowHotTakeModal(false);
  };

  const handleCompleteDay = (reflectionText: string, isReadChecked: boolean) => {
    if (isDayCompleted) return;

    const todayStr = new Date().toDateString();
    const newStreak =
      progress.lastCompletedDate !== todayStr
        ? progress.lastCompletedDate
          ? progress.streak + 1
          : 1
        : progress.streak;

    const addedXp = (isReadChecked ? 10 : 0) + currentLesson.task.xp;
    const newXp = progress.xp + addedXp;

    const newJournalEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      day: currentDay,
      lessonTitle: currentLesson.title,
      reflection: reflectionText || "Completed without reflection",
      xp: addedXp,
    };

    setProgress((prev) => ({
      ...prev,
      xp: newXp,
      streak: newStreak,
      lastCompletedDate: todayStr,
      completedDates: [...new Set([...prev.completedDates, todayStr])],
      currentDay,
      journal: [newJournalEntry, ...prev.journal],
      lessonsViewed: [...new Set([...prev.lessonsViewed, currentLesson.id])],
    }));

    setIsDayCompleted(true);
    setShowConfetti(true);
    setIsBouncingStreak(true);
    setTimeout(() => setIsBouncingStreak(false), 1200);
    setTimeout(() => setShowConfetti(false), 3000);
  };

  const handleQuickFix = (problem: string) => {
    const coachContext: ChatMessage = {
      id: `quick-fix-${Date.now()}`,
      role: "coach",
      text: `I've got you. You said: "${problem}". Show me the last few messages or tell me what happened and I'll help you figure out what to do next.`,
      time: "now",
      options: ["Show me what to text", "Roast the situation", "Give me a low-pressure move"],
    };
    setMessages((previous) => [...previous, coachContext]);
    handleSelectTab("coach");
  };

  const handleOpenCoachContext = (context: string) => {
    setMessages((previous) => [
      ...previous,
      {
        id: `community-context-${Date.now()}`,
        role: "coach",
        text: `${context}\n\nTell me what happened and I will help you apply it.`,
        time: "now",
        options: ["Show me an example", "Apply this to my chat"],
      },
    ]);
    handleSelectTab("coach");
  };

  const handleCommunityXp = (amount: number, reason: string) => {
    const transactionKey = `${getTodayStr()}_${reason}`;
    if (awardedXpKeys.includes(transactionKey)) return;
    setAwardedXpKeys((previous) => [...previous, transactionKey].slice(-250));
    setProgress((previous) => ({
      ...previous,
      xp: previous.xp + amount,
      journal: [
        {
          id: `community-${Date.now()}`,
          date: new Date().toISOString(),
          day: currentDay,
          lessonTitle: reason,
          reflection: "Community learning activity",
          xp: amount,
        },
        ...previous.journal,
      ],
    }));
  };

  const handlePracticeToday = (lessonId?: number) => {
    if (lessonId) {
      const lesson = LESSONS.find((item) => item.id === lessonId);
      if (lesson) {
        setAdminSettings((previous) => ({
          ...previous,
          dailyOverride: { ...previous.dailyOverride, lessonId, updatedAt: new Date().toISOString() },
        }));
      }
    }
    handleSelectTab("today");
  };

  const handleUpdateProfile = (nextProfile: UserProfile) => {
    setProfile(nextProfile);
  };

  const handlePracticeComplete = (scenario: string, score: number) => {
    const reward = Math.max(10, Math.round(score / 5));
    const entry = {
      id: `practice-${Date.now()}`,
      date: new Date().toISOString(),
      day: currentDay,
      lessonTitle: `AI practice: ${scenario}`,
      reflection: `Simulation score: ${score}/100`,
      xp: reward,
    };
    setProgress((previous) => ({
      ...previous,
      xp: previous.xp + reward,
      journal: [entry, ...previous.journal],
    }));
  };

  const handleUpdateDailyFocus = (focus: string) => {
    setProgress((previous) => ({ ...previous, dailyFocus: focus }));
  };

  const handleNewCoachSession = () => {
    setMessages([]);
    setIsTyping(false);
  };

  const handleCoachMessageFeedback = (messageId: string, helpful: boolean) => {
    setCoachFeedback((previous) =>
      [...previous, { messageId, helpful, createdAt: new Date().toISOString() }].slice(-100),
    );
  };

  const handleSendMessage = async (
    text?: string,
    imageBase64?: string,
    mode: "gentle" | "direct" | "brutal" = "direct"
  ) => {
    const userText = text || "";
    if (!userText && !imageBase64) return;

    if (!isPro && chatsUsedToday >= MAX_FREE_CHATS) {
      setShowProModal(true);
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      text: userText,
      imageUrl: imageBase64,
      time: "now",
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    if (!isPro) {
      const today = getTodayStr();
      setChatsUsedToday((prev) => prev + 1);
      setLastChatDate(today);
    }

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          message: userText,
          vibe: mode,
          history: messages,
          imageBase64,
          profile: {
            goal: profile?.goal,
            blocker: profile?.blocker,
            experience: profile?.experience,
          },
        }),
      });

      const data = await res.json();
      setIsTyping(false);

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "coach",
        text: data.text || "COACH'S TAKE\nSomething went sideways. Try sending that again.",
        time: "now",
        isAi: data.isAi,
        options: getFollowUpOptions(userText, data.text),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch {
      setIsTyping(false);
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "coach",
        text: "match their energy, add ONE playful tease, and end with a concrete question or plan. no paragraphs!",
        time: "now",
        options: ["Give me an opener", "What do I text back?", "Roast my chat"],
      };
      setMessages((prev) => [...prev, botMessage]);
    }
  };

  const getFollowUpOptions = (userMsg: string, replyText: string): string[] => {
    const lower = userMsg.toLowerCase();
    if (lower.includes("roast") || lower.includes("screenshot")) {
      return ["What should I text back?", "Roast another chat", "Profile review"];
    }
    if (lower.includes("opener") || lower.includes("first")) {
      return ["Give me 1 more option", "What if they don't reply?", "I'm nervous"];
    }
    return ["What do I text back?", "Roast my chat", "Profile review"];
  };

  const handleResetData = () => {
    const reset = createDefaultUserAppState();
    reset.lastChatDate = getTodayStr();
    applyUserState(reset);
    setActiveTab("today");
    setIsDayCompleted(false);
    setShowProModal(false);
    setShowHotTakeModal(false);
  };

  const handleSaveAdminSettings = (settings: AdminSettings) => {
    saveAdminSettings(settings);
    setAdminSettings(settings);
  };

  const activeAdminNotification = getActiveAdminNotification(adminSettings);
  const todayHotTake = adminSettings.dailyHotTake || getTodayHotTake();
  const shouldShowAdminNotification =
    activeAdminNotification && !dismissedNotificationIds.includes(activeAdminNotification.id);

  const handleDismissAdminNotification = () => {
    if (!activeAdminNotification) return;
    setDismissedNotificationIds((previous) => [
      ...new Set([...previous, activeAdminNotification.id]),
    ]);
  };

  const handleUpgradeToPro = () => {
    setIsPro(true);
    setShowProModal(false);

    const proMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "coach",
      text: "LETS GOOO 🚀 welcome to Pro! You now have unlimited coaching 24/7. Roast My Chat, Profile Review, all lessons unlocked. What are we fixing first?",
      time: "now",
      options: ["Roast my chat", "Profile review", "What do I text back?"],
    };

    setMessages((prev) => [...prev, proMessage]);
  };

  if (authLoading) {
    return <div className="min-h-screen bg-[#FFFBEB] flex items-center justify-center font-black">CHECKING YOUR SESSION...</div>;
  }
  if (pathname === "/auth/callback") return <AuthCallbackPage />;
  if (pathname === "/auth/reset-password") return <ResetPasswordPage />;

  // Public marketing site: landing, blog, pricing, manifesto. Signed-out
  // visitors get all of it (including "/"); signed-in users and guests can
  // still browse everything except "/", which routes into the app.
  if (isMarketingPath(pathname)) {
    const isAuthed = !!supabaseUser || isGuest;
    if (!isAuthed || pathname !== "/") {
      return (
        <MarketingSite pathname={pathname} navigate={navigate} isAuthed={isAuthed} />
      );
    }
  }

  if (!supabaseUser && !isGuest) {
    return (
      <AuthContainer
        onAuthSuccess={handleAuthSuccess}
        initialView={
          pathname === "/signup" ? "signup" : pathname === "/forgot-password" ? "forgot_password" : "signin"
        }
      />
    );
  }

  // Signed-in users can still reach the standalone recovery page directly.
  if (pathname === "/forgot-password") return <ForgotPasswordPage />;

  if (supabaseUser && syncStatus === "loading") {
    return (
      <div className="min-h-screen bg-[#FFFBEB] flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="w-12 h-12 rounded-full border-[4px] border-black border-t-[#FFE066] animate-spin" />
        <div className="font-black text-lg">SYNCING YOUR PROFILE…</div>
        <p className="font-bold text-sm opacity-60">Loading your XP, streak, chats, and settings.</p>
      </div>
    );
  }

  if (!profile) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  const inAdminWorkspace = activeTab === "admin";

  return (
    <div className={`min-h-screen text-[#111] font-sans selection:bg-[#FFE066] relative overflow-x-hidden ${inAdminWorkspace ? "bg-[#F4F5EF]" : "bg-[#FFFBEB]"}`}>
      {/* Confetti Overlay */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
          {[...Array(40)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-[confetti_2.5s_ease-out_forwards]"
              style={{
                left: `${Math.random() * 100}%`,
                top: "-10px",
                animationDelay: `${Math.random() * 0.5}s`,
                fontSize: `${14 + Math.random() * 18}px`,
                transform: `rotate(${Math.random() * 360}deg)`,
              }}
            >
              {["🎉", "✨", "💥", "🔥", "💖", "⚡"][Math.floor(Math.random() * 6)]}
            </div>
          ))}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-[#111] text-white px-6 py-3 rounded-full font-black text-[18px] brutal-shadow border-[3px] border-white animate-[pop_0.5s_ease-out]">
              +{currentLesson.task.xp + 10} XP • LET'S GOOO
            </div>
          </div>
        </div>
      )}

      {/* Pro Modal */}
      {showProModal && (
        <ProModal
          onClose={() => setShowProModal(false)}
          onUpgrade={handleUpgradeToPro}
        />
      )}

      {/* Daily Hot Take Modal */}
      {showHotTakeModal && !inAdminWorkspace && (
        <HotTakeModal
          hotTake={todayHotTake}
          onVote={handleVoteHotTake}
          onClose={handleCloseHotTakeModal}
        />
      )}

      {/* Auth View Modal when triggered from inside the app */}
      {showAuthView && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="relative w-full max-w-[500px]">
            <button
              onClick={() => setShowAuthView(null)}
              className="absolute -top-3 -right-3 z-50 w-9 h-9 bg-black text-white border-[2.5px] border-white rounded-full font-black text-[14px] flex items-center justify-center brutal-shadow cursor-pointer hover:bg-neutral-800"
              title="Close"
            >
              ✕
            </button>
            <AuthContainer
              onAuthSuccess={handleAuthSuccess}
              initialView={showAuthView}
            />
          </div>
        </div>
      )}

      {/* The admin workspace has its own dedicated application chrome. */}
      {!inAdminWorkspace && (
        <Header
          progress={progress}
          avatarUrl={avatarUrl}
          onOpenProfile={() => handleSelectTab("profile")}
          currentUser={currentUser}
          onSignOut={handleSignOut}
          onOpenAuth={handleOpenAuth}
          isBouncingStreak={isBouncingStreak}
        />
      )}

      {/* Main Tab Content */}
      <main className={inAdminWorkspace ? "w-full min-h-screen" : "max-w-[640px] mx-auto px-4 pb-[100px] pt-6"}>
        {!inAdminWorkspace && syncStatus === "offline" && (
          <div className="mb-5 bg-[#FDA4AF] border-[3px] border-black rounded-[18px] p-3 brutal-shadow-sm">
            <div className="font-black text-[12px] uppercase">Cloud sync paused</div>
            <p className="font-bold text-[11px] mt-1">
              Your latest changes are cached on this device and will sync after the database is reachable.
            </p>
            {syncError && <p className="text-[9px] mt-1 opacity-60 break-words">{syncError}</p>}
          </div>
        )}

        {!inAdminWorkspace && shouldShowAdminNotification && activeAdminNotification && (
          <div className="mb-5 bg-white border-[3px] border-black rounded-[20px] p-4 brutal-shadow-sm animate-[pop_0.25s_ease-out]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-full border-[2.5px] border-black flex items-center justify-center font-black text-[16px] shrink-0"
                  style={{
                    background:
                      activeAdminNotification.tone === "warning"
                        ? "#FDA4AF"
                        : activeAdminNotification.tone === "win"
                        ? "#BEF264"
                        : "#FFE066",
                  }}
                >
                  !
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-60">
                    Admin Broadcast
                  </div>
                  <h3 className="font-black text-[16px] leading-tight text-[#111]">
                    {activeAdminNotification.title}
                  </h3>
                  <p className="text-[12px] font-bold opacity-70 leading-snug mt-1">
                    {activeAdminNotification.message}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismissAdminNotification}
                className="w-8 h-8 bg-[#FFFBEB] border-[2px] border-black rounded-full font-black text-[13px] shrink-0"
                title="Dismiss broadcast"
              >
                X
              </button>
            </div>
          </div>
        )}

        {activeTab === "today" && (
          <TodayTab
            currentDay={currentDay}
            lesson={currentLesson}
            nextLesson={nextLesson}
            progress={progress}
            isDayCompleted={isDayCompleted}
            onCompleteDay={handleCompleteDay}
            onQuickFix={handleQuickFix}
            onPracticeComplete={handlePracticeComplete}
            onRealWorldComplete={() => handleCompleteDay("Completed today's real-world move", false)}
            adminNote={adminSettings.dailyOverride.note}
          />
        )}

        {activeTab === "coach" && (
          <CoachTab
            profile={profile}
            messages={messages}
            onSendMessage={handleSendMessage}
            isPro={isPro}
            chatsUsedToday={chatsUsedToday}
            maxFreeChats={MAX_FREE_CHATS}
            onOpenProModal={() => setShowProModal(true)}
            onNewSession={handleNewCoachSession}
            onMessageFeedback={handleCoachMessageFeedback}
            isTyping={isTyping}
            savedMode={coachMode}
            onModeChange={setCoachMode}
          />
        )}

        {activeTab === "community" && (
          <CommunityTab
            settings={adminSettings}
            isAdmin={adminAllowed}
            onOpenAdmin={() => handleSelectTab("admin")}
            userId={currentUser?.id}
            profile={profile}
            progress={progress}
            onOpenCoach={handleOpenCoachContext}
            onPracticeToday={handlePracticeToday}
            onAwardXp={handleCommunityXp}
            userState={communityState}
            onUserStateChange={setCommunityState}
          />
        )}

        {activeTab === "profile" && (
          <ProfileTab
            profile={profile}
            progress={progress}
            messages={messages}
            avatarUrl={avatarUrl}
            onUpdateAvatar={setAvatarUrl}
            screenshots={screenshots}
            onUpdateScreenshots={setScreenshots}
            isPro={isPro}
            onOpenProModal={() => setShowProModal(true)}
            onResetData={handleResetData}
            onOpenCoachTab={() => handleSelectTab("coach")}
            onOpenCoachContext={handleOpenCoachContext}
            onUpdateProfile={handleUpdateProfile}
            onAwardXp={handleCommunityXp}
            chatsUsedToday={chatsUsedToday}
            maxFreeChats={MAX_FREE_CHATS}
            onDowngradeToFree={() => {
              setIsPro(false);
              setChatsUsedToday(0);
            }}
            currentUser={currentUser}
            onSignOut={handleSignOut}
            onOpenAuth={handleOpenAuth}
            privateJournal={privateJournal}
            profileAudit={profileAudit}
            onPrivateDataChange={(journal, audit) => {
              setPrivateJournal(journal);
              setProfileAudit(audit);
            }}
            syncStatus={syncStatus}
            syncError={syncError}
            onUpdatePassword={updatePassword}
          />
        )}

        {activeTab === "admin" && adminAccess === "checking" && (
          <div className="min-h-screen bg-[#F4F5EF] flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full border-[3px] border-black/15 border-t-black animate-spin" />
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-black/45">Verifying admin access</div>
          </div>
        )}

        {activeTab === "admin" && adminAllowed && (
          <React.Suspense
            fallback={
              <div className="min-h-screen bg-[#F4F5EF] flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 rounded-full border-[3px] border-black/15 border-t-black animate-spin" />
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-black/45">Loading command center</div>
              </div>
            }
          >
            <AdminTab
              settings={adminSettings}
              onSaveSettings={handleSaveAdminSettings}
              currentUser={currentUser}
              onExit={() => handleSelectTab("today")}
              onSignOut={() => void handleSignOut()}
            />
          </React.Suspense>
        )}
      </main>

      {/* Bottom Navigation */}
      {!inAdminWorkspace && (
        <Navigation
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          showAdmin={false}
        />
      )}
    </div>
  );
}
