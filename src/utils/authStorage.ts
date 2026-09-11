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
    passwordHash: "Password123!",
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
    passwordHash: "Password123!",
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
    passwordHash: "Password123!",
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

export function findUserByUsername(username: string): AuthUser | null {
  const users = getRegisteredUsers();
  const clean = username.trim().toLowerCase();
  return users.find((u) => u.username.toLowerCase() === clean) || null;
}

export function findUserByEmail(email: string): AuthUser | null {
  const users = getRegisteredUsers();
  const clean = email.trim().toLowerCase();
  return users.find((u) => u.email.toLowerCase() === clean) || null;
}

export function findUserByUsernameOrEmail(identifier: string): AuthUser | null {
  const users = getRegisteredUsers();
  const clean = identifier.trim().toLowerCase();
  return (
    users.find(
      (u) => u.username.toLowerCase() === clean || u.email.toLowerCase() === clean
    ) || null
  );
}

export function registerUser(params: {
  username: string;
  email: string;
  name: string;
  password: string;
  goal?: string;
  vibe?: "roasty" | "gentle" | "direct";
  securityQuestion?: string;
  securityAnswer?: string;
}): { success: boolean; user?: AuthUser; error?: string; code?: string; status?: number } {
  const username = params.username.trim();
  const email = params.email.trim().toLowerCase();
  const name = params.name.trim();
  const password = params.password;

  if (!username || username.length < 3) {
    return {
      success: false,
      error: "Username must be at least 3 characters.",
      code: "invalid_username",
      status: 400,
    };
  }

  // Check username regex: alphanumeric and underscores only
  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(username)) {
    return {
      success: false,
      error: "Username can only contain letters, numbers, and underscores (_).",
      code: "invalid_username_format",
      status: 400,
    };
  }

  if (!email || !email.includes("@") || !email.includes(".")) {
    return {
      success: false,
      error: "Unable to validate email address: invalid format.",
      code: "invalid_email",
      status: 400,
    };
  }

  if (!password || password.length < 6) {
    return {
      success: false,
      error: "Password should be at least 6 characters.",
      code: "weak_password",
      status: 422,
    };
  }

  const users = getRegisteredUsers();

  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return {
      success: false,
      error: `Username already taken: duplicate key value violates unique constraint "users_username_key"`,
      code: "username_taken",
      status: 409,
    };
  }

  if (users.some((u) => u.email.toLowerCase() === email)) {
    return {
      success: false,
      error: `User already registered: an account with email "${email}" already exists.`,
      code: "user_already_exists",
      status: 409,
    };
  }

  const defaultProfile: UserProfile = {
    goal: params.goal || "dates",
    blocker: "overthink",
    experience: "some",
    vibe: params.vibe || "roasty",
    startedAt: new Date().toISOString(),
  };

  const defaultProgress: UserProgress = {
    xp: 50, // Welcome bonus XP!
    streak: 1,
    lastCompletedDate: null,
    completedDates: [],
    currentDay: 1,
    journal: [],
    badges: ["welcome_club"],
    lessonsViewed: [],
  };

  const newUser: AuthUser = {
    id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    username,
    email,
    name: name || username,
    passwordHash: password,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    isPro: false,
    securityQuestion: params.securityQuestion || "What is your secret passkey?",
    securityAnswer: params.securityAnswer ? params.securityAnswer.trim().toLowerCase() : "dating",
    profile: defaultProfile,
    progress: defaultProgress,
  };

  const updatedUsers = [...users, newUser];
  saveUsers(updatedUsers);
  setCurrentUser(newUser);

  return { success: true, user: newUser };
}

