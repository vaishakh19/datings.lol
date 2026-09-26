/**
 * datings.lol — Production API Server
 * ------------------------------------------------------------------
 * Drop-in replacement for the previous demo server. Every route,
 * request shape, and response shape is unchanged, so the UI needs
 * zero modifications. What changed is everything underneath:
 *
 *  - Real persistence via Supabase (in-memory demo mode still available
 *    behind ALLOW_DEMO_MODE=true for local dev without a database)
 *  - Race-free XP awarding and Coach daily quota via Postgres RPCs
 *  - Zod input validation on every write endpoint
 *  - Rate limiting (global API + stricter Coach limiter)
 *  - Helmet security headers, manual strict CORS, request logging (pino)
 *  - Structured errors, request IDs, graceful shutdown, health checks
 *  - Gemini client with model fallback + hard timeouts
 *
 * Run migrations in supabase_migration.sql before deploying.
 */

import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pino } from 'pino';
import { pinoHttp } from 'pino-http';
import { z } from 'zod';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI, Content } from '@google/genai';

// ============================================================================
// CONFIGURATION (validated — the server refuses to boot with a bad env)
// ============================================================================

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),

  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  // Optional: still accepted for backwards compatibility with Vite-style envs.
  VITE_SUPABASE_URL: z.string().url().optional(),

  GEMINI_API_KEY: z.string().optional(),
  COACH_FREE_DAILY_LIMIT: z.coerce.number().int().min(1).max(1000).default(3),
  COACH_XP_REWARD: z.coerce.number().int().min(0).max(1000).default(20),

  ALLOW_DEMO_MODE: z.enum(['true', 'false']).default('false'),
  ENABLE_CSP: z.enum(['true', 'false']).default('true'),
  CORS_ORIGINS: z.string().optional(),
  ADMIN_USER_IDS: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const envResult = envSchema.safeParse(process.env);
if (!envResult.success) {
  console.error('FATAL: invalid environment variables:', envResult.error.flatten().fieldErrors);
  process.exit(1);
}
const env = envResult.data;

const isProd = env.NODE_ENV === 'production';
const demoMode = env.ALLOW_DEMO_MODE === 'true';
const SUPABASE_URL = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? null;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY ?? null;
const GEMINI_API_KEY =
  env.GEMINI_API_KEY && env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' ? env.GEMINI_API_KEY : null;

if (!demoMode && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error('FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production.');
  console.error('       Set ALLOW_DEMO_MODE=true only for local development without a database.');
  process.exit(1);
}

const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: ['req.headers.authorization', 'req.headers.cookie'], censor: '[REDACTED]' },
});

// ============================================================================
// TYPES
// ============================================================================

type TaskKind = 'LEARN' | 'PRACTICE' | 'SIMULATION' | 'REAL_WORLD' | 'REVIEW';
type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'BRUTAL';
type CoachPlan = 'free' | 'pro';

interface GeneratedTask {
  id: string;
  userId: string;
  taskDate: string;
  skill: string;
  kind: TaskKind;
  title: string;
  description: string;
  difficulty: Difficulty;
  xpReward: number;
  completed: boolean;
}

interface Profile {
  id?: string;
  username?: string;
  email?: string;
  xp?: number;
  level?: number;
  streak?: number;
  activeDays?: number;
  lastActiveDate?: string;
  goal?: string;
  blocker?: string;
  vibe?: string;
  avatarUrl?: string;
  isPro?: boolean;
}

interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  type: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
}

interface ProfileAudit {
  id: string;
  userId: string;
  score: number;
  analysis: Record<string, string>;
  createdAt: string;
}

interface DashboardMetrics {
  users: number;
  proUsers: number;
  activeToday: number;
  totalXp: number;
  coachMessagesToday: number;
  tasksCompletedToday: number;
  communityTeachings: number;
  profileAudits: number;
  activeStreaks: number;
}

interface CompleteTaskResult {
  status: 'ok' | 'not_found' | 'already_completed';
  task: GeneratedTask | null;
}

interface GeminiResult {
  text: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

// ============================================================================
// SHARED STATIC CONTENT (community teachings — same data as before)
// ============================================================================

const TEACHINGS = [
  { id: 'teaching-breathe', category: 'TEXTING', type: 'BREAKDOWN', title: 'Stop trying to keep the chat alive', summary: 'Let effort be information. Add personality, then leave room.', xp: 15, accent: '#FFE066' },
  { id: 'teaching-confidence', category: 'CONFIDENCE', type: 'REMINDER', title: 'Confidence is a verb', summary: 'Collect evidence with one small social risk today.', xp: 15, accent: '#BEF264' },
  { id: 'teaching-flirt', category: 'FLIRTING', type: 'COACH TIP', title: 'Flirt without forcing it', summary: 'Playful beats performative. Let your point of view show.', xp: 15, accent: '#FDA4AF' },
] as const;

type Teaching = (typeof TEACHINGS)[number];

function findTeaching(id: string): Teaching | undefined {
  return TEACHINGS.find((t) => t.id === id);
}

// ============================================================================
// UTILITIES
// ============================================================================

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

const badRequest = (m: string) => new ApiError(400, m);
const conflict = (m: string) => new ApiError(409, m);

/** Wraps async route handlers so rejections hit the central error middleware. */
const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };

function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue && issue.path.length ? issue.path.join('.') + ': ' : '';
    throw badRequest(where + (issue?.message ?? 'Invalid request body.'));
  }
  return result.data;
}

/** Same deterministic generator as before — no UI-visible change. */
function buildDailyTask(userId: string, input: Record<string, any> = {}): GeneratedTask {
  const goals = Array.isArray(input.goals) ? input.goals : [];
  const skills = input.skills && typeof input.skills === 'object' ? input.skills : {};
  const rankedSkill = Object.entries(skills)
    .sort(([, left], [, right]) => Number(left) - Number(right))[0]?.[0];

  const skill = rankedSkill || goals[0] || 'texting';
  const skillValue = Number(skills[skill] || 50);

  const templates: Record<string, { title: string; description: string; kind: TaskKind }> = {
    texting: { title: 'Make the next message easier to answer', description: 'Share one specific detail about yourself, then ask a question that gives them somewhere interesting to go.', kind: 'PRACTICE' },
    confidence: { title: 'Take one clean social risk', description: 'Say the thing you normally edit out. Keep it warm, specific, and low-pressure.', kind: 'REAL_WORLD' },
    flirting: { title: 'Add playful energy', description: 'Replace one generic compliment with a light tease that reveals your personality.', kind: 'PRACTICE' },
    asking_out: { title: 'Turn momentum into a plan', description: 'Suggest a specific day and activity instead of leaving the conversation in the talking stage.', kind: 'REAL_WORLD' },
    overthinking: { title: 'Send before the spiral', description: 'Write the honest version in one sentence, read it once, then send it without a second edit.', kind: 'REAL_WORLD' },
  };

  const template = templates[skill] || templates.texting;
  const isBeginner = skillValue < 40;
  const isAdvanced = skillValue > 75;

  return {
    id: `task-${userId}-${todayKey()}`,
    userId,
    taskDate: todayKey(),
    skill,
    kind: template.kind,
    title: template.title,
    description: template.description,
    difficulty: isBeginner ? 'BEGINNER' : isAdvanced ? 'ADVANCED' : 'INTERMEDIATE',
    xpReward: 25 + (isAdvanced ? 15 : 0),
    completed: false,
  };
}

