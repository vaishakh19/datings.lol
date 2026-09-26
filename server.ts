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
  ENABLE_CSP: z.enum(['true', 'false']).default('false'),
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

if (isProd && demoMode) {
  console.error('FATAL: ALLOW_DEMO_MODE must be false when NODE_ENV=production.');
  process.exit(1);
}

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

interface CachedAuth {
  userId: string;
  expiresAt: number;
}
const tokenCache = new Map<string, CachedAuth>();
const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000;
let warnedDemoAuth = false;

async function getAuthenticatedUserId(req: Request): Promise<string | null> {
  const authorization = req.header('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice(7).trim();
  if (!token) return null;

  const cacheKey = crypto.createHash('sha256').update(token).digest('hex');
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.userId;

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const { data, error } = await sb().auth.getUser(token);
    if (error || !data?.user) return null;
    if (tokenCache.size > 10_000) tokenCache.clear();
    tokenCache.set(cacheKey, { userId: data.user.id, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
    return data.user.id;
  }

  // Dev-only convenience when running without Supabase: a stable ID derived
  // from the token hash so authenticated routes work locally.
  if (demoMode) {
    if (!warnedDemoAuth) {
      warnedDemoAuth = true;
      logger.warn('Demo mode: deriving user IDs from token hash (no Supabase auth).');
    }
    return `demo-${cacheKey.slice(0, 16)}`;
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

  // Demo mode is an explicitly local-only environment. Let its authenticated
  // test identity exercise the panel while production always uses the database
  // membership table (or the emergency ADMIN_USER_IDS allowlist).
  if (demoMode) return userId;
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
        const localToday = new Date().toDateString();
        const [authTotal, appStates, proUsers, dbProfileAudits] = await Promise.all([
          metric('users', async () => {
            const { data, error } = await sb().auth.admin.listUsers({ page: 1, perPage: 1 });
            if (error) throw error;
            return Number((data as any).total ?? data.users.length);
          }, 0),
          metric('userAppState', async () => {
            const { data, error } = await sb()
              .from('user_app_state')
              .select('user_id, state, updated_at')
              .limit(10000);
            if (error) throw error;
            return data ?? [];
          }, [] as any[]),
          metric('proUsers', () => count('subscriptions', (q) => q.eq('status', 'active').eq('plan', 'pro')), 0),
          metric('profileAudits', () => count('profile_audits'), 0),
        ]);

        const activeToday = appStates.filter((row: any) => String(row.updated_at || '').slice(0, 10) === today).length;
        const totalXp = appStates.reduce(
          (sum: number, row: any) => sum + Number(row.state?.progress?.xp || 0),
          0,
        );
        const coachMessagesToday = appStates.reduce(
          (sum: number, row: any) =>
            sum + (row.state?.lastChatDate === today ? Number(row.state?.chatsUsedToday || 0) : 0),
          0,
        );
        const tasksCompletedToday = appStates.filter(
          (row: any) => row.state?.progress?.lastCompletedDate === localToday,
        ).length;
        const activeStreaks = appStates.filter((row: any) => Number(row.state?.progress?.streak || 0) > 0).length;
        const syncedProfileAudits = appStates.filter((row: any) => Boolean(row.state?.profileAudit)).length;

        return {
          users: authTotal || appStates.length,
          proUsers,
          activeToday,
          totalXp,
          coachMessagesToday,
          tasksCompletedToday,
          communityTeachings: TEACHINGS.length,
          profileAudits: Math.max(dbProfileAudits, syncedProfileAudits),
          activeStreaks,
        };
      },
      async users(search) {
        const needle = search.trim().toLowerCase();
        const [profileResult, stateResult, proResult, authResult] = await Promise.all([
          sb().from('profiles').select('id, username, xp, created_at').limit(500),
          sb().from('user_app_state').select('user_id, state, updated_at').limit(500),
          sb().from('subscriptions').select('user_id').eq('status', 'active').eq('plan', 'pro'),
          sb().auth.admin.listUsers({ page: 1, perPage: 500 }),
        ]);
        if (authResult.error) {
          logger.warn({ err: authResult.error }, 'admin auth users query failed');
          return [];
        }
        if (profileResult.error) logger.warn({ err: profileResult.error }, 'admin profiles query failed');
        if (stateResult.error) logger.warn({ err: stateResult.error }, 'admin app state query failed');

        const profileById = new Map((profileResult.data ?? []).map((row: any) => [row.id, row]));
        const stateById = new Map((stateResult.data ?? []).map((row: any) => [row.user_id, row]));
        const proSet = new Set((proResult.data ?? []).map((row: any) => row.user_id));

        return (authResult.data?.users ?? [])
          .map((authUser: any) => {
            const profile: any = profileById.get(authUser.id);
            const appRow: any = stateById.get(authUser.id);
            const state = appRow?.state ?? {};
            return {
              id: authUser.id,
              username:
                profile?.username ||
                authUser.user_metadata?.username ||
                authUser.email?.split('@')[0] ||
                'member',
              email: authUser.email || '',
              xp: Number(state.progress?.xp ?? profile?.xp ?? 0),
              streak: Number(state.progress?.streak ?? 0),
              isPro: proSet.has(authUser.id),
              createdAt: authUser.created_at || profile?.created_at,
              lastSignInAt: appRow?.updated_at || authUser.last_sign_in_at,
            };
          })
          .filter(
            (row: any) =>
              !needle ||
              String(row.id).toLowerCase().includes(needle) ||
              String(row.username).toLowerCase().includes(needle) ||
              String(row.email).toLowerCase().includes(needle),
          );
      },
      async setFeatureFlag(adminId, key, state) {
        const { error } = await sb()
          .from('feature_flags')
          .upsert({ key, state, updated_by: adminId, updated_at: new Date().toISOString() }, { onConflict: 'key' });
        if (error) throw new ApiError(500, 'Failed to update feature flag.');
        const { error: auditError } = await sb().from('audit_logs').insert({
          admin_user_id: adminId,
          action: 'CHANGED_FEATURE_FLAG',
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
app.set('trust proxy', 1); // required for correct client IPs behind proxies
app.disable('x-powered-by');

app.use(
  helmet({
    // CSP is opt-in (ENABLE_CSP=true) so it can be tuned against the real
    // deployed SPA without risking breakage. Everything else is on by default.
    contentSecurityPolicy:
      env.ENABLE_CSP === 'true'
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:'],
              connectSrc: ["'self'", 'https:', 'wss:'],
              fontSrc: ["'self'", 'data:'],
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
    genReqId: (req) => (req.headers['x-request-id'] as string) || crypto.randomUUID(),
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

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 180,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many admin requests. Wait a moment and try again.' },
});

app.use('/api', apiLimiter);
app.use('/api/admin', adminLimiter);

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
const featureFlagSchema = z
  .object({
    state: z.enum(['ON', 'OFF', 'BETA']),
    rolloutPercent: z.coerce.number().int().min(0).max(100).optional(),
  })
  .strict();
const adminPlanSchema = z.object({ plan: z.enum(['free', 'pro']) }).strict();
const resetProgressSchema = z.object({ confirmation: z.literal('RESET_PROGRESS') }).strict();
const broadcastCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    message: z.string().trim().min(1).max(500),
    tone: z.enum(['update', 'warning', 'win']).default('update'),
    status: z.enum(['DRAFT', 'LIVE']).default('DRAFT'),
    expiresAt: z.string().datetime().optional(),
  })
  .strict();
const broadcastPatchSchema = z.object({ status: z.enum(['DRAFT', 'LIVE', 'ARCHIVED']) }).strict();
const dailyConfigSchema = z
  .object({
    lessonId: z.number().int().positive().nullable(),
    mode: z.enum(['AUTOMATIC', 'MANUAL']),
    focus: z.string().trim().max(120),
    note: z.string().trim().max(1000),
    taskType: z.enum(['LEARN', 'PRACTICE', 'SIMULATION', 'REAL_WORLD', 'REVIEW']),
    difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'BRUTAL']),
    xpReward: z.coerce.number().int().min(0).max(500),
  })
  .strict();
const hotTakeSchema = z
  .object({
    topic: z.string().trim().min(1).max(50),
    statement: z.string().trim().min(1).max(280),
    subtext: z.string().trim().max(280),
    agreePercent: z.number().min(0).max(100),
    disagreePercent: z.number().min(0).max(100),
    complicatedPercent: z.number().min(0).max(100),
    coachInsight: z.object({
      agree: z.string().max(500),
      disagree: z.string().max(500),
      complicated: z.string().max(500),
    }),
    bonusXp: z.number().int().min(0).max(500),
    updatedAt: z.string().optional(),
  })
  .strict();

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

app.get(
  '/api/account/entitlements',
  ah(async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    const plan = await store.coach.getPlan(userId);
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ plan, isPro: plan === 'pro' });
  }),
);

