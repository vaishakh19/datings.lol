import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "20mb" }));

type TaskKind = "LEARN" | "PRACTICE" | "SIMULATION" | "REAL_WORLD" | "REVIEW";

interface GeneratedTask {
  id: string;
  userId: string;
  taskDate: string;
  skill: string;
  kind: TaskKind;
  title: string;
  description: string;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "BRUTAL";
  xpReward: number;
  completed: boolean;
}

const demoTasks = new Map<string, GeneratedTask>();
const demoCommunitySaves = new Set<string>();
const demoCommunityCompletions = new Set<string>();
const demoCommunityReactions = new Map<string, string>();
const demoProfiles = new Map<string, Record<string, any>>();
const demoProfileAudits = new Map<string, any[]>();
const demoJournalEntries = new Map<string, any[]>();
const demoAdminAuditLogs: any[] = [];
const demoAdminFeatures = new Map<string, string>();

const demoCommunityTeachings = [
  { id: "teaching-breathe", category: "TEXTING", type: "BREAKDOWN", title: "Stop trying to keep the chat alive", summary: "Let effort be information. Add personality, then leave room.", xp: 15, accent: "#FFE066" },
  { id: "teaching-confidence", category: "CONFIDENCE", type: "REMINDER", title: "Confidence is a verb", summary: "Collect evidence with one small social risk today.", xp: 15, accent: "#BEF264" },
  { id: "teaching-flirt", category: "FLIRTING", type: "COACH TIP", title: "Flirt without forcing it", summary: "Playful beats performative. Let your point of view show.", xp: 15, accent: "#FDA4AF" },
];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildDailyTask(userId: string, input: Record<string, any> = {}): GeneratedTask {
  const goals = Array.isArray(input.goals) ? input.goals : [];
  const skills = input.skills && typeof input.skills === "object" ? input.skills : {};
  const rankedSkill = Object.entries(skills)
    .sort(([, left], [, right]) => Number(left) - Number(right))[0]?.[0];
  const skill = rankedSkill || goals[0] || "texting";
  const templates: Record<string, { title: string; description: string; kind: TaskKind }> = {
    texting: { title: "Make the next message easier to answer", description: "Share one specific detail about yourself, then ask a question that gives them somewhere interesting to go.", kind: "PRACTICE" },
    confidence: { title: "Take one clean social risk", description: "Say the thing you normally edit out. Keep it warm, specific, and low-pressure.", kind: "REAL_WORLD" },
    flirting: { title: "Add playful energy", description: "Replace one generic compliment with a light tease that reveals your personality.", kind: "PRACTICE" },
    asking_out: { title: "Turn momentum into a plan", description: "Suggest a specific day and activity instead of leaving the conversation in the talking stage.", kind: "REAL_WORLD" },
    overthinking: { title: "Send before the spiral", description: "Write the honest version in one sentence, read it once, then send it without a second edit.", kind: "REAL_WORLD" },
  };
  const template = templates[skill] || templates.texting;
  return {
    id: `task-${userId}-${todayKey()}`,
    userId,
    taskDate: todayKey(),
    skill,
    kind: template.kind,
    title: template.title,
    description: template.description,
    difficulty: Number(skills[skill] || 50) < 40 ? "BEGINNER" : Number(skills[skill] || 50) > 75 ? "ADVANCED" : "INTERMEDIATE",
    xpReward: 25 + (Number(skills[skill] || 50) > 75 ? 15 : 0),
    completed: false,
  };
}

function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? createClient(url, key) : null;
}

function getSupabaseServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceRoleKey ? createClient(url, serviceRoleKey) : null;
}

async function getAuthenticatedUserId(req: express.Request): Promise<string | null> {
  const authorization = req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const client = getSupabaseServerClient();
  if (!client) return null;
  const { data } = await client.auth.getUser(authorization.slice(7));
  return data.user?.id || null;
}

function requireUser(res: express.Response, userId: string | null): string | null {
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return null;
  }
  return userId;
}

type CoachPlan = "free" | "pro";

