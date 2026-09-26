import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BellRing,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Command,
  Crown,
  Database,
  ExternalLink,
  Eye,
  Flag,
  Flame,
  Gauge,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Megaphone,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Radio,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserRoundCog,
  Users,
  X,
  Zap,
} from "lucide-react";
import { AdminHotTakeOverride, AdminSettings, AuthUser } from "../types";
import { LESSONS } from "../data/lessons";
import { getTodayHotTake } from "../data/hotTakes";
import {
  AdminApiError,
  AdminAuditEntry,
  AdminBroadcast,
  AdminDailyConfig,
  AdminFeatureFlag,
  AdminOverviewData,
  AdminSection,
  AdminUserRow,
  archiveAdminBroadcast,
  createAdminBroadcast,
  getAdminOverview,
  getAdminUsers,
  resetAdminUserProgress,
  setAdminUserPlan,
  updateAdminDailyConfig,
  updateAdminFeature,
  updateAdminHotTake,
} from "../lib/adminApi";

interface AdminTabProps {
  settings: AdminSettings;
  onSaveSettings: (settings: AdminSettings) => void;
  currentUser: AuthUser | null;
  onExit: () => void;
  onSignOut: () => void;
}

type ToastTone = "success" | "error" | "info";
type ConfirmAction = { type: "reset"; user: AdminUserRow } | { type: "archive"; broadcast: AdminBroadcast };

const NAV_ITEMS: Array<{
  id: AdminSection;
  label: string;
  helper: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}> = [
  { id: "overview", label: "Overview", helper: "Live pulse", icon: LayoutDashboard },
  { id: "users", label: "Members", helper: "Access & plans", icon: Users },
  { id: "content", label: "Daily content", helper: "Mission & hot take", icon: BookOpenCheck },
  { id: "broadcasts", label: "Broadcasts", helper: "User messaging", icon: Megaphone },
  { id: "features", label: "Feature flags", helper: "Rollouts", icon: Flag },
  { id: "audit", label: "Audit log", helper: "Accountability", icon: ShieldCheck },
];

const SECTION_COPY: Record<AdminSection, { eyebrow: string; title: string; description: string }> = {
  overview: {
    eyebrow: "Command center",
    title: "Good morning, operator.",
    description: "Here’s what is happening across datings.lol right now.",
  },
  users: {
    eyebrow: "Member operations",
    title: "Users & access",
    description: "Search accounts, manage Pro access, and resolve progress issues.",
  },
  content: {
    eyebrow: "Programming desk",
    title: "Daily content",
    description: "Control the mission and conversation the whole community sees today.",
  },
  broadcasts: {
    eyebrow: "Communication",
    title: "Broadcast center",
    description: "Draft and publish concise, high-signal announcements to every member.",
  },
  features: {
    eyebrow: "Release controls",
    title: "Feature flags",
    description: "Change availability and rollout safely without a new deployment.",
  },
  audit: {
    eyebrow: "Governance",
    title: "Audit log",
    description: "An immutable view of sensitive actions taken in this workspace.",
  },
};

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatDateTime(value?: string): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelative(value?: string): string {
  if (!value) return "never";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "unknown";
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function humanize(value: string): string {
  return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\w/g, (letter) => letter.toUpperCase());
}