// ============================================================================
// SUPABASE CLIENT + AUTH (service-role singleton, token cache)
// ============================================================================

let serviceClient: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!serviceClient) {
    serviceClient = createClient(SUPABASE_URL as string, SUPABASE_SERVICE_ROLE_KEY as string, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return serviceClient;
}

let warnedDemoAuth = false;

async function getAuthenticatedUserId(req: Request): Promise<string | null> {
  const authorization = req.header('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice(7).trim();
  if (!token) return null;

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    // Validate every token with Supabase. Caching access-token validation lets
    // a signed-out or revoked token continue calling private endpoints.
    const { data, error } = await sb().auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  }

  // Dev-only convenience when running without Supabase: a stable ID derived
  // from the token hash so authenticated routes work locally.
  if (demoMode) {
    const demoTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    if (!warnedDemoAuth) {
      warnedDemoAuth = true;
      logger.warn('Demo mode: deriving user IDs from token hash (no Supabase auth).');
    }
    return `demo-${demoTokenHash.slice(0, 16)}`;
  }
  return null;
}

async function requireAuth(req: Request, res: Response): Promise<string | null> {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required.' });
    return null;
  }
  res.locals.userId = userId;
  return userId;
}

function configuredAdminIds(): string[] {
  return (env.ADMIN_USER_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

async function requireAdmin(req: Request, res: Response): Promise<string | null> {
  const userId = await requireAuth(req, res);
  if (!userId) return null;

  if (configuredAdminIds().includes(userId)) return userId;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(503).json({ error: 'Admin authorization is not configured.' });
    return null;
  }
  const { data, error } = await sb()
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) {
    res.status(403).json({ error: 'Admin permission required.' });
    return null;
  }
  return userId;
}

/** Atomic XP + streak update (never a read-then-write race). */
async function awardXp(userId: string, amount: number): Promise<void> {
  if (demoMode) return;
  const { error } = await sb().rpc('award_xp', { p_user_id: userId, p_amount: amount });
  if (error) logger.warn({ err: error, userId }, 'award_xp RPC failed');
}

// ============================================================================
// DATA STORE — Supabase (production) or in-memory (ALLOW_DEMO_MODE)
// ============================================================================

interface DataStore {
  tasks: {
    getOrCreateToday(userId: string, input: Record<string, unknown>): Promise<GeneratedTask>;
    getToday(userId: string): Promise<GeneratedTask | null>;
    complete(userId: string, taskId: string): Promise<CompleteTaskResult>;
    getProgress(userId: string): Promise<{ xp: number; streak: number; skills: Record<string, { completed: number; total: number }> }>;
  };
  community: {
    progress(userId: string): Promise<{ saved: string[]; completed: string[] }>;
    save(userId: string, teachingId: string): Promise<void>;
    unsave(userId: string, teachingId: string): Promise<void>;
    react(userId: string, teachingId: string, reaction: string): Promise<'ok' | 'already'>;
    complete(userId: string, teachingId: string, xp: number): Promise<'ok' | 'already'>;
  };
  profile: {
    get(userId: string): Promise<{ profile: Profile; audits: ProfileAudit[] }>;
    update(userId: string, patch: { goal?: string; blocker?: string; vibe?: string }): Promise<Profile>;
    saveAvatar(userId: string, dataUrl: string): Promise<void>;
  };
  journal: {
    list(userId: string): Promise<JournalEntry[]>;
    create(userId: string, input: { title: string; type: string; content: string }): Promise<JournalEntry>;
    update(userId: string, id: string, patch: { title?: string; content?: string }): Promise<JournalEntry | null>;
    remove(userId: string, id: string): Promise<boolean>;
  };
  admin: {
    dashboard(): Promise<DashboardMetrics>;
    users(search: string): Promise<Array<{ id: string; username?: string; email?: string; xp: number; streak: number; isPro: boolean }>>;
    setFeatureFlag(adminId: string, key: string, state: string): Promise<void>;
  };
  coach: {
    getPlan(userId: string): Promise<CoachPlan>;
    consumeQuota(userId: string, limit: number): Promise<boolean>;
    usageToday(userId: string): Promise<number>;
    recordUsage(userId: string, plan: CoachPlan, model: string | null, inputTokens: number | null, outputTokens: number | null, totalTokens: number | null): Promise<void>;
    saveResult(userId: string, situation: string, responseText: string): Promise<void>;
  };
}

/* -------------------------------------------------------------------------- */
/* In-memory implementation (demo mode — same behavior as the original server) */
/* -------------------------------------------------------------------------- */

