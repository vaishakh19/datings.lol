import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';

// The server module self-validates env at import time. Ensure the required
// demo-mode env is present *before* we import it.
process.env.ALLOW_DEMO_MODE = 'true';
process.env.NODE_ENV = 'test';
process.env.ENABLE_CSP = 'false';
process.env.LOG_LEVEL = 'error';
// Also set VITE_SUPABASE_URL to a placeholder so server doesn't fatal.
process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';

const { app } = await import('../server.js');

describe('HTTP smoke tests', () => {
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

  it('GET /api/health returns ok and billing metadata', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.billing).toMatchObject({
      provider: 'dodo',
      environment: 'test_mode',
    });
  });

  it('GET /healthz returns uptime', async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
  });

  it('unknown /api path returns 404 json', async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it('protected route without auth returns 401', async () => {
    const res = await fetch(`${baseUrl}/api/profile`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/authentication/i);
  });

  it('security headers are present on API responses', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.headers.get('x-powered-by')).toBeNull();
    expect(res.headers.get('x-content-type-options')).toMatch(/nosniff/i);
  });
});
