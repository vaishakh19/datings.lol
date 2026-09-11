import React, { useState } from "react";
import { Mail, ArrowRight, ArrowLeft, User, AlertCircle, CheckCircle2, Sparkles, KeyRound } from "lucide-react";
import { AuthView } from "../../types";
import { lookupUsernamesByEmail } from "../../utils/authStorage";

interface ForgotUsernameFormProps {
  onNavigate: (view: AuthView, initialIdentifier?: string) => void;
  initialEmail?: string;
}

export const ForgotUsernameForm: React.FC<ForgotUsernameFormProps> = ({
  onNavigate,
  initialEmail = "",
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [foundUsers, setFoundUsers] = useState<
    { username: string; name: string; email: string; avatarUrl?: string; createdAt: string }[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFoundUsers(null);

    const clean = email.trim();
    if (!clean) {
      setError("Please enter your registered email address.");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const res = lookupUsernamesByEmail(clean);
      setIsLoading(false);

      if (!res.success || !res.users || res.users.length === 0) {
        setError(res.error || `No account found for "${clean}".`);
      } else {
        setFoundUsers(res.users);
      }
    }, 350);
  };

  const handleFillDemoEmail = (demoEmail: string) => {
    setEmail(demoEmail);
    setError(null);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => onNavigate("signin")}
          className="inline-flex items-center gap-1.5 text-[13px] font-bold text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white mb-3 cursor-pointer"
        >
          <ArrowLeft size={16} />
          Back to Sign In
        </button>
        <h2 className="text-[26px] sm:text-[28px] font-black tracking-tight leading-tight">
          Forgot Username
        </h2>
        <p className="text-[14px] text-[#555] dark:text-[#A3A3A3] mt-1 font-medium">
          Enter your registered email address and we&apos;ll retrieve your username for you.
        </p>
      </div>

      {/* Error notification */}
      {error && (
        <div className="mb-5 p-3.5 bg-[#FCA5A5] border-[2.5px] border-black text-black rounded-xl font-bold text-[13px] flex items-start gap-2.5 brutal-shadow-sm">
          <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-700" />
          <div className="flex-1">
            <p>{error}</p>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate("signup")}
                className="text-[12px] underline font-black hover:opacity-80 cursor-pointer"
              >
                Create a new account instead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Form */}
      <form onSubmit={handleLookup} className="space-y-4">
        <div>
          <label className="block text-[13px] font-black uppercase tracking-wider mb-1.5">
            Registered Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-black/50 dark:text-white/50">
              <Mail size={18} />
            </div>
            <input
              id="forgot-username-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. alex@datings.lol"
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#1A1A1A] border-[2.5px] border-black rounded-xl text-[15px] font-bold outline-none focus:ring-2 focus:ring-[#FFE066] focus:border-black transition-all"
            />
          </div>
        </div>

        <button
          id="forgot-username-submit-btn"
          type="submit"
          disabled={isLoading}
          className="w-full h-[52px] mt-2 bg-[#FFE066] border-[2.5px] border-black text-black rounded-xl font-black text-[15px] uppercase tracking-wide flex items-center justify-center gap-2 brutal-shadow active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:bg-[#FDD835] transition-all cursor-pointer disabled:opacity-50"
        >
          {isLoading ? (
            <span className="animate-pulse">Searching accounts...</span>
          ) : (
            <>
              <span>Find My Username</span>
              <ArrowRight size={18} strokeWidth={3} />
            </>
          )}
        </button>
      </form>

      {/* Results Box */}
      {foundUsers && (
        <div className="mt-6 p-4 bg-[#F0FDF4] dark:bg-[#0E2A16] border-[2.5px] border-black rounded-xl brutal-shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-black text-[15px] text-black dark:text-white">
              {foundUsers.length === 1 ? "1 Account Found" : `${foundUsers.length} Accounts Found`}
            </h3>
          </div>

          <div className="space-y-3">
            {foundUsers.map((user) => (
              <div
                key={user.username}
                className="p-3.5 bg-white dark:bg-[#1A1A1A] border-[2px] border-black rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-[2px] border-black bg-[#FFE066] flex items-center justify-center font-black text-[16px] overflow-hidden">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      user.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="font-black text-[16px] text-black dark:text-white font-mono flex items-center gap-1.5">
                      @{user.username}
                    </div>
                    <div className="text-[12px] text-black/60 dark:text-white/60 font-medium">
                      {user.name} • Joined {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => onNavigate("signin", user.username)}
                    className="flex-1 sm:flex-initial px-3.5 py-2 bg-[#FFE066] text-black border-[2px] border-black rounded-lg font-black text-[12px] hover:bg-[#FDD835] active:translate-y-[1px] cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>Sign In</span>
                    <ArrowRight size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate("forgot_password", user.username)}
                    title="Reset password for this username"
                    className="p-2 bg-white dark:bg-[#2A2A2A] text-black dark:text-white border-[2px] border-black rounded-lg text-[12px] hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                  >
                    <KeyRound size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Helper Quick Fill */}
      <div className="mt-8 pt-5 border-t-[2px] border-dashed border-black/20 dark:border-white/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-black/60 dark:text-white/60 flex items-center gap-1">
            <Sparkles size={12} className="text-amber-500" />
            Test with demo emails:
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleFillDemoEmail("alex@datings.lol")}
            className="px-2.5 py-1 text-[11px] font-mono font-bold bg-white dark:bg-[#1A1A1A] border-[1.5px] border-black rounded-md hover:bg-[#FFE066] transition-colors cursor-pointer"
          >
            alex@datings.lol
          </button>
          <button
            type="button"
            onClick={() => handleFillDemoEmail("chloe@datings.lol")}
            className="px-2.5 py-1 text-[11px] font-mono font-bold bg-white dark:bg-[#1A1A1A] border-[1.5px] border-black rounded-md hover:bg-[#FFE066] transition-colors cursor-pointer"
          >
            chloe@datings.lol
          </button>
        </div>
      </div>

      {/* Footer link to Forgot Password & Sign Up */}
      <div className="mt-7 pt-4 border-t-[2px] border-black/10 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between text-[13px] gap-2">
        <button
          type="button"
          onClick={() => onNavigate("forgot_password")}
          className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
        >
          Need to reset password instead?
        </button>

        <button
          type="button"
          onClick={() => onNavigate("signup")}
          className="font-bold text-black dark:text-white hover:underline cursor-pointer"
        >
          Don&apos;t have an account? Sign Up
        </button>
      </div>
    </div>
  );
};