// ============================================================================
// API ROUTES: ADMIN & SYSTEM
// ============================================================================

const DEFAULT_ADMIN_FEATURES = [
  { key: 'AI_COACH', state: 'ON', rolloutPercent: 100, description: 'AI coach chat and response generation' },
  { key: 'SCREENSHOT_ANALYSIS', state: 'ON', rolloutPercent: 100, description: 'Conversation screenshot analysis' },
  { key: 'AI_SIMULATOR', state: 'BETA', rolloutPercent: 25, description: 'Interactive conversation simulator' },
  { key: 'COMMUNITY', state: 'ON', rolloutPercent: 100, description: 'Community lessons and hot takes' },
  { key: 'DAILY_TASKS', state: 'ON', rolloutPercent: 100, description: 'Personalized daily mission engine' },
  { key: 'PROFILE_AUDIT', state: 'ON', rolloutPercent: 100, description: 'AI dating profile audit' },
  { key: 'PAYWALL', state: 'ON', rolloutPercent: 100, description: 'Pro upgrade surfaces' },
] as const;

const defaultDailyConfig = () => ({
  lessonId: null as number | null,
  mode: 'AUTOMATIC' as const,
  focus: '',
  note: '',
  taskType: 'PRACTICE' as const,
  difficulty: 'INTERMEDIATE' as const,
  xpReward: 25,
  updatedAt: new Date(0).toISOString(),
});

