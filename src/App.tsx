import React, { useState, useEffect, useRef } from "react";
import { UserProfile, UserProgress, ChatMessage, AuthUser, AuthView, AdminSettings, AppTab } from "./types";
import { LESSONS } from "./data/lessons";
import { Onboarding } from "./components/Onboarding";
import { Header } from "./components/Header";
import { Navigation } from "./components/Navigation";
import { TodayTab } from "./components/TodayTab";
import { CoachTab } from "./components/CoachTab";
import { ProfileTab } from "./components/ProfileTab";
import { AdminTab } from "./components/AdminTab";
import { CommunityTab } from "./components/CommunityTab";
import { ProModal } from "./components/ProModal";
import { HotTakeModal } from "./components/HotTakeModal";
import { AuthContainer } from "./components/auth/AuthContainer";
import { AuthCallbackPage, ForgotPasswordPage, ResetPasswordPage } from "./components/auth/AuthRoutes";
import { useAuth } from "./context/AuthContext";
import { getTodayHotTake } from "./data/hotTakes";
import {
  getCurrentUser,
  setCurrentUser as saveCurrentUser,
  updateCurrentUserData,
} from "./utils/authStorage";
import {
  getActiveAdminNotification,
  getAdminSettings,
  isAdminUser,
  saveAdminSettings,
} from "./utils/adminStorage";

const MAX_FREE_CHATS = 3;

function getTodayStr(): string {
  return new Date().toLocaleDateString("en-CA");
}

