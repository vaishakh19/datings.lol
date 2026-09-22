import React, { useMemo, useState } from "react";
import {
  Activity,
  BellRing,
  BookOpenCheck,
  Check,
  ChevronRight,
  Copy,
  Eye,
  Flame,
  Megaphone,
  RefreshCcw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCog,
  Users,
  Zap,
  Radio,
  Database,
  Gauge,
  AlertTriangle,
  Crown,
  MessageCircle,
  ToggleLeft,
} from "lucide-react";
import { AdminHotTakeOverride, AdminNotification, AdminSettings, AuthUser } from "../types";
import { LESSONS } from "../data/lessons";
import { getTodayHotTake } from "../data/hotTakes";
import { getRegisteredUsers } from "../utils/authStorage";

interface AdminTabProps {
  settings: AdminSettings;
  onSaveSettings: (settings: AdminSettings) => void;
}

type AdminSection = "operations" | "users" | "today" | "community" | "analytics" | "system";
type FeatureState = "ON" | "OFF" | "BETA";

const FEATURE_DEFAULTS: Record<string, FeatureState> = {
  AI_COACH: "ON",
  SCREENSHOT_ANALYSIS: "ON",
  AI_SIMULATOR: "BETA",
  COMMUNITY: "ON",
  DAILY_TASKS: "ON",
  PROFILE_AUDIT: "ON",
  JOURNAL: "ON",
  ACHIEVEMENTS: "ON",
  PAYWALL: "ON",
};

const PRO_PRICE = 9; // $9/mo