let demoAdminFeatures: Array<{
  key: string;
  state: 'ON' | 'OFF' | 'BETA';
  rolloutPercent: number;
  description: string;
  updatedAt: string;
}> = DEFAULT_ADMIN_FEATURES.map((feature) => ({
  ...feature,
  updatedAt: new Date().toISOString(),
}));
let demoAdminBroadcasts: any[] = [];
let demoDailyConfig: any = defaultDailyConfig();
let demoDailyHotTake: any = null;
let demoAuditLogs: any[] = [];

function mapFeatureFlag(row: any) {
  return {
    key: String(row.key),
    state: row.state as 'ON' | 'OFF' | 'BETA',
    rolloutPercent: Number(row.rollout_percent ?? row.rolloutPercent ?? 100),
    description: String(row.description ?? ''),
    updatedAt: row.updated_at ?? row.updatedAt ?? new Date().toISOString(),
  };
}

function mapBroadcast(row: any) {
  const status = String(row.status || 'DRAFT');
  return {
    id: String(row.id),
    title: String(row.title),
    message: String(row.message),
    tone: row.tone as 'update' | 'warning' | 'win',
    status,
    audience: String(row.audience || 'ALL_USERS'),
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
    expiresAt: row.expires_at ?? row.expiresAt ?? undefined,
    isActive: status === 'LIVE',
  };
}

function mapDailyConfig(row: any) {
  if (!row) return defaultDailyConfig();
  return {
    id: row.id,
    lessonId: row.lesson_id == null ? null : Number(row.lesson_id),
    mode: row.mode === 'MANUAL' ? 'MANUAL' : 'AUTOMATIC',
    focus: String(row.focus ?? ''),
    note: String(row.note ?? row.coach_prompt ?? ''),
    taskType: row.task_type || 'PRACTICE',
    difficulty: row.difficulty || 'INTERMEDIATE',
    xpReward: Number(row.xp_reward ?? 25),
    updatedAt: row.updated_at ?? new Date(0).toISOString(),
  };
}

function mapAudit(row: any) {
  return {
    id: String(row.id),
    actorId: row.admin_user_id ? String(row.admin_user_id) : undefined,
    action: String(row.action),
    targetType: String(row.target_type),
    targetId: String(row.target_id),
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

async function writeAdminAudit(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown> = {},
) {
  if (demoMode) {
    demoAuditLogs = [
      {
        id: crypto.randomUUID(),
        actorId: adminId,
        action,
        targetType,
        targetId,
        metadata,
        createdAt: new Date().toISOString(),
      },
      ...demoAuditLogs,
    ].slice(0, 100);
    return;
  }
  const { error } = await sb().from('audit_logs').insert({
    admin_user_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
  });
  if (error) logger.warn({ err: error, action, targetId }, 'admin audit insert failed');
}

function emptyAdminTrend(days = 14) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - (days - index - 1));
    return { date: date.toISOString().slice(0, 10), active: 0, completions: 0 };
  });
}