function createMemoryStore(): DataStore {
  const tasks = new Map<string, GeneratedTask>();
  const communitySaves = new Set<string>();
  const communityCompletions = new Set<string>();
  const communityReactions = new Map<string, string>();
  const profiles = new Map<string, Profile>();
  const audits = new Map<string, ProfileAudit[]>();
  const journalEntries = new Map<string, JournalEntry[]>();
  const coachUsageLog: Array<{ userId: string; date: string }> = [];
  const proUsers = new Set<string>();

  const touchProfile = (userId: string, xpDelta = 0) => {
    const current = profiles.get(userId) || {};
    const today = todayKey();
    const newXp = (current.xp || 0) + xpDelta;
    profiles.set(userId, {
      ...current,
      id: userId,
      xp: newXp,
      level: Math.floor(newXp / 100) + 1,
      streak: current.lastActiveDate === today ? current.streak || 0 : (current.streak || 0) + 1,
      lastActiveDate: today,
    });
  };

  const key = (userId: string, id: string) => `${userId}:${id}`;

  return {
    tasks: {
      getOrCreateToday(userId, input) {
        const k = `${userId}:${todayKey()}`;
        const existing = tasks.get(k);
        if (existing) return Promise.resolve(existing);
        const task = buildDailyTask(userId, input);
        tasks.set(k, task);
        return Promise.resolve(task);
      },
      getToday(userId) {
        return Promise.resolve(tasks.get(`${userId}:${todayKey()}`) ?? null);
      },
      async complete(userId, taskId) {
        const k = `${userId}:${todayKey()}`;
        const task = tasks.get(k);
        if (!task || task.id !== taskId) return { status: 'not_found', task: null };
        if (task.completed) return { status: 'already_completed', task };
        task.completed = true;
        touchProfile(userId, task.xpReward);
        return { status: 'ok', task };
      },
      getProgress(userId) {
        const profile = profiles.get(userId) || {};
        const skills: Record<string, { completed: number; total: number }> = {};
        for (const task of tasks.values()) {
          if (task.userId !== userId) continue;
          skills[task.skill] = skills[task.skill] || { completed: 0, total: 0 };
          skills[task.skill].total += 1;
          if (task.completed) skills[task.skill].completed += 1;
        }
        return Promise.resolve({ xp: profile.xp || 0, streak: profile.streak || 0, skills });
      },
    },
    community: {
      progress(userId) {
        const prefix = `${userId}:`;
        return Promise.resolve({
          saved: [...communitySaves].filter((k) => k.startsWith(prefix)),
          completed: [...communityCompletions].filter((k) => k.startsWith(prefix)),
        });
      },
      save(userId, teachingId) {
        communitySaves.add(key(userId, teachingId));
        return Promise.resolve();
      },
      unsave(userId, teachingId) {
        communitySaves.delete(key(userId, teachingId));
        return Promise.resolve();
      },
      react(userId, teachingId) {
        const k = key(userId, teachingId);
        if (communityReactions.has(k)) return Promise.resolve('already');
        communityReactions.set(k, 'x');
        return Promise.resolve('ok');
      },
      complete(userId, teachingId, xp) {
        const k = key(userId, teachingId);
        if (communityCompletions.has(k)) return Promise.resolve('already');
        communityCompletions.add(k);
        touchProfile(userId, xp);
        return Promise.resolve('ok');
      },
    },
    profile: {
      async get(userId) {
        return { profile: profiles.get(userId) || {}, audits: audits.get(userId) || [] };
      },
      async update(userId, patch) {
        const current = profiles.get(userId) || {};
        const next: Profile = {
          ...current,
          id: userId,
          goal: patch.goal ?? current.goal ?? 'dates',
          blocker: patch.blocker ?? current.blocker ?? 'overthinking',
          vibe: patch.vibe ?? current.vibe ?? 'direct',
          lastActiveDate: todayKey(),
        };
        profiles.set(userId, next);
        return next;
      },
      async saveAvatar(userId, dataUrl) {
        profiles.set(userId, { ...(profiles.get(userId) || { id: userId }), avatarUrl: dataUrl });
      },
    },
    journal: {
      list(userId) {
        return Promise.resolve(journalEntries.get(userId) || []);
      },
      create(userId, input) {
        const entry: JournalEntry = {
          id: `journal-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
          userId,
          title: input.title,
          type: input.type,
          content: input.content,
          createdAt: new Date().toISOString(),
        };
        journalEntries.set(userId, [entry, ...(journalEntries.get(userId) || [])]);
        return Promise.resolve(entry);
      },
      update(userId, id, patch) {
        const entries = journalEntries.get(userId) || [];
        const entry = entries.find((e) => e.id === id);
        if (!entry) return Promise.resolve(null);
        if (patch.title !== undefined) entry.title = patch.title;
        if (patch.content !== undefined) entry.content = patch.content;
        entry.updatedAt = new Date().toISOString();
        return Promise.resolve(entry);
      },
      remove(userId, id) {
        const entries = journalEntries.get(userId) || [];
        journalEntries.set(userId, entries.filter((e) => e.id !== id));
        return Promise.resolve(true);
      },
    },
    admin: {
      async dashboard() {
        const totalXp = [...profiles.values()].reduce((sum, p) => sum + Number(p.xp || 0), 0);
        return {
          users: profiles.size,
          proUsers: proUsers.size,
          activeToday: [...profiles.values()].filter((p) => p.lastActiveDate === todayKey()).length,
          totalXp,
          coachMessagesToday: coachUsageLog.filter((u) => u.userId && u.date === todayKey()).length,
          tasksCompletedToday: 0,
          communityTeachings: TEACHINGS.length,
          profileAudits: [...audits.values()].reduce((s, a) => s + a.length, 0),
          activeStreaks: [...profiles.values()].filter((p) => (p.streak || 0) > 0).length,
        };
      },
      users() {
        return Promise.resolve(
          [...profiles.entries()].map(([id, p]) => ({
            id,
            username: p.username,
            email: p.email,
            xp: p.xp || 0,
            streak: p.streak || 0,
            isPro: proUsers.has(id),
          })),
        );
      },
      async setFeatureFlag() {
        /* demo: feature flags were never persisted; keep as no-op */
      },
    },
    coach: {
      getPlan(userId) {
        return Promise.resolve(proUsers.has(userId) ? 'pro' : 'free');
      },
      consumeQuota(userId, limit) {
        const used = coachUsageLog.filter((u) => u.userId === userId && u.date === todayKey()).length;
        if (used >= limit) return Promise.resolve(false);
        coachUsageLog.push({ userId, date: todayKey() });
        return Promise.resolve(true);
      },
      usageToday(userId) {
        return Promise.resolve(coachUsageLog.filter((u) => u.userId === userId && u.date === todayKey()).length);
      },
      recordUsage() {
        return Promise.resolve();
      },
      async saveResult(userId) {
        touchProfile(userId, env.COACH_XP_REWARD);
      },
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Supabase implementation (production)                                        */
/* -------------------------------------------------------------------------- */

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

function createSupabaseStore(): DataStore {
  /** Fetch one metric but degrade to a fallback instead of failing the dashboard. */
  const metric = async <T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      logger.warn({ err, metric: name }, 'dashboard metric failed');
      return fallback;
    }
  };

  const count = async (table: string, apply?: (q: any) => any): Promise<number> => {
    let q = sb().from(table).select('*', { count: 'exact', head: true });
    if (apply) q = apply(q);
    const { count: c, error } = await q;
    if (error) throw error;
    return c || 0;
  };

  const profileToCamel = (row: any): Profile => ({
    id: row?.id,
    username: row?.username,
    email: row?.email,
    xp: row?.xp ?? 0,
    level: row?.level ?? 1,
    streak: row?.streak ?? 0,
    lastActiveDate: row?.last_active_date,
    goal: row?.goal,
    blocker: row?.blocker,
    vibe: row?.vibe,
    avatarUrl: row?.avatar_url,
    isPro: Boolean(row?.is_pro),
  });

  return {
    tasks: {
      async getOrCreateToday(userId, input) {
        const generated = buildDailyTask(userId, input);
        const { data, error } = await sb()
          .from('daily_tasks')
          .upsert(
            { user_id: userId, task_date: generated.taskDate, payload: generated as any },
            { onConflict: 'user_id,task_date' },
          )
          .select('payload, completed')
          .single();
        if (error) {
          logger.warn({ err: error, userId }, 'daily task upsert failed; returning generated task');
          return generated;
        }
        return { ...(data.payload as GeneratedTask), completed: data.completed };
      },
      async getToday(userId) {
        const { data } = await sb()
          .from('daily_tasks')
          .select('payload, completed')
          .eq('user_id', userId)
          .eq('task_date', todayKey())
          .maybeSingle();
        if (!data) return null;
        return { ...(data.payload as GeneratedTask), completed: data.completed };
      },
      async complete(userId, taskId) {
        const { data: row } = await sb()
          .from('daily_tasks')
          .select('payload, completed')
          .eq('user_id', userId)
          .eq('task_date', todayKey())
          .maybeSingle();
        if (!row || (row.payload as GeneratedTask)?.id !== taskId) {
          return { status: 'not_found', task: null };
        }
        const task = { ...(row.payload as GeneratedTask), completed: true };
        const { data: updated, error } = await sb()
          .from('daily_tasks')
          .update({ completed: true, completed_at: new Date().toISOString(), payload: task })
          .eq('user_id', userId)
          .eq('task_date', todayKey())
          .eq('completed', false)
          .select('payload')
          .maybeSingle();
        if (error) throw new ApiError(500, 'Failed to complete task.');
        if (!updated) return { status: 'already_completed', task }; // lost a race
        await awardXp(userId, task.xpReward);
        return { status: 'ok', task };
      },
      async getProgress(userId) {
        const { data: profile } = await sb()
          .from('profiles')
          .select('xp, streak')
          .eq('id', userId)
          .maybeSingle();
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const { data: rows } = await sb()
          .from('daily_tasks')
          .select('payload, completed')
          .eq('user_id', userId)
          .gte('task_date', since);
        const skills: Record<string, { completed: number; total: number }> = {};
        for (const row of rows ?? []) {
          const skill = (row.payload as GeneratedTask)?.skill;
          if (!skill) continue;
          skills[skill] = skills[skill] || { completed: 0, total: 0 };
          skills[skill].total += 1;
          if (row.completed) skills[skill].completed += 1;
        }
        return { xp: profile?.xp ?? 0, streak: profile?.streak ?? 0, skills };
      },
    },
    community: {
      async progress(userId) {
        const [{ data: saves }, { data: completions }] = await Promise.all([
          sb().from('community_saves').select('teaching_id').eq('user_id', userId),
          sb().from('community_completions').select('teaching_id').eq('user_id', userId),
        ]);
        return {
          saved: (saves ?? []).map((r: any) => `${userId}:${r.teaching_id}`),
          completed: (completions ?? []).map((r: any) => `${userId}:${r.teaching_id}`),
        };
      },
      async save(userId, teachingId) {
        const { error } = await sb()
          .from('community_saves')
          .upsert({ user_id: userId, teaching_id: teachingId }, { onConflict: 'user_id,teaching_id' });
        if (error) throw new ApiError(500, 'Failed to save teaching.');
      },
      async unsave(userId, teachingId) {
        const { error } = await sb()
          .from('community_saves')
          .delete()
          .eq('user_id', userId)
          .eq('teaching_id', teachingId);
        if (error) throw new ApiError(500, 'Failed to unsave teaching.');
      },
      async react(userId, teachingId, reaction) {
        const { error } = await sb()
          .from('community_reactions')
          .insert({ user_id: userId, teaching_id: teachingId, reaction });
        if (isUniqueViolation(error)) return 'already';
        if (error) throw new ApiError(500, 'Failed to record reaction.');
        return 'ok';
      },
      async complete(userId, teachingId, xp) {
        const { error } = await sb()
          .from('community_completions')
          .insert({ user_id: userId, teaching_id: teachingId, xp_awarded: xp });
        if (isUniqueViolation(error)) return 'already';
        if (error) throw new ApiError(500, 'Failed to complete teaching.');
        await awardXp(userId, xp);
        return 'ok';
      },
    },
    profile: {
      async get(userId) {
        const [{ data: row }, { data: auditRows }] = await Promise.all([
          sb().from('profiles').select('*').eq('id', userId).maybeSingle(),
          sb().from('profile_audits').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        ]);
        const profileAudits: ProfileAudit[] = (auditRows ?? []).map((a: any) => ({
          id: a.id,
          userId: a.user_id,
          score: a.score,
          analysis: a.analysis ?? {},
          createdAt: a.created_at,
        }));
        return { profile: profileToCamel(row), audits: profileAudits };
      },
      async update(userId, patch) {
        const { data: current } = await sb().from('profiles').select('*').eq('id', userId).maybeSingle();
        const next = {
          goal: patch.goal ?? current?.goal ?? 'dates',
          blocker: patch.blocker ?? current?.blocker ?? 'overthinking',
          vibe: patch.vibe ?? current?.vibe ?? 'direct',
          last_active_date: todayKey(),
        };
        const { error } = await sb().from('profiles').upsert({ id: userId, ...next }, { onConflict: 'id' });
        if (error) throw new ApiError(500, 'Failed to update profile.');
        return { ...profileToCamel(current), id: userId, ...next, lastActiveDate: next.last_active_date };
      },
      async saveAvatar(userId, dataUrl) {
        const { error } = await sb()
          .from('profiles')
          .upsert({ id: userId, avatar_url: dataUrl }, { onConflict: 'id' });
        if (error) throw new ApiError(500, 'Failed to save avatar.');
      },
    },
    journal: {
      async list(userId) {
        const { data, error } = await sb()
          .from('journal_entries')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (error) throw new ApiError(500, 'Failed to load journal.');
        return (data ?? []).map((e: any) => ({
          id: e.id,
          userId: e.user_id,
          title: e.title,
          type: e.type,
          content: e.content,
          createdAt: e.created_at,
          updatedAt: e.updated_at ?? undefined,
        }));
      },
      async create(userId, input) {
        const { data, error } = await sb()
          .from('journal_entries')
          .insert({ user_id: userId, title: input.title, type: input.type, content: input.content })
          .select()
          .single();
        if (error) throw new ApiError(500, 'Failed to save journal entry.');
        return {
          id: data.id,
          userId: data.user_id,
          title: data.title,
          type: data.type,
          content: data.content,
          createdAt: data.created_at,
        };
      },
      async update(userId, id, patch) {
        const updates: Record<string, string> = { updated_at: new Date().toISOString() };
        if (patch.title !== undefined) updates.title = patch.title;
        if (patch.content !== undefined) updates.content = patch.content;
        const { data, error } = await sb()
          .from('journal_entries')
          .update(updates)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .maybeSingle();
        if (error) throw new ApiError(500, 'Failed to update journal entry.');
        if (!data) return null;
        return {
          id: data.id,
          userId: data.user_id,
          title: data.title,
          type: data.type,
          content: data.content,
          createdAt: data.created_at,
          updatedAt: data.updated_at ?? undefined,
        };
      },
      async remove(userId, id) {
        const { error } = await sb().from('journal_entries').delete().eq('id', id).eq('user_id', userId);
        if (error) throw new ApiError(500, 'Failed to delete journal entry.');
        return true;
      },
    },
    admin: {
      async dashboard() {
        const today = todayKey();
        const [users, proUsers, activeToday, totalXp, coachMessagesToday, tasksCompletedToday, profileAudits, activeStreaks] =
          await Promise.all([
            metric('users', () => count('profiles'), 0),
            metric('proUsers', () => count('subscriptions', (q) => q.eq('status', 'active').eq('plan', 'pro')), 0),
            metric('activeToday', () => count('profiles', (q) => q.eq('last_active_date', today)), 0),
            metric('totalXp', async () => {
              const { data, error } = await sb().from('profiles').select('xp').limit(10000);
              if (error) throw error;
              return (data ?? []).reduce((sum: number, r: any) => sum + Number(r.xp || 0), 0);
            }, 0),
            metric('coachMessagesToday', () => count('coach_usage', (q) => q.gte('created_at', startOfTodayIso())), 0),
            metric('tasksCompletedToday', () => count('daily_tasks', (q) => q.eq('completed', true).gte('completed_at', startOfTodayIso())), 0),
            metric('profileAudits', () => count('profile_audits'), 0),
            metric('activeStreaks', () => count('profiles', (q) => q.gt('streak', 0)), 0),
          ]);
        return {
          users,
          proUsers,
          activeToday,
          totalXp,
          coachMessagesToday,
          tasksCompletedToday,
          communityTeachings: TEACHINGS.length,
          profileAudits,
          activeStreaks,
        };
      },
      async users(search) {
        const needle = search.trim().toLowerCase();
        // Do not interpolate user input into PostgREST's .or() filter syntax.
        // Besides wildcard surprises, commas and parentheses can alter the filter.
        const escapedNeedle = needle.replace(/[\%_]/g, (character) => `\\${character}`);
        const base = () => sb().from('profiles').select('id, username, email, xp, streak').limit(500);
        const profileQueries = needle
          ? [base().ilike('username', `%${escapedNeedle}%`), base().ilike('email', `%${escapedNeedle}%`)]
          : [base()];
        const [{ data: firstRows, error: firstError }, { data: secondRows, error: secondError }, { data: proRows }] = await Promise.all([
          profileQueries[0],
          profileQueries[1] ?? Promise.resolve({ data: [], error: null }),
          sb().from('subscriptions').select('user_id').eq('status', 'active').eq('plan', 'pro'),
        ]);
        const error = firstError || secondError;
        const rows = [...(firstRows ?? []), ...(secondRows ?? [])].filter((row, index, all) =>
          all.findIndex((candidate) => candidate.id === row.id) === index,
        );
        if (error) {
          logger.warn({ err: error }, 'admin users query failed');
          return [];
        }
        const proSet = new Set((proRows ?? []).map((r: any) => r.user_id));
        return (rows ?? [])
          .filter(
            (r: any) =>
              !needle ||
              String(r.id).toLowerCase().includes(needle) ||
              String(r.username ?? '').toLowerCase().includes(needle) ||
              String(r.email ?? '').toLowerCase().includes(needle),
          )
          .map((r: any) => ({
            id: r.id,
            username: r.username,
            email: r.email,
            xp: r.xp || 0,
            streak: r.streak || 0,
            isPro: proSet.has(r.id),
          }));
      },
      async setFeatureFlag(adminId, key, state) {
        const { error } = await sb()
          .from('admin_features')
          .upsert({ key, state, updated_by: adminId, updated_at: new Date().toISOString() }, { onConflict: 'key' });
        if (error) throw new ApiError(500, 'Failed to update feature flag.');
        const { error: auditError } = await sb().from('admin_audit_logs').insert({
          admin_user_id: adminId,
          action: 'CHANGED FEATURE FLAG',
          target_type: 'feature_flag',
          target_id: key,
          metadata: { state },
        });
        if (auditError) logger.warn({ err: auditError }, 'admin audit log insert failed');
      },
    },
    coach: {
      async getPlan(userId) {
        const { data, error } = await sb()
          .from('subscriptions')
          .select('plan, status')
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle();
        if (error || !data) return 'free';
        return data.plan === 'pro' ? 'pro' : 'free';
      },
      async consumeQuota(userId, limit) {
        // Atomically increments the daily counter only when under the limit —
        // no check-then-act race, even with concurrent requests.
        const { data, error } = await sb().rpc('try_consume_coach_quota', {
          p_user_id: userId,
          p_limit: limit,
        });
        if (error) throw new ApiError(503, 'Coach quota service unavailable.');
        return Boolean(data);
      },
      async usageToday(userId) {
        const { count, error } = await sb()
          .from('coach_usage')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', startOfTodayIso());
        if (error) {
          logger.warn({ err: error, userId }, 'coach usage lookup failed');
          return 0;
        }
        return count || 0;
      },
      async recordUsage(userId, plan, model, inputTokens, outputTokens, totalTokens) {
        const { error } = await sb().from('coach_usage').insert({
          user_id: userId,
          plan,
          model,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: totalTokens,
          request_type: 'chat',
        });
        if (error) logger.warn({ err: error, userId }, 'coach usage record failed');
      },
      async saveResult(userId, situation, responseText) {
        const takeMatch = responseText.match(/COACH'S TAKE\s*([\s\S]*?)(?=\nDO THIS|\nTRY|$)/i);
        const doMatch = responseText.match(/DO THIS\s*([\s\S]*?)(?=\nTRY|$)/i);
        const tryMatch = responseText.match(/TRY\s*["“]?([\s\S]*?)["”]?\s*$/i);

        const analysis = takeMatch?.[1]?.trim() || responseText;
        const advice = doMatch?.[1]?.trim() || '';
        const suggestedMessage = tryMatch?.[1]?.trim() || '';

        const { error: historyError } = await sb().from('coach_history').insert({
          user_id: userId,
          situation: situation || 'Coach request',
          analysis,
          advice,
          suggested_message: suggestedMessage,
          action: advice,
          outcome: 'Pending',
          xp_awarded: env.COACH_XP_REWARD,
        });
        if (historyError) logger.warn({ err: historyError, userId }, 'failed to save coach history');

        await awardXp(userId, env.COACH_XP_REWARD);
      },
    },
  };
}

const store: DataStore = demoMode ? createMemoryStore() : createSupabaseStore();

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================

const app = express();
app.set('query parser', 'simple');
// Trust only the first ingress proxy; rate limiting and secure cookies depend on
// Express seeing the real client IP without accepting arbitrary forwarded hops.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    // CSP is enabled in production by default and can be disabled temporarily
    // with ENABLE_CSP=false if a deployment needs further policy tuning.
    contentSecurityPolicy:
      isProd && env.ENABLE_CSP === 'true'
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              imgSrc: ["'self'", 'data:', 'blob:'],
              connectSrc: ["'self'", 'https:', 'wss:'],
              fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // don't break cross-origin images
  }),
);

// Strict, allowlist-only CORS. Default (empty allowlist) = same-origin only,
// which is the correct posture for the SPA served by this same server.
const allowedOrigins = (env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  next();
});

app.use(
  pinoHttp({
    logger,
    genReqId: (req) => {
      const supplied = req.headers['x-request-id'];
      // Never put arbitrary header data into logs or response correlation IDs.
      return typeof supplied === 'string' && /^[A-Za-z0-9._-]{1,100}$/.test(supplied)
        ? supplied
        : crypto.randomUUID();
    },
    autoLogging: { ignore: (req) => req.url === '/healthz' || req.url === '/readyz' },
    serializers: {
      req: (req: any) => ({ id: req.id, method: req.method, url: req.url, userId: req.userId }),
    },
  }),
);

app.use(compression());
app.use(express.json({ limit: '20mb' }));

// Rate limiting (in-memory; swap the store for Redis when running multiple
// instances behind a load balancer — see express-rate-limit docs).
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down.' },
});

const coachLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many coach requests, slow down.' },
});

app.use('/api', apiLimiter);

// ============================================================================
// INPUT VALIDATION SCHEMAS
// ============================================================================

const coachBodySchema = z.object({
  message: z.string().max(4000).default(''),
  vibe: z.enum(['gentle', 'direct', 'brutal', 'roasty']).default('direct'),
  history: z
    .array(z.object({ role: z.string().max(20), text: z.string().max(3000).optional() }))
    .max(20)
    .default([]),
  imageBase64: z.string().max(8_000_000).optional(),
  profile: z
    .object({ goal: z.string().max(50).optional(), blocker: z.string().max(80).optional() })
    .passthrough()
    .default({}),
});

const practiceStartSchema = z.object({ scenario: z.string().max(80).optional() });
const practiceMessageSchema = z.object({ message: z.string().min(1).max(2000) });
const practiceFinishSchema = z.object({ score: z.coerce.number().min(0).max(100).default(0) });

const profilePatchSchema = z
  .object({
    goal: z.string().max(50).optional(),
    blocker: z.string().max(80).optional(),
    vibe: z.enum(['gentle', 'direct', 'brutal']).optional(),
  })
  .strict();

const avatarSchema = z.object({ dataUrl: z.string().max(10_000_000) });

const journalCreateSchema = z.object({
  title: z.string().max(100).optional(),
  type: z.string().max(40).optional(),
  content: z.string().min(1).max(5000),
});

const journalPatchSchema = z
  .object({ title: z.string().max(100).optional(), content: z.string().min(1).max(5000).optional() })
  .refine((d) => d.title !== undefined || d.content !== undefined, { message: 'Nothing to update.' });

const reactionSchema = z.object({ reaction: z.enum(['🔥', '💀', '💡', '❤️']) }).strict();
const featureFlagSchema = z.object({ state: z.enum(['ON', 'OFF', 'BETA']) }).strict();

// ============================================================================
// HEALTH CHECKS
// ============================================================================

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), mode: demoMode ? 'demo' : 'production' });
});

app.get(
  '/readyz',
  ah(async (_req, res) => {
    if (demoMode) return res.json({ status: 'ready', mode: 'demo' });
    const { error } = await sb().from('profiles').select('id', { head: true, count: 'exact' });
    if (error) return res.status(503).json({ status: 'not ready', detail: 'database' });
    res.json({ status: 'ready' });
  }),
);

// ============================================================================
// API ROUTES: TASKS & PROGRESS (same contract as before)
// ============================================================================

app.get(
  '/api/today',
  ah(async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const task = await store.tasks.getOrCreateToday(userId, req.query as Record<string, unknown>);
    res.json({ task, source: demoMode ? 'demo-cache' : 'supabase', generatedAt: new Date().toISOString() });
  }),
);

app.get(
  '/api/progress',
  ah(async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const progress = await store.tasks.getProgress(userId);
    res.json({ userId, ...progress });
  }),
);

app.post(
  '/api/tasks/:id/start',
  ah(async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const task = await store.tasks.getToday(userId);
    if (!task || task.id !== req.params.id) {
      return res.status(404).json({ error: 'Task not found.' });
    }
    res.json({ task, startedAt: new Date().toISOString() });
  }),
);

app.post(
  '/api/tasks/:id/complete',
  ah(async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const result = await store.tasks.complete(userId, req.params.id);
    if (result.status === 'not_found') return res.status(404).json({ error: 'Task not found.' });
    if (result.status === 'already_completed') return res.status(409).json({ error: 'Task already completed.' });

    res.json({ task: result.task, xpAwarded: result.task!.xpReward, idempotent: false });
  }),
);

// ============================================================================
// API ROUTES: PRACTICE (same contract as before)
// ============================================================================

app.post(
  '/api/practice/start',
  ah(async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const body = parseBody(practiceStartSchema, req.body);
    const scenario = (body.scenario ?? 'New match').slice(0, 80);
    res.json({ practiceId: `practice-${userId}-${Date.now()}`, scenario, startedAt: new Date().toISOString() });
  }),
);

app.post(
  '/api/practice/message',
  ah(async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const body = parseBody(practiceMessageSchema, req.body);
    res.json({ userId, message: body.message, reply: 'Keep going. Make your next message specific and easy to answer.' });
  }),
);

app.post(
  '/api/practice/finish',
  ah(async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const body = parseBody(practiceFinishSchema, req.body);
    res.json({ userId, score: body.score, feedback: 'Specific beats impressive. Keep the pressure low and the details real.' });
  }),
);

// ============================================================================
// API ROUTES: COMMUNITY (same contract as before, now persisted)
// ============================================================================

app.get(
  '/api/community',
  ah(async (req, res) => {
    const userId = await getAuthenticatedUserId(req);
    const category = typeof req.query.category === 'string' ? req.query.category.toUpperCase() : 'ALL';
    const search = typeof req.query.search === 'string' ? req.query.search.toLowerCase() : '';

    const teachings = TEACHINGS.filter(
      (teaching) =>
        (category === 'ALL' || teaching.category === category) &&
        (!search || `${teaching.title} ${teaching.summary}`.toLowerCase().includes(search)),
    );

    res.json({ teachings, userId, nextCursor: null });
  }),
);

app.get(
  '/api/community/teachings/:id',
  ah(async (req, res) => {
    const teaching = findTeaching(req.params.id);
    if (!teaching) return res.status(404).json({ error: 'Teaching not found.' });
    res.json({ teaching });
  }),
);

app.get(
  '/api/community/progress',
  ah(async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const progress = await store.community.progress(userId);
    res.json({ userId, ...progress });
  }),
);

app.post(
  '/api/community/teachings/:id/view',
  ah(async (req, res) => {
    const teaching = findTeaching(req.params.id);
    if (!teaching) return res.status(404).json({ error: 'Teaching not found.' });
    res.status(201).json({ teachingId: teaching.id, viewedAt: new Date().toISOString() });
  }),
);

app.post(
  '/api/community/teachings/:id/save',
  ah(async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    await store.community.save(userId, req.params.id);
    res.json({ saved: true, teachingId: req.params.id });
  }),
);

app.delete(
  '/api/community/teachings/:id/save',
  ah(async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    await store.community.unsave(userId, req.params.id);
    res.json({ saved: false, teachingId: req.params.id });
  }),
);

app.post(
  '/api/community/teachings/:id/react',
  ah(async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const body = parseBody(reactionSchema, req.body);
    const result = await store.community.react(userId, req.params.id, body.reaction);
    if (result === 'already') return res.status(409).json({ error: 'Teaching already reacted to.' });

    res.status(201).json({ reaction: body.reaction, teachingId: req.params.id });
  }),
);

app.post(
  '/api/community/teachings/:id/complete',
  ah(async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const teaching = findTeaching(req.params.id);
    if (!teaching) return res.status(404).json({ error: 'Teaching not found.' });

    const result = await store.community.complete(userId, teaching.id, teaching.xp);
    if (result === 'already') return res.status(409).json({ error: 'Teaching already completed.' });

    res.status(201).json({ completed: true, xpAwarded: teaching.xp, teachingId: teaching.id });
  }),
);

// ============================================================================
// API ROUTES: PROFILE & JOURNAL (same contract as before)
// ============================================================================

app.get(
  '/api/profile',
  ah(async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const { profile, audits } = await store.profile.get(userId);
    res.json({ userId, profile, audits });
  }),
);

app.patch(
  '/api/profile',
  ah(async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const body = parseBody(profilePatchSchema, req.body);
    const profile = await store.profile.update(userId, body);
    res.json({ profile });
  }),
);

const AVATAR_SIGNATURES: Record<string, number[]> = {
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
};

/** Validates the data URL *and* the actual decoded bytes — declared type must match real content. */
function validateAvatarDataUrl(dataUrl: string): void {
  const match = /^data:(image\/(png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(dataUrl);
  if (!match) throw badRequest('Invalid avatar image.');
  const mime = match[1];
  const bytes = Buffer.from(match[3], 'base64');
  if (!bytes.length || bytes.length > 5_000_000) throw badRequest('Avatar image too large (max ~5MB).');
  const signature = AVATAR_SIGNATURES[mime];
  if (!signature || signature.some((b, i) => bytes[i] !== b)) {
    throw badRequest('Avatar content does not match its declared type.');
  }
}

app.post(
  '/api/profile/avatar',
  ah(async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const body = parseBody(avatarSchema, req.body);
    validateAvatarDataUrl(body.dataUrl);
    await store.profile.saveAvatar(userId, body.dataUrl);
    res.status(201).json({ saved: true });
  }),
);

app.get(
  '/api/profile/journal',
  ah(async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const entries = await store.journal.list(userId);
    res.json({ entries });
  }),
);

app.post(
  '/api/profile/journal',
  ah(async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const body = parseBody(journalCreateSchema, req.body);
    const entry = await store.journal.create(userId, {
      title: body.title ?? 'Dating reflection',
      type: body.type ?? 'observation',
      content: body.content.trim(),
    });
    res.status(201).json({ entry });
  }),
);

app.patch(
  '/api/profile/journal/:id',
  ah(async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const body = parseBody(journalPatchSchema, req.body);
    const entry = await store.journal.update(userId, req.params.id, body);
    if (!entry) return res.status(404).json({ error: 'Journal entry not found.' });
    res.json({ entry });
  }),
);

app.delete(
  '/api/profile/journal/:id',
  ah(async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    await store.journal.remove(userId, req.params.id);
    res.json({ deleted: true });
  }),
);

// ============================================================================
// API ROUTES: ADMIN & SYSTEM (same contract as before, real metrics)
// ============================================================================

app.get(
  '/api/admin/dashboard',
  ah(async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;

    const metrics = await store.admin.dashboard();
    res.json({ metrics, generatedAt: new Date().toISOString() });
  }),
);

app.get(
  '/api/admin/users',
  ah(async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;

    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const users = await store.admin.users(search);
    res.json({ users, nextCursor: null });
  }),
);

app.patch(
  '/api/admin/features/:key',
  ah(async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;

    const body = parseBody(featureFlagSchema, req.body);
    await store.admin.setFeatureFlag(adminId, req.params.key, body.state);
    res.json({ key: req.params.key, state: body.state });
  }),
);

// ============================================================================
// API ROUTES: AI DATING COACH (same contract as before)
// ============================================================================

function getFallbackResponse(message: string = '', vibe: string = 'roasty', hasImage: boolean = false): string {
  const msg = message.toLowerCase();

  if (hasImage) {
    return "bro this screenshot... you opened with 'wyd' or sent 3 unanswered texts? that's not flirting, that's a cry for help! \uD83D\uDC40\n\nHere is what you should say instead:\n• 'ok you left me on read, my ego is in shambles but i'll survive. down for coffee this week?'\n• 'fair enough - felt a vibe, but if not, all good!'";
  }
  if (msg.includes('ghosted') || msg.includes('read')) {
    return "ghosted 101: they didn't die, they just chose silence. stop checking their story! 48hr rule: no checking their stuff for 2 days. if you still care, send ONE casual close-out or delete the chat. your time > their indecision.";
  }
  if (msg.includes('profile') || msg.includes('bio')) {
    return "profile audit: 1 clear face photo in natural light + 1 full body doing something + 1 social proof + 1 chaos hobby. delete 'fluent in sarcasm' immediately. make your bio 70% weird specific humor, 30% hot!";
  }
  if (vibe === 'gentle') {
    return "it's totally normal to feel nervous! focus on micro-reps today: make eye contact and smile at 2 people. confidence is built from tiny wins, not giant leaps. you've got this! ✨";
  }

  return 'rule of thumb: match their energy, add ONE playful tease, and end with a concrete question or plan. no paragraphs, no double texting!';
}

async function callGeminiCoach(systemInstruction: string, contents: Content[]): Promise<GeminiResult | null> {
  if (!GEMINI_API_KEY) return null;

  const ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];

  for (const model of candidateModels) {
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Model ${model} timed out`)), 20_000),
      );
      const response = (await Promise.race([
        ai.models.generateContent({
          model,
          contents,
          config: { systemInstruction, temperature: 0.7, maxOutputTokens: 80 },
        }),
        timeout,
      ])) as any;

      if (response?.text) {
        const usage = response.usageMetadata;
        const inputTokens = Number(usage?.promptTokenCount ?? usage?.inputTokenCount) || null;
        const outputTokens = Number(usage?.candidatesTokenCount ?? usage?.outputTokenCount) || null;
        const totalTokens = Number(usage?.totalTokenCount) || inputTokens + outputTokens || null;
        return { text: response.text, model, inputTokens, outputTokens, totalTokens };
      }
    } catch (modelError) {
      logger.warn({ err: modelError, model }, 'Gemini model failed, trying next');
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return null;
}