async function getCoachPlan(userId: string): Promise<CoachPlan> {
  const serviceClient = getSupabaseServiceClient();
  if (!serviceClient) return "free";

  // Pro subscriptions will be connected in the billing step.
  // Until then, authenticated users are treated as Free.
  const { data, error } = await serviceClient
    .from("subscriptions")
    .select("plan,status")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return "free";
  return data.plan === "pro" ? "pro" : "free";
}

async function getCoachUsageToday(userId: string): Promise<number> {
  const serviceClient = getSupabaseServiceClient();
  if (!serviceClient) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for Coach quota enforcement.");
  }

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const { count, error } = await serviceClient
    .from("coach_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfToday.toISOString());

  if (error) throw new Error(`Coach usage lookup failed: ${error.message}`);
  return count || 0;
}

async function recordCoachUsage(
  userId: string,
  plan: CoachPlan,
  model: string | null,
  inputTokens: number | null = null,
  outputTokens: number | null = null,
  totalTokens: number | null = null,
) {
  const serviceClient = getSupabaseServiceClient();
  if (!serviceClient) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for Coach usage tracking.");
  }

  const { error } = await serviceClient.from("coach_usage").insert({
    user_id: userId,
    plan,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    request_type: "chat",
  });

  if (error) throw new Error(`Coach usage record failed: ${error.message}`);
}


async function saveCoachResult(
  userId: string,
  situation: string,
  responseText: string,
) {
  const serviceClient = getSupabaseServiceClient();
  if (!serviceClient) return;

  const takeMatch = responseText.match(
    /COACH'S TAKE\s*([\s\S]*?)(?=\nDO THIS|\nTRY|$)/i,
  );
  const doMatch = responseText.match(
    /DO THIS\s*([\s\S]*?)(?=\nTRY|$)/i,
  );
  const tryMatch = responseText.match(
    /TRY\s*["“]?([\s\S]*?)["”]?\s*$/i,
  );

  const analysis = takeMatch?.[1]?.trim() || responseText;
  const advice = doMatch?.[1]?.trim() || "";
  const suggestedMessage = tryMatch?.[1]?.trim() || "";

  const { error: historyError } = await serviceClient
    .from("coach_history")
    .insert({
      user_id: userId,
      situation: situation || "Coach request",
      analysis,
      advice,
      suggested_message: suggestedMessage,
      action: advice,
      outcome: "Pending",
      xp_awarded: 20,
    });

  if (historyError) {
    console.error("Failed to save coach history:", historyError);
    return;
  }

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("xp, level, streak, last_active_date")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to fetch profile:", profileError);
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const newXp = (profile?.xp || 0) + 20;
  const newLevel = Math.floor(newXp / 100) + 1;

  let newStreak = profile?.streak || 0;
  if (profile?.last_active_date !== today) {
    newStreak += 1;
  }

  const { error: updateError } = await serviceClient
    .from("profiles")
    .update({
      xp: newXp,
      level: newLevel,
      streak: newStreak,
      last_active_date: today,
    })
    .eq("id", userId);

  if (updateError) {
    console.error("Failed to update profile:", updateError);
  }
}

async function requireAdmin(req: express.Request, res: express.Response): Promise<string | null> {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return null;
  }
  const serviceClient = getSupabaseServiceClient();
  if (!serviceClient) {
    res.status(503).json({ error: "Admin authorization is not configured." });
    return null;
  }
  const { data } = await serviceClient.from("admin_users").select("user_id").eq("user_id", userId).maybeSingle();
  if (!data) {
    res.status(403).json({ error: "Admin permission required." });
    return null;
  }
  return userId;
}

function recordAdminAudit(adminUserId: string, action: string, targetType: string, targetId: string, metadata: Record<string, unknown> = {}) {
  demoAdminAuditLogs.unshift({ id: `admin-audit-${Date.now()}`, adminUserId, action, targetType, targetId, metadata, createdAt: new Date().toISOString() });
  if (demoAdminAuditLogs.length > 200) demoAdminAuditLogs.pop();
}