export default function App() {
  const { user: supabaseUser, session, loading: authLoading, signOut: supabaseSignOut } = useAuth();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [showAuthView, setShowAuthView] = useState<AuthView | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const user = getCurrentUser();
    return user?.profile || null;
  });
  const [progress, setProgress] = useState<UserProgress>(() => {
    const user = getCurrentUser();
    return (
      user?.progress || {
        xp: 0,
        streak: 0,
        lastCompletedDate: null,
        completedDates: [],
        currentDay: 0,
        journal: [],
        badges: [],
        lessonsViewed: [],
      }
    );
  });

  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    const path = window.location.pathname;
    if (path === "/coach") return "coach";
    if (path === "/community") return "community";
    if (path === "/profile") return "profile";
    if (path === "/admin") return "admin";
    return "today";
  });
  const [adminSettings, setAdminSettings] = useState<AdminSettings>(() => getAdminSettings());
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("datings_dismissed_notifications") || "[]");
    } catch {
      return [];
    }
  });
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "coach",
      text: "yo, i'm your coach. paste your chat, or tell me what happened 👁️",
      time: "now",
      options: [
        "Roast my chat",
        "What do I text back?",
        "Profile review",
        "I'm nervous",
      ],
    },
  ]);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [chatsUsedToday, setChatsUsedToday] = useState(0);
  const [lastChatDate, setLastChatDate] = useState<string>("");
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

  // Load local storage on mount
  useEffect(() => {
    const savedProfile = localStorage.getItem("datings_profile");
    const savedProgress = localStorage.getItem("datings_progress");
    const savedChat = localStorage.getItem("datings_chat");
    const savedIsPro = localStorage.getItem("datings_isPro");
    const savedChatCount = localStorage.getItem("datings_chatCountToday");
    const savedLastChatDate = localStorage.getItem("datings_lastChatDate");
    const savedAvatar = localStorage.getItem("datings_avatar");
    const savedScreenshots = localStorage.getItem("datings_screenshots");

    if (savedProfile) {
      try { setProfile(JSON.parse(savedProfile)); } catch {}
    }

    if (savedProgress) {
      try {
        const prog = JSON.parse(savedProgress);
        setProgress(prog);
        const todayStr = new Date().toDateString();
        if (prog.lastCompletedDate === todayStr) {
          setIsDayCompleted(true);
        }
      } catch {}
    }

    if (savedChat) {
      try { setMessages(JSON.parse(savedChat)); } catch {}
    }

    if (savedAvatar) setAvatarUrl(savedAvatar);

    if (savedScreenshots) {
      try { setScreenshots(JSON.parse(savedScreenshots)); } catch {}
    }

    if (savedIsPro) setIsPro(savedIsPro === "true");

    const todayDate = getTodayStr();
    if (savedLastChatDate) {
      setLastChatDate(savedLastChatDate);
      if (savedLastChatDate !== todayDate) {
        setChatsUsedToday(0);
        setLastChatDate(todayDate);
        localStorage.setItem("datings_chatCountToday", "0");
        localStorage.setItem("datings_lastChatDate", todayDate);
      } else if (savedChatCount) {
        setChatsUsedToday(parseInt(savedChatCount, 10) || 0);
      }
    } else {
      setLastChatDate(todayDate);
      localStorage.setItem("datings_lastChatDate", todayDate);
      localStorage.setItem("datings_chatCountToday", "0");
    }

    // Trigger daily hot take once per day upon opening if user has completed onboarding
    const savedLastHotTakeDate = localStorage.getItem("datings_last_hottake_date");
    if (savedProfile && savedLastHotTakeDate !== todayDate) {
      setTimeout(() => {
        setShowHotTakeModal(true);
      }, 750);
    }
  }, []);

  // Save states on updates
  useEffect(() => {
    if (profile) localStorage.setItem("datings_profile", JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem("datings_progress", JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    localStorage.setItem("datings_chat", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (avatarUrl) localStorage.setItem("datings_avatar", avatarUrl);
  }, [avatarUrl]);

  useEffect(() => {
    localStorage.setItem("datings_screenshots", JSON.stringify(screenshots));
  }, [screenshots]);

  useEffect(() => {
    localStorage.setItem("datings_isPro", String(isPro));
  }, [isPro]);

  useEffect(() => {
    localStorage.setItem("datings_chatCountToday", String(chatsUsedToday));
  }, [chatsUsedToday]);

  useEffect(() => {
    if (lastChatDate) localStorage.setItem("datings_lastChatDate", lastChatDate);
  }, [lastChatDate]);

  // Keep active user's profile and progress synchronized in authStorage
  useEffect(() => {
    if (currentUser) {
      updateCurrentUserData({
        profile: profile || undefined,
        progress: progress,
        avatarUrl: avatarUrl || undefined,
        isPro: isPro,
        messages,
      });
    }
  }, [currentUser, profile, progress, avatarUrl, isPro, messages]);

  const adminAllowed = isAdminUser(currentUser);

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

  useEffect(() => {
    if (activeTab === "admin" && !adminAllowed) {
      if (window.location.pathname === "/admin") {
        window.history.replaceState({}, "", "/");
      }
      setActiveTab("today");
    }
  }, [activeTab, adminAllowed]);

  const handleSelectTab = (tab: AppTab) => {
    setActiveTab(tab);
    const nextPath = tab === "admin" ? "/admin" : tab === "today" ? "/dashboard" : `/${tab}`;
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
  };

  const handleAuthSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    saveCurrentUser(user);
    setIsGuest(false);
    setShowAuthView(null);

    if (user.profile) {
      setProfile(user.profile);
    } else {
      setProfile({
        goal: "dates",
        blocker: "overthink",
        experience: "some",
        vibe: "roasty",
        startedAt: new Date().toISOString(),
      });
    }

    if (user.progress) {
      setProgress(user.progress);
      const todayStr = new Date().toDateString();
      if (user.progress.lastCompletedDate === todayStr) {
        setIsDayCompleted(true);
      }
    }

    if (user.avatarUrl) setAvatarUrl(user.avatarUrl);
    if (user.isPro !== undefined) setIsPro(user.isPro);

    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2500);
  };

  const handleSignOut = () => {
    void supabaseSignOut();
    saveCurrentUser(null);
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
    if (currentUser) {
      updateCurrentUserData({ profile: newProfile });
    }
    const savedLastHotTakeDate = localStorage.getItem("datings_last_hottake_date");
    if (savedLastHotTakeDate !== getTodayStr()) {
      setTimeout(() => {
        setShowHotTakeModal(true);
      }, 800);
    }
  };

  const handleVoteHotTake = (reaction: "agree" | "disagree" | "complicated", xpReward: number) => {
    const todayDate = getTodayStr();
    localStorage.setItem("datings_last_hottake_date", todayDate);

    // Award bonus XP to progress
    setProgress((prev) => {
      const updatedXp = prev.xp + xpReward;
      const updated = {
        ...prev,
        xp: updatedXp,
      };
      localStorage.setItem("datings_progress", JSON.stringify(updated));
      return updated;
    });

    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2500);
  };

  const handleCloseHotTakeModal = () => {
    const todayDate = getTodayStr();
    localStorage.setItem("datings_last_hottake_date", todayDate);
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
    const transactionKey = `datings_community_xp_${getTodayStr()}_${reason}`;
    if (localStorage.getItem(transactionKey)) return;
    localStorage.setItem(transactionKey, "1");
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
    if (currentUser) updateCurrentUserData({ profile: nextProfile });
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
    setProgress((prev) => {
      const updated = { ...prev, dailyFocus: focus };
      localStorage.setItem("datings_progress", JSON.stringify(updated));
      return updated;
    });
  };

  const handleNewCoachSession = () => {
    setMessages([]);
    setIsTyping(false);
  };

  const handleCoachMessageFeedback = (messageId: string, helpful: boolean) => {
    const feedback = JSON.parse(localStorage.getItem("datings_coach_feedback") || "[]");
    localStorage.setItem(
      "datings_coach_feedback",
      JSON.stringify([...feedback, { messageId, helpful, createdAt: new Date().toISOString() }].slice(-100))
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
        headers: { "Content-Type": "application/json" },
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
    localStorage.clear();
    setProfile(null);
    setProgress({
      xp: 0,
      streak: 0,
      lastCompletedDate: null,
      completedDates: [],
      currentDay: 0,
      journal: [],
      badges: [],
      lessonsViewed: [],
      dailyFocus: "",
    });
    setActiveTab("today");
    setIsDayCompleted(false);
    setIsPro(false);
    setChatsUsedToday(0);
    setLastChatDate(getTodayStr());
    setShowProModal(false);
    setShowHotTakeModal(false);
    setAvatarUrl(null);
    setScreenshots([]);
    setMessages([
      {
        id: "1",
        role: "coach",
        text: "yo, i'm your coach. paste your chat, or tell me what happened 👁️",
        time: "now",
        options: [
          "Roast my chat",
          "What do I text back?",
          "Profile review",
          "I'm nervous",
        ],
      },
    ]);
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
    const nextDismissedIds = [...new Set([...dismissedNotificationIds, activeAdminNotification.id])];
    setDismissedNotificationIds(nextDismissedIds);
    localStorage.setItem("datings_dismissed_notifications", JSON.stringify(nextDismissedIds));
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

  const pathname = window.location.pathname;
  if (authLoading) {
    return <div className="min-h-screen bg-[#FFFBEB] flex items-center justify-center font-black">CHECKING YOUR SESSION...</div>;
  }
  if (pathname === "/auth/callback") return <AuthCallbackPage />;
  if (pathname === "/auth/reset-password") return <ResetPasswordPage />;
  if (pathname === "/forgot-password") return <ForgotPasswordPage />;

  const isPublicAuthPath = pathname === "/login" || pathname === "/signup" || pathname === "/";
  if (!supabaseUser && !isGuest) {
    if (!isPublicAuthPath) window.history.replaceState({}, "", "/login");
    return (
      <AuthContainer
        onAuthSuccess={handleAuthSuccess}
        initialView={pathname === "/signup" ? "signup" : "signin"}
      />
    );
  }

  if (supabaseUser && isPublicAuthPath) {
    window.history.replaceState({}, "", "/dashboard");
    setActiveTab("today");
  }

  if (!profile) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="min-h-screen bg-[#FFFBEB] text-[#111] font-sans selection:bg-[#FFE066] relative overflow-x-hidden">
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
      {showHotTakeModal && (
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
              onClose={() => setShowAuthView(null)}
            />
          </div>
        </div>
      )}

      {/* Top Header */}
      <Header
        progress={progress}
        avatarUrl={avatarUrl}
            onOpenProfile={() => handleSelectTab("profile")}
        currentUser={currentUser}
        onSignOut={handleSignOut}
        onOpenAuth={handleOpenAuth}
        isBouncingStreak={isBouncingStreak}
      />

      {/* Main Tab Content */}
      <main className="max-w-[640px] mx-auto px-4 pb-[100px] pt-6">
        {shouldShowAdminNotification && activeAdminNotification && (
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
          />
        )}

        {activeTab === "admin" && adminAllowed && (
          <AdminTab
            settings={adminSettings}
            onSaveSettings={handleSaveAdminSettings}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        showAdmin={adminAllowed && window.location.pathname === "/admin"}
      />
    </div>
  );
}
