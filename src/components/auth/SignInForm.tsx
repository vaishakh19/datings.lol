import React, { useState } from "react";
import { User, Lock, Eye, EyeOff, ArrowRight, Sparkles, CheckCircle2, ShieldAlert, Bug, X } from "lucide-react";
import { AuthUser, AuthView } from "../../types";
import { authenticateUser } from "../../utils/authStorage";
import {
  parseSupabaseError,
  ParsedSupabaseError,
  COMMON_SUPABASE_FAILURES,
} from "../../utils/supabaseErrors";
import { BrutalistAuthError } from "./BrutalistAuthError";
import { InvalidCredentialsBlock } from "./InvalidCredentialsBlock";

interface SignInFormProps {
  onSuccess: (user: AuthUser) => void;
  onNavigate: (view: AuthView, initialIdentifier?: string) => void;
  initialIdentifier?: string;
}

export const SignInForm: React.FC<SignInFormProps> = ({
  onSuccess,
  onNavigate,
  initialIdentifier = "",
}) => {
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [parsedError, setParsedError] = useState<ParsedSupabaseError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    identifier?: string;
    password?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showSimulator, setShowSimulator] = useState(false);

  const clearErrors = () => {
    setParsedError(null);
    setFieldErrors({});
  };

  const isInvalidCredentials =
    parsedError?.code === "invalid_credentials" ||
    Boolean(fieldErrors.password && fieldErrors.password.toLowerCase().includes("credentials")) ||
    Boolean(fieldErrors.password && fieldErrors.password.toLowerCase().includes("password"));

  const isUserNotFound =
    parsedError?.code === "user_not_found" ||
    Boolean(fieldErrors.identifier && fieldErrors.identifier.toLowerCase().includes("found"));

  // Only show generic top alert for global non-field errors (e.g. rate limit 429, 503 network, server error)
  const showTopError =
    parsedError !== null &&
    !isInvalidCredentials &&
    !isUserNotFound &&
    parsedError.code !== "invalid_password";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    const trimmedId = identifier.trim();
    if (!trimmedId) {
      const err = parseSupabaseError("Please enter your username or email address.", { identifier });
      setParsedError(err);
      setFieldErrors({ identifier: "Username or email is required" });
      return;
    }

    if (!password) {
      const err = parseSupabaseError("Please enter your password.", { identifier });
      setParsedError(err);
      setFieldErrors({ password: "Password cannot be blank" });
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const result = authenticateUser(trimmedId, password);
      setIsLoading(false);

      if (!result.success || !result.user) {
        const errorObj = {
          message: result.error || "Invalid login credentials",
          code: result.code || "invalid_credentials",
          status: result.status || 400,
        };
        const parsed = parseSupabaseError(errorObj, { identifier: trimmedId });
        setParsedError(parsed);

        // Apply field-specific visual error highlighting
        if (parsed.code === "invalid_credentials") {
          setFieldErrors({
            password: "Incorrect password for this account",
          });
        } else if (parsed.code === "user_not_found") {
          setFieldErrors({
            identifier: "No registered account found under this handle or email",
          });
        }
      } else {
        setSuccessMessage(`Welcome back, ${result.user.name || result.user.username}!`);
        setTimeout(() => {
          onSuccess(result.user!);
        }, 500);
      }
    }, 350);
  };

  const handleFillDemo = (demoUsername: string) => {
    setIdentifier(demoUsername);
    setPassword("Password123!");
    clearErrors();
  };

  const handleErrorAction = (actionType: string) => {
    if (actionType === "reset_password") {
      onNavigate("forgot_password", identifier);
    } else if (actionType === "try_demo") {
      handleFillDemo("alex_dating");
    } else if (actionType === "retry") {
      clearErrors();
    }
  };

  const handleSimulateSupabaseError = (simError: any) => {
    const parsed = parseSupabaseError(simError, { identifier: identifier || "alex_dating" });
    setParsedError(parsed);
    if (parsed.field === "password" || parsed.code === "invalid_credentials") {
      setFieldErrors({ password: "Invalid login credentials" });
    } else if (parsed.field === "identifier" || parsed.code === "user_not_found") {
      setFieldErrors({ identifier: "Account not found in database" });
    } else {
      setFieldErrors({});
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-[26px] sm:text-[28px] font-black tracking-tight leading-tight">
          Sign In
        </h2>
        <p className="text-[14px] text-[#555] dark:text-[#A3A3A3] mt-1 font-medium">
          Enter your username or email to access your chats, streak, and daily lessons.
        </p>
      </div>

      {/* Success notification */}
      {successMessage && (
        <div className="mb-5 p-3.5 bg-[#4ADE80] border-[2.5px] border-black text-black rounded-xl font-bold text-[14px] flex items-center gap-2.5 brutal-shadow-sm">
          <CheckCircle2 size={20} className="shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* High-Contrast Neo-Brutalist Error Display (for non-field global errors like 429 rate limit or 503 network) */}
      {showTopError && (
        <BrutalistAuthError
          error={parsedError}
          onDismiss={clearErrors}
          onAction={handleErrorAction}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Username or Email input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[13px] font-black uppercase tracking-wider">
              Username or Email
            </label>
            {fieldErrors.identifier && (
              <span className="text-[11px] font-bold text-red-600 dark:text-red-400">
                Invalid handle or email
              </span>
            )}
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-black/50 dark:text-white/50">
              <User size={18} />
            </div>
            <input
              id="signin-identifier"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (fieldErrors.identifier) {
                  setFieldErrors((prev) => ({ ...prev, identifier: undefined }));
                }
                if (parsedError && parsedError.field === "identifier") {
                  setParsedError(null);
                }
              }}
              placeholder="e.g. alex_dating or alex@datings.lol"
              className={`w-full pl-10 pr-4 py-3 bg-white dark:bg-[#1A1A1A] border-[2.5px] rounded-xl text-[15px] font-bold outline-none transition-all ${
                fieldErrors.identifier
                  ? "border-red-600 dark:border-red-500 ring-2 ring-red-400/50 bg-red-50/40 dark:bg-red-950/20"
                  : "border-black focus:ring-2 focus:ring-[#FFE066] focus:border-black"
              }`}
            />
          </div>

          {/* Dedicated error block for user_not_found */}
          {isUserNotFound && (
            <div
              id="user-not-found-error-block"
              role="alert"
              className="mt-3 bg-[#FFF0F0] dark:bg-[#221212] border-[3px] border-black rounded-xl p-3.5 brutal-shadow animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div className="flex items-center justify-between gap-2 pb-2 border-b-[2px] border-black/20 dark:border-white/20">
                <span className="bg-[#FF4D4D] text-black border-[2px] border-black font-mono font-black text-[10.5px] px-2 py-0.5 rounded shadow-[2px_2px_0px_#000] uppercase">
                  HTTP 404: USER_NOT_FOUND
                </span>
                <button
                  type="button"
                  onClick={clearErrors}
                  className="w-6 h-6 bg-white dark:bg-[#2D2D2D] text-black dark:text-white border-[2px] border-black rounded flex items-center justify-center font-black hover:bg-neutral-200 cursor-pointer shadow-[1.5px_1.5px_0px_#000]"
                >
                  <X size={13} className="stroke-[3]" />
                </button>
              </div>
              <div className="pt-2 space-y-2">
                <p className="font-black text-[13.5px] uppercase text-black dark:text-white">
                  No account found under &ldquo;{identifier}&rdquo;
                </p>
                <p className="text-[12px] font-bold text-black/80 dark:text-white/80">
                  This handle or email is not registered in Supabase. Check for typos or create a new locker.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onNavigate("forgot_username")}
                    className="py-1.5 px-3 bg-[#FFE066] hover:bg-[#FDD835] text-black border-[2px] border-black rounded-lg font-black text-[11.5px] uppercase tracking-wide shadow-[2px_2px_0px_#000] cursor-pointer"
                  >
                    Look Up Username
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate("signup")}
                    className="py-1.5 px-3 bg-white dark:bg-[#2D2D2D] text-black dark:text-white border-[2px] border-black rounded-lg font-black text-[11.5px] uppercase tracking-wide shadow-[2px_2px_0px_#000] cursor-pointer hover:bg-neutral-100"
                  >
                    Create Account
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Simple field error if not user_not_found */}
          {fieldErrors.identifier && !isUserNotFound && (
            <div className="mt-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-950/50 border-[1.5px] border-red-600 rounded-lg text-[11.5px] font-bold text-red-800 dark:text-red-300 flex items-center justify-between">
              <span>✕ {fieldErrors.identifier}</span>
              <button
                type="button"
                onClick={() => onNavigate("forgot_username")}
                className="underline font-black text-[11px] hover:text-black dark:hover:text-white cursor-pointer ml-2 shrink-0"
              >
                Look Up Username
              </button>
            </div>
          )}
        </div>

        {/* Password input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[13px] font-black uppercase tracking-wider">
              Password
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate("forgot_password", identifier)}
                className="text-[12px] font-bold text-black/70 dark:text-white/70 hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-black/50 dark:text-white/50">
              <Lock size={18} />
            </div>
            <input
              id="signin-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
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
              placeholder="••••••••••••"
              className={`w-full pl-10 pr-11 py-3 bg-white dark:bg-[#1A1A1A] border-[2.5px] rounded-xl text-[15px] font-bold outline-none transition-all ${
                isInvalidCredentials || fieldErrors.password
                  ? "border-red-600 dark:border-red-500 ring-2 ring-red-400/50 bg-red-50/40 dark:bg-red-950/20"
                  : "border-black focus:ring-2 focus:ring-[#FFE066] focus:border-black"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white cursor-pointer"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Dedicated High-Contrast Brutalist Error Block for Invalid Credentials */}
          {isInvalidCredentials && (
            <InvalidCredentialsBlock
              identifier={identifier}
              onResetPassword={() => onNavigate("forgot_password", identifier)}
              onUseDemo={() => handleFillDemo("alex_dating")}
              onDismiss={clearErrors}
            />
          )}

          {/* Fallback inline error if password error is not invalid credentials */}
          {fieldErrors.password && !isInvalidCredentials && (
            <div className="mt-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-950/50 border-[1.5px] border-red-600 rounded-lg text-[11.5px] font-bold text-red-800 dark:text-red-300 flex items-center justify-between">
              <span>✕ {fieldErrors.password}</span>
              <button
                type="button"
                onClick={() => onNavigate("forgot_password", identifier)}
                className="underline font-black text-[11px] hover:text-black dark:hover:text-white cursor-pointer ml-2 shrink-0"
              >
                Reset Password
              </button>
            </div>
          )}
        </div>

        {/* Remember me & Forgot username */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-[2px] border-black text-[#111] focus:ring-0 accent-[#FFE066] cursor-pointer"
            />
            <span className="text-[13px] font-bold">Remember me</span>
          </label>

          <button
            type="button"
            onClick={() => onNavigate("forgot_username")}
            className="text-[12px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            Forgot username?
          </button>
        </div>

        {/* Submit button */}
        <button
          id="signin-submit-btn"
          type="submit"
          disabled={isLoading}
          className="w-full h-[52px] mt-2 bg-[#FFE066] border-[2.5px] border-black text-black rounded-xl font-black text-[15px] uppercase tracking-wide flex items-center justify-center gap-2 brutal-shadow active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:bg-[#FDD835] transition-all cursor-pointer disabled:opacity-50"
        >
          {isLoading ? (
            <span className="animate-pulse">Checking Supabase Auth...</span>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight size={18} strokeWidth={3} />
            </>
          )}
        </button>
      </form>

      {/* Supabase Error Simulator for immediate UI testing */}
      <div className="mt-5 bg-neutral-100 dark:bg-[#1C1C1C] border-[2px] border-black/30 dark:border-white/20 rounded-xl p-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowSimulator((prev) => !prev)}
            className="text-[11px] font-black uppercase tracking-wider text-black/70 dark:text-white/70 flex items-center gap-1.5 hover:text-black dark:hover:text-white cursor-pointer"
          >
            <Bug size={13} className="text-red-500" />
            <span>Test Supabase Error States</span>
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
              Click any common Supabase failure to preview its brutalist error banner, troubleshooting guidance, and field highlights:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_SUPABASE_FAILURES.map((item, idx) => (
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

      {/* Quick Demo Logins Section */}
      <div className="mt-6 pt-5 border-t-[2px] border-dashed border-black/20 dark:border-white/20">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-black uppercase tracking-wider text-black/60 dark:text-white/60 flex items-center gap-1.5">
            <Sparkles size={13} className="text-amber-500" />
            Quick Demo Accounts (1-Click Fill)
          </span>
          <span className="text-[11px] font-mono text-black/50 dark:text-white/50">
            Password: Password123!
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleFillDemo("alex_dating")}
            className="p-2.5 text-left bg-white dark:bg-[#1A1A1A] border-[2px] border-black rounded-lg hover:bg-[#FFFBEB] dark:hover:bg-[#252525] transition-colors flex items-center justify-between text-[12px] group cursor-pointer"
          >
            <div>
              <span className="font-black text-black dark:text-white block">
                Alex Hunter (Pro)
              </span>
              <span className="text-black/60 dark:text-white/60 font-mono text-[11px]">
                @alex_dating
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-[#FFE066] text-black border-[1.5px] border-black rounded-full group-hover:scale-105 transition-transform">
              Fill
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleFillDemo("chloe_glow")}
            className="p-2.5 text-left bg-white dark:bg-[#1A1A1A] border-[2px] border-black rounded-lg hover:bg-[#FFFBEB] dark:hover:bg-[#252525] transition-colors flex items-center justify-between text-[12px] group cursor-pointer"
          >
            <div>
              <span className="font-black text-black dark:text-white block">
                Chloe Vance
              </span>
              <span className="text-black/60 dark:text-white/60 font-mono text-[11px]">
                @chloe_glow
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-[#FFE066] text-black border-[1.5px] border-black rounded-full group-hover:scale-105 transition-transform">
              Fill
            </span>
          </button>
        </div>
      </div>

      {/* Switch to Sign Up */}
      <div className="mt-7 text-center">
        <p className="text-[14px] font-medium text-black/80 dark:text-white/80">
          Don&apos;t have an account yet?{" "}
          <button
            type="button"
            onClick={() => onNavigate("signup")}
            className="font-black underline text-black dark:text-white hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer"
          >
            Create an account free
          </button>
        </p>
      </div>
    </div>
  );
};