app.get("/api/today", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  const key = `${userId}:${todayKey()}`;
  const task = demoTasks.get(key) || buildDailyTask(userId, req.query);
  demoTasks.set(key, task);
  res.json({ task, source: "demo-cache", generatedAt: new Date().toISOString() });
});

app.get("/api/progress", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  res.json({ userId, xp: 0, streak: 0, skills: {} });
});

app.post("/api/tasks/:id/start", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  const task = demoTasks.get(`${userId}:${todayKey()}`);
  if (!task || task.id !== req.params.id) return res.status(404).json({ error: "Task not found." });
  res.json({ task, startedAt: new Date().toISOString() });
});

app.post("/api/tasks/:id/complete", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  const task = demoTasks.get(`${userId}:${todayKey()}`);
  if (!task || task.id !== req.params.id) return res.status(404).json({ error: "Task not found." });
  if (task.completed) return res.status(409).json({ error: "Task already completed." });
  task.completed = true;
  res.json({ task, xpAwarded: task.xpReward, idempotent: false });
});

app.post("/api/practice/start", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  const scenario = typeof req.body?.scenario === "string" ? req.body.scenario.slice(0, 80) : "New match";
  res.json({ practiceId: `practice-${userId}-${Date.now()}`, scenario, startedAt: new Date().toISOString() });
});

app.post("/api/practice/message", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message || message.length > 2000) return res.status(400).json({ error: "Message must be between 1 and 2000 characters." });
  res.json({ userId, message, reply: "Keep going. Make your next message specific and easy to answer." });
});

app.post("/api/practice/finish", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  const score = Math.max(0, Math.min(100, Number(req.body?.score) || 0));
  res.json({ userId, score, feedback: "Specific beats impressive. Keep the pressure low and the details real." });
});

app.post("/api/coach/context", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  const context = typeof req.body?.context === "string" ? req.body.context.trim().slice(0, 500) : "";
  if (!context) return res.status(400).json({ error: "Coach context is required." });
  res.json({ userId, context, createdAt: new Date().toISOString() });
});

app.get("/api/community", async (req, res) => {
  const userId = await getAuthenticatedUserId(req);
  const category = typeof req.query.category === "string" ? req.query.category.toUpperCase() : "ALL";
  const search = typeof req.query.search === "string" ? req.query.search.toLowerCase() : "";
  const teachings = demoCommunityTeachings.filter((teaching) =>
    (category === "ALL" || teaching.category === category) &&
    (!search || `${teaching.title} ${teaching.summary}`.toLowerCase().includes(search))
  );
  res.json({ teachings, userId, nextCursor: null });
});

app.get("/api/community/teachings/:id", async (req, res) => {
  const teaching = demoCommunityTeachings.find((item) => item.id === req.params.id);
  if (!teaching) return res.status(404).json({ error: "Teaching not found." });
  res.json({ teaching });
});

app.get("/api/community/progress", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  res.json({ userId, saved: [...demoCommunitySaves].filter((key) => key.startsWith(`${userId}:`)), completed: [...demoCommunityCompletions].filter((key) => key.startsWith(`${userId}:`)) });
});

app.post("/api/community/teachings/:id/view", async (req, res) => {
  const teaching = demoCommunityTeachings.find((item) => item.id === req.params.id);
  if (!teaching) return res.status(404).json({ error: "Teaching not found." });
  res.status(201).json({ teachingId: teaching.id, viewedAt: new Date().toISOString() });
});

app.post("/api/community/teachings/:id/save", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  const key = `${userId}:${req.params.id}`;
  demoCommunitySaves.add(key);
  res.json({ saved: true, teachingId: req.params.id });
});

app.delete("/api/community/teachings/:id/save", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  demoCommunitySaves.delete(`${userId}:${req.params.id}`);
  res.json({ saved: false, teachingId: req.params.id });
});

app.post("/api/community/teachings/:id/react", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  const reaction = typeof req.body?.reaction === "string" ? req.body.reaction : "";
  if (!["🔥", "💀", "💡", "❤️"].includes(reaction)) return res.status(400).json({ error: "Unsupported reaction." });
  const key = `${userId}:${req.params.id}`;
  if (demoCommunityReactions.has(key)) return res.status(409).json({ error: "Teaching already reacted to." });
  demoCommunityReactions.set(key, reaction);
  res.status(201).json({ reaction, teachingId: req.params.id });
});

