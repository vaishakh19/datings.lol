/**
 * Vercel serverless entry point for the datings.lol API.
 *
 * Vercel routes every `/api/*` request here (see the rewrites in vercel.json).
 * The exported Express app handles them exactly like the long-running server
 * does — same middleware, auth, validation, and routes — minus the HTTP
 * listener and static file serving, which Vercel's CDN takes care of.
 *
 * The server module is loaded dynamically inside a try/catch: if anything at
 * module scope fails to boot (a bad dependency, a syntax error, an invalid
 * environment variable), the function answers with a JSON 500 carrying the
 * actual error instead of Vercel's opaque FUNCTION_INVOCATION_FAILED page —
 * so `curl https://datings.lol/api/health` is enough to diagnose a broken
 * deployment.
 *
 * Required environment variables (Project → Settings → Environment Variables):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   — server-side Supabase access
 *   GEMINI_API_KEY                            — AI coach (optional)
 *   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY — baked into the SPA at
 *     build time, so they must exist before the first deploy.
 */
import type { Request, Response } from 'express';

type Handler = (req: Request, res: Response) => void;

let handler: Handler | null = null;
let bootError: string | null = null;

try {
  // The explicit .js extension is required: this package is ESM ("type":
  // "module"), and Vercel's Node builder transpiles files individually and
  // copies them as-is instead of bundling. Node's ESM resolver needs the
  // extension to find the compiled /var/task/server.js at runtime, while
  // esbuild/tsc map "../server.js" back to ../server.ts at build time.
  // Extensionless, this import fails with "Cannot find module '/var/task/server'".
  const { app } = await import('../server.js');
  handler = app as unknown as Handler;
} catch (error) {
  bootError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

const bootFailure = (_req: Request, res: Response) => {
  res.status(500).json({
    error: 'The API failed to boot. Check the deployment logs for details.',
    detail: bootError,
    code: 'API_BOOT_FAILED',
  });
};

export default (handler ?? bootFailure) as Handler;
