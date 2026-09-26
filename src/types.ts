export type AuthView = "signin" | "signup" | "forgot_password" | "forgot_username";
export type AppTab = "today" | "coach" | "community" | "profile" | "admin";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  name: string;
  passwordHash: string;
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt?: string;
  isPro?: boolean;
  securityQuestion?: string;
  securityAnswer?: string;
  profile?: UserProfile;
  progress?: UserProgress;
  messages?: ChatMessage[];
}

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  tone: "update" | "warning" | "win";
  createdAt: string;
  expiresAt?: string;
  isActive: boolean;
}

export interface AdminDailyOverride {
  lessonId: number | null;
  focus: string;
  note: string;
  updatedAt: string;
}

export interface AdminHotTakeOverride {
  topic: string;
  statement: string;
  subtext: string;
  agreePercent: number;
  disagreePercent: number;
  complicatedPercent: number;
  coachInsight: {
    agree: string;
    disagree: string;
    complicated: string;
  };
  bonusXp: number;
  updatedAt: string;
}

export interface AdminSettings {
  notifications: AdminNotification[];
  dailyOverride: AdminDailyOverride;
  dailyHotTake: AdminHotTakeOverride | null;
}

export interface UserProfile {
  name?: string;
  age?: number;
  goal: string;
  blocker: string;
  experience: string;
  vibe: "roasty" | "gentle" | "direct";
  startedAt: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  day: number;
  lessonTitle: string;
  reflection: string;
  xp: number;
}

export interface UserProgress {
  xp: number;
  streak: number;
  lastCompletedDate: string | null;
  completedDates: string[];
  currentDay: number;
  journal: JournalEntry[];
  badges: string[];
  lessonsViewed: number[];
  dailyFocus?: string;
  skillScores?: Record<string, number>;
}

export type PrivateJournalType =
  | "date recap"
  | "rejection"
  | "confidence"
  | "lesson learned"
  | "observation";

export interface PrivateJournalEntry {
  id: string;
  title: string;
  content: string;
  type: PrivateJournalType;
  createdAt: string;
}

export interface ProfileAuditReport {
  id: string;
  score: number;
  createdAt: string;
  photos: number;
  personality: number;
  clarity: number;
  fix: string;
}

export interface CommunityUserState {
  saved: string[];
  completed: string[];
  reactions: Record<string, string>;
}

export interface CoachFeedback {
  messageId: string;
  helpful: boolean;
  createdAt: string;
}

/** The complete per-account payload synchronized to Supabase. */
export interface UserAppState {
  version: number;
  profile: UserProfile | null;
  progress: UserProgress;
  messages: ChatMessage[];
  avatarUrl: string | null;
  screenshots: string[];
  isPro: boolean;
  chatsUsedToday: number;
  lastChatDate: string;
  lastHotTakeDate: string;
  dismissedNotificationIds: string[];
  awardedXpKeys: string[];
  coachFeedback: CoachFeedback[];
  coachMode: "gentle" | "direct" | "brutal";
  community: CommunityUserState;
  privateJournal: PrivateJournalEntry[];
  profileAudit: ProfileAuditReport | null;
}

export interface Task {
  title: string;
  desc: string;
  difficulty: "easy" | "medium" | "spicy";
  xp: number;
}

export interface Lesson {
  id: number;
  title: string;
  subtitle: string;
  paragraphs: string[];
  goodExample: string;
  badExample: string;
  tags: string[];
  blockers: string[];
  task: Task;
  color: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "coach";
  text?: string;
  imageUrl?: string;
  time: string;
  options?: string[];
  isAi?: boolean;
}

export interface Badge {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  category: "all" | "streak" | "chat" | "lessons" | "xp" | "special";
  xpReward: number;
  req: (p: UserProgress, messages?: ChatMessage[], screenshots?: string[]) => boolean;
  getProgress: (p: UserProgress, messages?: ChatMessage[], screenshots?: string[]) => { current: number; total: number; unit: string };
}

export interface RankInfo {
  name: string;
  emoji: string;
  next: number;
  color: string;
}