app.post("/api/community/teachings/:id/complete", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  const teaching = demoCommunityTeachings.find((item) => item.id === req.params.id);
  if (!teaching) return res.status(404).json({ error: "Teaching not found." });
  const key = `${userId}:${teaching.id}`;
  if (demoCommunityCompletions.has(key)) return res.status(409).json({ error: "Teaching already completed." });
  demoCommunityCompletions.add(key);
  res.status(201).json({ completed: true, xpAwarded: teaching.xp, teachingId: teaching.id });
});

app.get("/api/community/challenges", (_req, res) => {
  res.json({ challenges: [{ id: "challenge-question", title: "Ask one better question today", description: "Ask something that reveals personality, then share something about yourself.", xp: 25 }] });
});

app.post("/api/community/challenges/:id/complete", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  res.status(201).json({ completed: true, challengeId: req.params.id, xpAwarded: 25 });
});

app.get("/api/profile", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  res.json({ userId, profile: demoProfiles.get(userId) || {}, audits: demoProfileAudits.get(userId) || [] });
});

app.patch("/api/profile", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  const current = demoProfiles.get(userId) || {};
  const next = { ...current, goal: String(req.body?.goal || current.goal || "dates").slice(0, 50), blocker: String(req.body?.blocker || current.blocker || "overthinking").slice(0, 80), vibe: ["gentle", "direct", "brutal"].includes(req.body?.vibe) ? req.body.vibe : current.vibe || "direct", updatedAt: new Date().toISOString() };
  demoProfiles.set(userId, next);
  res.json({ profile: next });
});

app.post("/api/profile/avatar", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  const image = typeof req.body?.dataUrl === "string" ? req.body.dataUrl : "";
  if (!/^data:image\/(png|jpeg|webp);base64,/i.test(image) || image.length > 7_000_000) return res.status(400).json({ error: "Invalid avatar image." });
  demoProfiles.set(userId, { ...(demoProfiles.get(userId) || {}), avatarUrl: image });
  res.status(201).json({ saved: true });
});

app.delete("/api/profile/avatar", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  const profile = demoProfiles.get(userId) || {};
  delete profile.avatarUrl;
  demoProfiles.set(userId, profile);
  res.json({ deleted: true });
});

app.post("/api/profile/dating-screenshots", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  const image = typeof req.body?.dataUrl === "string" ? req.body.dataUrl : "";
  if (!/^data:image\/(png|jpeg|webp);base64,/i.test(image) || image.length > 7_000_000) return res.status(400).json({ error: "Invalid screenshot." });
  res.status(201).json({ id: `screenshot-${Date.now()}`, userId, saved: true });
});

app.post("/api/profile/roast", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  const audit = { id: `audit-${Date.now()}`, userId, score: 7.1, analysis: { biggestFix: "Show more of your personality and give people an easy conversation hook.", keep: "Clear, recent photos with a visible face.", change: "Replace generic claims with specific details.", test: "Try one bio line that invites a playful reply." }, createdAt: new Date().toISOString() };
  const audits = demoProfileAudits.get(userId) || [];
  demoProfileAudits.set(userId, [audit, ...audits].slice(0, 20));
  res.status(201).json({ audit });
});

app.get("/api/profile/audits", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  res.json({ audits: demoProfileAudits.get(userId) || [] });
});

app.get("/api/profile/progress", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  res.json({ userId, xp: 0, streak: 0, activeDays: 0, skills: {} });
});

app.get("/api/profile/achievements", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  res.json({ userId, achievements: [] });
});

app.get("/api/profile/journal", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  res.json({ entries: demoJournalEntries.get(userId) || [] });
});

app.post("/api/profile/journal", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  if (!content || content.length > 5000) return res.status(400).json({ error: "Journal content is required and must be under 5000 characters." });
  const entry = { id: `journal-${Date.now()}`, userId, title: String(req.body?.title || "Dating reflection").slice(0, 100), type: String(req.body?.type || "observation").slice(0, 40), content, createdAt: new Date().toISOString() };
  demoJournalEntries.set(userId, [entry, ...(demoJournalEntries.get(userId) || [])]);
  res.status(201).json({ entry });
});