async function getProductionAdminExtras() {
  const trend = emptyAdminTrend();
  const since = trend[0].date;
  const [featureResult, broadcastResult, dailyResult, hotTakeResult, auditResult, analyticsResult] =
    await Promise.all([
      sb().from('feature_flags').select('*').order('key'),
      sb().from('broadcasts').select('*').order('created_at', { ascending: false }).limit(30),
      sb().from('daily_lesson_config').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      sb().from('system_settings').select('value').eq('key', 'daily_hot_take').maybeSingle(),
      sb().from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
      sb().from('analytics_daily').select('metric_date, metric_key, metric_value').gte('metric_date', since),
    ]);

  for (const row of analyticsResult.data ?? []) {
    const point = trend.find((item) => item.date === row.metric_date);
    if (!point) continue;
    if (row.metric_key === 'active_users') point.active = Number(row.metric_value || 0);
    if (row.metric_key === 'tasks_completed') point.completions = Number(row.metric_value || 0);
  }

  return {
    features: featureResult.error
      ? DEFAULT_ADMIN_FEATURES.map(mapFeatureFlag)
      : (featureResult.data ?? []).map(mapFeatureFlag),
    broadcasts: broadcastResult.error ? [] : (broadcastResult.data ?? []).map(mapBroadcast),
    dailyConfig: dailyResult.error ? defaultDailyConfig() : mapDailyConfig(dailyResult.data),
    dailyHotTake: hotTakeResult.error ? null : (hotTakeResult.data?.value ?? null),
    audits: auditResult.error ? [] : (auditResult.data ?? []).map(mapAudit),
    trend,
    degraded: Boolean(
      featureResult.error || broadcastResult.error || dailyResult.error || auditResult.error,
    ),
  };
}

function getSystemServices(degraded = false) {
  return [
    {
      name: 'API',
      status: 'operational',
      detail: `${Math.round(process.uptime() / 60)}m uptime`,
    },
    {
      name: 'Database',
      status: degraded ? 'degraded' : 'operational',
      detail: demoMode ? 'in-memory demo store' : degraded ? 'one or more queries failed' : 'Supabase connected',
    },
    {
      name: 'Authentication',
      status: 'operational',
      detail: demoMode ? 'demo identity' : 'JWT verification active',
    },
    {
      name: 'AI coach',
      status: GEMINI_API_KEY ? 'operational' : 'not_configured',
      detail: GEMINI_API_KEY ? 'Gemini configured' : 'API key not configured',
    },
  ];
}

// Public, read-only product configuration. It contains no admin identity or
// private data and lets every device receive the currently published controls.
app.get(
  '/api/app-config',
  ah(async (_req, res) => {
    if (demoMode) {
      return res.json({
        settings: {
          notifications: demoAdminBroadcasts.filter((item) => item.status === 'LIVE'),
          dailyOverride: {
            lessonId: demoDailyConfig.lessonId,
            focus: demoDailyConfig.focus,
            note: demoDailyConfig.note,
            updatedAt: demoDailyConfig.updatedAt,
          },
          dailyHotTake: demoDailyHotTake,
        },
      });
    }

    const [broadcastResult, dailyResult, hotTakeResult] = await Promise.all([
      sb().from('broadcasts').select('*').eq('status', 'LIVE').order('created_at', { ascending: false }).limit(20),
      sb().from('daily_lesson_config').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      sb().from('system_settings').select('value').eq('key', 'daily_hot_take').maybeSingle(),
    ]);
    const now = Date.now();
    const notifications = (broadcastResult.data ?? [])
      .map(mapBroadcast)
      .filter((item) => !item.expiresAt || new Date(item.expiresAt).getTime() > now);
    const daily = mapDailyConfig(dailyResult.data);
    res.setHeader('Cache-Control', 'private, max-age=30');
    res.json({
      settings: {
        notifications,
        dailyOverride: {
          lessonId: daily.lessonId,
          focus: daily.focus,
          note: daily.note,
          updatedAt: daily.updatedAt,
        },
        dailyHotTake: hotTakeResult.data?.value ?? null,
      },
    });
  }),
);

app.get(
  '/api/admin/session',
  ah(async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    res.json({ adminId, role: 'ADMIN', mode: demoMode ? 'demo' : 'production' });
  }),
);

