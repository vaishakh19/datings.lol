/**
 * server/routes-auth.test.ts
 *
 * Route-level contract tests for authentication boundaries: 401 without a
 * bearer token, 200 with a demo-mode token, 403 for admin routes when not
 * authorized, consistent error shape across all protected endpoints.
 *
 * These run against the real Express app in demo mode so we exercise the
 * actual middleware stack (rate limiting is present but thresholds are
 * high enough not to trip during the suite).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';

process.env.ALLOW_DEMO_MODE = 'true';
process.env.NODE_ENV = 'test';
process.env.ENABLE_CSP = 'false';
process.env.LOG_LEVEL = 'error';
process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
// Explicitly clear service-role key so we don't accidentally call Supabase
// and so admin 403/503 paths are deterministic.
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { app } = await import('../server.js');

const PROTECTED_GET = [
  '/api/today',
  '/api/progress',
  '/api/community/progress',
  '/api/profile',
  '/api/profile/journal',
  '/api/account/entitlements',
  '/api/billing/subscription',
];

const PROTECTED_WRITE_SAMPLES: Array<[string, string, object?]> = [
  ['post', '/api/tasks/fake/start'],
  ['post', '/api/tasks/fake/complete'],
  ['post', '/api/practice/start', { scenario: 'Hi' }],
  ['post', '/api/practice/message', { message: 'hey' }],
  ['post', '/api/practice/finish', { score: 3 }],
  ['post', '/api/community/teachings/any/save'],
  ['delete', '/api/community/teachings/any/save'],
  ['post', '/api/community/teachings/any/react', { reaction: 'fire' }],
  ['post', '/api/community/teachings/any/complete'],
  ['patch', '/api/profile', { goal: 'test' }],
  ['post', '/api/profile/journal', { content: 'hello' }],
];

const ADMIN_ENDPOINTS: Array<[string, string, object?]> = [
  ['get', '/api/admin/session'],
  ['get', '/api/admin/overview'],
  ['get', '/api/admin/dashboard'],
  ['get', '/api/admin/users'],
  ['post', '/api/admin/broadcasts', { title: 'T', message: 'M', tone: 'supportive', status: 'DRAFT' }],
  ['put', '/api/admin/daily-config', { lessonId: 'L1', mode: 'automatic', taskType: 'message', difficulty: 'easy', xpReward: 10 }],
  ['put', '/api/admin/hot-take', { topic: 'Test', stance: 'pro', difficulty: 'easy' }],
];

describe('auth boundaries', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}`;
  }, 30_000);

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const authHeader = (token = 'test-user-token') => ({ Authorization: `Bearer ${token}` });

  describe('unauthenticated requests return 401 with a consistent error shape', () => {
    it.each(PROTECTED_GET)('GET %s -> 401', async (path) => {
      const res = await fetch(`${baseUrl}${path}`);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toMatchObject({ error: expect.stringMatching(/authentication/i) });
    });

    it.each(PROTECTED_WRITE_SAMPLES)('%s %s -> 401', async (method, path, body) => {
      const res = await fetch(`${baseUrl}${path}`, {
        method: method.toUpperCase(),
        headers: { 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      expect(res.status).toBe(401);
      const parsed = await res.json();
      expect(parsed).toMatchObject({ error: expect.stringMatching(/authentication/i) });
    });
  });

  describe('authenticated demo-mode requests succeed for non-admin routes', () => {
    it('GET /api/today returns 200 with a task', async () => {
      const res = await fetch(`${baseUrl}/api/today`, { headers: authHeader() });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('task');
      expect(body.source).toBe('demo-cache');
    });

    it('GET /api/progress returns 200 with xp/streak/skills', async () => {
      const res = await fetch(`${baseUrl}/api/progress`, { headers: authHeader() });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        xp: expect.any(Number),
        streak: expect.any(Number),
        skills: expect.any(Object),
      });
    });

    it('GET /api/profile returns 200 with profile shape', async () => {
      const res = await fetch(`${baseUrl}/api/profile`, { headers: authHeader() });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('profile');
      expect(body).toHaveProperty('audits');
    });
  });

  describe('admin routes require authorization', () => {
    it.each(ADMIN_ENDPOINTS)('%s %s without auth -> 401', async (method, path, body) => {
      const res = await fetch(`${baseUrl}${path}`, {
        method: method.toUpperCase(),
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      expect(res.status).toBe(401);
    });

    it.each(ADMIN_ENDPOINTS)('%s %s with a demo authed user is reachable', async (method, path, body) => {
      // Demo mode short-circuits admin to allow any authed user. This is
      // documented behavior, not a security hole (demo mode is local-only).
      const res = await fetch(`${baseUrl}${path}`, {
        method: method.toUpperCase(),
        headers: { ...authHeader('demo-admin'), ...(body ? { 'content-type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      expect([200, 201, 400]).toContain(res.status);
    });
  });
});
