import { supabase } from "./supabase";

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers });
}

export async function loadAccountEntitlements(): Promise<{ plan: "free" | "pro"; isPro: boolean } | null> {
  const response = await apiFetch("/api/account/entitlements");
  if (!response.ok) return null;
  return response.json();
}
