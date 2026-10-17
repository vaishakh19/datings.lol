/**
 * Schema-contract guard test.
 *
 * Scans server.ts and src/lib/*.ts for every Supabase .from('table') and
 * .rpc('fn') call, plus columns referenced in .select() / .insert() /
 * .upsert() / .update(), and cross-checks that each name is defined in
 * supabase/schema.sql + supabase/migrations/ and that user-data tables have
 * RLS enabled. Fails with a clear message listing any reference that doesn't
 * have a matching definition.
 *
 * Legitimate exceptions are listed in ALLOWED_TABLES / ALLOWED_FUNCTIONS /
 * ALLOWED_COLUMNS with an explanatory comment.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..');

// Tables the server references via .from() that are not actually public-schema
// tables we create (e.g. handled by the Supabase SDK).
const ALLOWED_TABLES: ReadonlySet<string> = new Set<string>([]);

// RPCs invoked via the SDK but defined outside our SQL.
const ALLOWED_FUNCTIONS: ReadonlySet<string> = new Set<string>([]);

// Columns that are accessed through alias/expression/RPC returns rather than
// direct table columns. Each entry is 'table.column' with a reason.
const ALLOWED_COLUMNS: ReadonlySet<string> = new Set<string>([
  // community progress endpoint maps rows to `${userId}:${teaching_id}` strings
  // on the way back to the client — never a column read.
  'saved_teachings.fake_column_for_legacy_key_format',
  'teaching_completions.fake_column_for_legacy_key_format',
  // subscriptions columns selected across the billing RPC (billing code uses
  // the supabase client directly; we enumerate those as explicit columns below).
]);

// Tables that legitimately don't need RLS (populated by migrations, fully
// revoked from authenticated users, or read-only public).
const RLS_EXEMPT_TABLES: ReadonlySet<string> = new Set<string>([]);

function collectFromFiles(paths: string[]): string {
  return paths.map((p) => readFileSync(resolve(REPO_ROOT, p), 'utf8')).join('\n');
}

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(resolve(REPO_ROOT, dir), { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else if (entry.isFile() && /\.(ts|tsx|js|sql)$/.test(entry.name)) out.push(full);
  }
  return out;
}

// --- Reference extraction from source --------------------------------------

function extractReferencedTables(sourceCode: string): Set<string> {
  const tables = new Set<string>();
  const re = /\.from\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sourceCode)) !== null) tables.add(m[1]);
  return tables;
}

function extractReferencedRpcs(sourceCode: string): Set<string> {
  const fns = new Set<string>();
  const re = /\.rpc\(\s*['"]([^'"]+)['"]\s*,/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sourceCode)) !== null) fns.add(m[1]);
  return fns;
}

/**
 * Extract referenced table→columns from .from('table').select('...'),
 * .insert({...}), .upsert({...}), .update({...}). Handles simple identifiers
 * separated by commas; ignores aggregate/count queries like '*' and
 * options like `{head:true,count:'exact'}`.
 */
