import React, { useState } from "react";
import { Lock, Mail, User, KeyRound, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Copy, Sparkles } from "lucide-react";
import { AuthView } from "../../types";
import { requestPasswordResetCode, verifyAndResetPassword } from "../../utils/authStorage";

interface ForgotPasswordFormProps {
  onNavigate: (view: AuthView, initialIdentifier?: string) => void;
  initialIdentifier?: string;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  onNavigate,
  initialIdentifier = "",
}) => {
  const [step, setStep] = useState<"request" | "reset" | "success">("request");
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [targetUser, setTargetUser] = useState<{ username: string; email: string } | null>(null);

  const [enteredCode, setEnteredCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Handle Step 1: Send reset code
  const handleRequestCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim()) {
      setError("Please enter your username or email address.");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const res = requestPasswordResetCode(identifier);
      setIsLoading(false);

      if (!res.success || !res.code) {
        setError(res.error || "No matching account found.");
      } else {
        setGeneratedCode(res.code);
        setTargetUser({ username: res.username!, email: res.email! });
        setEnteredCode(res.code); // Pre-fill for convenience or user can edit
        setStep("reset");
      }
    }, 400);
  };

  // Handle Step 2: Reset password
  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!enteredCode.trim()) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const res = verifyAndResetPassword({
        identifier: targetUser?.username || identifier,
        code: enteredCode,
        newPassword,
      });

      setIsLoading(false);

      if (!res.success) {
        setError(res.error || "Failed to reset password.");
      } else {
        setStep("success");
      }
    }, 400);
  };

  const handleCopyCode = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => onNavigate("signin", identifier)}
          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white mb-3"
        >
          <ArrowLeft size={16} />
          Back to Sign In
        </button>
        <h2 className="text-[26px] sm:text-[28px] font-black tracking-tight leading-tight">
          Reset Password
        </h2>
        <p className="text-[14px] text-[#555] dark:text-[#A3A3A3] mt-1 font-medium">
          {step === "request" && "Enter your username or email and we'll help you reset your password."}
          {step === "reset" && "Enter the verification code and choose your new password."}
          {step === "success" && "Your password has been changed successfully!"}
        </p>
      </div>

      {/* Error notification */}
      {error && (
        <div className="mb-5 p-3.5 bg-[#FCA5A5] border-[2.5px] border-black text-black rounded-xl font-bold text-[13px] flex items-start gap-2.5 brutal-shadow-sm">
          <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-700" />
          <div className="flex-1">
            <p>{error}</p>
            {step === "request" && (
              <button
                type="button"
                onClick={() => onNavigate("forgot_username")}
                className="mt-1.5 text-[12px] underline font-black block hover:opacity-80"
              >
                Don&apos;t remember your username or email? Find your username here
              </button>
            )}
          </div>
        </div>
      )}

      {/* STEP 1: REQUEST CODE */}
      {step === "request" && (
        <form onSubmit={handleRequestCode} className="space-y-4">
          <div>
            <label className="block text-[13px] font-black uppercase tracking-wider mb-1.5">
              Username or Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-black/50 dark:text-white/50">
                <User size={18} />
              </div>
              <input
                id="forgot-password-identifier"
                type="text"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. alex_dating or alex@datings.lol"
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#1A1A1A] border-[2.5px] border-black rounded-xl text-[15px] font-bold outline-none focus:ring-2 focus:ring-[#FFE066] focus:border-black transition-all"
              />
            </div>
          </div>

          <button
            id="forgot-password-request-btn"
            type="submit"
            disabled={isLoading}
            className="w-full h-[52px] mt-2 bg-[#FFE066] border-[2.5px] border-black text-black rounded-xl font-black text-[15px] uppercase tracking-wide flex items-center justify-center gap-2 brutal-shadow active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:bg-[#FDD835] transition-all cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <span className="animate-pulse">Checking account...</span>
            ) : (
              <>
                <span>Send Verification Code</span>
                <ArrowRight size={18} strokeWidth={3} />
              </>
            )}
          </button>

          {/* Helper hint */}
          <div className="p-3 bg-[#FFFBEB] dark:bg-[#202020] border-[2px] border-dashed border-black/30 dark:border-white/30 rounded-xl text-[12px] text-black/75 dark:text-white/75 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" />
              Testing helper:
            </p>
            <p>
              Try entering demo username <span className="font-mono font-bold">alex_dating</span> or email <span className="font-mono font-bold">alex@datings.lol</span>
            </p>
          </div>
        </form>
      )}

      {/* STEP 2: VERIFY CODE & NEW PASSWORD */}
      {step === "reset" && (
        <form onSubmit={handleResetPassword} className="space-y-4">
          {/* Simulated Code Banner */}
          {generatedCode && (
            <div className="p-3.5 bg-[#BEF264] border-[2.5px] border-black text-black rounded-xl brutal-shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound size={14} />
                  Simulated Recovery Dispatch
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="text-[11px] font-black bg-white px-2 py-0.5 border-[1.5px] border-black rounded flex items-center gap-1 hover:bg-gray-100"
                >
                  <Copy size={12} />
                  {copiedCode ? "Copied!" : "Copy Code"}
                </button>
              </div>
              <p className="text-[13px] font-medium mt-1">
                Security code sent to{" "}
                <strong className="underline">{targetUser?.email}</strong>:
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="font-mono font-black text-[22px] tracking-widest bg-black text-white px-3 py-1 rounded-lg">
                  {generatedCode}
                </span>
                <span className="text-[11px] font-bold opacity-80">
                  (Valid for 15 mins)
                </span>
              </div>
            </div>
          )}

          {/* Account info pill */}
          {targetUser && (
            <div className="text-[12px] font-bold text-black/70 dark:text-white/70">
              Resetting password for account:{" "}
              <span className="font-mono font-black text-black dark:text-white">
                @{targetUser.username}
              </span>
            </div>
          )}

          {/* Verification Code Input */}
          <div>
            <label className="block text-[13px] font-black uppercase tracking-wider mb-1.5">
              6-Digit Verification Code
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-black/50 dark:text-white/50">
                <KeyRound size={18} />
              </div>
              <input
                id="forgot-password-code"
                type="text"
                maxLength={6}
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value.trim())}
                placeholder="123456"
                className="w-full pl-10 pr-4 py-3 font-mono tracking-widest text-[18px] bg-white dark:bg-[#1A1A1A] border-[2.5px] border-black rounded-xl font-bold outline-none focus:ring-2 focus:ring-[#FFE066] focus:border-black transition-all"
              />
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-[13px] font-black uppercase tracking-wider mb-1.5">
              New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-black/50 dark:text-white/50">
                <Lock size={18} />
              </div>
              <input
                id="forgot-password-new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#1A1A1A] border-[2.5px] border-black rounded-xl text-[15px] font-bold outline-none focus:ring-2 focus:ring-[#FFE066] focus:border-black transition-all"
              />
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-[13px] font-black uppercase tracking-wider mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-black/50 dark:text-white/50">
                <Lock size={18} />
              </div>
              <input
                id="forgot-password-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#1A1A1A] border-[2.5px] border-black rounded-xl text-[15px] font-bold outline-none focus:ring-2 focus:ring-[#FFE066] focus:border-black transition-all"
              />
            </div>
          </div>

          <button
            id="forgot-password-save-btn"
            type="submit"
            disabled={isLoading}
            className="w-full h-[52px] mt-2 bg-[#FFE066] border-[2.5px] border-black text-black rounded-xl font-black text-[15px] uppercase tracking-wide flex items-center justify-center gap-2 brutal-shadow active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:bg-[#FDD835] transition-all cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <span className="animate-pulse">Updating password...</span>
            ) : (
              <>
                <span>Save New Password</span>
                <ArrowRight size={18} strokeWidth={3} />
              </>
            )}
          </button>
        </form>
      )}

      {/* STEP 3: SUCCESS */}
      {step === "success" && (
        <div className="text-center py-4 space-y-4">
          <div className="w-16 h-16 bg-[#4ADE80] border-[3px] border-black rounded-full flex items-center justify-center mx-auto brutal-shadow">
            <CheckCircle2 size={36} className="text-black" />
          </div>

          <div>
            <h3 className="text-[20px] font-black">Password Updated!</h3>
            <p className="text-[14px] text-black/70 dark:text-white/70 mt-1">
              Your password has been changed. You can now sign in using your new credentials.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate("signin", targetUser?.username || identifier)}
            className="w-full h-[52px] bg-[#FFE066] border-[2.5px] border-black text-black rounded-xl font-black text-[15px] uppercase tracking-wide flex items-center justify-center gap-2 brutal-shadow active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:bg-[#FDD835] cursor-pointer"
          >
            <span>Sign In with New Password</span>
            <ArrowRight size={18} strokeWidth={3} />
          </button>
        </div>
      )}

      {/* Footer link to Forgot Username */}
      {step !== "success" && (
        <div className="mt-7 pt-4 border-t-[2px] border-black/10 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between text-[13px] gap-2">
          <button
            type="button"
            onClick={() => onNavigate("forgot_username")}
            className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Forgot your username instead?
          </button>

          <button
            type="button"
            onClick={() => onNavigate("signup")}
            className="font-bold text-black dark:text-white hover:underline"
          >
            Need a new account? Sign Up
          </button>
        </div>
      )}
    </div>
  );
};