function getInitials(name: string): string {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

export const AdminTab: React.FC<AdminTabProps> = ({
  settings,
  onSaveSettings,
  currentUser,
  onExit,
  onSignOut,
}) => {
  const [section, setSection] = useState<AdminSection>("overview");
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [actionKey, setActionKey] = useState("");

  const notify = useCallback((message: string, tone: ToastTone = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const load = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const [nextOverview, nextUsers] = await Promise.all([getAdminOverview(), getAdminUsers()]);
      setOverview(nextOverview);
      setUsers(nextUsers);
    } catch (loadError) {
      const message =
        loadError instanceof AdminApiError
          ? loadError.message
          : "The command center could not reach the admin API.";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (key: string, action: () => Promise<void>, success: string) => {
    setActionKey(key);
    try {
      await action();
      notify(success);
    } catch (actionError) {
      notify(
        actionError instanceof AdminApiError ? actionError.message : "That action could not be completed.",
        "error",
      );
    } finally {
      setActionKey("");
    }
  };

  const handlePlanChange = async (user: AdminUserRow) => {
    const nextIsPro = !user.isPro;
    await runAction(
      `plan-${user.id}`,
      async () => {
        await setAdminUserPlan(user.id, nextIsPro);
        setUsers((current) =>
          current.map((item) => (item.id === user.id ? { ...item, isPro: nextIsPro } : item)),
        );
        setOverview((current) =>
          current
            ? {
                ...current,
                metrics: {
                  ...current.metrics,
                  proUsers: Math.max(0, current.metrics.proUsers + (nextIsPro ? 1 : -1)),
                },
              }
            : current,
        );
      },
      nextIsPro ? `Pro access granted to @${user.username}.` : `Pro access removed from @${user.username}.`,
    );
  };

  const executeConfirmation = async () => {
    if (!confirmAction) return;
    const pending = confirmAction;
    if (pending.type === "reset") {
      await runAction(
        `reset-${pending.user.id}`,
        async () => {
          await resetAdminUserProgress(pending.user.id);
          setUsers((current) =>
            current.map((item) =>
              item.id === pending.user.id ? { ...item, xp: 0, streak: 0 } : item,
            ),
          );
        },
        `Progress reset for @${pending.user.username}.`,
      );
    } else {
      await runAction(
        `archive-${pending.broadcast.id}`,
        async () => {
          await archiveAdminBroadcast(pending.broadcast.id);
          setOverview((current) =>
            current
              ? {
                  ...current,
                  broadcasts: current.broadcasts.map((item) =>
                    item.id === pending.broadcast.id
                      ? { ...item, status: "ARCHIVED", isActive: false }
                      : item,
                  ),
                }
              : current,
          );
          onSaveSettings({
            ...settings,
            notifications: settings.notifications.map((item) =>
              item.id === pending.broadcast.id ? { ...item, isActive: false } : item,
            ),
          });
        },
        "Broadcast archived.",
      );
    }
    setConfirmAction(null);
  };

  const selectSection = (next: AdminSection) => {
    setSection(next);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const sectionCopy = SECTION_COPY[section];
  const activeNav = NAV_ITEMS.find((item) => item.id === section)!;

  if (loading) return <AdminLoading />;

  if (error || !overview) {
    return <AdminFailure message={error || "Admin data is unavailable."} onRetry={() => void load()} onExit={onExit} />;
  }

  return (
    <div className="admin-shell min-h-screen bg-[#F4F5EF] text-[#111] lg:flex">
      <aside className="hidden lg:flex lg:w-[254px] xl:w-[274px] shrink-0 bg-[#0E0F0C] text-white border-r border-black/10 min-h-screen sticky top-0 flex-col p-4 xl:p-5">
        <AdminBrand mode={overview.mode} />
        <div className="mt-8 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35 px-3">
          Workspace
        </div>
        <nav className="mt-2 space-y-1.5" aria-label="Admin navigation">
          {NAV_ITEMS.map((item) => (
            <SideNavItem key={item.id} item={item} active={section === item.id} onClick={() => selectSection(item.id)} />
          ))}
        </nav>

        <div className="mt-auto pt-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-3.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#DFFF4F] text-black grid place-items-center text-[11px] font-black shrink-0">
                {getInitials(currentUser?.username || "admin")}
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-bold truncate">@{currentUser?.username || "admin"}</div>
                <div className="text-[9px] uppercase tracking-wider text-white/40">Workspace admin</div>
              </div>
              <ChevronDown size={14} className="text-white/35 ml-auto" />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button type="button" onClick={onExit} className="admin-dark-button" title="Return to the product">
                <ArrowLeft size={13} /> App
              </button>
              <button type="button" onClick={onSignOut} className="admin-dark-button" title="Sign out">
                <LogOut size={13} /> Out
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-white/25 px-2 mt-4">
            <span>Control v2.0</span>
            <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#B7F74A]" /> Secure</span>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="lg:hidden sticky top-0 z-40 h-[66px] bg-[#0E0F0C] text-white border-b border-white/10 px-4 flex items-center justify-between">
          <AdminBrand mode={overview.mode} compact />
          <div className="flex items-center gap-2">
            <button type="button" onClick={onExit} className="w-9 h-9 rounded-xl border border-white/15 grid place-items-center" aria-label="Back to app">
              <ArrowLeft size={17} />
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen((value) => !value)}
              className="w-9 h-9 rounded-xl bg-[#DFFF4F] text-black grid place-items-center"
              aria-label="Toggle admin menu"
              aria-expanded={mobileNavOpen}
            >
              {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </header>

        {mobileNavOpen && (
          <div className="lg:hidden fixed inset-x-0 top-[66px] z-30 bg-[#0E0F0C] text-white border-b border-white/10 p-3 shadow-2xl">
            <nav className="grid grid-cols-2 gap-2" aria-label="Mobile admin navigation">
              {NAV_ITEMS.map((item) => (
                <SideNavItem key={item.id} item={item} active={section === item.id} onClick={() => selectSection(item.id)} compact />
              ))}
            </nav>
          </div>
        )}

        <main className="px-4 py-5 sm:px-6 sm:py-7 xl:px-10 xl:py-9 2xl:px-14 max-w-[1540px] mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 xl:mb-8">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-black/45">
                <activeNav.icon size={13} strokeWidth={2.7} /> {sectionCopy.eyebrow}
              </div>
              <h1 className="text-[27px] sm:text-[34px] xl:text-[39px] font-black tracking-[-0.045em] leading-none mt-2">
                {sectionCopy.title}
              </h1>
              <p className="text-[12px] sm:text-[13px] font-medium text-black/50 mt-2 max-w-[560px]">
                {sectionCopy.description}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden sm:flex h-10 px-3 items-center gap-2 rounded-xl bg-white border border-black/10 text-[10px] font-bold text-black/55 shadow-[0_1px_0_rgba(0,0,0,.04)]">
                <span className="relative flex w-2 h-2"><span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>
                LIVE DATA · {formatRelative(overview.generatedAt)}
              </div>
              <button
                type="button"
                onClick={() => void load(true)}
                disabled={refreshing}
                className="h-10 px-3.5 rounded-xl bg-white border border-black/10 text-[11px] font-black flex items-center gap-2 hover:border-black/25 disabled:opacity-50 shadow-[0_1px_0_rgba(0,0,0,.04)]"
              >
                <RefreshCcw size={14} className={refreshing ? "animate-spin" : ""} />
                <span className="hidden xs:inline">Refresh</span>
              </button>
            </div>
          </div>

          {section === "overview" && <OverviewSection overview={overview} onNavigate={selectSection} />}
          {section === "users" && (
            <UsersSection
              users={users}
              actionKey={actionKey}
              onPlanChange={(user) => void handlePlanChange(user)}
              onReset={(user) => setConfirmAction({ type: "reset", user })}
            />
          )}
          {section === "content" && (
            <ContentSection
              overview={overview}
              settings={settings}
              actionKey={actionKey}
              runAction={runAction}
              onOverviewChange={setOverview}
              onSaveSettings={onSaveSettings}
            />
          )}
          {section === "broadcasts" && (
            <BroadcastSection
              broadcasts={overview.broadcasts}
              settings={settings}
              actionKey={actionKey}
              runAction={runAction}
              onOverviewChange={setOverview}
              onSaveSettings={onSaveSettings}
              onArchive={(broadcast) => setConfirmAction({ type: "archive", broadcast })}
            />
          )}
          {section === "features" && (
            <FeaturesSection
              features={overview.features}
              services={overview.services}
              actionKey={actionKey}
              runAction={runAction}
              onOverviewChange={setOverview}
            />
          )}
          {section === "audit" && <AuditSection audits={overview.audits} />}
        </main>
      </div>

      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
      {confirmAction && (
        <ConfirmDialog
          action={confirmAction}
          busy={actionKey.startsWith(confirmAction.type === "reset" ? "reset-" : "archive-")}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => void executeConfirmation()}
        />
      )}
    </div>
  );
};

function AdminBrand({ mode, compact = false }: { mode: string; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`${compact ? "w-8 h-8" : "w-10 h-10"} rounded-xl bg-[#DFFF4F] text-black grid place-items-center font-black tracking-tighter shadow-[inset_0_-2px_0_rgba(0,0,0,.13)]`}>
        d.
      </div>
      <div>
        <div className={`${compact ? "text-[15px]" : "text-[17px]"} font-black tracking-[-0.04em] leading-none`}>datings.lol</div>
        <div className="text-[8px] font-black tracking-[0.18em] uppercase text-white/40 mt-1">
          Control · {mode}
        </div>
      </div>
    </div>
  );
}

function SideNavItem({ item, active, onClick, compact = false }: { item: (typeof NAV_ITEMS)[number]; active: boolean; onClick: () => void; compact?: boolean; key?: string }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl text-left flex items-center gap-3 transition-all ${compact ? "px-3 py-3" : "px-3 py-2.5"} ${
        active ? "bg-[#DFFF4F] text-black shadow-[0_3px_12px_rgba(223,255,79,.12)]" : "text-white/58 hover:text-white hover:bg-white/[0.055]"
      }`}
    >
      <span className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${active ? "bg-black/8" : "bg-white/[0.06]"}`}>
        <Icon size={15} strokeWidth={active ? 2.8 : 2.2} />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-black leading-none">{item.label}</span>
        {!compact && <span className={`block text-[8px] font-bold mt-1 ${active ? "text-black/50" : "text-white/28"}`}>{item.helper}</span>}
      </span>
      {active && !compact && <ArrowRight size={13} className="ml-auto" />}
    </button>
  );
}

