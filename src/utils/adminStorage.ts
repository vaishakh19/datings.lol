import { AdminSettings } from "../types";

const ADMIN_SETTINGS_KEY = "datings_admin_settings";

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  notifications: [],
  dailyHotTake: null,
  dailyOverride: {
    lessonId: null,
    focus: "",
    note: "",
    updatedAt: new Date(0).toISOString(),
  },
};

export function getAdminSettings(): AdminSettings {
  try {
    const raw = localStorage.getItem(ADMIN_SETTINGS_KEY);
    if (!raw) return DEFAULT_ADMIN_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<AdminSettings>;
    return {
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      dailyHotTake: parsed.dailyHotTake || null,
      dailyOverride: {
        ...DEFAULT_ADMIN_SETTINGS.dailyOverride,
        ...(parsed.dailyOverride || {}),
      },
    };
  } catch {
    return DEFAULT_ADMIN_SETTINGS;
  }
}

export function saveAdminSettings(settings: AdminSettings): void {
  localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event("datings_admin_settings_updated"));
}

export function getActiveAdminNotification(settings: AdminSettings): AdminSettings["notifications"][number] | null {
  const now = Date.now();
  return (
    settings.notifications.find((notification) => {
      const hasNotExpired = !notification.expiresAt || new Date(notification.expiresAt).getTime() > now;
      return notification.isActive && hasNotExpired;
    }) || null
  );
}
