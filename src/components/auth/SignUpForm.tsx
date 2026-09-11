import React, { useState, useMemo } from "react";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  Bug,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { AuthUser, AuthView } from "../../types";
import { registerUser, findUserByUsername, findUserByEmail } from "../../utils/authStorage";
import {
  parseSupabaseError,
  ParsedSupabaseError,
  COMMON_SUPABASE_FAILURES,
} from "../../utils/supabaseErrors";
import { BrutalistAuthError } from "./BrutalistAuthError";
import { UsernameTakenBlock } from "./UsernameTakenBlock";
import { EmailTakenBlock } from "./EmailTakenBlock";

interface SignUpFormProps {
  onSuccess: (user: AuthUser) => void;
  onNavigate: (view: AuthView, initialIdentifier?: string) => void;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({ onSuccess, onNavigate }) => {
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [goal, setGoal] = useState("dates");
  const [vibe, setVibe] = useState<"roasty" | "gentle" | "direct">("roasty");
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [parsedError, setParsedError] = useState<ParsedSupabaseError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);

  const clearErrors = () => {
    setParsedError(null);
    setFieldErrors({});
  };

  // Live username availability check
  const usernameStatus = useMemo(() => {
    const trimmed = username.trim();
    if (!trimmed) return null;
    if (trimmed.length < 3) return { valid: false, message: "At least 3 characters" };
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      return { valid: false, message: "Only letters, numbers, and _" };
    }
    const existing = findUserByUsername(trimmed);
    if (existing) return { valid: false, message: "Username already taken" };
    return { valid: true, message: "Username available!" };
  }, [username]);

  // Suggested alternative handles if username is taken
  const suggestedAlternatives = useMemo(() => {
    if (!username.trim()) return [];
    const base = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    return [`${base}_99`, `${base}_pro`, `${base}_vip`, `${base}_chat`];
  }, [username]);

  const isUsernameTaken =
    parsedError?.code === "username_taken" ||
    Boolean(fieldErrors.username && fieldErrors.username.toLowerCase().includes("taken")) ||
    Boolean(usernameStatus && !usernameStatus.valid && usernameStatus.message.toLowerCase().includes("taken"));

  const isEmailTaken =
    parsedError?.code === "email_taken" ||
    Boolean(fieldErrors.email && (fieldErrors.email.toLowerCase().includes("registered") || fieldErrors.email.toLowerCase().includes("taken")));

  // Suppress top alert if dedicated in-field blocks handle the error
  const showTopError =
    parsedError !== null &&
    !isUsernameTaken &&
    !isEmailTaken &&
    parsedError.field !== "username" &&
    parsedError.field !== "email";

  // Live email validity check
  const emailStatus = useMemo(() => {
    const trimmed = email.trim();
    if (!trimmed) return null;
    const isValidFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!isValidFormat) return { valid: false, message: "Invalid email format" };
    const existing = findUserByEmail(trimmed);
    if (existing) return { valid: false, message: "Email already in use" };
    return { valid: true, message: "Email looks great" };
  }, [email]);

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: "Empty", color: "bg-gray-200" };
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;

    switch (score) {
      case 1:
        return { score: 1, label: "Weak", color: "bg-red-500", text: "text-red-600" };
      case 2:
        return { score: 2, label: "Fair", color: "bg-amber-500", text: "text-amber-600" };
      case 3:
        return { score: 3, label: "Good", color: "bg-blue-500", text: "text-blue-600" };
      case 4:
      default:
        return { score: 4, label: "Strong", color: "bg-green-500", text: "text-green-600" };
    }
  }, [password]);

  // Confirm password match check
  const passwordsMatch = useMemo(() => {
    if (!confirmPassword) return null;
    return password === confirmPassword;
  }, [password, confirmPassword]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    const newFieldErrors: Record<string, string> = {};

    if (!username.trim()) {
      newFieldErrors.username = "Please choose a username";
    } else if (usernameStatus && !usernameStatus.valid) {
      newFieldErrors.username = usernameStatus.message;
    }

    if (!email.trim()) {
      newFieldErrors.email = "Please enter your email address";
    } else if (emailStatus && !emailStatus.valid) {
      newFieldErrors.email = emailStatus.message;
    }

    if (!password || password.length < 6) {
      newFieldErrors.password = "Password must be at least 6 characters";
    }

    if (password && confirmPassword && password !== confirmPassword) {
      newFieldErrors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      const firstMsg = Object.values(newFieldErrors)[0];
      setParsedError(parseSupabaseError(firstMsg, { username, email }));
      return;
    }

    if (!agreeTerms) {
      setParsedError(parseSupabaseError("Please accept the community rules to continue."));
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const result = registerUser({
        username,
        name: name.trim() || username.trim(),
        email,
        password,
        goal,
        vibe,
      });

      setIsLoading(false);

      if (!result.success || !result.user) {
        const errorObj = {
          message: result.error || "Failed to create account in database",
          code: result.code,
          status: result.status || 400,
        };
        const parsed = parseSupabaseError(errorObj, { username, email });
        setParsedError(parsed);

        // Target exact field for visual error styling
        if (parsed.code === "username_taken") {
          setFieldErrors({ username: `Username "${username}" is already taken` });
        } else if (parsed.code === "email_taken") {
          setFieldErrors({ email: `Email "${email}" is already registered` });
        } else if (parsed.code === "weak_password") {
          setFieldErrors({ password: "Password should be at least 6 characters" });
        } else if (parsed.code === "invalid_email") {
          setFieldErrors({ email: "Invalid email format" });
        }
      } else {
        onSuccess(result.user);
      }
    }, 400);
  };

  const handleErrorAction = (actionType: string, value?: string) => {
    if (actionType === "signin_email") {
      onNavigate("signin", email);
    } else if (actionType === "apply_username" && value) {
      setUsername(value);
      clearErrors();
    } else if (actionType === "retry") {
      clearErrors();
    }
  };

  const handleSimulateSupabaseError = (simError: any) => {
    const parsed = parseSupabaseError(simError, {
      username: username || "alex_dating",
      email: email || "alex@datings.lol",
    });
    setParsedError(parsed);

    if (parsed.code === "username_taken") {
      setFieldErrors({ username: "Username already taken (PostgreSQL unique constraint)" });
    } else if (parsed.code === "email_taken") {
      setFieldErrors({ email: "User already registered under this email address" });
    } else if (parsed.code === "weak_password") {
      setFieldErrors({ password: "Password should be at least 6 characters" });
    } else {
      setFieldErrors({});
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-[26px] sm:text-[28px] font-black tracking-tight leading-tight">
          Create Account
        </h2>
        <p className="text-[14px] text-[#555] dark:text-[#A3A3A3] mt-1 font-medium">
          Get personalized chat coaching, profile audits, and track your daily streak.
        </p>
      </div>

      {/* High-Contrast Neo-Brutalist Error Display (only for general/global errors, NOT username taken or email taken) */}
      {showTopError && (
        <BrutalistAuthError
          error={parsedError}
          onDismiss={clearErrors}
          onAction={handleErrorAction}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Username field with live badge */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[13px] font-black uppercase tracking-wider">
              Username *
            </label>
            {isUsernameTaken ? (
              <span className="bg-[#FF4D4D] text-black border-[1.5px] border-black text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded shadow-[1.5px_1.5px_0px_#000]">
                Handle Taken
              </span>
            ) : fieldErrors.username ? (
              <span className="text-[11px] font-bold text-red-600 dark:text-red-400">
                Invalid handle
              </span>
            ) : (
              usernameStatus && (
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                    usernameStatus.valid
                      ? "bg-emerald-100 text-emerald-800 border-emerald-400"
                      : "bg-red-100 text-red-700 border-red-300"
                  }`}
                >
                  {usernameStatus.message}
                </span>
              )
            )}
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-black/50 dark:text-white/50">
              <User size={18} />
            </div>
            <input
              id="signup-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value.toLowerCase().replace(/\s+/g, "_"));
                if (fieldErrors.username) {
                  setFieldErrors((prev) => ({ ...prev, username: undefined }));
                }
                if (parsedError && parsedError.field === "username") {
                  setParsedError(null);
                }
              }}
              placeholder="e.g. rizz_god or julia_flirts"
              className={`w-full pl-10 pr-4 py-3 bg-white dark:bg-[#1A1A1A] border-[2.5px] rounded-xl text-[15px] font-bold outline-none transition-all ${
                isUsernameTaken || fieldErrors.username
                  ? "border-red-600 dark:border-red-500 ring-2 ring-red-400/50 bg-red-50/40 dark:bg-red-950/20"
                  : "border-black focus:ring-2 focus:ring-[#FFE066] focus:border-black"
              }`}
            />
          </div>

          {/* Dedicated High-Contrast Brutalist Error Block for Username Taken */}
          {isUsernameTaken && (
            <UsernameTakenBlock
              username={username}
              suggestedAlternatives={suggestedAlternatives}
              onSelectSuggestion={(alt) => {
                setUsername(alt);
                clearErrors();
              }}
              onSignInInstead={() => onNavigate("signin", username)}
              onDismiss={clearErrors}
            />
          )}

          {/* Simple inline error for other username issues (e.g. too short) */}
          {fieldErrors.username && !isUsernameTaken && (
            <div className="mt-2 p-2.5 bg-red-100 dark:bg-red-950/50 border-[1.5px] border-red-600 rounded-lg text-red-900 dark:text-red-300 text-[12px] font-bold">
              <span>✕ {fieldErrors.username}</span>
            </div>
          )}
        </div>

        {/* Display / Full name & Email side-by-side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-black uppercase tracking-wider mb-1.5">
              Display Name
            </label>
            <input
              id="signup-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Hunter"
              className="w-full px-3.5 py-3 bg-white dark:bg-[#1A1A1A] border-[2.5px] border-black rounded-xl text-[15px] font-bold outline-none focus:ring-2 focus:ring-[#FFE066] focus:border-black transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[13px] font-black uppercase tracking-wider">
                Email *
              </label>
              {isEmailTaken ? (
                <span className="bg-[#FF4D4D] text-black border-[1.5px] border-black text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded shadow-[1.5px_1.5px_0px_#000]">
                  Email Registered
                </span>
              ) : fieldErrors.email ? (
                <span className="text-[10px] font-black text-red-600 dark:text-red-400">
                  Invalid email
                </span>
              ) : (
                emailStatus && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                      emailStatus.valid ? "text-emerald-700 font-black" : "text-red-600"
                    }`}
                  >
                    {emailStatus.valid ? "✓ Valid" : "✗ Check email"}
                  </span>
                )
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-black/50 dark:text-white/50">
                <Mail size={16} />
              </div>
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }
                  if (parsedError && parsedError.field === "email") {
                    setParsedError(null);
                  }
                }}
                placeholder="you@domain.com"
                className={`w-full pl-9 pr-3 py-3 bg-white dark:bg-[#1A1A1A] border-[2.5px] rounded-xl text-[15px] font-bold outline-none transition-all ${
                  isEmailTaken || fieldErrors.email
                    ? "border-red-600 dark:border-red-500 ring-2 ring-red-400/50 bg-red-50/40 dark:bg-red-950/20"
                    : "border-black focus:ring-2 focus:ring-[#FFE066] focus:border-black"
                }`}
              />
            </div>

            {/* Dedicated High-Contrast Brutalist Error Block for Email Taken */}
            {isEmailTaken && (
              <EmailTakenBlock
                email={email}
                onSignIn={() => onNavigate("signin", email)}
                onDismiss={clearErrors}
              />
            )}

            {/* Fallback inline error for email validation (not taken) */}
            {fieldErrors.email && !isEmailTaken && (
              <div className="mt-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-950/50 border-[1.5px] border-red-600 rounded-lg text-[11.5px] font-bold text-red-800 dark:text-red-300 flex items-center justify-between">
                <span>✕ {fieldErrors.email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Password & Confirm Password */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[13px] font-black uppercase tracking-wider">
                Password *
              </label>
              {password && (
                <span className={`text-[11px] font-bold ${passwordStrength.text}`}>
                  {passwordStrength.label}
                </span>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-black/50 dark:text-white/50">
                <Lock size={18} />
              </div>
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }
                  if (parsedError && parsedError.field === "password") {
                    setParsedError(null);
                  }
                }}
                placeholder="At least 6 chars"
                className={`w-full pl-10 pr-10 py-3 bg-white dark:bg-[#1A1A1A] border-[2.5px] rounded-xl text-[15px] font-bold outline-none transition-all ${
                  fieldErrors.password
                    ? "border-red-600 dark:border-red-500 ring-2 ring-red-400/50 bg-red-50/40 dark:bg-red-950/20"
                    : "border-black focus:ring-2 focus:ring-[#FFE066] focus:border-black"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-black/60 dark:text-white/60 cursor-pointer"
                aria-label={showPassword ? "Hide" : "Show"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Password strength visual bars */}
            {password && (
              <div className="flex gap-1 mt-2">
                {[1, 2, 3, 4].map((barIndex) => (
                  <div
                    key={barIndex}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      passwordStrength.score >= barIndex
                        ? passwordStrength.color
                        : "bg-gray-200 dark:bg-gray-700"
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Inline password error */}
            {fieldErrors.password && (
              <p className="mt-1 text-[11px] font-bold text-red-600 dark:text-red-400">
                ✕ {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[13px] font-black uppercase tracking-wider">
                Confirm Password *
              </label>
              {passwordsMatch !== null && (
                <span
                  className={`text-[11px] font-bold ${
                    passwordsMatch ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {passwordsMatch ? "✓ Match" : "✗ Don't match"}
                </span>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-black/50 dark:text-white/50">
                <Lock size={18} />
              </div>
              <input
                id="signup-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (fieldErrors.confirmPassword) {
                    setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                  }
                }}
                placeholder="Re-type password"
                className={`w-full pl-10 pr-10 py-3 bg-white dark:bg-[#1A1A1A] border-[2.5px] rounded-xl text-[15px] font-bold outline-none transition-all ${
                  fieldErrors.confirmPassword
                    ? "border-red-600 dark:border-red-500 ring-2 ring-red-400/50 bg-red-50/40 dark:bg-red-950/20"
                    : "border-black focus:ring-2 focus:ring-[#FFE066] focus:border-black"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-black/60 dark:text-white/60 cursor-pointer"
                aria-label={showConfirmPassword ? "Hide" : "Show"}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {fieldErrors.confirmPassword && (
              <p className="mt-1 text-[11px] font-bold text-red-600 dark:text-red-400">
                ✕ {fieldErrors.confirmPassword}
              </p>
            )}
          </div>
        </div>

        {/* Coach vibe preference chips */}
        <div className="pt-2">
          <label className="block text-[12px] font-black uppercase tracking-wider mb-2 text-black/70 dark:text-white/70">
            Initial Coach Vibe Preference
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "roasty", label: "Roasty 🔥", desc: "Honest & funny" },
              { id: "gentle", label: "Gentle 🧸", desc: "Hype me up" },
              { id: "direct", label: "Direct 🎯", desc: "Tactical advice" },
            ].map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVibe(v.id as any)}
                className={`p-2 rounded-xl border-[2px] text-left transition-all cursor-pointer ${
                  vibe === v.id
                    ? "bg-[#FFE066] border-black text-black font-black brutal-shadow-sm"
                    : "bg-white dark:bg-[#1A1A1A] border-black/30 dark:border-white/30 text-black dark:text-white font-medium hover:border-black"
                }`}
              >
                <div className="text-[12px] font-bold">{v.label}</div>
                <div className="text-[10px] opacity-75">{v.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Terms agreement */}
        <div className="pt-1">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-[2px] border-black text-[#111] focus:ring-0 accent-[#FFE066] cursor-pointer"
            />
            <span className="text-[12px] font-medium text-black/80 dark:text-white/80 leading-snug">
              I agree to the Community Guidelines and promise to stop double-texting dry paragraphs 🤞
            </span>
          </label>
        </div>

        {/* Submit button */}
        <button
          id="signup-submit-btn"
          type="submit"
          disabled={isLoading}
          className="w-full h-[52px] mt-2 bg-[#FFE066] border-[2.5px] border-black text-black rounded-xl font-black text-[15px] uppercase tracking-wide flex items-center justify-center gap-2 brutal-shadow active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:bg-[#FDD835] transition-all cursor-pointer disabled:opacity-50"
        >
          {isLoading ? (
            <span className="animate-pulse">Setting up your locker in Supabase...</span>
          ) : (
            <>
              <span>Create Account & Start</span>
              <ArrowRight size={18} strokeWidth={3} />
            </>
          )}
        </button>
      </form>

      {/* Supabase Error Simulator for Signup */}
      <div className="mt-5 bg-neutral-100 dark:bg-[#1C1C1C] border-[2px] border-black/30 dark:border-white/20 rounded-xl p-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowSimulator((prev) => !prev)}
            className="text-[11px] font-black uppercase tracking-wider text-black/70 dark:text-white/70 flex items-center gap-1.5 hover:text-black dark:hover:text-white cursor-pointer"
          >
            <Bug size={13} className="text-red-500" />
            <span>Test Supabase Signup Failures</span>
            <span className="text-[9.5px] font-mono px-1.5 py-0.2 bg-black text-white rounded">
              {showSimulator ? "Hide" : "Preview Failures"}
            </span>
          </button>
          {parsedError && (
            <button
              type="button"
              onClick={clearErrors}
              className="text-[10px] font-bold underline text-red-600 dark:text-red-400 cursor-pointer"
            >
              Clear error
            </button>
          )}
        </div>

        {showSimulator && (
          <div className="mt-3 pt-2.5 border-t border-black/10 dark:border-white/10 space-y-2">
            <p className="text-[11px] font-medium text-black/60 dark:text-white/60">
              Click any common Supabase registration failure to view its brutalist alert, error code badge, and inline field highlights:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                COMMON_SUPABASE_FAILURES[1], // Username already taken (409)
                COMMON_SUPABASE_FAILURES[2], // User already registered (409)
                COMMON_SUPABASE_FAILURES[3], // Weak password (422)
                COMMON_SUPABASE_FAILURES[4], // Rate limit exceeded (429)
                COMMON_SUPABASE_FAILURES[6], // Network failure (503)
              ].map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSimulateSupabaseError(item.error)}
                  className="px-2 py-1 bg-white dark:bg-[#2A2A2A] border-[1.5px] border-black text-black dark:text-white text-[10.5px] font-bold rounded-md hover:bg-[#FFE066] dark:hover:bg-[#FFE066] dark:hover:text-black active:translate-y-[1px] cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Switch to Sign In */}
      <div className="mt-6 text-center">
        <p className="text-[14px] font-medium text-black/80 dark:text-white/80">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => onNavigate("signin")}
            className="font-black underline text-black dark:text-white hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer"
          >
            Sign In here
          </button>
        </p>
      </div>
    </div>
  );
};

