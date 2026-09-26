import type {
  ChatMessage,
  CommunityUserState,
  ProfileAuditReport,
  PrivateJournalEntry,
  UserAppState,
  UserProfile,
  UserProgress,
} from "../types";
import { supabase } from "./supabase";

const STATE_VERSION = 1;
const CACHE_PREFIX = "datings_cloud_state_";
const LEGACY_OWNER_KEY = "datings_data_owner";

const WELCOME_MESSAGE: ChatMessage = {
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
};

export function createEmptyProgress(): UserProgress {
  return {
    xp: 0,
    streak: 0,
    lastCompletedDate: null,
    completedDates: [],
    currentDay: 0,
    journal: [],
    badges: [],
    lessonsViewed: [],
    dailyFocus: "",
  };
}

export function createDefaultCommunityState(): CommunityUserState {
  return { saved: [], completed: [], reactions: {} };
}

export function createDefaultUserAppState(): UserAppState {
  return {
    version: STATE_VERSION,
    profile: null,
    progress: createEmptyProgress(),
    messages: [{ ...WELCOME_MESSAGE, options: [...(WELCOME_MESSAGE.options || [])] }],
    avatarUrl: null,
    screenshots: [],
    isPro: false,
    chatsUsedToday: 0,
    lastChatDate: "",
    lastHotTakeDate: "",
    dismissedNotificationIds: [],
    awardedXpKeys: [],
    coachFeedback: [],
    coachMode: "direct",
    community: createDefaultCommunityState(),
    privateJournal: [],
    profileAudit: null,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeArray<T>(value: unknown, fallback: T[] = []): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

/**
 * The JSON column is deliberately versioned and normalized at the boundary.
 * That lets us add fields later without breaking accounts created by an older
 * app release, and prevents malformed remote data from crashing the UI.
 */
export function normalizeUserAppState(value: unknown): UserAppState {
  const defaults = createDefaultUserAppState();
  if (!isObject(value)) return defaults;

  const progress = isObject(value.progress)
    ? ({ ...defaults.progress, ...value.progress } as UserProgress)
    : defaults.progress;
  progress.completedDates = safeArray<string>(progress.completedDates);
  progress.journal = safeArray(progress.journal);
  progress.badges = safeArray<string>(progress.badges);
  progress.lessonsViewed = safeArray<number>(progress.lessonsViewed);

  const communityValue = isObject(value.community) ? value.community : {};
  const community: CommunityUserState = {
    saved: safeArray<string>(communityValue.saved),
    completed: safeArray<string>(communityValue.completed),
    reactions: isObject(communityValue.reactions)
      ? (communityValue.reactions as Record<string, string>)
      : {},
  };

  return {
    version: STATE_VERSION,
    profile: isObject(value.profile) ? (value.profile as unknown as UserProfile) : null,
    progress,
    messages: safeArray<ChatMessage>(value.messages, defaults.messages),
    avatarUrl: typeof value.avatarUrl === "string" ? value.avatarUrl : null,
    screenshots: safeArray<string>(value.screenshots),
    isPro: value.isPro === true,
    chatsUsedToday:
      typeof value.chatsUsedToday === "number" && Number.isFinite(value.chatsUsedToday)
        ? Math.max(0, Math.floor(value.chatsUsedToday))
        : 0,
    lastChatDate: typeof value.lastChatDate === "string" ? value.lastChatDate : "",
    lastHotTakeDate:
      typeof value.lastHotTakeDate === "string" ? value.lastHotTakeDate : "",
    dismissedNotificationIds: safeArray<string>(value.dismissedNotificationIds),
    awardedXpKeys: safeArray<string>(value.awardedXpKeys),
    coachFeedback: safeArray(value.coachFeedback),
    coachMode:
      value.coachMode === "gentle" || value.coachMode === "brutal"
        ? value.coachMode
        : "direct",
    community,
    privateJournal: safeArray<PrivateJournalEntry>(value.privateJournal),
    profileAudit: isObject(value.profileAudit)
      ? (value.profileAudit as unknown as ProfileAuditReport)
      : null,
  };
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function readCachedUserAppState(userId: string): UserAppState | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${userId}`);
    return raw ? normalizeUserAppState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function cacheUserAppState(userId: string, state: UserAppState): void {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${userId}`, JSON.stringify(state));
    localStorage.setItem(LEGACY_OWNER_KEY, userId);
  } catch (error) {
    // A full browser storage quota must not prevent cloud persistence.
    console.warn("Could not cache user state locally", error);
  }
}

/**
 * Imports data from the pre-cloud release once. Unowned legacy data is claimed
 * by the first account that signs in after this upgrade; once claimed it can
 * never leak into another account on the same browser.
 */
export function readLegacyUserAppState(userId: string): UserAppState | null {
  try {
    const owner = localStorage.getItem(LEGACY_OWNER_KEY);
    if (owner && owner !== userId) return null;

    const profile = readJson<UserProfile | null>("datings_profile", null);
    const progress = readJson<UserProgress | null>("datings_progress", null);
    const messages = readJson<ChatMessage[] | null>("datings_chat", null);
    const avatarUrl = localStorage.getItem("datings_avatar");
    const screenshots = readJson<string[]>("datings_screenshots", []);

    const hasLegacyData = Boolean(
      profile ||
        progress ||
        messages ||
        avatarUrl ||
        screenshots.length,
    );
    if (!hasLegacyData) return null;

    const state = createDefaultUserAppState();
    state.profile = profile;
    if (progress) state.progress = progress;
    if (messages?.length) state.messages = messages;
    state.avatarUrl = avatarUrl;
    state.screenshots = screenshots;
    state.isPro = localStorage.getItem("datings_isPro") === "true";
    state.chatsUsedToday = Number(localStorage.getItem("datings_chatCountToday")) || 0;
    state.lastChatDate = localStorage.getItem("datings_lastChatDate") || "";
    state.lastHotTakeDate = localStorage.getItem("datings_last_hottake_date") || "";
    state.dismissedNotificationIds = readJson("datings_dismissed_notifications", []);
    state.awardedXpKeys = Object.keys(localStorage)
      .filter((key) => key.startsWith("datings_community_xp_") && localStorage.getItem(key))
      .map((key) => key.replace("datings_community_xp_", ""))
      .slice(-250);
    state.coachFeedback = readJson("datings_coach_feedback", []);
    const legacyCoachMode = localStorage.getItem("datings_coach_mode");
    if (
      legacyCoachMode === "gentle" ||
      legacyCoachMode === "direct" ||
      legacyCoachMode === "brutal"
    ) {
      state.coachMode = legacyCoachMode;
    }
    state.privateJournal = readJson(`datings_journal_${userId}`, []);
    state.profileAudit = readJson(`datings_audits_${userId}`, null);
    state.community = {
      saved: readJson(`datings_community_${userId}_saved`, []),
      completed: readJson(`datings_community_${userId}_completed`, []),
      reactions: readJson(`datings_community_${userId}_reactions`, {}),
    };

    localStorage.setItem(LEGACY_OWNER_KEY, userId);
    return normalizeUserAppState(state);
  } catch {
    return null;
  }
}

export async function loadUserAppState(userId: string): Promise<UserAppState | null> {
  const { data, error } = await supabase
    .from("user_app_state")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeUserAppState(data.state) : null;
}

export async function saveUserAppState(
  userId: string,
  state: UserAppState,
): Promise<void> {
  const normalized = normalizeUserAppState(state);
  const { error } = await supabase.from("user_app_state").upsert(
    {
      user_id: userId,
      state: normalized,
      state_version: STATE_VERSION,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}