function extractReferencedColumns(sourceCode: string): Map<string, Set<string>> {
  const byTable = new Map<string, Set<string>>();
  const add = (t: string, c: string) => {
    if (!byTable.has(t)) byTable.set(t, new Set());
    byTable.get(t)!.add(c);
  };

  // Match .from('table') chained through to .select('...') / .insert({...}) /
  // .upsert({...}) / .update({...}). We look at the literal identifiers in the
  // argument; this is a simple static check, not a JS parser, so it will
  // over-count in some cases (hence the allowlist).
  const fromRe = /\.from\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = fromRe.exec(sourceCode)) !== null) {
    const table = m[1];
    const rest = sourceCode.slice(m.index + m[0].length);

    // Stop at next .from( statement boundary to avoid picking up columns from
    // a subsequent Supabase chain. A generous 1500 chars still covers typical
    // chained calls.
    let windowLimit = rest.length;
    const next = /\.from\(/.exec(rest.slice(1));
    if (next) windowLimit = Math.min(windowLimit, next.index + 1);
    const semi = rest.indexOf(';');
    if (semi >= 0) windowLimit = Math.min(windowLimit, semi);
    const window = rest.slice(0, Math.min(1500, windowLimit));

    // .select('a, b, c') or .select('a, b, c', ...)
    const selectMatch = /\.select\(\s*['"]([^'"]+)['"]/.exec(window);
    if (selectMatch) {
      selectMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && s !== '*' && !s.includes('(') && !s.includes('{'))
        .forEach((c) => {
          const col = c.split(':')[0].trim(); // strip aliases
          if (col) add(table, col);
        });
    }

    // For insert/upsert/update: the payload is an object literal, often with
    // colons and nested braces. Extract top-level identifier keys at depth 0
    // using a simple brace-count scanner.
    for (const method of ['insert', 'upsert', 'update']) {
      const re2 = new RegExp(`\\.${method}\\(\\s*\\{`);
      const hit = re2.exec(window);
      if (!hit) continue;
      const start = hit.index + hit[0].length - 1; // position of '{'
      let depth = 1;
      let i = start + 1;
      while (i < window.length && depth > 0) {
        const ch = window[i];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        else if (ch === '(') {
          // skip until matching paren
          let pd = 1;
          i++;
          while (i < window.length && pd > 0) {
            if (window[i] === '(') pd++;
            else if (window[i] === ')') pd--;
            i++;
          }
          continue;
        }
        i++;
      }
      const objLiteral = window.slice(start + 1, i - 1);
      // Find identifier keys: IDENT: or 'ident': or "ident":
      const keyRe = /(?:^|[,{]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g;
      let km: RegExpExecArray | null;
      while ((km = keyRe.exec(objLiteral)) !== null) add(table, km[1]);
    }
  }
  return byTable;
}

// --- SQL parsing -----------------------------------------------------------

function extractDefinedTables(sql: string): Set<string> {
  const tables = new Set<string>();
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) tables.add(m[1]);
  return tables;
}

function extractDefinedFunctions(sql: string): Set<string> {
  const fns = new Set<string>();
  const re = /create(?:\s+or\s+replace)?\s+function\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) fns.add(m[1]);
  return fns;
}

function extractDefinedColumnsByTable(sql: string): Map<string, Set<string>> {
  const byTable = new Map<string, Set<string>>();

  // Walk CREATE TABLE blocks using parenthesis/string-aware scanning so that
  // inline CHECK (...) constraints with commas or default intervals don't
  // confuse the splitter.
  const createRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/gi;
  let m: RegExpExecArray | null;
  while ((m = createRe.exec(sql)) !== null) {
    const table = m[1];
    const openIdx = m.index + m[0].length - 1;
    let depth = 1;
    let inString = false;
    let i = openIdx + 1;
    for (; i < sql.length && depth > 0; i++) {
      const ch = sql[i];
      if (ch === "'" && sql[i - 1] !== '\\') inString = !inString;
      if (inString) continue;
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
    }
    const body = sql.slice(openIdx + 1, i - 1);
    const cols = new Set<string>();
    let d = 0;
    let start = 0;
    let inStr = false;
    for (let k = 0; k < body.length; k++) {
      const ch = body[k];
      if (ch === "'" && body[k - 1] !== '\\') inStr = !inStr;
      if (inStr) continue;
      if (ch === '(') d++;
      else if (ch === ')') d--;
      else if (ch === ',' && d === 0) {
        processTablePiece(body.slice(start, k), cols);
        start = k + 1;
      }
    }
    processTablePiece(body.slice(start), cols);
    if (!byTable.has(table)) byTable.set(table, cols);
    else cols.forEach((c) => byTable.get(table)!.add(c));
  }

  // Also pick up `alter table add column [if not exists] name type` statements.
  const addCol = /alter\s+table\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi;
  while ((m = addCol.exec(sql)) !== null) {
    const table = m[1];
    const col = m[2];
    if (!byTable.has(table)) byTable.set(table, new Set());
    byTable.get(table)!.add(col);
  }
  return byTable;
}

