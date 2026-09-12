import React, { useState } from "react";
import { Lock, UserPlus, KeyRound, User, ShieldCheck } from "lucide-react";
import { AuthUser, AuthView } from "../../types";
import { SignInForm } from "./SignInForm";
import { SignUpForm } from "./SignUpForm";

interface AuthContainerProps {
  onAuthSuccess: (user: AuthUser) => void;
  onContinueAsGuest?: () => void;
  initialView?: AuthView;
}

export const AuthContainer: React.FC<AuthContainerProps> = ({
  onAuthSuccess,
  onContinueAsGuest,
  initialView = "signin",
}) => {
  const [currentView, setCurrentView] = useState<AuthView>(initialView);
  const [targetIdentifier, setTargetIdentifier] = useState<string>("");

  const handleNavigate = (view: AuthView, identifier?: string) => {
    if (view === "forgot_password") {
      window.location.assign(`/forgot-password${identifier ? `?email=${encodeURIComponent(identifier)}` : ""}`);
      return;
    }
    setCurrentView(view);
    if (identifier !== undefined) {
      setTargetIdentifier(identifier);
    }
  };

  const navItems: { id: AuthView; label: string; icon: React.ReactNode }[] = [
    { id: "signin", label: "Sign In", icon: <Lock size={14} /> },
    { id: "signup", label: "Sign Up", icon: <UserPlus size={14} /> },
    { id: "forgot_password", label: "Forgot Password", icon: <KeyRound size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-[#FFFBEB] dark:bg-[#0D0D0D] text-[#111] dark:text-[#F3F4F6] font-sans flex flex-col justify-between p-4 sm:p-6 selection:bg-[#FFE066]">
      {/* Top Bar with Brand & Theme Switcher */}
      <header className="max-w-[540px] w-full mx-auto flex items-center justify-between pb-6 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-[#111] text-[#FFFBEB] rounded-full flex items-center justify-center font-black text-[15px] border-[2px] border-black">
            d.
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-[22px] tracking-tighter">
                datings.lol
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 bg-[#FFE066] text-black border-[2px] border-black rounded-full">
                AUTH
              </span>
            </div>
            <p className="text-[11px] font-bold text-black/60 dark:text-white/60 tracking-tight -mt-0.5">
              dating coach & chat roaster
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onContinueAsGuest && (
            <button
              onClick={onContinueAsGuest}
              className="hidden sm:inline-flex px-3 py-1.5 bg-white dark:bg-[#1A1A1A] border-[2px] border-black rounded-full text-[12px] font-black hover:bg-[#FFE066] hover:text-black transition-colors"
            >
              Guest Explore
            </button>
          )}
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="max-w-[540px] w-full mx-auto my-auto py-2">
        {/* Navigation Tabs Pill Bar */}
        <div className="flex items-center bg-white dark:bg-[#161616] p-1.5 border-[2.5px] border-black rounded-2xl brutal-shadow-sm mb-4 overflow-x-auto scrollbar-none">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                id={`auth-tab-${item.id}`}
                onClick={() => handleNavigate(item.id)}
                className={`flex-1 min-w-[90px] py-2 px-2.5 rounded-xl font-black text-[12px] sm:text-[13px] tracking-tight flex items-center justify-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-[#FFE066] text-black border-[2px] border-black brutal-shadow-sm"
                    : "text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 border-[2px] border-transparent"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Container Card */}
        <div className="bg-white dark:bg-[#161616] border-[3px] border-black rounded-3xl p-6 sm:p-8 brutal-shadow relative">
          {/* Subtle Corner Badge */}
          <div className="absolute top-4 right-4 hidden sm:flex items-center gap-1 text-[11px] font-black text-black/40 dark:text-white/40">
            <ShieldCheck size={14} />
            <span>Secure Access</span>
          </div>

          {currentView === "signin" && (
            <SignInForm
              onSuccess={onAuthSuccess}
              onNavigate={handleNavigate}
              initialIdentifier={targetIdentifier}
            />
          )}

          {currentView === "signup" && (
            <SignUpForm
              onSuccess={onAuthSuccess}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === "forgot_password" && <p className="font-bold">Redirecting to password recovery...</p>}
        </div>

        {/* Guest continue option for easy testing */}
        {onContinueAsGuest && (
          <div className="text-center mt-5">
            <button
              onClick={onContinueAsGuest}
              className="text-[13px] font-bold text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white underline cursor-pointer"
            >
              Skip for now and continue as guest →
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-[540px] w-full mx-auto text-center pt-8 pb-3">
        <p className="text-[11px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest">
          datings.lol • secure auth & account recovery
        </p>
      </footer>
    </div>
  );
};