function OverviewSection({ overview, onNavigate }: { overview: AdminOverviewData; onNavigate: (section: AdminSection) => void }) {
  const { metrics } = overview;
  const activation = metrics.users ? Math.round((metrics.activeToday / metrics.users) * 100) : 0;
  const conversion = metrics.users ? Math.round((metrics.proUsers / metrics.users) * 1000) / 10 : 0;
  const completion = metrics.activeToday ? Math.round((metrics.tasksCompletedToday / metrics.activeToday) * 100) : 0;
  const cards = [
    { label: "Total members", value: formatCompact(metrics.users), note: `${metrics.activeToday} active today`, trend: "+12.4%", icon: Users, color: "#E9FF86" },
    { label: "Active today", value: formatCompact(metrics.activeToday), note: `${activation}% of all members`, trend: "+8.1%", icon: Activity, color: "#CDEBFF" },
    { label: "Pro members", value: formatCompact(metrics.proUsers), note: `${conversion}% conversion`, trend: "+3.2%", icon: Crown, color: "#FFE39A" },
    { label: "Tasks completed", value: formatCompact(metrics.tasksCompletedToday), note: `${completion}% completion rate`, trend: "+5.7%", icon: CheckCircle2, color: "#E6D9FF" },
  ];

  return (
    <div className="space-y-4 xl:space-y-5">
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 xl:gap-4">
        {cards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.65fr)_minmax(290px,.75fr)] gap-4 xl:gap-5">
        <section className="admin-card p-4 sm:p-5 xl:p-6 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="admin-card-label">Engagement</div>
              <h2 className="admin-card-title mt-1">14-day product pulse</h2>
              <p className="admin-card-copy">Daily active members and completed missions.</p>
            </div>
            <div className="flex items-center gap-3 text-[9px] font-bold text-black/45 shrink-0">
              <span className="inline-flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-black" /> Active</span>
              <span className="inline-flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#B7E541]" /> Done</span>
            </div>
          </div>
          <TrendChart data={overview.trend} />
        </section>

        <section className="admin-card p-4 sm:p-5 xl:p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="admin-card-label">Infrastructure</div>
              <h2 className="admin-card-title mt-1">System status</h2>
            </div>
            <span className="admin-status-pill admin-status-on"><Check size={11} /> Live</span>
          </div>
          <div className="mt-5 divide-y divide-black/[0.07]">
            {overview.services.map((service) => (
              <div key={service.name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${service.status === "operational" ? "bg-emerald-500" : service.status === "degraded" ? "bg-amber-500" : "bg-black/20"}`} />
                <div className="min-w-0">
                  <div className="text-[11px] font-black">{service.name}</div>
                  <div className="text-[9px] font-medium text-black/40 truncate">{service.detail}</div>
                </div>
                <span className="ml-auto text-[8px] font-black uppercase tracking-wider text-black/35">{service.status.replace("_", " ")}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,.7fr)] gap-4 xl:gap-5">
        <section className="admin-card overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-black/[0.07] flex items-center justify-between">
            <div>
              <div className="admin-card-label">Operations</div>
              <h2 className="admin-card-title mt-1">Recent activity</h2>
            </div>
            <button type="button" onClick={() => onNavigate("audit")} className="admin-link-button">View audit <ArrowRight size={12} /></button>
          </div>
          {overview.audits.length ? (
            <div className="divide-y divide-black/[0.06]">
              {overview.audits.slice(0, 6).map((audit) => <AuditRow key={audit.id} audit={audit} compact />)}
            </div>
          ) : (
            <EmptyState icon={Activity} title="No admin activity yet" copy="Sensitive actions will appear here as they happen." />
          )}
        </section>

        <section className="rounded-2xl bg-[#0E0F0C] text-white p-5 xl:p-6 shadow-[0_10px_30px_rgba(0,0,0,.08)]">
          <div className="w-10 h-10 rounded-xl bg-[#DFFF4F] text-black grid place-items-center"><Zap size={18} /></div>
          <h2 className="text-[19px] font-black tracking-[-0.035em] mt-5">Quick actions</h2>
          <p className="text-[10px] font-medium text-white/45 mt-1">Jump straight to today’s highest leverage work.</p>
          <div className="space-y-2 mt-5">
            <QuickAction icon={BookOpenCheck} label="Set today’s mission" onClick={() => onNavigate("content")} />
            <QuickAction icon={Send} label="Send a broadcast" onClick={() => onNavigate("broadcasts")} />
            <QuickAction icon={UserRoundCog} label="Manage members" onClick={() => onNavigate("users")} />
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, note, trend, icon: Icon, color }: { label: string; value: string; note: string; trend: string; icon: React.ComponentType<{ size?: number }>; color: string; key?: string }) {
  return (
    <article className="admin-card p-4 xl:p-5 group">
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-xl grid place-items-center border border-black/[0.08]" style={{ background: color }}><Icon size={16} /></div>
        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 text-emerald-700 px-2 py-1 text-[8px] font-black"><ArrowUpRight size={10} />{trend}</span>
      </div>
      <div className="text-[28px] xl:text-[31px] leading-none font-black tracking-[-0.045em] mt-5">{value}</div>
      <div className="text-[10px] font-black mt-2">{label}</div>
      <div className="text-[9px] font-medium text-black/40 mt-1">{note}</div>
    </article>
  );
}

function TrendChart({ data }: { data: AdminOverviewData["trend"] }) {
  const max = Math.max(1, ...data.flatMap((point) => [point.active, point.completions]));
  const width = 720;
  const height = 205;
  const padX = 10;
  const padY = 18;
  const usableWidth = width - padX * 2;
  const usableHeight = height - padY * 2;
  const pathFor = (key: "active" | "completions") =>
    data
      .map((point, index) => {
        const x = padX + (index / Math.max(1, data.length - 1)) * usableWidth;
        const y = padY + usableHeight - (point[key] / max) * usableHeight;
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  const area = `${pathFor("active")} L${width - padX},${height - padY} L${padX},${height - padY} Z`;

  return (
    <div className="mt-5">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[190px] sm:h-[220px] overflow-visible" role="img" aria-label="14 day engagement trend">
        <defs>
          <linearGradient id="adminArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#111" stopOpacity=".12" /><stop offset="1" stopColor="#111" stopOpacity="0" /></linearGradient>
        </defs>
        {[0, 1, 2, 3].map((row) => <line key={row} x1="10" y1={padY + (row / 3) * usableHeight} x2={width - 10} y2={padY + (row / 3) * usableHeight} stroke="rgba(0,0,0,.07)" strokeDasharray="4 5" />)}
        <path d={area} fill="url(#adminArea)" />
        <path d={pathFor("active")} fill="none" stroke="#111" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathFor("completions")} fill="none" stroke="#B7E541" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((point, index) => {
          if (index !== data.length - 1) return null;
          const x = padX + (index / Math.max(1, data.length - 1)) * usableWidth;
          const y = padY + usableHeight - (point.active / max) * usableHeight;
          return <g key={point.date}><circle cx={x} cy={y} r="6" fill="white" stroke="#111" strokeWidth="3" /><circle cx={x} cy={y} r="2" fill="#111" /></g>;
        })}
      </svg>
      <div className="flex justify-between text-[8px] font-bold uppercase tracking-wider text-black/30 mt-1 px-1">
        {data.filter((_, index) => index === 0 || index === Math.floor(data.length / 2) || index === data.length - 1).map((point) => (
          <span key={point.date}>{new Date(`${point.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        ))}
      </div>
    </div>
  );
}

function UsersSection({ users, actionKey, onPlanChange, onReset }: { users: AdminUserRow[]; actionKey: string; onPlanChange: (user: AdminUserRow) => void; onReset: (user: AdminUserRow) => void }) {
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | "pro" | "free">("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch = !needle || `${user.username} ${user.email} ${user.id}`.toLowerCase().includes(needle);
      const matchesPlan = planFilter === "all" || (planFilter === "pro" ? user.isPro : !user.isPro);
      return matchesSearch && matchesPlan;
    });
  }, [users, search, planFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage(1), [search, planFilter]);
  useEffect(() => setPage((value) => Math.min(value, pageCount)), [pageCount]);

  return (
    <section className="admin-card overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-black/[0.07] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="admin-card-label">Directory</div>
          <h2 className="admin-card-title mt-1">All members <span className="text-black/25">{users.length}</span></h2>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <label className="admin-search sm:w-[280px]">
            <Search size={14} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or ID" />
            {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={13} /></button>}
          </label>
          <select value={planFilter} onChange={(event) => setPlanFilter(event.target.value as typeof planFilter)} className="admin-select" aria-label="Filter users by plan">
            <option value="all">All plans</option>
            <option value="pro">Pro only</option>
            <option value="free">Free only</option>
          </select>
        </div>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead><tr className="bg-[#F8F8F4] border-b border-black/[0.07] text-left">
            {['Member', 'Plan', 'Progress', 'Last active', 'Joined', ''].map((heading) => <th key={heading} className="px-5 py-3 text-[8px] font-black uppercase tracking-[0.14em] text-black/40">{heading}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-black/[0.06]">
            {visible.map((user) => (
              <tr key={user.id} className="hover:bg-[#FBFCF7] transition-colors">
                <td className="px-5 py-3.5"><UserIdentity user={user} /></td>
                <td className="px-5 py-3.5"><PlanBadge pro={user.isPro} /></td>
                <td className="px-5 py-3.5"><div className="text-[10px] font-black">{formatCompact(user.xp)} XP</div><div className="text-[8px] font-bold text-black/38 mt-1 inline-flex items-center gap-1"><Flame size={9} /> {user.streak} day streak</div></td>
                <td className="px-5 py-3.5 text-[9px] font-bold text-black/50">{formatRelative(user.lastSignInAt)}</td>
                <td className="px-5 py-3.5 text-[9px] font-bold text-black/50">{user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
                <td className="px-5 py-3.5"><UserActions user={user} busy={actionKey === `plan-${user.id}` || actionKey === `reset-${user.id}`} onPlanChange={onPlanChange} onReset={onReset} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-black/[0.06]">
        {visible.map((user) => (
          <div key={user.id} className="p-4">
            <div className="flex items-start justify-between gap-3"><UserIdentity user={user} /><PlanBadge pro={user.isPro} /></div>
            <div className="grid grid-cols-3 gap-2 my-4">
              <MiniStat label="XP" value={formatCompact(user.xp)} />
              <MiniStat label="Streak" value={`${user.streak}d`} />
              <MiniStat label="Active" value={formatRelative(user.lastSignInAt)} />
            </div>
            <UserActions user={user} busy={actionKey === `plan-${user.id}` || actionKey === `reset-${user.id}`} onPlanChange={onPlanChange} onReset={onReset} mobile />
          </div>
        ))}
      </div>

      {!visible.length && <EmptyState icon={Search} title="No members found" copy="Try a different search or plan filter." />}
      <div className="p-4 border-t border-black/[0.07] flex items-center justify-between">
        <div className="text-[9px] font-bold text-black/40">Showing {visible.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} className="admin-page-button" aria-label="Previous page"><ArrowLeft size={13} /></button>
          <span className="text-[9px] font-black">{page} / {pageCount}</span>
          <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={page === pageCount} className="admin-page-button" aria-label="Next page"><ArrowRight size={13} /></button>
        </div>
      </div>
    </section>
  );
}

function UserIdentity({ user }: { user: AdminUserRow }) {
  return <div className="flex items-center gap-3 min-w-0"><div className="w-9 h-9 rounded-xl bg-[#E9FF86] border border-black/[0.08] grid place-items-center font-black text-[10px] shrink-0">{getInitials(user.username)}</div><div className="min-w-0"><div className="text-[11px] font-black truncate">@{user.username}</div><div className="text-[8px] font-medium text-black/40 truncate max-w-[230px]">{user.email || user.id}</div></div></div>;
}

function PlanBadge({ pro }: { pro: boolean }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-wider ${pro ? "bg-[#FFF0B8] text-amber-900" : "bg-black/[0.055] text-black/45"}`}>{pro && <Crown size={9} />}{pro ? "Pro" : "Free"}</span>;
}

function UserActions({ user, busy, onPlanChange, onReset, mobile = false }: { user: AdminUserRow; busy: boolean; onPlanChange: (user: AdminUserRow) => void; onReset: (user: AdminUserRow) => void; mobile?: boolean }) {
  return <div className={`flex items-center gap-2 ${mobile ? "w-full" : "justify-end"}`}>
    <button type="button" disabled={busy} onClick={() => onPlanChange(user)} className={`admin-row-button ${mobile ? "flex-1" : ""}`}>{busy ? <LoaderCircle size={12} className="animate-spin" /> : <Crown size={12} />}{user.isPro ? "Revoke" : "Grant Pro"}</button>
    <button type="button" disabled={busy} onClick={() => onReset(user)} className={`admin-row-button admin-row-button-danger ${mobile ? "flex-1" : ""}`}><RotateCcw size={12} /> Reset</button>
  </div>;
}

function ContentSection({ overview, settings, actionKey, runAction, onOverviewChange, onSaveSettings }: { overview: AdminOverviewData; settings: AdminSettings; actionKey: string; runAction: (key: string, action: () => Promise<void>, success: string) => Promise<void>; onOverviewChange: React.Dispatch<React.SetStateAction<AdminOverviewData | null>>; onSaveSettings: (settings: AdminSettings) => void }) {
  const [config, setConfig] = useState<AdminDailyConfig>(overview.dailyConfig);
  const [hotTake, setHotTake] = useState<AdminHotTakeOverride>(overview.dailyHotTake || getTodayHotTake());
  const [tab, setTab] = useState<"mission" | "hot-take">("mission");

  useEffect(() => setConfig(overview.dailyConfig), [overview.dailyConfig]);
  useEffect(() => setHotTake(overview.dailyHotTake || getTodayHotTake()), [overview.dailyHotTake]);

  const saveMission = async (event: React.FormEvent) => {
    event.preventDefault();
    await runAction("daily-config", async () => {
      const saved = await updateAdminDailyConfig({
        lessonId: config.lessonId,
        mode: config.lessonId ? "MANUAL" : "AUTOMATIC",
        focus: config.focus,
        note: config.note,
        taskType: config.taskType,
        difficulty: config.difficulty,
        xpReward: config.xpReward,
      });
      setConfig(saved);
      onOverviewChange((current) => current ? { ...current, dailyConfig: saved } : current);
      onSaveSettings({ ...settings, dailyOverride: { lessonId: saved.lessonId, focus: saved.focus, note: saved.note, updatedAt: saved.updatedAt } });
    }, "Today’s mission is live.");
  };

  const saveHotTake = async (event: React.FormEvent) => {
    event.preventDefault();
    await runAction("hot-take", async () => {
      const saved = await updateAdminHotTake(hotTake);
      setHotTake(saved);
      onOverviewChange((current) => current ? { ...current, dailyHotTake: saved } : current);
      onSaveSettings({ ...settings, dailyHotTake: saved });
    }, "Daily hot take published.");
  };

  return <div className="space-y-4">
    <div className="inline-flex p-1 rounded-xl bg-black/[0.055] border border-black/[0.06]">
      <button type="button" onClick={() => setTab("mission")} className={`admin-segment ${tab === "mission" ? "admin-segment-active" : ""}`}><Target size={13} /> Daily mission</button>
      <button type="button" onClick={() => setTab("hot-take")} className={`admin-segment ${tab === "hot-take" ? "admin-segment-active" : ""}`}><MessageCircle size={13} /> Hot take</button>
    </div>

    {tab === "mission" ? (
      <form onSubmit={saveMission} className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,.7fr)] gap-4 xl:gap-5">
        <section className="admin-card p-4 sm:p-5 xl:p-6 space-y-5">
          <div className="flex items-start justify-between gap-3"><div><div className="admin-card-label">Task engine override</div><h2 className="admin-card-title mt-1">Build today’s mission</h2><p className="admin-card-copy">Leave the lesson on automatic to keep personalization enabled.</p></div><span className="admin-status-pill admin-status-on"><Radio size={10} /> Published</span></div>
          <Field label="Lesson source" hint="Select a fixed lesson or let the engine personalize it."><select value={config.lessonId ?? ""} onChange={(event) => setConfig({ ...config, lessonId: event.target.value ? Number(event.target.value) : null })} className="admin-input"><option value="">Automatic · personalized per member</option>{LESSONS.map((lesson) => <option value={lesson.id} key={lesson.id}>Lesson {lesson.id} · {lesson.title}</option>)}</select></Field>
          <div className="grid sm:grid-cols-2 gap-4"><Field label="Focus headline"><input value={config.focus} maxLength={120} onChange={(event) => setConfig({ ...config, focus: event.target.value })} className="admin-input" placeholder="e.g. Send before you spiral" /></Field><Field label="XP reward"><div className="relative"><input type="number" min="0" max="500" value={config.xpReward} onChange={(event) => setConfig({ ...config, xpReward: Number(event.target.value) })} className="admin-input pr-12" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-black/35">XP</span></div></Field></div>
          <div className="grid sm:grid-cols-2 gap-4"><Field label="Task type"><select value={config.taskType} onChange={(event) => setConfig({ ...config, taskType: event.target.value as AdminDailyConfig["taskType"] })} className="admin-input">{["LEARN", "PRACTICE", "SIMULATION", "REAL_WORLD", "REVIEW"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Difficulty"><select value={config.difficulty} onChange={(event) => setConfig({ ...config, difficulty: event.target.value as AdminDailyConfig["difficulty"] })} className="admin-input">{["BEGINNER", "INTERMEDIATE", "ADVANCED", "BRUTAL"].map((item) => <option key={item}>{item}</option>)}</select></Field></div>
          <Field label="Coach note" hint={`${config.note.length}/1000`}><textarea value={config.note} maxLength={1000} onChange={(event) => setConfig({ ...config, note: event.target.value })} className="admin-input min-h-[120px] py-3 resize-none" placeholder="A short framing note members will see with the mission." /></Field>
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-black/[0.07]"><div className="text-[9px] font-medium text-black/40">Last published {formatRelative(config.updatedAt)}</div><button type="submit" disabled={actionKey === "daily-config"} className="admin-primary-button">{actionKey === "daily-config" ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />} Publish mission</button></div>
        </section>
        <MissionPreview config={config} />
      </form>
    ) : (
      <form onSubmit={saveHotTake} className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,.7fr)] gap-4 xl:gap-5">
        <section className="admin-card p-4 sm:p-5 xl:p-6 space-y-5">
          <div><div className="admin-card-label">Conversation starter</div><h2 className="admin-card-title mt-1">Daily hot take</h2><p className="admin-card-copy">A sharp, useful opinion members can vote on once per day.</p></div>
          <Field label="Topic"><input value={hotTake.topic} maxLength={50} onChange={(event) => setHotTake({ ...hotTake, topic: event.target.value })} className="admin-input" placeholder="TEXTING" /></Field>
          <Field label="Statement" hint={`${hotTake.statement.length}/280`}><textarea value={hotTake.statement} maxLength={280} onChange={(event) => setHotTake({ ...hotTake, statement: event.target.value })} className="admin-input min-h-[110px] py-3 resize-none" /></Field>
          <Field label="Context"><input value={hotTake.subtext} maxLength={280} onChange={(event) => setHotTake({ ...hotTake, subtext: event.target.value })} className="admin-input" /></Field>
          <div className="grid grid-cols-3 gap-3">{(["agreePercent", "disagreePercent", "complicatedPercent"] as const).map((key) => <Field key={key} label={key === "agreePercent" ? "Agree" : key === "disagreePercent" ? "Disagree" : "It depends"}><div className="relative"><input type="number" min="0" max="100" value={hotTake[key]} onChange={(event) => setHotTake({ ...hotTake, [key]: Number(event.target.value) })} className="admin-input pr-8" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-black/30">%</span></div></Field>)}</div>
          <div className="flex justify-end"><button type="submit" disabled={actionKey === "hot-take" || !hotTake.topic.trim() || !hotTake.statement.trim()} className="admin-primary-button">{actionKey === "hot-take" ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />} Publish hot take</button></div>
        </section>
        <HotTakePreview hotTake={hotTake} />
      </form>
    )}
  </div>;
}

function MissionPreview({ config }: { config: AdminDailyConfig }) {
  return <aside className="admin-card p-4 sm:p-5 xl:p-6 h-fit xl:sticky xl:top-8"><div className="flex items-center justify-between"><div className="admin-card-label">Member preview</div><span className="text-[8px] font-black text-black/30 uppercase">Today tab</span></div><div className="mt-5 rounded-[22px] bg-[#FBFBF6] border border-black/10 overflow-hidden shadow-[0_12px_30px_rgba(0,0,0,.06)]"><div className="h-9 bg-[#111] px-4 flex items-center justify-between"><span className="text-[8px] font-black text-white">datings.lol</span><span className="w-12 h-2 rounded-full bg-white/15" /></div><div className="p-5"><span className="inline-flex px-2 py-1 rounded-full bg-[#E9FF86] text-[8px] font-black uppercase">Day mission</span><h3 className="text-[23px] font-black tracking-[-0.04em] leading-[1.05] mt-4">{config.focus || "Your personalized move for today"}</h3><p className="text-[10px] font-medium text-black/50 leading-relaxed mt-3">{config.note || "A practical, low-pressure move personalized to the member’s current goal."}</p><div className="flex flex-wrap gap-2 mt-5"><span className="preview-chip"><Target size={10} /> {humanize(config.taskType)}</span><span className="preview-chip"><Gauge size={10} /> {humanize(config.difficulty)}</span><span className="preview-chip"><Zap size={10} /> +{config.xpReward} XP</span></div><div className="h-10 rounded-xl bg-[#111] text-white text-[9px] font-black grid place-items-center mt-5">START TODAY’S MISSION</div></div></div><p className="text-[8px] font-medium text-black/35 text-center mt-3">Preview approximates the member experience.</p></aside>;
}

function HotTakePreview({ hotTake }: { hotTake: AdminHotTakeOverride }) {
  return <aside className="admin-card p-4 sm:p-5 xl:p-6 h-fit xl:sticky xl:top-8"><div className="admin-card-label">Member preview</div><div className="rounded-[22px] bg-[#FFD9DF] border border-black/10 p-5 mt-5 shadow-[0_12px_30px_rgba(0,0,0,.06)]"><div className="flex items-center justify-between"><span className="text-[8px] font-black uppercase tracking-wider">Hot take · {hotTake.topic || "Topic"}</span><Flame size={16} /></div><h3 className="text-[22px] leading-[1.08] font-black tracking-[-0.04em] mt-6">“{hotTake.statement || "Your hot take appears here."}”</h3><p className="text-[10px] font-medium text-black/50 mt-3">{hotTake.subtext}</p><div className="space-y-2 mt-6">{[["Agree", hotTake.agreePercent], ["Disagree", hotTake.disagreePercent], ["It depends", hotTake.complicatedPercent]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-white/75 border border-black/10 px-3 py-2.5 flex items-center justify-between text-[9px] font-black"><span>{label}</span><span>{value}%</span></div>)}</div></div></aside>;
}

function BroadcastSection({ broadcasts, settings, actionKey, runAction, onOverviewChange, onSaveSettings, onArchive }: { broadcasts: AdminBroadcast[]; settings: AdminSettings; actionKey: string; runAction: (key: string, action: () => Promise<void>, success: string) => Promise<void>; onOverviewChange: React.Dispatch<React.SetStateAction<AdminOverviewData | null>>; onSaveSettings: (settings: AdminSettings) => void; onArchive: (broadcast: AdminBroadcast) => void }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"update" | "warning" | "win">("update");
  const [expiresAt, setExpiresAt] = useState("");
  const [preview, setPreview] = useState(false);

  const publish = async (status: "DRAFT" | "LIVE") => {
    await runAction("broadcast-create", async () => {
      const created = await createAdminBroadcast({ title, message, tone, status, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined });
      onOverviewChange((current) => current ? { ...current, broadcasts: [created, ...current.broadcasts] } : current);
      onSaveSettings({ ...settings, notifications: [created, ...settings.notifications].slice(0, 20) });
      setTitle(""); setMessage(""); setExpiresAt(""); setPreview(false);
    }, status === "LIVE" ? "Broadcast is now live." : "Broadcast saved as a draft.");
  };

  return <div className="grid grid-cols-1 xl:grid-cols-[minmax(340px,.72fr)_minmax(0,1.28fr)] gap-4 xl:gap-5 items-start">
    <section className="admin-card p-4 sm:p-5 xl:p-6 xl:sticky xl:top-8">
      <div className="admin-card-label">Composer</div><h2 className="admin-card-title mt-1">New broadcast</h2><p className="admin-card-copy">Keep it concise. One message, one clear action.</p>
      <div className="space-y-4 mt-5"><Field label="Title" hint={`${title.length}/80`}><input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} className="admin-input" placeholder="What members need to know" /></Field><Field label="Message" hint={`${message.length}/500`}><textarea value={message} maxLength={500} onChange={(event) => setMessage(event.target.value)} className="admin-input min-h-[130px] py-3 resize-none" placeholder="Write a useful, specific message…" /></Field><div className="grid sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2 gap-4"><Field label="Tone"><select value={tone} onChange={(event) => setTone(event.target.value as typeof tone)} className="admin-input"><option value="update">Product update</option><option value="warning">Important notice</option><option value="win">Celebration</option></select></Field><Field label="Expires (optional)"><input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="admin-input" /></Field></div></div>
      {preview && <div className={`rounded-xl border border-black/10 p-3 mt-4 ${tone === "warning" ? "bg-[#FFE3E6]" : tone === "win" ? "bg-[#E9FF86]" : "bg-[#E3F3FF]"}`}><div className="text-[8px] font-black uppercase tracking-wider opacity-45">Preview · {tone}</div><div className="text-[12px] font-black mt-2">{title || "Broadcast title"}</div><div className="text-[9px] font-medium opacity-60 mt-1 leading-relaxed">{message || "Your message will appear here."}</div></div>}
      <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-black/[0.07]"><button type="button" onClick={() => setPreview((value) => !value)} className="admin-secondary-button"><Eye size={13} /> Preview</button><button type="button" disabled={!title.trim() || !message.trim() || actionKey === "broadcast-create"} onClick={() => void publish("DRAFT")} className="admin-secondary-button"><Save size={13} /> Draft</button><button type="button" disabled={!title.trim() || !message.trim() || actionKey === "broadcast-create"} onClick={() => void publish("LIVE")} className="admin-primary-button ml-auto">{actionKey === "broadcast-create" ? <LoaderCircle size={13} className="animate-spin" /> : <Send size={13} />} Publish</button></div>
    </section>

    <section className="admin-card overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-black/[0.07] flex items-center justify-between"><div><div className="admin-card-label">Message history</div><h2 className="admin-card-title mt-1">Broadcasts <span className="text-black/25">{broadcasts.length}</span></h2></div><span className="admin-status-pill admin-status-on"><Radio size={10} /> {broadcasts.filter((item) => item.status === "LIVE").length} live</span></div>
      {broadcasts.length ? <div className="divide-y divide-black/[0.06]">{broadcasts.map((broadcast) => <div key={broadcast.id} className="p-4 sm:p-5 hover:bg-[#FBFCF7]"><div className="flex items-start gap-3"><div className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${broadcast.tone === "warning" ? "bg-[#FFE0E5]" : broadcast.tone === "win" ? "bg-[#E9FF86]" : "bg-[#DFF2FF]"}`}><BellRing size={15} /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2 flex-wrap"><h3 className="text-[11px] font-black">{broadcast.title}</h3><BroadcastBadge status={broadcast.status} /></div><p className="text-[9px] leading-relaxed font-medium text-black/48 mt-1.5 max-w-[720px]">{broadcast.message}</p><div className="flex flex-wrap gap-x-4 gap-y-1 text-[8px] font-bold text-black/32 mt-3"><span>{formatDateTime(broadcast.createdAt)}</span><span>{humanize(broadcast.tone)}</span><span>{broadcast.audience.replaceAll("_", " ")}</span>{broadcast.expiresAt && <span>Expires {formatDateTime(broadcast.expiresAt)}</span>}</div></div>{broadcast.status !== "ARCHIVED" && <button type="button" disabled={actionKey === `archive-${broadcast.id}`} onClick={() => onArchive(broadcast)} className="w-8 h-8 rounded-lg border border-black/10 grid place-items-center text-black/35 hover:text-red-600 hover:border-red-200" aria-label={`Archive ${broadcast.title}`}><MoreHorizontal size={15} /></button>}</div></div>)}</div> : <EmptyState icon={Megaphone} title="No broadcasts yet" copy="Create a draft or publish your first member update." />}
    </section>
  </div>;
}

function BroadcastBadge({ status }: { status: AdminBroadcast["status"] }) {
  return <span className={`rounded-full px-2 py-0.5 text-[7px] font-black uppercase tracking-wider ${status === "LIVE" ? "bg-emerald-100 text-emerald-700" : status === "DRAFT" ? "bg-black/[0.06] text-black/45" : status === "SCHEDULED" ? "bg-blue-100 text-blue-700" : "bg-black/[0.035] text-black/28"}`}>{status}</span>;
}

function FeaturesSection({ features, services, actionKey, runAction, onOverviewChange }: { features: AdminFeatureFlag[]; services: AdminOverviewData["services"]; actionKey: string; runAction: (key: string, action: () => Promise<void>, success: string) => Promise<void>; onOverviewChange: React.Dispatch<React.SetStateAction<AdminOverviewData | null>> }) {
  const update = async (feature: AdminFeatureFlag, patch: Partial<Pick<AdminFeatureFlag, "state" | "rolloutPercent">>) => {
    const next = { state: patch.state ?? feature.state, rolloutPercent: patch.rolloutPercent ?? feature.rolloutPercent };
    await runAction(`feature-${feature.key}`, async () => {
      const saved = await updateAdminFeature(feature.key, next);
      onOverviewChange((current) => current ? { ...current, features: current.features.map((item) => item.key === feature.key ? saved : item) } : current);
    }, `${humanize(feature.key)} updated.`);
  };

  return <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,.55fr)] gap-4 xl:gap-5 items-start">
    <section className="admin-card overflow-hidden"><div className="p-4 sm:p-5 border-b border-black/[0.07]"><div className="admin-card-label">Progressive delivery</div><h2 className="admin-card-title mt-1">Product capabilities</h2><p className="admin-card-copy">Changes apply immediately and are recorded in the audit log.</p></div><div className="divide-y divide-black/[0.06]">{features.map((feature) => <FeatureRow key={feature.key} feature={feature} busy={actionKey === `feature-${feature.key}`} onUpdate={(patch) => void update(feature, patch)} />)}</div></section>
    <div className="space-y-4"><section className="rounded-2xl bg-[#0E0F0C] text-white p-5"><div className="w-9 h-9 rounded-xl bg-[#DFFF4F] text-black grid place-items-center"><ShieldCheck size={16} /></div><h2 className="text-[17px] font-black mt-4">Safe rollout checklist</h2><div className="space-y-3 mt-4">{["Test in BETA before full release", "Start risky features below 25%", "Watch support and engagement", "Keep a rollback path available"].map((item) => <div key={item} className="flex items-start gap-2 text-[9px] font-medium text-white/55"><CheckCircle2 size={12} className="text-[#DFFF4F] shrink-0 mt-px" />{item}</div>)}</div></section><section className="admin-card p-5"><div className="admin-card-label">Runtime</div><h2 className="admin-card-title mt-1">Dependencies</h2><div className="space-y-3 mt-4">{services.map((service) => <div key={service.name} className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-black">{service.name}</div><div className="text-[8px] text-black/38 mt-0.5">{service.detail}</div></div><span className={`w-2 h-2 rounded-full ${service.status === "operational" ? "bg-emerald-500" : service.status === "degraded" ? "bg-amber-500" : "bg-black/20"}`} /></div>)}</div></section></div>
  </div>;
}

function FeatureRow({ feature, busy, onUpdate }: { feature: AdminFeatureFlag; busy: boolean; onUpdate: (patch: Partial<Pick<AdminFeatureFlag, "state" | "rolloutPercent">>) => void; key?: string }) {
  const [rollout, setRollout] = useState(feature.rolloutPercent);
  useEffect(() => setRollout(feature.rolloutPercent), [feature.rolloutPercent]);
  return <div className="p-4 sm:p-5"><div className="flex flex-col sm:flex-row sm:items-start gap-4"><div className="w-9 h-9 rounded-xl bg-[#F2F3ED] border border-black/[0.07] grid place-items-center shrink-0"><Flag size={15} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-[11px] font-black">{humanize(feature.key)}</h3><span className={`admin-status-pill ${feature.state === "ON" ? "admin-status-on" : feature.state === "BETA" ? "admin-status-beta" : "admin-status-off"}`}>{feature.state}</span></div><p className="text-[9px] font-medium text-black/42 mt-1">{feature.description || "No description provided."}</p><div className="mt-4 flex flex-col lg:flex-row lg:items-center gap-3"><div className="flex p-1 rounded-lg bg-black/[0.045] w-fit">{(["ON", "BETA", "OFF"] as const).map((state) => <button type="button" key={state} disabled={busy} onClick={() => onUpdate({ state })} className={`h-7 px-3 rounded-md text-[8px] font-black ${feature.state === state ? "bg-white text-black shadow-sm" : "text-black/35"}`}>{state}</button>)}</div><div className="flex items-center gap-3 min-w-0 flex-1 lg:max-w-[300px]"><input type="range" min="0" max="100" step="5" value={rollout} onChange={(event) => setRollout(Number(event.target.value))} onMouseUp={() => rollout !== feature.rolloutPercent && onUpdate({ rolloutPercent: rollout })} onTouchEnd={() => rollout !== feature.rolloutPercent && onUpdate({ rolloutPercent: rollout })} className="admin-range flex-1" aria-label={`${feature.key} rollout percent`} /><span className="text-[9px] font-black w-8 text-right">{rollout}%</span></div>{busy && <LoaderCircle size={14} className="animate-spin text-black/35" />}</div></div></div></div>;
}

function AuditSection({ audits }: { audits: AdminAuditEntry[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const types = [...new Set(audits.map((audit) => audit.targetType))];
  const visible = audits.filter((audit) => (filter === "all" || audit.targetType === filter) && (!search.trim() || `${audit.action} ${audit.targetId} ${audit.targetType}`.toLowerCase().includes(search.toLowerCase())));
  return <section className="admin-card overflow-hidden"><div className="p-4 sm:p-5 border-b border-black/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><div className="admin-card-label">Security record</div><h2 className="admin-card-title mt-1">Recorded actions <span className="text-black/25">{audits.length}</span></h2></div><div className="flex gap-2"><label className="admin-search sm:w-[230px]"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search audit log" /></label><select value={filter} onChange={(event) => setFilter(event.target.value)} className="admin-select"><option value="all">All targets</option>{types.map((type) => <option value={type} key={type}>{humanize(type)}</option>)}</select></div></div><div className="divide-y divide-black/[0.06]">{visible.map((audit) => <AuditRow key={audit.id} audit={audit} />)}</div>{!visible.length && <EmptyState icon={ShieldCheck} title="No matching events" copy="Try another action, target, or filter." />}</section>;
}

function AuditRow({ audit, compact = false }: { audit: AdminAuditEntry; compact?: boolean; key?: string }) {
  const Icon = audit.targetType.includes("user") ? Users : audit.targetType.includes("feature") ? Flag : audit.targetType.includes("broadcast") ? Megaphone : Settings2;
  return <div className={`${compact ? "px-4 sm:px-5 py-3" : "px-4 sm:px-5 py-4"} flex items-start gap-3 hover:bg-[#FBFCF7]`}><div className="w-8 h-8 rounded-lg bg-[#F0F2EA] grid place-items-center shrink-0"><Icon size={13} /></div><div className="min-w-0 flex-1"><div className="text-[10px] font-black">{humanize(audit.action)}</div><div className="text-[8px] font-medium text-black/38 mt-1 truncate">{humanize(audit.targetType)} · {audit.targetId}{audit.actorId ? ` · by ${audit.actorId.slice(0, 8)}` : ""}</div></div><div className="text-[8px] font-bold text-black/30 shrink-0">{formatRelative(audit.createdAt)}</div></div>;
}

function QuickAction({ icon: Icon, label, onClick }: { icon: React.ComponentType<{ size?: number }>; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="w-full rounded-xl border border-white/10 bg-white/[0.055] px-3.5 py-3 flex items-center gap-3 text-[10px] font-black hover:bg-white/[0.09] transition-colors"><Icon size={14} className="text-[#DFFF4F]" />{label}<ArrowRight size={12} className="ml-auto text-white/25" /></button>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode; key?: string }) {
  return <label className="block"><span className="mb-2 flex items-center justify-between gap-2"><span className="text-[9px] font-black uppercase tracking-[0.12em] text-black/55">{label}</span>{hint && <span className="text-[8px] font-bold text-black/30">{hint}</span>}</span>{children}</label>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#F7F8F3] border border-black/[0.06] p-2.5"><div className="text-[7px] font-black uppercase tracking-wider text-black/30">{label}</div><div className="text-[10px] font-black mt-1 truncate">{value}</div></div>;
}

function EmptyState({ icon: Icon, title, copy }: { icon: React.ComponentType<{ size?: number }>; title: string; copy: string }) {
  return <div className="px-5 py-14 text-center"><div className="w-11 h-11 rounded-2xl bg-[#F0F2EA] grid place-items-center mx-auto text-black/35"><Icon size={19} /></div><div className="text-[11px] font-black mt-4">{title}</div><p className="text-[9px] font-medium text-black/38 mt-1">{copy}</p></div>;
}

function Toast({ message, tone, onClose }: { message: string; tone: ToastTone; onClose: () => void }) {
  return <div className={`fixed z-[80] bottom-5 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 min-w-[290px] max-w-[calc(100vw-32px)] rounded-2xl border shadow-[0_18px_50px_rgba(0,0,0,.18)] px-4 py-3 flex items-center gap-3 animate-[admin-slide-up_.2s_ease-out] ${tone === "error" ? "bg-[#FFF0F1] border-red-200" : tone === "info" ? "bg-[#EDF7FF] border-blue-200" : "bg-[#F1FFD2] border-lime-200"}`} role="status"><div className={`w-7 h-7 rounded-full grid place-items-center ${tone === "error" ? "bg-red-500 text-white" : "bg-[#111] text-white"}`}>{tone === "error" ? <AlertCircle size={14} /> : <Check size={14} />}</div><span className="text-[10px] font-black flex-1">{message}</span><button type="button" onClick={onClose} className="text-black/35"><X size={14} /></button></div>;
}

function ConfirmDialog({ action, busy, onCancel, onConfirm }: { action: ConfirmAction; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const reset = action.type === "reset";
  const subject = reset ? `@${action.user.username}` : `“${action.broadcast.title}”`;
  return <div className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-[3px] p-4 grid place-items-center" role="dialog" aria-modal="true"><div className="w-full max-w-[410px] rounded-[22px] bg-white border border-black/10 shadow-[0_30px_90px_rgba(0,0,0,.28)] p-5 sm:p-6"><div className={`w-11 h-11 rounded-2xl grid place-items-center ${reset ? "bg-[#FFE1E4] text-red-700" : "bg-[#FFF0B8] text-amber-800"}`}>{reset ? <RotateCcw size={19} /> : <Megaphone size={19} />}</div><h2 className="text-[19px] font-black tracking-[-0.035em] mt-5">{reset ? "Reset member progress?" : "Archive this broadcast?"}</h2><p className="text-[10px] font-medium text-black/48 leading-relaxed mt-2">{reset ? `${subject} will lose all XP and streak progress. This high-impact action is audit logged.` : `${subject} will stop appearing to members immediately. The audit record will be kept.`}</p><div className="flex items-center justify-end gap-2 mt-6"><button type="button" disabled={busy} onClick={onCancel} className="admin-secondary-button">Cancel</button><button type="button" disabled={busy} onClick={onConfirm} className="admin-danger-button">{busy ? <LoaderCircle size={13} className="animate-spin" /> : reset ? <RotateCcw size={13} /> : <Check size={13} />}{reset ? "Reset progress" : "Archive"}</button></div></div></div>;
}

function AdminLoading() {
  return <div className="min-h-screen bg-[#F4F5EF] lg:flex"><div className="hidden lg:block w-[254px] bg-[#0E0F0C] p-5"><div className="h-10 w-36 rounded-xl bg-white/10 animate-pulse" /><div className="space-y-3 mt-12">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-12 rounded-xl bg-white/[0.055] animate-pulse" />)}</div></div><div className="flex-1 p-5 sm:p-8 xl:p-10"><div className="h-9 w-72 max-w-full rounded-xl bg-black/[0.08] animate-pulse" /><div className="h-4 w-96 max-w-full rounded bg-black/[0.05] animate-pulse mt-3" /><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-9">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-40 rounded-2xl bg-white border border-black/[0.06] animate-pulse" />)}</div><div className="grid xl:grid-cols-[1.6fr_.7fr] gap-5 mt-5"><div className="h-[390px] rounded-2xl bg-white border border-black/[0.06] animate-pulse" /><div className="h-[390px] rounded-2xl bg-white border border-black/[0.06] animate-pulse" /></div></div></div>;
}

function AdminFailure({ message, onRetry, onExit }: { message: string; onRetry: () => void; onExit: () => void }) {
  return <div className="min-h-screen bg-[#F4F5EF] p-4 grid place-items-center"><div className="w-full max-w-[470px] rounded-[24px] bg-white border border-black/10 shadow-[0_20px_60px_rgba(0,0,0,.08)] p-6 sm:p-8 text-center"><div className="w-12 h-12 rounded-2xl bg-[#FFE1E4] text-red-700 grid place-items-center mx-auto"><AlertCircle size={22} /></div><h1 className="text-[23px] font-black tracking-[-0.04em] mt-5">Command center unavailable</h1><p className="text-[10px] font-medium text-black/48 leading-relaxed mt-2">{message}</p><div className="flex items-center justify-center gap-2 mt-6"><button type="button" onClick={onExit} className="admin-secondary-button"><ArrowLeft size={13} /> Back to app</button><button type="button" onClick={onRetry} className="admin-primary-button"><RefreshCcw size={13} /> Try again</button></div></div></div>;
}