app.patch("/api/profile/journal/:id", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  const entries = demoJournalEntries.get(userId) || [];
  const entry = entries.find((item) => item.id === req.params.id);
  if (!entry) return res.status(404).json({ error: "Journal entry not found." });
  Object.assign(entry, { title: String(req.body?.title || entry.title).slice(0, 100), content: String(req.body?.content || entry.content).slice(0, 5000), updatedAt: new Date().toISOString() });
  res.json({ entry });
});

app.delete("/api/profile/journal/:id", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  demoJournalEntries.set(userId, (demoJournalEntries.get(userId) || []).filter((item) => item.id !== req.params.id));
  res.json({ deleted: true });
});

app.post("/api/profile/reset", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId || req.body?.confirmation !== "RESET") return res.status(400).json({ error: "Explicit RESET confirmation required." });
  demoProfiles.delete(userId); demoProfileAudits.delete(userId); demoJournalEntries.delete(userId);
  res.json({ deleted: true });
});

app.post("/api/profile/export", async (req, res) => {
  const userId = requireUser(res, await getAuthenticatedUserId(req));
  if (!userId) return;
  res.json({ userId, profile: demoProfiles.get(userId) || {}, audits: demoProfileAudits.get(userId) || [], journal: demoJournalEntries.get(userId) || [], exportedAt: new Date().toISOString() });
});

app.get("/api/admin/dashboard", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  const totalXp = [...demoProfiles.values()].reduce((sum, profile) => sum + Number(profile.xp || 0), 0);
  res.json({ metrics: { users: demoProfiles.size, proUsers: 0, activeToday: 0, totalXp, coachMessagesToday: 0, tasksCompletedToday: 0, communityTeachings: demoCommunityTeachings.length, profileAudits: [...demoProfileAudits.values()].reduce((sum, audits) => sum + audits.length, 0), activeStreaks: 0 }, generatedAt: new Date().toISOString() });
});

app.get("/api/admin/users", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  const search = typeof req.query.search === "string" ? req.query.search.toLowerCase() : "";
  const users = [...demoProfiles.entries()].filter(([id, profile]) => !search || `${id} ${profile.username || ""} ${profile.email || ""}`.toLowerCase().includes(search)).map(([id, profile]) => ({ id, username: profile.username, email: profile.email, xp: profile.xp || 0, streak: profile.streak || 0, isPro: Boolean(profile.isPro) }));
  res.json({ users, nextCursor: null });
});

app.get("/api/admin/audit-logs", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  res.json({ logs: demoAdminAuditLogs });
});

app.get("/api/admin/features", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  res.json({ features: Object.fromEntries(demoAdminFeatures) });
});

app.patch("/api/admin/features/:key", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  const state = req.body?.state;
  if (!["ON", "OFF", "BETA"].includes(state)) return res.status(400).json({ error: "Feature state must be ON, OFF, or BETA." });
  demoAdminFeatures.set(req.params.key, state);
  recordAdminAudit(adminId, "CHANGED FEATURE FLAG", "feature_flag", req.params.key, { state });
  res.json({ key: req.params.key, state });
});

app.post("/api/admin/broadcasts", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 80) : "";
  const message = typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 500) : "";
  if (!title || !message) return res.status(400).json({ error: "Title and message are required." });
  const broadcast = { id: `broadcast-${Date.now()}`, title, message, tone: req.body?.tone || "update", status: req.body?.publish ? "LIVE" : "DRAFT", createdAt: new Date().toISOString(), createdBy: adminId };
  recordAdminAudit(adminId, req.body?.publish ? "PUBLISHED BROADCAST" : "SAVED BROADCAST DRAFT", "broadcast", broadcast.id);
  res.status(201).json({ broadcast });
});