app.get(
  '/api/admin/overview',
  ah(async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    const metrics = await store.admin.dashboard();
    if (demoMode) {
      const trend = emptyAdminTrend().map((point, index) => ({
        ...point,
        active: Math.max(0, Math.round(8 + index * 1.7 + Math.sin(index) * 4)),
        completions: Math.max(0, Math.round(3 + index * 0.8 + Math.cos(index) * 2)),
      }));
      return res.json({
        metrics,
        features: demoAdminFeatures,
        broadcasts: demoAdminBroadcasts,
        dailyConfig: demoDailyConfig,
        dailyHotTake: demoDailyHotTake,
        audits: demoAuditLogs,
        trend,
        services: getSystemServices(false),
        generatedAt: new Date().toISOString(),
        mode: 'demo',
      });
    }
    const extras = await getProductionAdminExtras();
    const todayPoint = extras.trend.at(-1);
    if (todayPoint) {
      todayPoint.active = metrics.activeToday;
      todayPoint.completions = metrics.tasksCompletedToday;
    }
    res.json({
      metrics,
      ...extras,
      services: getSystemServices(extras.degraded),
      generatedAt: new Date().toISOString(),
      mode: 'production',
    });
  }),
);

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
  '/api/admin/users/:id/plan',
  ah(async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    const userId = z.string().uuid().safeParse(req.params.id);
    if (!userId.success) throw badRequest('Invalid user id.');
    const body = parseBody(adminPlanSchema, req.body);

    if (!demoMode) {
      const isPro = body.plan === 'pro';
      const [{ error }, { error: stateError }] = await Promise.all([
        sb().from('subscriptions').upsert(
          {
            user_id: userId.data,
            plan: body.plan,
            status: isPro ? 'active' : 'inactive',
            provider: 'admin',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        ),
        sb().rpc('admin_set_user_pro', { p_user_id: userId.data, p_is_pro: isPro }),
      ]);
      if (error || stateError) throw new ApiError(500, 'Failed to update the user plan.');
    }
    await writeAdminAudit(adminId, body.plan === 'pro' ? 'GRANTED_PRO' : 'REVOKED_PRO', 'user', userId.data, {
      plan: body.plan,
    });
    res.json({ userId: userId.data, plan: body.plan });
  }),
);

app.post(
  '/api/admin/users/:id/reset-progress',
  ah(async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    const userId = z.string().uuid().safeParse(req.params.id);
    if (!userId.success) throw badRequest('Invalid user id.');
    parseBody(resetProgressSchema, req.body);

    if (!demoMode) {
      const [{ error: profileError }, { error: streakError }, { error: stateError }] = await Promise.all([
        sb().from('profiles').update({ xp: 0, level: 1, updated_at: new Date().toISOString() }).eq('id', userId.data),
        sb()
          .from('streaks')
          .update({
            current_count: 0,
            best_count: 0,
            last_completed_date: null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId.data),
        sb().rpc('admin_reset_user_progress', { p_user_id: userId.data }),
      ]);
      if (profileError || streakError || stateError) throw new ApiError(500, 'Failed to reset user progress.');
    }
    await writeAdminAudit(adminId, 'RESET_USER_PROGRESS', 'user', userId.data);
    res.json({ userId: userId.data, reset: true });
  }),
);

app.post(
  '/api/admin/broadcasts',
  ah(async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    const body = parseBody(broadcastCreateSchema, req.body);
    let broadcast: any;
    if (demoMode) {
      broadcast = mapBroadcast({
        id: crypto.randomUUID(),
        ...body,
        expiresAt: body.expiresAt,
        createdAt: new Date().toISOString(),
      });
      demoAdminBroadcasts = [broadcast, ...demoAdminBroadcasts];
    } else {
      const { data, error } = await sb()
        .from('broadcasts')
        .insert({
          title: body.title,
          message: body.message,
          tone: body.tone,
          status: body.status,
          audience: 'ALL_USERS',
          expires_at: body.expiresAt ?? null,
          created_by: adminId,
        })
        .select('*')
        .single();
      if (error) throw new ApiError(500, 'Failed to create broadcast.');
      broadcast = mapBroadcast(data);
    }
    await writeAdminAudit(adminId, body.status === 'LIVE' ? 'PUBLISHED_BROADCAST' : 'CREATED_BROADCAST_DRAFT', 'broadcast', broadcast.id, {
      tone: body.tone,
    });
    res.status(201).json({ broadcast });
  }),
);

