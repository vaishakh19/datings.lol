import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authError: string | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<{ user: User | null; needsEmailConfirmation: boolean; error?: string }>;
  signOut: () => Promise<{ error?: string }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  updatePassword: (password: string) => Promise<{ error?: string }>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function friendlyAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) return "That email or password is not correct.";
  if (lower.includes("email not confirmed")) return "Check your email and confirm your account before signing in.";
  if (lower.includes("user already registered") || lower.includes("already exists")) return "An account already exists for this email. Try signing in instead.";
  if (lower.includes("password") && (lower.includes("6") || lower.includes("weak"))) return "Use a password with at least 6 characters.";
  if (lower.includes("rate limit") || lower.includes("too many")) return "Too many attempts. Please wait a moment and try again.";
  if (lower.includes("failed to fetch") || lower.includes("network")) return "Supabase is unavailable right now. Check your connection and retry.";
  return "Something went sideways. Please try again.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      setSession(data.session);
      if (error) setAuthError(friendlyAuthError(error));
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      if (event === "SIGNED_OUT") setAuthError(null);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user || null,
    session,
    loading,
    authError,
    clearAuthError: () => setAuthError(null),
    async signIn(email, password) {
      setAuthError(null);
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) { const message = friendlyAuthError(error); setAuthError(message); return { error: message }; }
      return {};
    },
    async signUp(email, password, metadata) {
      setAuthError(null);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: metadata, emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) { const message = friendlyAuthError(error); setAuthError(message); return { user: null, needsEmailConfirmation: false, error: message }; }
      return { user: data.user, needsEmailConfirmation: !data.session };
    },
    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) { const message = friendlyAuthError(error); setAuthError(message); return { error: message }; }
      return {};
    },
    async resetPassword(email) {
      setAuthError(null);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/auth/reset-password` });
      if (error) { const message = friendlyAuthError(error); setAuthError(message); return { error: message }; }
      return {};
    },
    async updatePassword(password) {
      setAuthError(null);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { const message = friendlyAuthError(error); setAuthError(message); return { error: message }; }
      return {};
    },
  }), [authError, loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
