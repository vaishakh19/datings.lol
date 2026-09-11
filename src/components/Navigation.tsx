import React from "react";
import { Calendar, MessageCircle, User } from "lucide-react";

interface NavigationProps {
  activeTab: "today" | "coach" | "profile";
  onSelectTab: (tab: "today" | "coach" | "profile") => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const navItems = [
    { id: "today", label: "Today", icon: Calendar, activeColor: "#FFE066" },
    { id: "coach", label: "Coach", icon: MessageCircle, activeColor: "#A78BFA" },
    { id: "profile", label: "Profile", icon: User, activeColor: "#BEF264" },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t-[3px] border-black">
      <div className="max-w-[640px] mx-auto px-2 h-[76px] flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex-1 max-w-[120px] h-[52px] rounded-full border-[3px] border-black font-black text-[13px] flex items-center justify-center gap-2 transition-all ${
                isActive
                  ? "text-black brutal-shadow-sm translate-y-[-2px]"
                  : "bg-[#FFFBEB] text-black/60 hover:text-black"
              }`}
              style={{ background: isActive ? item.activeColor : undefined }}
            >
              <Icon size={18} strokeWidth={isActive ? 3 : 2} />
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)] bg-white" />
    </nav>
  );
};