app.patch(
  '/api/admin/broadcasts/:id',
  ah(async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    const body = parseBody(broadcastPatchSchema, req.body);
    if (demoMode) {
      demoAdminBroadcasts = demoAdminBroadcasts.map((item) =>
        item.id === req.params.id ? { ...item, status: body.status, isActive: body.status === 'LIVE' } : item,
      );
    } else {
      const { data, error } = await sb()
        .from('broadcasts')
        .update({ status: body.status })
        .eq('id', req.params.id)
        .select('id')
        .maybeSingle();
      if (error) throw new ApiError(500, 'Failed to update broadcast.');
      if (!data) return res.status(404).json({ error: 'Broadcast not found.' });
    }
    await writeAdminAudit(adminId, `${body.status}_BROADCAST`, 'broadcast', req.params.id);
    res.json({ id: req.params.id, status: body.status });
  }),
);

app.put(
  '/api/admin/daily-config',
  ah(async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    const body = parseBody(dailyConfigSchema, req.body);
    let dailyConfig: any;
    if (demoMode) {
      dailyConfig = {
        ...body,
        id: demoDailyConfig.id || crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
      };
      demoDailyConfig = dailyConfig;
    } else {
      const { data, error } = await sb()
        .from('daily_lesson_config')
        .insert({
          lesson_id: body.lessonId,
          mode: body.mode,
          focus: body.focus || null,
          note: body.note || null,
          task_type: body.taskType,
          difficulty: body.difficulty,
          xp_reward: body.xpReward,
          coach_prompt: body.note || null,
          updated_by: adminId,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (error) throw new ApiError(500, 'Failed to publish the daily mission.');
      dailyConfig = mapDailyConfig(data);
    }
    await writeAdminAudit(adminId, 'PUBLISHED_DAILY_CONFIG', 'daily_lesson', String(body.lessonId ?? 'automatic'), {
      mode: body.mode,
      taskType: body.taskType,
      difficulty: body.difficulty,
      xpReward: body.xpReward,
    });
    res.json({ dailyConfig });
  }),
);

app.put(
  '/api/admin/hot-take',
  ah(async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    const body = parseBody(hotTakeSchema, req.body);
    const dailyHotTake = { ...body, updatedAt: new Date().toISOString() };
    if (demoMode) {
      demoDailyHotTake = dailyHotTake;
    } else {
      const { error } = await sb().from('system_settings').upsert(
        {
          key: 'daily_hot_take',
          value: dailyHotTake,
          description: 'Published daily community hot take',
          updated_by: adminId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' },
      );
      if (error) throw new ApiError(500, 'Failed to publish the hot take.');
    }
    await writeAdminAudit(adminId, 'PUBLISHED_HOT_TAKE', 'hot_take', body.topic);
    res.json({ dailyHotTake });
  }),
);

app.patch(
  '/api/admin/features/:key',
  ah(async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    const key = req.params.key.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(key)) throw badRequest('Invalid feature key.');
    const body = parseBody(featureFlagSchema, req.body);
    let feature: any;
    if (demoMode) {
      demoAdminFeatures = demoAdminFeatures.map((item) =>
        item.key === key
          ? {
              ...item,
              state: body.state,
              rolloutPercent: body.rolloutPercent ?? item.rolloutPercent,
              updatedAt: new Date().toISOString(),
            }
          : item,
      );
      feature = demoAdminFeatures.find((item) => item.key === key);
      if (!feature) {
        feature = {
          key,
          state: body.state,
          rolloutPercent: body.rolloutPercent ?? 100,
          description: '',
          updatedAt: new Date().toISOString(),
        };
        demoAdminFeatures.push(feature);
      }
    } else {
      const { data: current } = await sb().from('feature_flags').select('*').eq('key', key).maybeSingle();
      const { data, error } = await sb()
        .from('feature_flags')
        .upsert(
          {
            key,
            state: body.state,
            rollout_percent: body.rolloutPercent ?? current?.rollout_percent ?? 100,
            description: current?.description ?? '',
            updated_by: adminId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' },
        )
        .select('*')
        .single();
      if (error) throw new ApiError(500, 'Failed to update feature flag.');
      feature = mapFeatureFlag(data);
    }
    await writeAdminAudit(adminId, 'CHANGED_FEATURE_FLAG', 'feature_flag', key, {
      state: feature.state,
      rolloutPercent: feature.rolloutPercent,
    });
    res.json(feature);
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
        const cleanedBase64 = body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const mimeMatch = body.imageBase64.match(/^data:(image\/\w+);base64,/);
        currentParts.push({
          inlineData: { mimeType: mimeMatch ? mimeMatch[1] : 'image/jpeg', data: cleanedBase64 },
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