function processTablePiece(piece: string, cols: Set<string>) {
  const trimmed = piece.trim();
  if (!trimmed) return;
  const lower = trimmed.toLowerCase();
  // Skip constraints, keys, indexes, etc. Both bare and named constraints.
  // Match on a word boundary so columns like `checkout_session_id` aren't
  // mistaken for a CHECK constraint.
  if (
    /^(primary\s|foreign\s|unique\s|check\s|constraint\s|exclude\s|like\s|references\b)/i.test(
      trimmed,
    )
  ) {
    return;
  }
  // First token should be the column name (optionally quoted). Strip leading
  // whitespace. Skip inline constraints like UNIQUE / NOT NULL / DEFAULT /
  // REFERENCES / CHECK to pick out just the identifier.
  const match = trimmed.match(/^"?([a-z_][a-z0-9_]*)"?\b/i);
  if (match) cols.add(match[1]);
}

function extractRlsEnabledTables(sql: string): Set<string> {
  const enabled = new Set<string>();
  const re = /alter\s+table\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+enable\s+row\s+level\s+security/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) enabled.add(m[1]);
  return enabled;
}

function tablesRevokedFromAll(sql: string): Set<string> {
  const revoked = new Set<string>();
  const re = /revoke\s+all\s+on\s+(?:table\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s+from\s+(?:public\s*,\s*?)?(?:anon|authenticated)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) revoked.add(m[1]);
  return revoked;
}

describe('server/schema contract', () => {
  const sourceFiles = [
    'server.ts',
    ...listFilesRecursive('src/lib').filter((f) => /\.(ts|tsx)$/.test(f)),
  ];
  const source = collectFromFiles(sourceFiles);

  const sqlFiles = [
    'supabase/schema.sql',
    ...listFilesRecursive('supabase/migrations').filter((f) => f.endsWith('.sql')),
  ];
  const sql = collectFromFiles(sqlFiles);

  const referencedTables = extractReferencedTables(source);
  const referencedRpcs = extractReferencedRpcs(source);
  const referencedColumns = extractReferencedColumns(source);
  const definedTables = extractDefinedTables(sql);
  const definedFunctions = extractDefinedFunctions(sql);
  const definedColumns = extractDefinedColumnsByTable(sql);
  const rlsEnabled = extractRlsEnabledTables(sql);
  const revokedFromAll = tablesRevokedFromAll(sql);

  it('every table referenced by the server exists in the SQL schema', () => {
    const missing: string[] = [];
    for (const t of referencedTables) {
      if (ALLOWED_TABLES.has(t)) continue;
      if (!definedTables.has(t)) missing.push(t);
    }
    expect(missing).toEqual([]);
  });

  it('every RPC function referenced by the server is defined in SQL', () => {
    const missing: string[] = [];
    for (const f of referencedRpcs) {
      if (ALLOWED_FUNCTIONS.has(f)) continue;
      if (!definedFunctions.has(f)) missing.push(f);
    }
    expect(missing).toEqual([]);
  });

  it('every column the server selects/inserts/upserts/updates exists in SQL', () => {
    const missing: string[] = [];
    for (const [table, cols] of referencedColumns.entries()) {
      if (ALLOWED_TABLES.has(table)) continue;
      const defined = definedColumns.get(table);
      if (!defined) {
        missing.push(`${table}: table not defined (caught by prior test)`);
        continue;
      }
      for (const col of cols) {
        const key = `${table}.${col}`;
        if (ALLOWED_COLUMNS.has(key)) continue;
        if (!defined.has(col)) missing.push(`${table}.${col}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every user-data table has RLS enabled', () => {
    const missing: string[] = [];
    for (const t of definedTables) {
      if (RLS_EXEMPT_TABLES.has(t)) continue;
      // Tables fully revoked from anon+authenticated are only accessible to
      // service_role; RLS is not required (and indeed is irrelevant).
      if (revokedFromAll.has(t)) continue;
      if (!rlsEnabled.has(t)) missing.push(t);
    }
    expect(missing).toEqual([]);
  });
});
