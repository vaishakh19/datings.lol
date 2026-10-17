/**
 * server/routes-contract.test.ts
 *
 * Route-level contract tests covering profile round-trip, community save/
 * unsave/complete-once/react, zod malformed-body consistency, coach input
 * caps, and unknown-route 404 shape. All run against the real Express app
 * in demo mode. Each describe block uses its own bearer token so that
 * demo-mode in-memory state (profiles, reactions, completions, coach quota)
 * doesn't leak between groups.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';

process.env.ALLOW_DEMO_MODE = 'true';
process.env.NODE_ENV = 'test';
process.env.ENABLE_CSP = 'false';
process.env.LOG_LEVEL = 'error';
process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.GEMINI_API_KEY;

const { app } = await import('../server.js');

const json = (body: unknown) => ({
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

function authed(token: string) {
  return async (baseUrl: string, path: string, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers ?? {});
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(`${baseUrl}${path}`, { ...init, headers });
  };
}

// Real teaching id from the in-memory catalog (see server.ts TEACHINGS).
const TEACHING_ID = 'teaching-breathe';

function describeWithServer(name: string, fn: (ctx: { baseUrl: () => string; authFetch: ReturnType<typeof authed> }) => void, token: string) {
  describe(name, () => {
    let server: Server;
    let baseUrl = '';
    const authFetch = authed(token);

    beforeAll(async () => {
      await new Promise<void>((resolve) => {
        server = app.listen(0, '127.0.0.1', () => resolve());
      });
      baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    }, 30_000);

    afterAll(async () => {
      await new Promise((resolve) => server.close(resolve));
    });

    fn({ baseUrl: () => baseUrl, authFetch });
  });
}

describeWithServer(
  'profile roundtrip & validation',
  ({ baseUrl, authFetch }) => {
    it('GET /api/profile returns a profile envelope', async () => {
      const res = await authFetch(baseUrl(), '/api/profile');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('userId');
      expect(body).toHaveProperty('profile');
      expect(body).toHaveProperty('audits');
      expect(Array.isArray(body.audits)).toBe(true);
    });

    it('PATCH /api/profile accepts valid fields and round-trips', async () => {
      const patch = { goal: 'Get a first date', blocker: 'overthinking', vibe: 'gentle' as const };
      const res = await authFetch(baseUrl(), '/api/profile', { method: 'PATCH', ...json(patch) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.profile).toMatchObject(patch);

      const again = await authFetch(baseUrl(), '/api/profile');
      const fetched = await again.json();
      expect(fetched.profile.goal).toBe('Get a first date');
    });

    it('PATCH /api/profile rejects unknown fields (zod strict)', async () => {
      const res = await authFetch(baseUrl(), '/api/profile', {
        method: 'PATCH',
        ...json({ goal: 'ok', rogue: 'field', xp: 99999 }),
      });
      expect(res.status).toBe(400);
    });

    it('PATCH /api/profile rejects vibe outside the enum', async () => {
      const res = await authFetch(baseUrl(), '/api/profile', {
        method: 'PATCH',
        ...json({ vibe: 'ultra-brutal' }),
      });
      expect(res.status).toBe(400);
    });

    it('POST /api/profile/avatar rejects a non-data URL', async () => {
      const res = await authFetch(baseUrl(), '/api/profile/avatar', {
        method: 'POST',
        ...json({ dataUrl: 'http://example.com/evil.png' }),
      });
      expect(res.status).toBe(400);
    });

    it('POST /api/profile/avatar rejects missing dataUrl', async () => {
      const res = await authFetch(baseUrl(), '/api/profile/avatar', {
        method: 'POST',
        ...json({}),
      });
      expect(res.status).toBe(400);
    });
  },
  'route-contract-profile',
);

describeWithServer(
  'community save / unsave / complete / react idempotency',
  ({ baseUrl, authFetch }) => {
    it('GET /api/community/progress returns saved/completed arrays', async () => {
      const res = await authFetch(baseUrl(), '/api/community/progress');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.saved)).toBe(true);
      expect(Array.isArray(body.completed)).toBe(true);
    });

    it('POST save -> DELETE save round-trips', async () => {
      let r = await authFetch(baseUrl(), `/api/community/teachings/${TEACHING_ID}/save`, { method: 'POST' });
      expect(r.status).toBe(200);
      expect(await r.json()).toMatchObject({ saved: true, teachingId: TEACHING_ID });

      const prog1 = await authFetch(baseUrl(), '/api/community/progress');
      const savedList = (await prog1.json()).saved as string[];
      expect(savedList.findIndex((k) => k.endsWith(`:${TEACHING_ID}`))).toBeGreaterThanOrEqual(0);

      r = await authFetch(baseUrl(), `/api/community/teachings/${TEACHING_ID}/save`, { method: 'DELETE' });
      expect(r.status).toBe(200);
      expect(await r.json()).toMatchObject({ saved: false });
    });

    it('POST complete is idempotent (first 201, second 409)', async () => {
      const first = await authFetch(baseUrl(), `/api/community/teachings/${TEACHING_ID}/complete`, { method: 'POST' });
      expect(first.status).toBe(201);
      const second = await authFetch(baseUrl(), `/api/community/teachings/${TEACHING_ID}/complete`, { method: 'POST' });
      expect(second.status).toBe(409);
      const body = await second.json();
      expect(body.error).toMatch(/already/i);
    });

    it('POST react rejects invalid reaction enum', async () => {
      const r = await authFetch(baseUrl(), `/api/community/teachings/${TEACHING_ID}/react`, {
        method: 'POST',
        ...json({ reaction: 'thumbsup' }),
      });
      expect(r.status).toBe(400);
    });

    it('POST react accepts valid enum and duplicates return 409', async () => {
      const r = await authFetch(baseUrl(), `/api/community/teachings/${TEACHING_ID}/react`, {
        method: 'POST',
        ...json({ reaction: '🔥' }),
      });
      expect(r.status).toBe(201);
      const r2 = await authFetch(baseUrl(), `/api/community/teachings/${TEACHING_ID}/react`, {
        method: 'POST',
        ...json({ reaction: '🔥' }),
      });
      expect(r2.status).toBe(409);
    });

    it('POST /api/community/teachings/:id on unknown id returns 404', async () => {
      const r = await authFetch(baseUrl(), '/api/community/teachings/does-not-exist/complete', { method: 'POST' });
      expect(r.status).toBe(404);
    });
  },
  'route-contract-community',
);

describeWithServer(
  'malformed body zod behavior is consistent',
  ({ baseUrl, authFetch }) => {
    it('POST /api/practice/message with non-object body returns 400 json', async () => {
      const r = await authFetch(baseUrl(), '/api/practice/message', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '"just a string"',
      });
      expect(r.status).toBe(400);
      expect(await r.json()).toMatchObject({ error: expect.any(String) });
    });

    it('POST /api/practice/message rejects empty message', async () => {
      const r = await authFetch(baseUrl(), '/api/practice/message', {
        method: 'POST',
        ...json({ message: '' }),
      });
      expect(r.status).toBe(400);
    });

    it('POST /api/profile/journal with missing content returns 400', async () => {
      const r = await authFetch(baseUrl(), '/api/profile/journal', {
        method: 'POST',
        ...json({ title: 'x' }),
      });
      expect(r.status).toBe(400);
    });

    it('POST /api/tasks/:id/complete for unknown task returns 404 json', async () => {
      const r = await authFetch(baseUrl(), '/api/tasks/nope/complete', { method: 'POST' });
      expect(r.status).toBe(404);
      expect(await r.json()).toMatchObject({ error: expect.any(String) });
    });

    it('unknown API path returns 404 json', async () => {
      const r = await authFetch(baseUrl(), '/api/totally-made-up');
      expect(r.status).toBe(404);
      const body = await r.json();
      expect(body.error).toMatch(/not found/i);
    });
  },
  'route-contract-zod',
);

describeWithServer(
  'coach route quota and input caps',
  ({ baseUrl, authFetch }) => {
    it('POST /api/coach with empty message+no image returns 400', async () => {
      const r = await authFetch(baseUrl(), '/api/coach', { method: 'POST', ...json({ message: '' }) });
      expect(r.status).toBe(400);
    });

    it('POST /api/coach rejects message longer than 4000 chars', async () => {
      const r = await authFetch(baseUrl(), '/api/coach', {
        method: 'POST',
        ...json({ message: 'a'.repeat(4001) }),
      });
      expect(r.status).toBe(400);
    });

    it('POST /api/coach with a valid message returns a response (no Gemini crash)', async () => {
      const r = await authFetch(baseUrl(), '/api/coach', {
        method: 'POST',
        ...json({ message: 'Give me opener advice', vibe: 'direct' }),
      });
      // Expect a well-formed JSON response — 200 (fallback), 429 (quota),
      // 400 (validation), or 503 (Gemini not configured) — never 500.
      expect([200, 400, 429, 503]).toContain(r.status);
      const ctype = r.headers.get('content-type') || '';
      expect(ctype).toContain('application/json');
      const body = await r.json();
      // Error responses carry {error,...}, success responses carry {text,...}.
      if (r.status === 200) expect(body.text).toEqual(expect.any(String));
      else expect(body.error).toEqual(expect.any(String));
    });
  },
  'route-contract-coach',
);