app.patch("/api/admin/daily-lesson", async (req, res) => {
  const adminId = await requireAdmin(req, res);
  if (!adminId) return;
  const payload = { lessonId: req.body?.lessonId || null, focus: String(req.body?.focus || "").slice(0, 100), taskType: String(req.body?.taskType || "PRACTICE"), difficulty: String(req.body?.difficulty || "INTERMEDIATE"), xp: Math.max(0, Math.min(500, Number(req.body?.xp) || 0)), updatedAt: new Date().toISOString() };
  recordAdminAudit(adminId, "UPDATED DAILY LESSON", "daily_lesson", "today", payload);
  res.json({ config: payload });
});

// Helper to initialize Gemini SDK safely
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// API endpoint for AI Dating Coach & Chat Roaster
app.post("/api/coach", async (req, res) => {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const {
      message,
      vibe = "direct",
      history = [],
      imageBase64,
      profile = {},
    } = req.body;

    const userText =
      typeof message === "string" ? message.trim().slice(0, 4000) : "";

    if (!userText && !imageBase64) {
      return res.status(400).json({ error: "Message or image is required." });
    }

    if (typeof imageBase64 === "string" && imageBase64.length > 8_000_000) {
      return res.status(400).json({ error: "Image is too large." });
    }

    const plan = await getCoachPlan(userId);
    const freeDailyLimit = 3;

    if (plan === "free") {
      const usedToday = await getCoachUsageToday(userId);

      if (usedToday >= freeDailyLimit) {
        return res.status(429).json({
          error: "Daily Coach limit reached.",
          code: "COACH_DAILY_LIMIT",
          plan: "free",
          limit: freeDailyLimit,
          used: usedToday,
          remaining: 0,
        });
      }
    }

    const ai = getGeminiClient();

    let vibeInstruction = "";
    if (vibe === "brutal" || vibe === "roasty") {
      vibeInstruction =
        "You are 'lol coach' on datings.lol in BRUTAL mode: blunt, concise, honest, and occasionally funny, but never abusive, degrading, coercive, manipulative, or cruel. Call out double texts, dry replies, pressure, and weak moves, then give a better move.";
    } else if (vibe === "gentle") {
      vibeInstruction =
        "You are 'lol coach' on datings.lol - a warm, supportive, encouraging dating coach. Hype the user up, validate their feelings, reduce anxiety, and give clear, confident, actionable advice and reply suggestions.";
    } else {
      vibeInstruction =
        "You are 'lol coach' on datings.lol - a direct, no-BS dating coach. Concise, tactical, no fluff, straight to the point with actionable steps and exact text templates.";
    }

    const systemInstruction = `${vibeInstruction}

The user's context is:
goal=${profile.goal || "unknown"}
blocker=${profile.blocker || "unknown"}
experience=${profile.experience || "unknown"}

You are a practical dating coach.

OUTPUT FORMAT — FOLLOW EXACTLY:
COACH'S TAKE
[ONE short sentence]

DO THIS
[ONE short sentence]

TRY
"[ONE short message the user can send]"

STRICT RULES:
- Output ONLY those 3 sections.
- Use the headings exactly: COACH'S TAKE, DO THIS, TRY.
- COACH'S TAKE = exactly one short sentence.
- DO THIS = exactly one short sentence.
- TRY = exactly one short message in quotation marks.
- No WHY section.
- No bullet points.
- No extra explanation.
- No paragraphs.
- Keep the entire response very short.
- Never claim certainty about another person's feelings.
- Never encourage manipulation, pressure, harassment, or deception.`;

    let responseText: string | null = null;
    let usedModel: string | null = null;
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;
    let totalTokens: number | null = null;

    if (ai) {
      const contents: any[] = [];

      if (Array.isArray(history) && history.length > 0) {
        history.slice(-6).forEach((h: any) => {
          if (h.text) {
            contents.push({
              role: h.role === "user" ? "user" : "model",
              parts: [{ text: String(h.text).slice(0, 3000) }],
            });
          }
        });
      }

      const currentParts: any[] = [];

      if (imageBase64) {
        const cleanedBase64 = String(imageBase64).replace(
          /^data:image\/\w+;base64,/,
          "",
        );
        const mimeMatch = String(imageBase64).match(
          /^data:(image\/\w+);base64,/,
        );
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

        currentParts.push({
          inlineData: {
            mimeType,
            data: cleanedBase64,
          },
        });
      }

      const userPrompt =
        userText ||
        (imageBase64
          ? "Roast this chat / profile screenshot and give me actionable fixes."
          : "Give me dating advice.");

      currentParts.push({ text: userPrompt });

      contents.push({
        role: "user",
        parts: currentParts,
      });

      const candidateModels = [
        "gemini-3.8-flash",
        "gemini-flash-latest",
        "gemini-2.5-flash",
      ];

      for (const model of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction,
              temperature: 0.7,
              maxOutputTokens: 80,
            },
          });

          if (response.text) {
            responseText = response.text;
            usedModel = model;

            const usage = (response as any).usageMetadata;
            inputTokens =
              Number(usage?.promptTokenCount ?? usage?.inputTokenCount) || null;
            outputTokens =
              Number(usage?.candidatesTokenCount ?? usage?.outputTokenCount) ||
              null;
            totalTokens =
              Number(usage?.totalTokenCount) ||
              (inputTokens !== null || outputTokens !== null
                ? (inputTokens || 0) + (outputTokens || 0)
                : null);

            break;
          }
        } catch (modelError: any) {
          console.warn(
            `Model ${model} failed, trying next candidate:`,
            modelError?.message || modelError,
          );
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    await recordCoachUsage(
      userId,
      plan,
      usedModel,
      inputTokens,
      outputTokens,
      totalTokens,
    );

    if (responseText) {
      await saveCoachResult(userId, userText, responseText);

      return res.json({
        text: responseText,
        isAi: true,
        plan,
        usage: {
          model: usedModel,
          inputTokens,
          outputTokens,
          totalTokens,
        },
      });
    }

    const fallbackText = getFallbackResponse(
      userText,
      vibe,
      !!imageBase64,
    );

    await saveCoachResult(userId, userText, fallbackText);

    return res.json({
      text: fallbackText,
      isAi: false,
      plan,
      usage: {
        model: null,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
      },
    });
  } catch (error: any) {
    console.error("Error in /api/coach:", error);

    return res.status(500).json({
      error: "Coach is temporarily unavailable. Please try again.",
      code: "COACH_SERVER_ERROR",
    });
  }
});

