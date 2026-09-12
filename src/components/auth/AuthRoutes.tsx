import React, { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, MailCheck, TriangleAlert } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#FFFBEB] text-[#111] flex items-center justify-center p-4"><div className="w-full max-w-[540px] bg-white border-[3px] border-black rounded-3xl p-6 sm:p-8 brutal-shadow">{children}</div></div>;
}

export function AuthCallbackPage() {
  const { session, loading } = useAuth();
  useEffect(() => { if (!loading && session) window.location.replace("/dashboard"); }, [loading, session]);
  return <Shell><div className="text-center"><LoaderCircle className="mx-auto animate-spin" size={30} /><h1 className="font-black text-2xl mt-3">VERIFYING YOUR ACCOUNT...</h1><p className="text-sm font-bold opacity-60 mt-2">Finishing your secure Supabase sign-in.</p>{!loading && !session && <a className="inline-block mt-5 font-black underline" href="/login">Back to login</a>}</div></Shell>;
}

export function ResetPasswordPage() {
  const { session, loading, updatePassword, authError } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (password.length < 6) return setMessage("Use at least 6 characters."); if (password !== confirm) return setMessage("Passwords do not match."); const result = await updatePassword(password); if (result.error) setMessage(result.error); else { setMessage("Password updated. Redirecting..."); window.setTimeout(() => window.location.replace("/dashboard"), 900); } };
  if (loading) return <Shell><LoaderCircle className="mx-auto animate-spin" /></Shell>;
  if (!session) return <Shell><TriangleAlert className="text-red-600" /><h1 className="font-black text-2xl mt-2">RESET LINK EXPIRED</h1><p className="font-bold opacity-70 mt-2">Request a new password reset email and try again.</p><a href="/forgot-password" className="inline-block mt-4 font-black underline">Request new link</a></Shell>;
  return <Shell><h1 className="font-black text-3xl">SET A NEW PASSWORD</h1><p className="font-bold opacity-60 mt-2">Choose a new password for your datings.lol account.</p><form onSubmit={submit} className="space-y-3 mt-5"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" autoComplete="new-password" className="w-full h-12 border-[2px] border-black rounded-xl px-3 font-bold" /><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" autoComplete="new-password" className="w-full h-12 border-[2px] border-black rounded-xl px-3 font-bold" /><button className="w-full h-12 bg-[#FFE066] border-[2px] border-black rounded-xl font-black uppercase brutal-shadow-sm">Update password</button></form>{(message || authError) && <p className="mt-4 bg-[#FDA4AF] border-[2px] border-black rounded-xl p-3 font-bold text-sm">{message || authError}</p>}</Shell>;
}

export function ForgotPasswordPage() {
  const { resetPassword, authError } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setMessage("Enter a valid email address."); const result = await resetPassword(email); if (result.error) setMessage(result.error); else setSent(true); };
  return <Shell>{sent ? <div className="text-center"><MailCheck className="mx-auto text-green-600" size={34} /><h1 className="font-black text-2xl mt-3">CHECK YOUR EMAIL</h1><p className="font-bold opacity-70 mt-2">If an account matches that email, Supabase sent a secure reset link.</p><a href="/login" className="inline-block mt-5 font-black underline">Back to login</a></div> : <><h1 className="font-black text-3xl">FORGOT PASSWORD?</h1><p className="font-bold opacity-60 mt-2">We&apos;ll send a secure reset link. We won&apos;t reveal whether an email is registered.</p><form onSubmit={submit} className="space-y-3 mt-5"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" className="w-full h-12 border-[2px] border-black rounded-xl px-3 font-bold" /><button className="w-full h-12 bg-[#FFE066] border-[2px] border-black rounded-xl font-black uppercase brutal-shadow-sm">Send reset link</button></form>{(message || authError) && <p className="mt-4 bg-[#FDA4AF] border-[2px] border-black rounded-xl p-3 font-bold text-sm">{message || authError}</p>}<a href="/login" className="inline-block mt-4 font-black underline">Back to login</a></>}</Shell>;
}