app.post(
  '/api/coach',
  coachLimiter,
  ah(async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    try {
      const body = parseBody(coachBodySchema, req.body);
      const userText = body.message.trim();
      const hasImage = Boolean(body.imageBase64);

      if (!userText && !hasImage) {
        return res.status(400).json({ error: 'Message or image is required.' });
      }

      // Quota: atomic consume for free users; pro users skip the check.
      const plan = await store.coach.getPlan(userId);
      if (plan === 'free') {
        const allowed = await store.coach.consumeQuota(userId, env.COACH_FREE_DAILY_LIMIT);
        if (!allowed) {
          const used = await store.coach.usageToday(userId);
          return res.status(429).json({
            error: 'Daily Coach limit reached.',
            code: 'COACH_DAILY_LIMIT',
            plan: 'free',
            limit: env.COACH_FREE_DAILY_LIMIT,
            used,
            remaining: 0,
          });
        }
      }

      const vibeInstruction =
        body.vibe === 'brutal' || body.vibe === 'roasty'
          ? "You are 'lol coach' on datings.lol in BRUTAL mode: blunt, concise, honest, and occasionally funny. Never abusive. Call out weak moves, then give a better move."
          : body.vibe === 'gentle'
            ? "You are 'lol coach' on datings.lol - a warm, encouraging dating coach. Hype the user up, reduce anxiety, and give confident, actionable advice."
            : "You are 'lol coach' on datings.lol - a direct, no-BS dating coach. Concise, tactical, straight to the point with actionable steps.";

      const systemInstruction = `${vibeInstruction}
The user's context is:
goal=${body.profile.goal || 'unknown'}
blocker=${body.profile.blocker || 'unknown'}

OUTPUT FORMAT — FOLLOW EXACTLY:
COACH'S TAKE
[ONE short sentence]

DO THIS
[ONE short sentence]

TRY
"[ONE short message the user can send]"

STRICT RULES:
- Output ONLY those 3 sections.
- Use headings exactly: COACH'S TAKE, DO THIS, TRY.
- No WHY section, no bullets, no paragraphs.`;

      const contents: Content[] = [];
      body.history.slice(-6).forEach((h) => {
        if (h.text) {
          contents.push({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.text.slice(0, 3000) }],
          });
        }
      });

      const currentParts: any[] = [];
      if (body.imageBase64) {
        const imageMatch = body.imageBase64.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/);
        if (!imageMatch) throw badRequest('Invalid image attachment.');
        const imageBytes = Buffer.from(imageMatch[2], 'base64');
        if (!imageBytes.length || imageBytes.length > 5_000_000) throw badRequest('Image attachment is too large.');
        currentParts.push({
          inlineData: { mimeType: imageMatch[1], data: imageMatch[2].replace(/\s/g, '') },
        });
      }
      currentParts.push({ text: userText || (hasImage ? 'Roast this chat / profile screenshot and give me actionable fixes.' : 'Give me dating advice.') });
      contents.push({ role: 'user', parts: currentParts });

      const result = await callGeminiCoach(systemInstruction, contents);

      // Analytics record (attempt, model, token usage) — same as before.
      await store.coach.recordUsage(
        userId,
        plan,
        result?.model ?? null,
        result?.inputTokens ?? null,
        result?.outputTokens ?? null,
        result?.totalTokens ?? null,
      );

      if (result) {
        await store.coach.saveResult(userId, userText, result.text);
        return res.json({
          text: result.text,
          isAi: true,
          plan,
          usage: {
            model: result.model,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            totalTokens: result.totalTokens,
          },
        });
      }

      const fallbackText = getFallbackResponse(userText, body.vibe, hasImage);
      await store.coach.saveResult(userId, userText, fallbackText);
      return res.json({
        text: fallbackText,
        isAi: false,
        plan,
        usage: { model: null, inputTokens: null, outputTokens: null, totalTokens: null },
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error, userId }, 'coach request failed');
      return res.status(500).json({ error: 'Coach is temporarily unavailable. Please try again.', code: 'COACH_SERVER_ERROR' });
    }
  }),
);