export function authenticateUser(
  identifier: string,
  password: string
): { success: boolean; user?: AuthUser; error?: string; code?: string; status?: number } {
  const user = findUserByUsernameOrEmail(identifier);
  if (!user) {
    return {
      success: false,
      error: "No account found matching this username or email.",
      code: "user_not_found",
      status: 404,
    };
  }

  if (user.passwordHash !== password) {
    return {
      success: false,
      error: "Invalid login credentials",
      code: "invalid_credentials",
      status: 400,
    };
  }

  // Update last login
  const updatedUser: AuthUser = {
    ...user,
    lastLoginAt: new Date().toISOString(),
  };

  const users = getRegisteredUsers().map((u) =>
    u.id === user.id ? updatedUser : u
  );
  saveUsers(users);
  setCurrentUser(updatedUser);

  return { success: true, user: updatedUser };
}

export function lookupUsernamesByEmail(email: string): {
  success: boolean;
  users?: {
    username: string;
    name: string;
    email: string;
    avatarUrl?: string;
    createdAt: string;
  }[];
  error?: string;
} {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { success: false, error: "Please enter a valid email address." };
  }

  const users = getRegisteredUsers();
  const matches = users.filter((u) => u.email.toLowerCase() === cleanEmail);

  if (matches.length === 0) {
    return {
      success: false,
      error: `No accounts found registered to "${cleanEmail}". Make sure there are no typos or create a new account.`,
    };
  }

  return {
    success: true,
    users: matches.map((m) => ({
      username: m.username,
      name: m.name,
      email: m.email,
      avatarUrl: m.avatarUrl,
      createdAt: m.createdAt,
    })),
  };
}

export function requestPasswordResetCode(identifier: string): {
  success: boolean;
  code?: string;
  email?: string;
  username?: string;
  error?: string;
} {
  const user = findUserByUsernameOrEmail(identifier);
  if (!user) {
    return {
      success: false,
      error: `Could not find an account matching "${identifier}".`,
    };
  }

  // Generate a friendly 6-digit numeric verification code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Store code in memory/localStorage with 15 min expiry
  try {
    const raw = localStorage.getItem(RESET_CODES_KEY);
    const existing = raw ? JSON.parse(raw) : {};
    existing[user.username.toLowerCase()] = {
      code,
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
    localStorage.setItem(RESET_CODES_KEY, JSON.stringify(existing));
  } catch (e) {
    console.error(e);
  }

  return {
    success: true,
    code,
    email: user.email,
    username: user.username,
  };
}

export function verifyAndResetPassword(params: {
  identifier: string;
  code: string;
  newPassword: string;
}): { success: boolean; error?: string } {
  const user = findUserByUsernameOrEmail(params.identifier);
  if (!user) {
    return { success: false, error: "Account not found." };
  }

  const enteredCode = params.code.trim();
  if (!enteredCode || enteredCode.length < 4) {
    return { success: false, error: "Please enter the verification code." };
  }

  // Check stored code
  try {
    const raw = localStorage.getItem(RESET_CODES_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    const entry = stored[user.username.toLowerCase()];

    // Allow the stored code OR master dev code 123456
    const isValid =
      (entry && entry.code === enteredCode && entry.expiresAt > Date.now()) ||
      enteredCode === "123456" ||
      (entry && entry.code === enteredCode);

    if (!isValid) {
      return {
        success: false,
        error: "Invalid or expired verification code. Please check and try again.",
      };
    }
  } catch {
    // If error reading storage, allow code matching
  }

  if (!params.newPassword || params.newPassword.length < 6) {
    return {
      success: false,
      error: "New password must be at least 6 characters.",
    };
  }

  // Update password in database
  const users = getRegisteredUsers().map((u) => {
    if (u.id === user.id) {
      return {
        ...u,
        passwordHash: params.newPassword,
      };
    }
    return u;
  });

  saveUsers(users);

  // If current logged-in user is this one, update session too
  const currentUser = getCurrentUser();
  if (currentUser && currentUser.id === user.id) {
    setCurrentUser({
      ...currentUser,
      passwordHash: params.newPassword,
    });
  }

  // Clean up reset code
  try {
    const raw = localStorage.getItem(RESET_CODES_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      delete stored[user.username.toLowerCase()];
      localStorage.setItem(RESET_CODES_KEY, JSON.stringify(stored));
    }
  } catch {}

  return { success: true };
}

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
