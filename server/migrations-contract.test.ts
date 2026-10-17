/**
 * server/migrations-contract.test.ts
 *
 * Static contract tests for hardened SQL migrations. These verify that our
 * hand-written SQL satisfies the security/correctness invariants we rely on
 * at the application layer (atomic award_xp, restricted grants, idempotent
 * guards, retention comments, etc.).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..');
const MIGRATIONS_DIR = resolve(REPO_ROOT, 'supabase/migrations');

function loadMigrations(): { name: string; sql: string }[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => ({
      name,
      sql: readFileSync(resolve(MIGRATIONS_DIR, name), 'utf8'),
    }));
}

describe('hardened migration 20261017120000 contract', () => {
  const mig = loadMigrations().find((m) =>
    m.name.startsWith('20261017120000'),
  );

  it('exists', () => {
    expect(mig, '20261017120000 migration must be present').toBeTruthy();
  });

  const sql = mig?.sql ?? '';

  it('award_xp rejects null / zero / negative / out-of-range amounts', () => {
    // Extract from `create or replace function` to the closing $$ of the body.
    const fnStart = sql.toLowerCase().indexOf('create or replace function public.award_xp');
    expect(fnStart).toBeGreaterThanOrEqual(0);
    const afterFn = sql.slice(fnStart);
    const bodyEnd = afterFn.indexOf('\n$$;', afterFn.toLowerCase().indexOf('as $$'));
    expect(bodyEnd).toBeGreaterThan(0);
    const body = afterFn.slice(0, bodyEnd);
    expect(body).toMatch(/p_user_id\s+is\s+null/i);
    expect(body).toMatch(/p_amount\s+is\s+null\s+or\s+p_amount\s*<=\s*0/i);
    expect(body).toMatch(/p_amount\s*>\s*10000/i);
    expect(body).toMatch(/raise\s+exception/i);
  });

  it('award_xp sets empty search_path and uses fully-qualified table names', () => {
    expect(sql).toMatch(/set\s+search_path\s*=\s*''/);
    const start = sql.toLowerCase().indexOf('create or replace function public.award_xp');
    expect(start).toBeGreaterThanOrEqual(0);
    const afterFn = sql.slice(start);
    const bodyEnd = afterFn.indexOf('\n$$;', afterFn.toLowerCase().indexOf('as $$'));
    const fn = bodyEnd > 0 ? afterFn.slice(0, bodyEnd) : afterFn;
    for (const tbl of ['profiles', 'xp_transactions', 'streaks', 'user_app_state']) {
      expect(fn, `award_xp must fully-qualify public.${tbl}`).toMatch(
        new RegExp(`public\\.${tbl}\\b`),
      );
    }
  });

  it('award_xp is granted to service_role only and revoked from public/anon/authenticated', () => {
    expect(sql).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.award_xp\(uuid,\s*integer\)\s+from\s+public,\s*anon,\s*authenticated/i,
    );
    expect(sql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.award_xp\(uuid,\s*integer\)\s+to\s+service_role/i,
    );
  });

  it('award_xp updates BOTH profiles.xp AND user_app_state.state.progress.xp', () => {
    expect(sql).toMatch(/jsonb_set\s*\(/i);
    expect(sql).toMatch(/\{progress\s*,\s*xp\}/);
    expect(sql).toMatch(/on\s+conflict\s*\(id\)\s+do\s+update[\s\S]*xp\s*=\s*coalesce\(public\.profiles\.xp/i);
  });

  it('coach_history has separate select/insert policies and no update/delete for clients', () => {
    expect(sql).toMatch(/create policy[^;]*"users read own coach history"[\s\S]*?for\s+select/i);
    expect(sql).toMatch(/create policy[^;]*"users insert own coach history"[\s\S]*?for\s+insert/i);
    expect(sql).toMatch(/intentionally no update\/delete policy/i);
  });

  it('coach_history has (user_id, created_at desc) index and retention comment', () => {
    expect(sql).toMatch(/coach_history_user_created_idx[\s\S]*?coach_history\(user_id,\s*created_at\s+desc\)/i);
    expect(sql).toMatch(/comment on table|retention|prune/i);
  });

  it('profiles.vibe backfill only fills rows where vibe is null', () => {
    expect(sql).toMatch(/update\s+public\.profiles[\s\S]*?where[\s\S]*p\.vibe\s+is\s+null/i);
    expect(sql).toMatch(/coalesce\(s\.vibe,\s*'direct'\)/i);
  });

  it('daily_tasks.task_id nullability is guarded by an information_schema DO block', () => {
    expect(sql).toMatch(/information_schema\.columns[\s\S]*?daily_tasks[\s\S]*?task_id[\s\S]*?is_nullable\s*=\s*'NO'/i);
  });

  it('add-column operations are idempotent (use if not exists / DO blocks)', () => {
    // Every `alter table add column` in this migration must include `if not exists`.
    const addColStmts = [...sql.matchAll(/alter\s+table\s+public\.\w+\s+add\s+column\b/gi)];
    expect(addColStmts.length).toBeGreaterThan(0);
    for (const match of addColStmts) {
      const tail = sql.slice(match.index!, match.index! + 80);
      expect(tail).toMatch(/if\s+not\s+exists/i);
    }
  });
});
