import React, { useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { AuthView } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { EmailTakenBlock } from "./EmailTakenBlock";

export function SignUpForm({ onNavigate }: { onSuccess?: unknown; onNavigate: (view: AuthView, identifier?: string) => void }) {
  const { signUp, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [name, setName] = useState(""); const [showPassword, setShowPassword] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [confirmation, setConfirmation] = useState(false); const [emailTaken, setEmailTaken] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setEmailTaken("");
    clearAuthError();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email address.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setLoading(true);
    const result = await signUp(email, password, { display_name: name.trim() });
    setLoading(false);
    if (result.emailTaken) setEmailTaken(email.trim().toLowerCase());
    else if (result.error) setError(result.error);
    else if (result.needsEmailConfirmation) setConfirmation(true);
    else window.location.replace("/dashboard");
  };

  if (confirmation) return <div className="text-center"><Mail className="mx-auto text-green-600" size={34} /><h2 className="text-2xl font-black mt-3">CHECK YOUR EMAIL</h2><p className="font-bold opacity-70 mt-2">We sent a verification link to <strong>{email}</strong>. Confirm it, then come back to sign in.</p><button type="button" onClick={() => onNavigate("signin", email)} className="mt-5 font-black underline">Back to sign in</button></div>;

  return <div>
    <div className="mb-6">
      <h2 className="text-[28px] font-black tracking-tight">Create Account</h2>
      <p className="text-[14px] text-[#555] mt-1 font-medium">Use your real email so account recovery works.</p>
    </div>

    <form onSubmit={submit} className="space-y-4">

      <label className="block">
        <span className="block text-[13px] font-black uppercase tracking-wider mb-1.5">Display name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          placeholder="Your name"
          className="w-full px-3.5 py-3 bg-white border-[2.5px] border-black rounded-xl text-[15px] font-bold text-[#111] placeholder:text-[#777] outline-none focus:ring-2 focus:ring-[#FFE066]"
        />
      </label>

      <label className="block">
        <span className="block text-[13px] font-black uppercase tracking-wider mb-1.5">Email</span>
        <div className="relative">
          <Mail className="absolute left-3.5 top-3.5 text-black/50" size={18} />
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (emailTaken) setEmailTaken(""); }}
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full pl-10 pr-3 py-3 bg-white border-[2.5px] border-black rounded-xl text-[15px] font-bold text-[#111] placeholder:text-[#777] outline-none focus:ring-2 focus:ring-[#FFE066]"
          />
        </div>
      </label>

      <div className="grid sm:grid-cols-2 gap-3">

        <label className="block">
          <span className="block text-[13px] font-black uppercase tracking-wider mb-1.5">Password</span>
          <div className="relative">
            <Lock className="absolute left-3.5 top-3.5 text-black/50" size={18} />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="At least 6 chars"
              className="w-full pl-10 pr-10 py-3 bg-white border-[2.5px] border-black rounded-xl text-[15px] font-bold text-[#111] placeholder:text-[#777] outline-none focus:ring-2 focus:ring-[#FFE066]"
            />
            <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-3.5" aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>

        <label className="block">
          <span className="block text-[13px] font-black uppercase tracking-wider mb-1.5">Confirm</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            placeholder="Repeat password"
            className="w-full px-3.5 py-3 bg-white border-[2.5px] border-black rounded-xl text-[15px] font-bold text-[#111] placeholder:text-[#777] outline-none focus:ring-2 focus:ring-[#FFE066]"
          />
        </label>

      </div>

      {emailTaken && (
        <EmailTakenBlock
          email={emailTaken}
          onSignIn={() => onNavigate("signin", emailTaken)}
          onDismiss={() => setEmailTaken("")}
        />
      )}

      {(error || authError) && !emailTaken && <div className="bg-[#FDA4AF] border-[2px] border-black rounded-xl p-3 font-bold text-sm">{error || authError}</div>}

      <button disabled={loading} className="w-full h-12 bg-[#FFE066] border-[2.5px] border-black text-black rounded-xl font-black uppercase flex items-center justify-center gap-2 brutal-shadow disabled:opacity-50">
        {loading ? "Creating account..." : <>Create account <ArrowRight size={18} /></>}
      </button>

    </form>

    <p className="text-center mt-6 text-sm font-bold">
      Already have an account? <button type="button" onClick={() => onNavigate("signin")} className="underline font-black">Sign in</button>
    </p>
  </div>;
}