import { apiFetch } from "./api";
import { AdminHotTakeOverride, AdminNotification, AdminSettings } from "../types";

export type AdminSection = "overview" | "users" | "content" | "broadcasts" | "features" | "audit";
export type FeatureState = "ON" | "OFF" | "BETA";

export interface AdminMetrics {
  users: number;
  proUsers: number;
  activeToday: number;
  totalXp: number;
  coachMessagesToday: number;
  tasksCompletedToday: number;
  communityTeachings: number;
  profileAudits: number;
  activeStreaks: number;
}

export interface AdminUserRow {
  id: string;
  username: string;
  email: string;
  xp: number;
  streak: number;
  isPro: boolean;
  createdAt?: string;
  lastSignInAt?: string;
}

export interface AdminFeatureFlag {
  key: string;
  state: FeatureState;
  rolloutPercent: number;
  description: string;
  updatedAt: string;
}

export interface AdminBroadcast extends AdminNotification {
  status: "DRAFT" | "SCHEDULED" | "LIVE" | "EXPIRED" | "ARCHIVED";
  audience: string;
}

export interface AdminDailyConfig {
  id?: string;
  lessonId: number | null;
  mode: "AUTOMATIC" | "MANUAL";
  focus: string;
  note: string;
  taskType: "LEARN" | "PRACTICE" | "SIMULATION" | "REAL_WORLD" | "REVIEW";
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "BRUTAL";
  xpReward: number;
  updatedAt: string;
}

export interface AdminAuditEntry {
  id: string;
  actorId?: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminTrendPoint {
  date: string;
  active: number;
  completions: number;
}

export interface AdminSystemService {
  name: string;
  status: "operational" | "degraded" | "not_configured";
  detail: string;
}

export interface AdminOverviewData {
  metrics: AdminMetrics;
  features: AdminFeatureFlag[];
  broadcasts: AdminBroadcast[];
  dailyConfig: AdminDailyConfig;
  dailyHotTake: AdminHotTakeOverride | null;
  audits: AdminAuditEntry[];
  trend: AdminTrendPoint[];
  services: AdminSystemService[];
  generatedAt: string;
  mode: "demo" | "production";
}

export class AdminApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
  }
}

async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AdminApiError(
      typeof body?.error === "string" ? body.error : "The admin request could not be completed.",
      response.status,
      typeof body?.code === "string" ? body.code : undefined,
    );
  }
  return body as T;
}

export async function verifyAdminSession(): Promise<{ adminId: string; role: string; mode: string }> {
  return adminRequest("/api/admin/session");
}

export async function getAdminOverview(): Promise<AdminOverviewData> {
  return adminRequest("/api/admin/overview");
}

export async function getAdminUsers(search = ""): Promise<AdminUserRow[]> {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  const response = await adminRequest<{ users: AdminUserRow[] }>(
    `/api/admin/users${params.size ? `?${params.toString()}` : ""}`,
  );
  return response.users;
}

export async function setAdminUserPlan(userId: string, isPro: boolean): Promise<void> {
  await adminRequest(`/api/admin/users/${encodeURIComponent(userId)}/plan`, {
    method: "PATCH",
    body: JSON.stringify({ plan: isPro ? "pro" : "free" }),
  });
}

export async function resetAdminUserProgress(userId: string): Promise<void> {
  await adminRequest(`/api/admin/users/${encodeURIComponent(userId)}/reset-progress`, {
    method: "POST",
    body: JSON.stringify({ confirmation: "RESET_PROGRESS" }),
  });
}

export async function updateAdminFeature(
  key: string,
  patch: Pick<AdminFeatureFlag, "state" | "rolloutPercent">,
): Promise<AdminFeatureFlag> {
  return adminRequest(`/api/admin/features/${encodeURIComponent(key)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function createAdminBroadcast(input: {
  title: string;
  message: string;
  tone: AdminNotification["tone"];
  status: "DRAFT" | "LIVE";
  expiresAt?: string;
}): Promise<AdminBroadcast> {
  const response = await adminRequest<{ broadcast: AdminBroadcast }>("/api/admin/broadcasts", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return response.broadcast;
}

export async function archiveAdminBroadcast(id: string): Promise<void> {
  await adminRequest(`/api/admin/broadcasts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "ARCHIVED" }),
  });
}

export async function updateAdminDailyConfig(
  input: Omit<AdminDailyConfig, "id" | "updatedAt">,
): Promise<AdminDailyConfig> {
  const response = await adminRequest<{ dailyConfig: AdminDailyConfig }>("/api/admin/daily-config", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return response.dailyConfig;
}

export async function updateAdminHotTake(
  hotTake: AdminHotTakeOverride,
): Promise<AdminHotTakeOverride> {
  const response = await adminRequest<{ dailyHotTake: AdminHotTakeOverride }>(
    "/api/admin/hot-take",
    { method: "PUT", body: JSON.stringify(hotTake) },
  );
  return response.dailyHotTake;
}

export async function loadPublicAdminSettings(): Promise<AdminSettings | null> {
  const response = await apiFetch("/api/app-config");
  if (!response.ok) return null;
  const body = (await response.json()) as { settings?: AdminSettings };
  return body.settings || null;
}