// Fallback heuristic engine
function getFallbackResponse(message: string = "", vibe: string = "roasty", hasImage: boolean = false): string {
  const msg = (message || "").toLowerCase();

  if (hasImage) {
    return "bro this screenshot... you opened with 'wyd' or sent 3 unanswered texts? that's not flirting, that's a cry for help! \uD83D\uDC40\n\nHere is what you should say instead:\n• 'ok you left me on read, my ego is in shambles but i'll survive. down for coffee this week?'\n• 'fair enough - felt a vibe, but if not, all good!'";
  }

  if (msg.includes("ghosted") || msg.includes("read")) {
    return "ghosted 101: they didn't die, they just chose silence. stop checking their story! 48hr rule: no checking their stuff for 2 days. if you still care, send ONE casual close-out or delete the chat. your time > their indecision.";
  }

  if (msg.includes("profile") || msg.includes("bio")) {
    return "profile audit: 1 clear face photo in natural light + 1 full body doing something + 1 social proof + 1 chaos hobby. delete 'fluent in sarcasm' immediately. make your bio 70% weird specific humor, 30% hot!";
  }

  if (vibe === "gentle") {
    return "it's totally normal to feel nervous! focus on micro-reps today: make eye contact and smile at 2 people. confidence is built from tiny wins, not giant leaps. you've got this! ✨";
  }

  return "rule of thumb: match their energy, add ONE playful tease, and end with a concrete question or plan. no paragraphs, no double texting!";
}

async function startServer() {
  // Vite middleware for dev
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

    app.listen(PORT, "localhost", () => {
    console.log(`Datings.lol Server running at http://localhost:${PORT}`);
  });
}  // ← ADD THIS

startServer();
