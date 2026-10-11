import { supabase } from "./supabase";

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers });
}

export interface BillingStatus {
  plan: "free" | "pro";
  isPro: boolean;
  status: string;
  provider: string | null;
  dailyLimit: number;
  freeDailyLimit: number;
  proDailyLimit: number;
  usedToday: number;
  remainingToday: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  renewalDate: string | null;
  accessEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  canManageBilling: boolean;
  billingConfigured: boolean;
  environment: "test_mode";
  price: { currency: "USD"; amount: number; interval: "month" };
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function readJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function requireOk(response: Response): Promise<any> {
  const data = await readJson(response);
  if (!response.ok) {
    throw new ApiRequestError(
      typeof data.error === "string" ? data.error : "Request failed.",
      response.status,
      typeof data.code === "string" ? data.code : undefined,
    );
  }
  return data;
}

export async function loadAccountEntitlements(): Promise<BillingStatus | null> {
  const response = await apiFetch("/api/account/entitlements");
  if (!response.ok) return null;
  return response.json();
}

export async function loadBillingStatus(): Promise<BillingStatus> {
  return requireOk(await apiFetch("/api/billing/subscription"));
}

export async function createBillingCheckout(): Promise<{ checkoutUrl: string }> {
  return requireOk(
    await apiFetch("/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  );
}

export async function closeCancelledCheckout(): Promise<void> {
  await requireOk(
    await apiFetch("/api/billing/checkout/cancel", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  );
}

export async function createBillingPortal(): Promise<{ portalUrl: string }> {
  return requireOk(
    await apiFetch("/api/billing/portal", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  );
}
