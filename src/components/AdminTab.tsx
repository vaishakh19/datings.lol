import React, { useMemo, useState } from "react";
import {
  BellRing,
  BookOpenCheck,
  Clock,
  Crown,
  Eye,
  Flame,
  MessageSquareText,
  MessageCircle,
  Radio,
  Save,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Users,
} from "lucide-react";
import { AdminHotTakeOverride, AdminNotification, AdminSettings, AuthUser } from "../types";
import { LESSONS } from "../data/lessons";
import { getTodayHotTake } from "../data/hotTakes";
import { getRegisteredUsers } from "../utils/authStorage";

interface AdminTabProps {
  settings: AdminSettings;
  onSaveSettings: (settings: AdminSettings) => void;
}

function formatDate(value?: string): string {
  if (!value) return "Never";
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return "Never";
  return time.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateTime(value?: string): string {
  if (!value) return "Never";
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return "Never";
  return time.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const AdminTab: React.FC<AdminTabProps> = ({ settings, onSaveSettings }) => {
  const [users, setUsers] = useState<AuthUser[]>(() => getRegisteredUsers());
  const [activeSection, setActiveSection] = useState<"operations" | "community">("operations");
  const [title, setTitle] = useState("Tonight's tiny mission");
  const [message, setMessage] = useState("Open today's lesson and finish the task before the day gets away from you.");
  const [tone, setTone] = useState<AdminNotification["tone"]>("update");
  const [expiresAt, setExpiresAt] = useState("");
  const [lessonId, setLessonId] = useState(settings.dailyOverride.lessonId?.toString() || "");
  const [focus, setFocus] = useState(settings.dailyOverride.focus);
  const [note, setNote] = useState(settings.dailyOverride.note);
  const defaultHotTake = settings.dailyHotTake || getTodayHotTake();
  const [hotTakeTopic, setHotTakeTopic] = useState(defaultHotTake.topic);
  const [hotTakeStatement, setHotTakeStatement] = useState(defaultHotTake.statement);
  const [hotTakeSubtext, setHotTakeSubtext] = useState(defaultHotTake.subtext);
  const [hotTakeAgree, setHotTakeAgree] = useState(defaultHotTake.coachInsight.agree);
  const [hotTakeDisagree, setHotTakeDisagree] = useState(defaultHotTake.coachInsight.disagree);
  const [hotTakeComplicated, setHotTakeComplicated] = useState(defaultHotTake.coachInsight.complicated);
  const [hotTakeBonusXp, setHotTakeBonusXp] = useState(defaultHotTake.bonusXp.toString());
  const [notice, setNotice] = useState("");

  const activeNotification = settings.notifications.find((item) => item.isActive);

  const stats = useMemo(() => {
    const totalXp = users.reduce((sum, user) => sum + (user.progress?.xp || 0), 0);
    const completedToday = users.filter(
      (user) => user.progress?.lastCompletedDate === new Date().toDateString()
    ).length;
    const proUsers = users.filter((user) => user.isPro).length;
    const chatMessages = users.reduce((sum, user) => sum + (user.messages?.length || 0), 0);

    return {
      totalUsers: users.length,
      proUsers,
      completedToday,
      avgXp: users.length ? Math.round(totalXp / users.length) : 0,
      chatMessages,
    };
  }, [users]);

  const showSaved = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(""), 2400);
  };

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    const notification: AdminNotification = {
      id: `notification-${Date.now()}`,
      title: title.trim(),
      message: message.trim(),
      tone,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      isActive: true,
    };

    onSaveSettings({
      ...settings,
      notifications: [
        notification,
        ...settings.notifications.map((item) => ({ ...item, isActive: false })),
      ].slice(0, 8),
    });
    showSaved("Notification is live.");
  };

  const handleToggleNotification = (id: string) => {
    onSaveSettings({
      ...settings,
      notifications: settings.notifications.map((item) => ({
        ...item,
        isActive: item.id === id ? !item.isActive : false,
      })),
    });
  };

  const handleSaveDailyOverride = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      ...settings,
      dailyOverride: {
        lessonId: lessonId ? Number(lessonId) : null,
        focus: focus.trim(),
        note: note.trim(),
        updatedAt: new Date().toISOString(),
      },
    });
    showSaved("Daily content updated.");
  };

  const handleSaveHotTake = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotTakeTopic.trim() || !hotTakeStatement.trim() || !hotTakeSubtext.trim()) return;

    const hotTake: AdminHotTakeOverride = {
      topic: hotTakeTopic.trim(),
      statement: hotTakeStatement.trim(),
      subtext: hotTakeSubtext.trim(),
      agreePercent: defaultHotTake.agreePercent,
      disagreePercent: defaultHotTake.disagreePercent,
      complicatedPercent: defaultHotTake.complicatedPercent,
      coachInsight: {
        agree: hotTakeAgree.trim(),
        disagree: hotTakeDisagree.trim(),
        complicated: hotTakeComplicated.trim(),
      },
      bonusXp: Math.max(0, Number(hotTakeBonusXp) || 25),
      updatedAt: new Date().toISOString(),
    };

    onSaveSettings({ ...settings, dailyHotTake: hotTake });
    showSaved("Daily hot take updated.");
  };

  const handleClearHotTake = () => {
    onSaveSettings({ ...settings, dailyHotTake: null });
    const fallback = getTodayHotTake();
    setHotTakeTopic(fallback.topic);
    setHotTakeStatement(fallback.statement);
    setHotTakeSubtext(fallback.subtext);
    setHotTakeAgree(fallback.coachInsight.agree);
    setHotTakeDisagree(fallback.coachInsight.disagree);
    setHotTakeComplicated(fallback.coachInsight.complicated);
    setHotTakeBonusXp(fallback.bonusXp.toString());
    showSaved("Automatic hot take rotation restored.");
  };

  return (
    <div className="space-y-5">
      <div className="bg-[#111] text-white border-[3px] border-black rounded-[24px] p-5 brutal-shadow">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#FFE066] text-black border-[2px] border-white rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck size={13} /> Admin Control
            </div>
            <h1 className="text-[30px] font-black leading-none tracking-tighter mt-3">
              operations panel
            </h1>
            <p className="text-[12px] font-bold opacity-70 mt-1">
              Manage the app, then talk directly to the community.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setUsers(getRegisteredUsers());
              showSaved("Activity refreshed.");
            }}
            className="h-10 px-3 bg-white text-black border-[2.5px] border-white rounded-full font-black text-[11px] uppercase flex items-center gap-1.5"
          >
            <Radio size={14} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            type="button"
            onClick={() => setActiveSection("operations")}
            className={`h-10 rounded-full border-[2.5px] border-white font-black text-[11px] uppercase flex items-center justify-center gap-1.5 ${
              activeSection === "operations" ? "bg-[#FFE066] text-black" : "bg-white/10 text-white/70"
            }`}
          >
            <ShieldCheck size={14} /> Operations
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("community")}
            className={`h-10 rounded-full border-[2.5px] border-white font-black text-[11px] uppercase flex items-center justify-center gap-1.5 ${
              activeSection === "community" ? "bg-[#FDA4AF] text-black" : "bg-white/10 text-white/70"
            }`}
          >
            <MessageSquareText size={14} /> Community
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
          {[
            { label: "Users", value: stats.totalUsers, icon: Users, color: "#FFE066" },
            { label: "Pro", value: stats.proUsers, icon: Crown, color: "#BEF264" },
            { label: "Done Today", value: stats.completedToday, icon: BookOpenCheck, color: "#FDA4AF" },
            { label: "Avg XP", value: stats.avgXp, icon: Sparkles, color: "#A78BFA" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="bg-white text-black border-[2.5px] border-white rounded-[16px] p-3"
              >
                <div
                  className="w-8 h-8 rounded-full border-[2px] border-black flex items-center justify-center mb-2"
                  style={{ background: item.color }}
                >
                  <Icon size={15} strokeWidth={3} />
                </div>
                <div className="font-black text-[20px] leading-none">{item.value}</div>
                <div className="font-black text-[9px] uppercase tracking-widest opacity-60 mt-1">
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {notice && (
        <div className="bg-[#BEF264] border-[3px] border-black rounded-full px-4 py-2 font-black text-[12px] uppercase brutal-shadow-sm">
          {notice}
        </div>
      )}

      <form onSubmit={handleBroadcast} className="bg-white border-[3px] border-black rounded-[24px] p-5 brutal-shadow space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-black text-[18px] tracking-tighter flex items-center gap-2">
              <MessageSquareText size={19} /> Community Broadcast
            </h2>
            <p className="text-[11px] font-bold opacity-60 mt-0.5">
              Send a message that appears at the top of every member's app.
            </p>
          </div>
          {activeNotification && (
            <span className="text-[10px] font-black uppercase bg-[#BEF264] border-[2px] border-black rounded-full px-2.5 py-1">
              Live
            </span>
          )}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={48}
          placeholder="Notification title"
          className="w-full px-4 py-3 bg-[#FFFBEB] border-[2.5px] border-black rounded-[16px] font-black text-[14px] outline-none"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={180}
          placeholder="What should users see?"
          className="w-full min-h-[90px] px-4 py-3 bg-[#FFFBEB] border-[2.5px] border-black rounded-[16px] font-bold text-[13px] outline-none resize-none"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest opacity-60 block mb-1">
              Tone
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as AdminNotification["tone"])}
              className="w-full h-11 bg-white border-[2.5px] border-black rounded-full px-3 font-black text-[12px] outline-none"
            >
              <option value="update">Update</option>
              <option value="warning">Warning</option>
              <option value="win">Win</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest opacity-60 block mb-1">
              Expire At
            </label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full h-11 bg-white border-[2.5px] border-black rounded-full px-3 font-bold text-[12px] outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full h-12 bg-[#FFE066] border-[3px] border-black rounded-full font-black text-[13px] uppercase flex items-center justify-center gap-2 brutal-shadow-sm"
        >
          <BellRing size={16} /> Publish Notification
        </button>
      </form>

      <form onSubmit={handleSaveDailyOverride} className={`${activeSection === "community" ? "hidden " : ""}bg-[#A78BFA] border-[3px] border-black rounded-[24px] p-5 brutal-shadow space-y-4`}>
        <div>
          <h2 className="font-black text-[18px] tracking-tighter flex items-center gap-2">
            <BookOpenCheck size={19} /> Daily Lesson Control
          </h2>
          <p className="text-[11px] font-bold opacity-70 mt-0.5">
            Override the lesson and focus users see today.
          </p>
        </div>

        <select
          value={lessonId}
          onChange={(e) => setLessonId(e.target.value)}
          className="w-full h-12 bg-white border-[2.5px] border-black rounded-[16px] px-3 font-black text-[12px] outline-none"
        >
          <option value="">Use automatic lesson schedule</option>
          {LESSONS.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              Lesson {lesson.id}: {lesson.title}
            </option>
          ))}
        </select>

        <input
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          maxLength={80}
          placeholder="Optional daily focus override"
          className="w-full px-4 py-3 bg-white border-[2.5px] border-black rounded-[16px] font-bold text-[13px] outline-none"
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={160}
          placeholder="Optional admin note shown with today's lesson"
          className="w-full min-h-[80px] px-4 py-3 bg-white border-[2.5px] border-black rounded-[16px] font-bold text-[13px] outline-none resize-none"
        />

        <button
          type="submit"
          className="w-full h-12 bg-[#111] text-white border-[3px] border-black rounded-full font-black text-[13px] uppercase flex items-center justify-center gap-2"
        >
          <Save size={16} /> Save Daily Content
        </button>
      </form>

      <form onSubmit={handleSaveHotTake} className={`${activeSection === "community" ? "hidden " : ""}bg-[#FDA4AF] border-[3px] border-black rounded-[24px] p-5 brutal-shadow space-y-4`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-black text-[18px] tracking-tighter flex items-center gap-2">
              <Flame size={19} /> Daily Hot Take
            </h2>
            <p className="text-[11px] font-bold opacity-70 mt-0.5">
              Replace today's debate prompt, statement, and coach verdicts.
            </p>
          </div>
          {settings.dailyHotTake && (
            <span className="text-[10px] font-black uppercase bg-white border-[2px] border-black rounded-full px-2.5 py-1">
              Custom live
            </span>
          )}
        </div>

        <input value={hotTakeTopic} onChange={(e) => setHotTakeTopic(e.target.value)} maxLength={48} placeholder="Topic" className="w-full px-4 py-3 bg-white border-[2.5px] border-black rounded-[16px] font-black text-[14px] outline-none" />
        <textarea value={hotTakeStatement} onChange={(e) => setHotTakeStatement(e.target.value)} maxLength={180} placeholder="The hot take statement" className="w-full min-h-[86px] px-4 py-3 bg-white border-[2.5px] border-black rounded-[16px] font-bold text-[13px] outline-none resize-none" />
        <textarea value={hotTakeSubtext} onChange={(e) => setHotTakeSubtext(e.target.value)} maxLength={160} placeholder="Short context shown below the statement" className="w-full min-h-[70px] px-4 py-3 bg-white border-[2.5px] border-black rounded-[16px] font-bold text-[13px] outline-none resize-none" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <textarea value={hotTakeAgree} onChange={(e) => setHotTakeAgree(e.target.value)} placeholder="Agree verdict" className="w-full min-h-[90px] px-3 py-2 bg-white border-[2.5px] border-black rounded-[14px] font-bold text-[12px] outline-none resize-none" />
          <textarea value={hotTakeDisagree} onChange={(e) => setHotTakeDisagree(e.target.value)} placeholder="Disagree verdict" className="w-full min-h-[90px] px-3 py-2 bg-white border-[2.5px] border-black rounded-[14px] font-bold text-[12px] outline-none resize-none" />
          <textarea value={hotTakeComplicated} onChange={(e) => setHotTakeComplicated(e.target.value)} placeholder="Complicated verdict" className="w-full min-h-[90px] px-3 py-2 bg-white border-[2.5px] border-black rounded-[14px] font-bold text-[12px] outline-none resize-none" />
        </div>

        <div className="flex gap-3">
          <input type="number" min="0" max="100" value={hotTakeBonusXp} onChange={(e) => setHotTakeBonusXp(e.target.value)} aria-label="Hot take bonus XP" className="w-28 h-11 bg-white border-[2.5px] border-black rounded-full px-3 font-black text-[12px] outline-none" />
          <button type="submit" className="flex-1 h-11 bg-[#111] text-white border-[3px] border-black rounded-full font-black text-[12px] uppercase flex items-center justify-center gap-2">
            <Save size={15} /> Publish Hot Take
          </button>
          {settings.dailyHotTake && (
            <button type="button" onClick={handleClearHotTake} className="h-11 px-4 bg-white border-[2.5px] border-black rounded-full font-black text-[11px] uppercase">
              Restore
            </button>
          )}
        </div>
      </form>

      <div className={`${activeSection === "community" ? "hidden " : ""}bg-white border-[3px] border-black rounded-[24px] p-5 brutal-shadow`}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-black text-[18px] tracking-tighter flex items-center gap-2">
              <Users size={19} /> User Activity
            </h2>
            <p className="text-[11px] font-bold opacity-60 mt-0.5">
              Local registered users, progress, streaks, and recent activity.
            </p>
          </div>
          <div className="bg-black text-white border-[2px] border-black rounded-full px-3 py-1 text-[10px] font-black uppercase">
            {stats.chatMessages} chats
          </div>
        </div>

        <div className="space-y-3">
          {users.map((user) => (
            <div key={user.id} className="bg-[#FFFBEB] border-[2.5px] border-black rounded-[18px] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-[14px] truncate">@{user.username}</span>
                    {user.isPro && (
                      <span className="bg-[#FFE066] border-[1.5px] border-black rounded-full px-2 py-0.5 text-[9px] font-black uppercase flex items-center gap-1">
                        <Crown size={10} /> Pro
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-bold opacity-60 truncate">{user.email}</div>
                  <div className="text-[11px] font-black opacity-75 mt-1">
                    {user.profile?.name || user.name}{user.profile?.age ? ` • ${user.profile.age}` : ""}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-black text-[16px] leading-none">{user.progress?.xp || 0}</div>
                  <div className="text-[9px] font-black uppercase opacity-60">XP</div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                <div className="bg-white border-[1.5px] border-black rounded-[12px] p-2">
                  <div className="text-[9px] font-black uppercase opacity-50">Streak</div>
                  <div className="font-black text-[13px]">{user.progress?.streak || 0} days</div>
                </div>
                <div className="bg-white border-[1.5px] border-black rounded-[12px] p-2">
                  <div className="text-[9px] font-black uppercase opacity-50">Lessons</div>
                  <div className="font-black text-[13px]">{user.progress?.lessonsViewed?.length || 0}</div>
                </div>
                <div className="bg-white border-[1.5px] border-black rounded-[12px] p-2">
                  <div className="text-[9px] font-black uppercase opacity-50">Journal</div>
                  <div className="font-black text-[13px]">{user.progress?.journal?.length || 0}</div>
                </div>
                <div className="bg-white border-[1.5px] border-black rounded-[12px] p-2">
                  <div className="text-[9px] font-black uppercase opacity-50">Chats</div>
                  <div className="font-black text-[13px]">{user.messages?.filter((m) => m.role === "user").length || 0}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-3 text-[10px] font-bold opacity-70 flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock size={11} /> Login {formatDateTime(user.lastLoginAt)}
                </span>
                <span className="flex items-center gap-1">
                  <BookOpenCheck size={11} /> Last lesson {formatDate(user.progress?.lastCompletedDate || undefined)}
                </span>
                <span className="flex items-center gap-1">
                  <Eye size={11} /> Goal {user.profile?.goal || "unknown"}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle size={11} /> Vibe {user.profile?.vibe || "unset"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {settings.notifications.length > 0 && (
        <div className={`${activeSection === "community" ? "hidden " : ""}bg-[#FFE066] border-[3px] border-black rounded-[24px] p-5 brutal-shadow`}>
          <h2 className="font-black text-[16px] mb-3">Notification History</h2>
          <div className="space-y-2">
            {settings.notifications.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleToggleNotification(item.id)}
                className="w-full bg-white border-[2px] border-black rounded-[16px] p-3 text-left flex items-start gap-3"
              >
                {item.isActive ? <ToggleRight size={22} className="text-[#16A34A] shrink-0" /> : <ToggleLeft size={22} className="opacity-50 shrink-0" />}
                <span className="flex-1 min-w-0">
                  <span className="block font-black text-[13px]">{item.title}</span>
                  <span className="block text-[11px] font-bold opacity-60 line-clamp-2">{item.message}</span>
                </span>
                <span className="text-[9px] font-black uppercase opacity-50 shrink-0">
                  {formatDate(item.createdAt)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
