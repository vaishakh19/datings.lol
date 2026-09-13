import React, { useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, User } from "lucide-react";
import { AuthView } from "../../types";
import { useAuth } from "../../context/AuthContext";

export function SignInForm({ onNavigate }: { onSuccess?: unknown; onNavigate: (view: AuthView, identifier?: string) => void; initialIdentifier?: string }) {
  const { signIn, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    clearAuthError();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email address.");
    if (!password) return setError("Enter your password.");
    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);
    if (result.error) setError(result.error);
    else window.location.replace("/dashboard");
  };

  return <div>
    <div className="mb-6">
      <h2 className="text-[28px] font-black tracking-tight">Sign In</h2>
      <p className="text-[14px] text-[#555] mt-1 font-medium">Enter your email to access your chats, streak, and daily lessons.</p>
    </div>

    <form onSubmit={submit} className="space-y-4">

      <label className="block">
        <span className="block text-[13px] font-black uppercase tracking-wider mb-1.5">Email</span>
        <div className="relative">
          <User className="absolute left-3.5 top-3.5 text-black/50" size={18} />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full pl-10 pr-3 py-3 bg-white border-[2.5px] border-black rounded-xl text-[15px] font-bold text-[#111] placeholder:text-[#777] outline-none focus:ring-2 focus:ring-[#FFE066]"
          />
        </div>
      </label>

      <label className="block">
        <div className="flex justify-between mb-1.5">
          <span className="text-[13px] font-black uppercase tracking-wider">Password</span>
          <button type="button" onClick={() => onNavigate("forgot_password", email)} className="text-[12px] font-bold underline">
            Forgot password?
          </button>
        </div>

        <div className="relative">
          <Lock className="absolute left-3.5 top-3.5 text-black/50" size={18} />

          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full pl-10 pr-11 py-3 bg-white border-[2.5px] border-black rounded-xl text-[15px] font-bold text-[#111] placeholder:text-[#777] outline-none focus:ring-2 focus:ring-[#FFE066]"
          />

          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-3 top-3.5"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>

      {(error || authError) && (
        <div className="bg-[#FDA4AF] border-[2px] border-black rounded-xl p-3 font-bold text-sm">
          {error || authError}
        </div>
      )}

      <button
        disabled={loading}
        className="w-full h-12 bg-[#FFE066] border-[2.5px] border-black text-black rounded-xl font-black uppercase flex items-center justify-center gap-2 brutal-shadow disabled:opacity-50"
      >
        {loading ? "Signing in..." : <>Sign In <ArrowRight size={18} /></>}
      </button>
    </form>

    <p className="text-center mt-6 text-sm font-bold">
      New here?{" "}
      <button type="button" onClick={() => onNavigate("signup")} className="underline font-black">
        Create an account
      </button>
    </p>
  </div>;
}