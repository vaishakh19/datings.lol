import { AuthUser, UserProfile, UserProgress } from "../types";

const USERS_STORAGE_KEY = "datings_auth_users";
const CURRENT_USER_KEY = "datings_auth_current_user";
const RESET_CODES_KEY = "datings_auth_reset_codes";

// Initial sample users for testing immediately
const DEFAULT_USERS: AuthUser[] = [
  {
    id: "user-demo-1",
    username: "alex_dating",
    email: "alex@datings.lol",
    name: "Alex Hunter",
    passwordHash: "",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    createdAt: "2024-01-15T10:00:00.000Z",
    lastLoginAt: new Date().toISOString(),
    isPro: true,
    securityQuestion: "What was your first pet's name?",
    securityAnswer: "milo",
    profile: {
      goal: "dates",
      blocker: "shy",
      experience: "some",
      vibe: "roasty",
      startedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    progress: {
      xp: 420,
      streak: 5,
      lastCompletedDate: new Date().toDateString(),
      completedDates: [new Date().toDateString()],
      currentDay: 5,
      journal: [],
      badges: ["streak_3", "first_chat"],
      lessonsViewed: [1, 2, 3, 4],
    },
  },
  {
    id: "user-demo-2",
    username: "chloe_glow",
    email: "chloe@datings.lol",
    name: "Chloe Vance",
    passwordHash: "",
    avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    createdAt: "2024-02-20T14:30:00.000Z",
    lastLoginAt: new Date().toISOString(),
    isPro: false,
    securityQuestion: "What city were you born in?",
    securityAnswer: "chicago",
    profile: {
      goal: "texting",
      blocker: "ghosted",
      experience: "new",
      vibe: "gentle",
      startedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    progress: {
      xp: 180,
      streak: 2,
      lastCompletedDate: new Date().toDateString(),
      completedDates: [new Date().toDateString()],
      currentDay: 2,
      journal: [],
      badges: ["first_chat"],
      lessonsViewed: [1],
    },
  },
  {
    id: "user-demo-admin",
    username: "admin",
    email: "admin@datings.lol",
    name: "Dating Ops",
    passwordHash: "",
    createdAt: "2024-01-01T09:00:00.000Z",
    lastLoginAt: new Date().toISOString(),
    isPro: true,
    securityQuestion: "What is your admin passkey?",
    securityAnswer: "dating",
    profile: {
      goal: "dates",
      blocker: "overthink",
      experience: "some",
      vibe: "direct",
      startedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
    progress: {
      xp: 1240,
      streak: 12,
      lastCompletedDate: new Date().toDateString(),
      completedDates: [new Date().toDateString()],
      currentDay: 12,
      journal: [],
      badges: ["streak_3", "first_chat"],
      lessonsViewed: [1, 2, 3, 4, 5],
    },
  },
];

export function getRegisteredUsers(): AuthUser[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    const adminUser = DEFAULT_USERS.find((user) => user.id === "user-demo-admin");
    if (adminUser && !parsed.some((user) => user.id === adminUser.id)) {
      const usersWithAdmin = [...parsed, adminUser];
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(usersWithAdmin));
      return usersWithAdmin;
    }
    return parsed;
  } catch (err) {
    console.error("Failed to read registered users", err);
    return DEFAULT_USERS;
  }
}

export function saveUsers(users: AuthUser[]): void {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (err) {
    console.error("Failed to save users", err);
  }
}

export function getCurrentUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setCurrentUser(user: AuthUser | null): void {
  try {
    if (!user) {
      localStorage.removeItem(CURRENT_USER_KEY);
    } else {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    }
  } catch (err) {
    console.error("Failed to set current user", err);
  }
}

/**
 * Supabase is the source of truth for authentication. This helper only keeps
 * non-sensitive UI state in the browser for backwards-compatible local views;
 * passwords and reset tokens are never stored here.
 */
export function updateCurrentUserData(updates: Partial<AuthUser>): AuthUser | null {
  const current = getCurrentUser();
  if (!current) return null;

  const updated: AuthUser = {
    ...current,
    ...updates,
  };

  const users = getRegisteredUsers().map((u) =>
    u.id === current.id ? updated : u
  );
  saveUsers(users);
  setCurrentUser(updated);

  return updated;
}
