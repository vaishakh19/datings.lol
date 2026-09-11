export type AuthView = "signin" | "signup" | "forgot_password" | "forgot_username";

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

export interface UserProfile {
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
