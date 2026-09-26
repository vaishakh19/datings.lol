import React, { useEffect, useState } from "react";
import { ArrowRight, MailCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface ForgotPasswordPanelProps {
  initialIdentifier?: string;
  /** Rendered as the "back to sign in" control. */
  onBackToSignIn: () => void;
}

/**
 * The Supabase-backed password reset request form, without any page chrome, so
 * it can be rendered inline inside AuthContainer as well as on the standalone
 * /forgot-password route.
 */
export const ForgotPasswordPanel: React.FC<ForgotPasswordPanelProps> = ({
  initialIdentifier = "",
  onBackToSignIn,
}) => {
  const { resetPassword, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState(initialIdentifier);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (initialIdentifier) setEmail(initialIdentifier);
  }, [initialIdentifier]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    clearAuthError();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMessage("Enter a valid email address.");
    setLoading(true);
    const result = await resetPassword(email);
    setLoading(false);
    if (result.error) setMessage(result.error);
    else setSent(true);
  };

  if (sent) {
    return (
      <div className="text-center">
        <MailCheck className="mx-auto text-green-600" size={34} />
        <h2 className="text-2xl font-black mt-3">CHECK YOUR EMAIL</h2>
        <p className="font-bold opacity-70 mt-2">
          If an account matches <strong>{email}</strong>, we sent a secure reset link.
        </p>
        <button type="button" onClick={onBackToSignIn} className="mt-5 font-black underline">
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-[28px] font-black tracking-tight">Forgot Password?</h2>
        <p className="text-[14px] text-[#555] mt-1 font-medium">
          We&apos;ll send a secure reset link. We won&apos;t reveal whether an email is registered.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="block text-[13px] font-black uppercase tracking-wider mb-1.5">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full px-3.5 py-3 bg-white border-[2.5px] border-black rounded-xl text-[15px] font-bold text-[#111] placeholder:text-[#777] outline-none focus:ring-2 focus:ring-[#FFE066]"
          />
        </label>

        {(message || authError) && (
          <div className="bg-[#FDA4AF] border-[2px] border-black rounded-xl p-3 font-bold text-sm">
            {message || authError}
          </div>
        )}

        <button
          disabled={loading}
          className="w-full h-12 bg-[#FFE066] border-[2.5px] border-black text-black rounded-xl font-black uppercase flex items-center justify-center gap-2 brutal-shadow disabled:opacity-50"
        >
          {loading ? "Sending link..." : <>Send reset link <ArrowRight size={18} /></>}
        </button>
      </form>

      <p className="text-center mt-6 text-sm font-bold">
        Remembered it?{" "}
        <button type="button" onClick={onBackToSignIn} className="underline font-black">
          Back to sign in
        </button>
      </p>
    </div>
  );
};
