/**
 * Vercel serverless entry point for the datings.lol API.
 *
 * Vercel routes every `/api/*` request here (see the rewrites in vercel.json).
 * The exported Express app handles them exactly like the long-running server
 * does — same middleware, auth, validation, and routes — minus the HTTP
 * listener and static file serving, which Vercel's CDN takes care of.
 *
 * Required environment variables (Project → Settings → Environment Variables):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   — server-side Supabase access
 *   GEMINI_API_KEY                            — AI coach (optional)
 *   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY — baked into the SPA at
 *     build time, so they must exist before the first deploy.
 */
import { app } from '../server';

export default app;