// ============================================================================
// 404 + GLOBAL ERROR HANDLER
// ============================================================================

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    const payload: Record<string, unknown> = { error: err.message };
    if (err.code) payload.code = err.code;
    return res.status(err.statusCode).json(payload);
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }
  (req as any).log?.error({ err }, 'unhandled error');
  res.status(500).json({ error: 'Internal Server Error.' });
});

// ============================================================================
// STATIC SPA (production) + SERVER STARTUP + GRACEFUL SHUTDOWN
// ============================================================================

async function startServer() {
  if (!isProd) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true, allowedHosts: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      logger.info('Vite dev middleware enabled');
    } catch {
      logger.warn('Vite not available — API-only dev mode (serve the UI separately).');
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(
      express.static(distPath, {
        index: false,
        setHeaders: (res, filePath) => {
          if (/\.(js|css|png|jpg|jpeg|webp|svg|woff2?)$/.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );
    app.use((req: Request, res: Response, next: NextFunction) => {
      if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info(`🚀 Datings.lol server running on http://${env.HOST}:${env.PORT} (${env.NODE_ENV}${demoMode ? ', demo mode' : ''})`);
  });
  server.requestTimeout = 60_000;

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'shutting down');
    server.close(() => {
      logger.info('closed');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException');
  process.exit(1);
});

startServer().catch((err) => {
  logger.fatal({ err }, 'failed to start server');
  process.exit(1);
});