function formatDate(value?: string): string {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Never"
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown"
    : date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function saveAudit(action: string, target: string, metadata: Record<string, unknown> = {}) {
  const key = "datings_admin_audit_logs";
  const current = (() => {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  })();
  const next = [
    {
      id: `audit-${Date.now()}`,
      action,
      target,
      metadata,
      createdAt: new Date().toISOString(),
    },
    ...current,
  ].slice(0, 100);
  localStorage.setItem(key, JSON.stringify(next));
}

function loadAudits() {
  try {
    return JSON.parse(localStorage.getItem("datings_admin_audit_logs") || "[]");
  } catch {
    return [];
  }
}

function persistUsers(users: AuthUser[]) {
  // Keep in sync with your authStorage shape
  localStorage.setItem("datings_registered_users", JSON.stringify(users));
}

export const AdminTab: React.FC<AdminTabProps> = ({ settings, onSaveSettings }) => {
  const [section, setSection] = useState<AdminSection>("operations");
  const [users, setUsers] = useState<AuthUser[]>(() => getRegisteredUsers());
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [features, setFeatures] = useState<Record<string, FeatureState>>(() => {
    try {
      return {
        ...FEATURE_DEFAULTS,
        ...JSON.parse(localStorage.getItem("datings_feature_flags") || "{}"),
      };
    } catch {
      return FEATURE_DEFAULTS;
    }
  });

  // Broadcast
  const [title, setTitle] = useState("Tonight's tiny mission");
  const [message, setMessage] = useState(
    "Open today's lesson and finish the task before the day gets away from you."
  );
  const [tone, setTone] = useState<AdminNotification["tone"]>("update");
  const [expiresAt, setExpiresAt] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  // Today controls
  const [lessonId, setLessonId] = useState(settings.dailyOverride.lessonId?.toString() || "");
  const [focus, setFocus] = useState(settings.dailyOverride.focus);
  const [note, setNote] = useState(settings.dailyOverride.note);
  const [taskType, setTaskType] = useState("PRACTICE");
  const [difficulty, setDifficulty] = useState("INTERMEDIATE");
  const [xp, setXp] = useState("25");

  // Hot take
  const [hotTake, setHotTake] = useState<AdminHotTakeOverride>(
    settings.dailyHotTake || getTodayHotTake()
  );

  const showSaved = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2400);
  };

  const refreshUsers = () => {
    setUsers(getRegisteredUsers());
    showSaved("Users refreshed.");
  };

  const stats = useMemo(() => {
    const totalXp = users.reduce((sum, u) => sum + (u.progress?.xp || 0), 0);
    const completedToday = users.filter(
      (u) => u.progress?.lastCompletedDate === new Date().toDateString()
    ).length;
    const activeStreaks = users.filter((u) => (u.progress?.streak || 0) > 0).length;
    const coachMessages = users.reduce(
      (sum, u) => sum + (u.messages?.filter((m) => m.role === "user").length || 0),
      0
    );
    const pro = users.filter((u) => u.isPro).length;
    const audits = Number(localStorage.getItem("datings_profile_audit_count") || 0);
    const teachings = Number(localStorage.getItem("datings_teaching_count") || 0);
    const mrr = pro * PRO_PRICE;
    const conversion = users.length ? Math.round((pro / users.length) * 100) : 0;

    return {
      users: users.length,
      pro,
      completedToday,
      avgXp: users.length ? Math.round(totalXp / users.length) : 0,
      activeStreaks,
      coachMessages,
      audits,
      teachings,
      mrr,
      conversion,
    };
  }, [users]);

  const saveBroadcast = (publish: boolean) => {
    if (!title.trim() || !message.trim()) {
      return showSaved("Add a title and message first.");
    }
    const notification: AdminNotification = {
      id: `notification-${Date.now()}`,
      title: title.trim(),
      message: message.trim(),
      tone,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      isActive: publish,
    };
    onSaveSettings({
      ...settings,
      notifications: [notification, ...settings.notifications].slice(0, 20),
    });
    saveAudit(publish ? "PUBLISHED BROADCAST" : "SAVED BROADCAST DRAFT", notification.id, {
      tone,
    });
    showSaved(publish ? "Broadcast is live." : "Draft saved.");
  };

  const saveToday = (event: React.FormEvent) => {
    event.preventDefault();
    onSaveSettings({
      ...settings,
      dailyOverride: {
        lessonId: lessonId ? Number(lessonId) : null,
        focus: focus.trim(),
        note: `${note.trim()}${note.trim() ? "\n" : ""}Task type: ${taskType} • ${difficulty} • +${Math.max(
          0,
          Number(xp) || 0
        )} XP`,
        updatedAt: new Date().toISOString(),
      },
    });
    saveAudit("UPDATED DAILY LESSON", lessonId || "automatic", { taskType, difficulty, xp });
    showSaved("Today control published.");
  };

  const saveHotTake = (event: React.FormEvent) => {
    event.preventDefault();
    onSaveSettings({
      ...settings,
      dailyHotTake: { ...hotTake, updatedAt: new Date().toISOString() },
    });
    saveAudit("UPDATED HOT TAKE", hotTake.topic);
    showSaved("Hot take published.");
  };

  const toggleFeature = (key: string) => {
    const nextState: FeatureState =
      features[key] === "ON" ? "BETA" : features[key] === "BETA" ? "OFF" : "ON";
    const next = { ...features, [key]: nextState };
    setFeatures(next);
    localStorage.setItem("datings_feature_flags", JSON.stringify(next));
    saveAudit("CHANGED FEATURE FLAG", key, { state: nextState });
    showSaved(`${key.replaceAll("_", " ")} → ${nextState}`);
  };

  const togglePro = (userId: string) => {
    const next = users.map((u) =>
      u.id === userId ? { ...u, isPro: !u.isPro } : u
    );
    setUsers(next);
    persistUsers(next);
    const target = next.find((u) => u.id === userId);
    saveAudit(target?.isPro ? "GRANTED PRO" : "REVOKED PRO", target?.username || userId);
    showSaved(target?.isPro ? `Pro granted to @${target.username}` : `Pro removed`);
  };

  const resetUserProgress = (userId: string) => {
    if (!confirm("Reset XP, streak, and level for this user?")) return;
    const next = users.map((u) =>
      u.id === userId
        ? {
            ...u,
            progress: {
              ...(u.progress || {}),
              xp: 0,
              streak: 0,
              level: 1,
              lastCompletedDate: undefined,
            },
          }
        : u
    );
    setUsers(next);
    persistUsers(next);
    saveAudit("RESET USER PROGRESS", userId);
    showSaved("User progress reset.");
  };

  const copyId = async (id: string) => {
    await navigator.clipboard.writeText(id);
    showSaved("User ID copied.");
  };

  const filteredUsers = users.filter((user) =>
    `${user.username} ${user.email} ${user.id}`.toLowerCase().includes(search.toLowerCase())
  );

  const audits = loadAudits();

  const nav = [
    ["operations", "Ops", ShieldCheck],
    ["users", "Users", Users],
    ["today", "Today", BookOpenCheck],
    ["community", "Community", Megaphone],
    ["analytics", "Analytics", Activity],
    ["system", "System", Settings2],
  ] as const;

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <section className="bg-black text-white border-[3px] border-black rounded-[24px] p-5 brutal-shadow">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#FFE066] text-black border-[2px] border-white rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck size={13} /> Admin control
            </div>
            <h1 className="text-[28px] sm:text-[30px] font-black leading-none tracking-tighter mt-3">
              operations panel
            </h1>
            <p className="text-[12px] font-bold opacity-70 mt-1">
              Run the product. Talk to users. Ship daily.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshUsers}
            className="h-10 px-3 bg-white text-black border-[2.5px] border-white rounded-full font-black text-[11px] uppercase flex items-center gap-1.5 shrink-0"
          >
            <RefreshCcw size={14} /> Refresh
          </button>
        </div>

        {/* Mini MRR strip */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="bg-white/10 border border-white/30 rounded-[14px] p-3">
            <div className="text-[9px] font-black uppercase opacity-60">Est. MRR</div>
            <div className="font-black text-[20px] text-[#FFE066]">${stats.mrr}</div>
          </div>
          <div className="bg-white/10 border border-white/30 rounded-[14px] p-3">
            <div className="text-[9px] font-black uppercase opacity-60">Pro users</div>
            <div className="font-black text-[20px]">{stats.pro}</div>
          </div>
          <div className="bg-white/10 border border-white/30 rounded-[14px] p-3">
            <div className="text-[9px] font-black uppercase opacity-60">Conv.</div>
            <div className="font-black text-[20px]">{stats.conversion}%</div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-none mt-5">
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`shrink-0 h-10 px-3 rounded-full border-[2.5px] border-white font-black text-[10px] uppercase flex items-center gap-1.5 ${
                section === id ? "bg-[#FFE066] text-black" : "bg-white/10 text-white/70"
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </section>

      {notice && (
        <div className="bg-[#BEF264] border-[3px] border-black rounded-full px-4 py-2 font-black text-[12px] uppercase brutal-shadow-sm">
          {notice}
        </div>
      )}

      {section === "operations" && (
        <Operations stats={stats} onSection={setSection} audits={audits} />
      )}
      {section === "users" && (
        <UsersSection
          users={filteredUsers}
          search={search}
          setSearch={setSearch}
          onTogglePro={togglePro}
          onReset={resetUserProgress}
          onCopyId={copyId}
        />
      )}
      {section === "today" && (
        <TodaySection
          lessonId={lessonId}
          setLessonId={setLessonId}
          focus={focus}
          setFocus={setFocus}
          note={note}
          setNote={setNote}
          taskType={taskType}
          setTaskType={setTaskType}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          xp={xp}
          setXp={setXp}
          saveToday={saveToday}
        />
      )}
      {section === "community" && (
        <CommunitySection
          title={title}
          setTitle={setTitle}
          message={message}
          setMessage={setMessage}
          tone={tone}
          setTone={setTone}
          expiresAt={expiresAt}
          setExpiresAt={setExpiresAt}
          showPreview={showPreview}
          setShowPreview={setShowPreview}
          saveBroadcast={saveBroadcast}
          settings={settings}
          hotTake={hotTake}
          setHotTake={setHotTake}
          saveHotTake={saveHotTake}
        />
      )}
      {section === "analytics" && <Analytics stats={stats} users={users} />}
      {section === "system" && (
        <SystemSection features={features} toggleFeature={toggleFeature} audits={audits} />
      )}
    </div>
  );
};

/* ───────────────────────── SECTIONS ───────────────────────── */

function Operations({
  stats,
  onSection,
  audits,
}: {
  stats: Record<string, number>;
  onSection: (section: AdminSection) => void;
  audits: any[];
}) {
  const cards = [
    ["Users", stats.users, Users, "#FFE066"],
    ["Pro", stats.pro, Crown, "#BEF264"],
    ["MRR", `$${stats.mrr}`, Zap, "#A78BFA"],
    ["Done today", stats.completedToday, Check, "#FDA4AF"],
    ["Coach msgs", stats.coachMessages, MessageCircle, "#FFE066"],
    ["Streaks", stats.activeStreaks, Flame, "#FDA4AF"],
  ] as const;

  return (
    <>
      <section className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {cards.map(([label, value, Icon, color]) => (
          <div
            key={label}
            className="bg-white border-[3px] border-black rounded-[16px] p-3 brutal-shadow-sm"
          >
            <div
              className="w-8 h-8 rounded-full border-[2px] border-black flex items-center justify-center mb-2"
              style={{ background: color }}
            >
              <Icon size={15} />
            </div>
            <div className="font-black text-[22px] leading-none">{value}</div>
            <div className="font-black text-[9px] uppercase tracking-widest opacity-60 mt-1">
              {label}
            </div>
          </div>
        ))}
      </section>

      <section className="bg-[#FFE066] border-[3px] border-black rounded-[24px] p-5 brutal-shadow mt-4">
        <h2 className="font-black text-[18px] tracking-tight">Quick actions</h2>
        <div className="grid grid-cols-2 gap-2 mt-3">
          {(
            [
              ["Publish teaching", "community", Megaphone],
              ["Set daily lesson", "today", BookOpenCheck],
              ["Send broadcast", "community", BellRing],
              ["Manage users", "users", Users],
              ["View analytics", "analytics", Activity],
              ["System / flags", "system", Settings2],
            ] as const
          ).map(([label, target, Icon]) => (
            <button
              key={label}
              type="button"
              onClick={() => onSection(target)}
              className="min-h-12 bg-white border-[2px] border-black rounded-[14px] px-3 py-2 text-left font-black text-[11px] uppercase flex items-center gap-2"
            >
              <Icon size={15} /> {label}
              <ChevronRight size={14} className="ml-auto" />
            </button>
          ))}
        </div>
      </section>

      <section className="bg-white border-[3px] border-black rounded-[24px] p-5 brutal-shadow mt-4">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-[17px]">Recent operations</h2>
          <span className="text-[10px] font-black uppercase opacity-50">
            {audits.length} logged
          </span>
        </div>
        {audits.length ? (
          <div className="space-y-2 mt-3">
            {audits.slice(0, 6).map((audit) => (
              <div
                key={audit.id}
                className="bg-[#FFFBEB] border-[2px] border-black rounded-[12px] p-3 flex justify-between gap-3"
              >
                <div>
                  <div className="font-black text-[11px] uppercase">{audit.action}</div>
                  <div className="font-bold normal-case opacity-60 mt-1 text-[11px]">
                    {audit.target}
                  </div>
                </div>
                <span className="text-[10px] font-bold opacity-50 shrink-0">
                  {formatDateTime(audit.createdAt)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty text="No admin actions logged yet." />
        )}
      </section>
    </>
  );
}

function UsersSection({
  users,
  search,
  setSearch,
  onTogglePro,
  onReset,
  onCopyId,
}: {
  users: AuthUser[];
  search: string;
  setSearch: (value: string) => void;
  onTogglePro: (id: string) => void;
  onReset: (id: string) => void;
  onCopyId: (id: string) => void;
}) {
  return (
    <section className="bg-white border-[3px] border-black rounded-[24px] p-5 brutal-shadow">
      <div className="flex justify-between items-center gap-3">
        <div>
          <h2 className="font-black text-[20px]">Users</h2>
          <p className="text-[11px] font-bold opacity-60">
            Grant Pro, reset progress, inspect activity.
          </p>
        </div>
        <span className="bg-[#BEF264] border-[2px] border-black rounded-full px-2 py-1 text-[10px] font-black">
          {users.length} shown
        </span>
      </div>

      <label className="h-10 border-[2px] border-black rounded-full px-3 flex items-center gap-2 bg-[#FFFBEB] mt-4">
        <Search size={15} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="username, email, or ID"
          className="bg-transparent outline-none w-full text-[12px] font-bold"
        />
      </label>

      <div className="space-y-2 mt-4">
        {users.length === 0 && <Empty text="No users match this search." />}
        {users.map((user) => (
          <div
            key={user.id}
            className="bg-[#FFFBEB] border-[2px] border-black rounded-[14px] p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-black text-[13px] flex items-center gap-1.5 flex-wrap">
                  @{user.username}
                  {user.isPro && (
                    <span className="bg-[#FFE066] border border-black rounded-full px-1.5 text-[8px]">
                      PRO
                    </span>
                  )}
                </div>
                <div className="text-[10px] font-bold opacity-60 truncate">{user.email}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-black text-[13px]">{user.progress?.xp || 0} XP</div>
                <div className="text-[9px] font-black uppercase opacity-50">
                  {user.progress?.streak || 0} streak
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onTogglePro(user.id)}
                className="h-8 px-2.5 bg-white border-[1.5px] border-black rounded-full text-[9px] font-black uppercase flex items-center gap-1"
              >
                <Crown size={12} /> {user.isPro ? "Revoke Pro" : "Make Pro"}
              </button>
              <button
                type="button"
                onClick={() => onCopyId(user.id)}
                className="h-8 px-2.5 bg-white border-[1.5px] border-black rounded-full text-[9px] font-black uppercase flex items-center gap-1"
              >
                <Copy size={12} /> ID
              </button>
              <button
                type="button"
                onClick={() => onReset(user.id)}
                className="h-8 px-2.5 bg-[#FDA4AF] border-[1.5px] border-black rounded-full text-[9px] font-black uppercase flex items-center gap-1"
              >
                <Trash2 size={12} /> Reset XP
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TodaySection({
  lessonId,
  setLessonId,
  focus,
  setFocus,
  note,
  setNote,
  taskType,
  setTaskType,
  difficulty,
  setDifficulty,
  xp,
  setXp,
  saveToday,
}: any) {
  return (
    <form
      onSubmit={saveToday}
      className="bg-[#A78BFA] border-[3px] border-black rounded-[24px] p-5 brutal-shadow space-y-4"
    >
      <div>
        <h2 className="font-black text-[20px]">Daily lesson control</h2>
        <p className="text-[11px] font-bold opacity-70">
          Override what every user sees on the Today tab.
        </p>
      </div>

      <select
        value={lessonId}
        onChange={(e) => setLessonId(e.target.value)}
        className="w-full h-11 bg-white border-[2px] border-black rounded-full px-3 font-black text-[12px]"
      >
        <option value="">Automatic task engine</option>
        {LESSONS.map((lesson) => (
          <option key={lesson.id} value={lesson.id}>
            Lesson {lesson.id}: {lesson.title}
          </option>
        ))}
      </select>

      <div className="grid sm:grid-cols-3 gap-2">
        <select
          value={taskType}
          onChange={(e) => setTaskType(e.target.value)}
          className="h-11 bg-white border-[2px] border-black rounded-full px-3 font-black text-[11px]"
        >
          <option>LEARN</option>
          <option>PRACTICE</option>
          <option>SIMULATION</option>
          <option>REAL_WORLD</option>
          <option>REVIEW</option>
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="h-11 bg-white border-[2px] border-black rounded-full px-3 font-black text-[11px]"
        >
          <option>BEGINNER</option>
          <option>INTERMEDIATE</option>
          <option>ADVANCED</option>
          <option>BRUTAL</option>
        </select>
        <input
          type="number"
          min="0"
          max="500"
          value={xp}
          onChange={(e) => setXp(e.target.value)}
          className="h-11 bg-white border-[2px] border-black rounded-full px-3 font-black text-[11px]"
          aria-label="XP reward"
          placeholder="XP"
        />
      </div>

      <input
        value={focus}
        onChange={(e) => setFocus(e.target.value)}
        placeholder="Today's focus headline"
        className="w-full h-11 bg-white border-[2px] border-black rounded-[14px] px-3 font-bold text-[12px]"
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Admin note / coach recommendation shown to users"
        className="w-full min-h-24 bg-white border-[2px] border-black rounded-[14px] p-3 font-bold text-[12px] resize-none"
      />

      <div className="bg-white border-[2px] border-black rounded-[16px] p-3">
        <div className="text-[10px] font-black uppercase">Live preview</div>
        <div className="font-black text-[19px] mt-1">
          {focus || "Today's personalized mission"}
        </div>
        <div className="text-[11px] font-bold opacity-70 mt-1">
          {note || "The task engine will personalize the final wording."}
        </div>
        <span className="inline-block bg-[#FFE066] border border-black rounded-full px-2 py-1 text-[9px] font-black mt-2">
          +{xp} XP • {difficulty} • {taskType}
        </span>
      </div>

      <button
        type="submit"
        className="w-full h-11 bg-black text-white border-[2px] border-black rounded-full font-black text-[12px] uppercase"
      >
        <Save size={15} className="inline mr-1" /> Save & publish today
      </button>
    </form>
  );
}

function CommunitySection({
  title,
  setTitle,
  message,
  setMessage,
  tone,
  setTone,
  expiresAt,
  setExpiresAt,
  showPreview,
  setShowPreview,
  saveBroadcast,
  settings,
  hotTake,
  setHotTake,
  saveHotTake,
}: any) {
  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveBroadcast(true);
        }}
        className="bg-white border-[3px] border-black rounded-[24px] p-5 brutal-shadow space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-black text-[20px]">Community broadcast</h2>
            <p className="text-[11px] font-bold opacity-60">
              Push a banner to every user. Preview first.
            </p>
          </div>
          {settings.notifications.some((item: AdminNotification) => item.isActive) && (
            <span className="bg-[#BEF264] border-[2px] border-black rounded-full px-2 py-1 text-[9px] font-black uppercase shrink-0">
              Live
            </span>
          )}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={48}
          placeholder="Broadcast title"
          className="w-full h-11 bg-[#FFFBEB] border-[2px] border-black rounded-[14px] px-3 font-black text-[13px]"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={180}
          placeholder="Broadcast message (max 180 chars)"
          className="w-full min-h-24 bg-[#FFFBEB] border-[2px] border-black rounded-[14px] p-3 font-bold text-[12px] resize-none"
        />

        <div className="grid sm:grid-cols-2 gap-2">
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="h-10 bg-white border-[2px] border-black rounded-full px-3 font-black text-[11px]"
          >
            <option value="update">Update</option>
            <option value="warning">Warning</option>
            <option value="win">Celebration</option>
          </select>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="h-10 bg-white border-[2px] border-black rounded-full px-3 font-bold text-[11px]"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowPreview((v: boolean) => !v)}
            className="h-10 px-3 bg-[#FFFBEB] border-[2px] border-black rounded-full font-black text-[10px] uppercase"
          >
            <Eye size={13} className="inline mr-1" /> Preview
          </button>
          <button
            type="button"
            onClick={() => saveBroadcast(false)}
            className="h-10 px-3 bg-white border-[2px] border-black rounded-full font-black text-[10px] uppercase"
          >
            <Save size={13} className="inline mr-1" /> Draft
          </button>
          <button
            type="submit"
            className="h-10 px-3 bg-[#FFE066] border-[2px] border-black rounded-full font-black text-[10px] uppercase"
          >
            <Radio size={13} className="inline mr-1" /> Publish
          </button>
        </div>

        {showPreview && (
          <div
            className={`border-[2px] border-black rounded-[16px] p-3 ${
              tone === "warning"
                ? "bg-[#FDA4AF]"
                : tone === "win"
                ? "bg-[#BEF264]"
                : "bg-[#FFE066]"
            }`}
          >
            <div className="text-[9px] font-black uppercase">Preview • {tone}</div>
            <div className="font-black text-[16px] mt-1">{title || "Untitled broadcast"}</div>
            <p className="text-[12px] font-bold mt-1">
              {message || "Your message appears here."}
            </p>
          </div>
        )}
      </form>

      <form
        onSubmit={saveHotTake}
        className="bg-[#FDA4AF] border-[3px] border-black rounded-[24px] p-5 brutal-shadow space-y-3"
      >
        <h2 className="font-black text-[18px]">Daily hot take</h2>
        <p className="text-[11px] font-bold opacity-70 -mt-1">
          One sharp idea the whole community sees today.
        </p>
        <input
          value={hotTake.topic}
          onChange={(e) => setHotTake({ ...hotTake, topic: e.target.value })}
          placeholder="Topic"
          className="w-full h-10 bg-white border-[2px] border-black rounded-full px-3 font-black text-[12px]"
        />
        <textarea
          value={hotTake.statement}
          onChange={(e) => setHotTake({ ...hotTake, statement: e.target.value })}
          placeholder="The take itself"
          className="w-full min-h-20 bg-white border-[2px] border-black rounded-[14px] p-3 font-bold text-[12px] resize-none"
        />
        <button
          type="submit"
          className="h-10 px-4 bg-black text-white border-[2px] border-black rounded-full font-black text-[11px] uppercase"
        >
          <Save size={13} className="inline mr-1" /> Publish hot take
        </button>
      </form>
    </div>
  );
}

function Analytics({ stats, users }: { stats: Record<string, number>; users: AuthUser[] }) {
  const avgStreak = users.length
    ? Math.round(users.reduce((sum, u) => sum + (u.progress?.streak || 0), 0) / users.length)
    : 0;

  const topUsers = [...users]
    .sort((a, b) => (b.progress?.xp || 0) - (a.progress?.xp || 0))
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <section className="bg-white border-[3px] border-black rounded-[24px] p-5 brutal-shadow">
        <h2 className="font-black text-[20px]">Analytics snapshot</h2>
        <p className="text-[11px] font-bold opacity-60">
          Local activity only. Wire Supabase events later for real retention cohorts.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
          {(
            [
              ["Users", stats.users],
              ["Pro", stats.pro],
              ["Est. MRR", `$${stats.mrr}`],
              ["Conversion", `${stats.conversion}%`],
              ["Coach messages", stats.coachMessages],
              ["Avg XP", stats.avgXp],
              ["Avg streak", avgStreak],
              ["Profile audits", stats.audits],
              ["Teachings", stats.teachings],
            ] as const
          ).map(([label, value]) => (
            <div
              key={String(label)}
              className="bg-[#FFFBEB] border-[2px] border-black rounded-[14px] p-3"
            >
              <div className="text-[9px] font-black uppercase opacity-50">{label}</div>
              <div className="font-black text-[22px]">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#BEF264] border-[3px] border-black rounded-[24px] p-5 brutal-shadow">
        <h2 className="font-black text-[17px]">Top XP leaders</h2>
        <div className="space-y-2 mt-3">
          {topUsers.length === 0 && <Empty text="No users yet." />}
          {topUsers.map((u, i) => (
            <div
              key={u.id}
              className="bg-white border-[2px] border-black rounded-[12px] p-3 flex items-center justify-between"
            >
              <div className="font-black text-[12px]">
                #{i + 1} @{u.username}
              </div>
              <div className="font-black text-[12px]">{u.progress?.xp || 0} XP</div>
            </div>
          ))}
        </div>
      </section>

      <div className="bg-black text-white border-[3px] border-black rounded-[18px] p-4 text-[11px] font-bold">
        <AlertTriangle size={14} className="inline mr-1 text-[#FFE066]" />
        Next upgrade: log `coach_sessions`, daily active users, and paywall hits into Supabase
        so this board shows real retention — not just localStorage.
      </div>
    </div>
  );
}

function SystemSection({
  features,
  toggleFeature,
  audits,
}: {
  features: Record<string, FeatureState>;
  toggleFeature: (key: string) => void;
  audits: any[];
}) {
  const health = [
    ["Database", "local storage", true],
    ["Auth", "local auth", true],
    ["AI Coach", "OpenRouter ready", true],
    ["Payments", "Stripe not connected", false],
    ["Scheduler", "not configured", false],
  ] as const;

  return (
    <div className="space-y-4">
      <section className="bg-[#A78BFA] border-[3px] border-black rounded-[24px] p-5 brutal-shadow">
        <h2 className="font-black text-[20px]">Feature flags</h2>
        <p className="text-[11px] font-bold opacity-70">
          Cycle ON → BETA → OFF. Every change is audit-logged.
        </p>
        <div className="space-y-2 mt-4">
          {Object.entries(features).map(([key, state]) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleFeature(key)}
              className="w-full bg-white border-[2px] border-black rounded-[14px] p-3 flex items-center justify-between"
            >
              <span className="font-black text-[12px] flex items-center gap-2">
                <ToggleLeft size={14} /> {key.replaceAll("_", " ")}
              </span>
              <span
                className={`px-2 py-1 rounded-full border-[1.5px] border-black text-[9px] font-black ${
                  state === "ON"
                    ? "bg-[#BEF264]"
                    : state === "BETA"
                    ? "bg-[#FFE066]"
                    : "bg-[#FDA4AF]"
                }`}
              >
                {state}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="bg-black text-white border-[3px] border-black rounded-[24px] p-5 brutal-shadow">
        <h2 className="font-black text-[18px] flex items-center gap-2">
          <Gauge size={18} /> System health
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          {health.map(([label, value, ok]) => (
            <div key={label} className="bg-white/10 border border-white rounded-[12px] p-3">
              <div className="text-[9px] font-black uppercase opacity-60">{label}</div>
              <div className="font-black text-[12px] flex items-center gap-1.5 mt-1">
                <span
                  className={`w-2 h-2 rounded-full border border-black ${
                    ok ? "bg-[#BEF264]" : "bg-[#FDA4AF]"
                  }`}
                />
                {value}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border-[3px] border-black rounded-[24px] p-5 brutal-shadow">
        <div className="flex items-center justify-between">
          <h2 className="font-black text-[18px]">Audit log</h2>
          <span className="text-[10px] font-black uppercase opacity-50">{audits.length}</span>
        </div>
        {audits.length ? (
          <div className="space-y-2 mt-3 max-h-80 overflow-y-auto">
            {audits.slice(0, 30).map((audit) => (
              <div key={audit.id} className="border-[2px] border-black rounded-[12px] p-3">
                <div className="font-black text-[11px] uppercase">{audit.action}</div>
                <div className="text-[10px] font-bold opacity-60">
                  {audit.target} • {formatDateTime(audit.createdAt)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty text="No admin actions logged yet." />
        )}
      </section>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center py-8 text-[12px] font-bold opacity-60">{text}</div>;
}