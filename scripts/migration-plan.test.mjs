import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { isMigrationFile, migrationName, pendingMigrations } from "./migration-plan.mjs";
import { projectRoot } from "./with-app-env.mjs";

const AUTH_MIGRATION = "0001_auth.sql";

/**
 * The auth-on copy of the Better Auth schema and its source, or null when the
 * app has not turned sign-in on (the shipped state).
 */
function authSchemaCopy(root) {
  const copy = join(root, "migrations", AUTH_MIGRATION);
  const source = join(root, "migrations/auth", AUTH_MIGRATION);
  if (!existsSync(copy) || !existsSync(source)) return null;
  return { copy: readFileSync(copy, "utf8"), source: readFileSync(source, "utf8") };
}

test("_migrations keys on basename, not path", () => {
  assert.equal(migrationName("/migrations/0002_todos.sql"), "0002_todos.sql");
  assert.equal(migrationName("migrations/auth/0001_auth.sql"), "0001_auth.sql");
  assert.equal(migrationName("0001_auth.sql"), "0001_auth.sql");
});

test("a file already applied from another directory does not re-apply", () => {
  // The auth-on path copies migrations/auth/0001_auth.sql into the globbed
  // directory; a database that already has it must not run it twice.
  assert.deepEqual(pendingMigrations(["/migrations/0001_auth.sql"], ["0001_auth.sql"]), []);
});

test("pending migrations are returned in name order", () => {
  assert.deepEqual(
    pendingMigrations(
      ["/migrations/0003_c.sql", "/migrations/0001_a.sql", "/migrations/0002_b.sql"],
      ["0001_a.sql"],
    ),
    [
      { name: "0002_b.sql", path: "/migrations/0002_b.sql" },
      { name: "0003_c.sql", path: "/migrations/0003_c.sql" },
    ],
  );
});

test("non-.sql entries are dropped (readdir also yields the auth/ directory)", () => {
  assert.equal(isMigrationFile("auth"), false);
  assert.deepEqual(pendingMigrations(["auth", "README.md"], []), []);
});

test("copied sql in the globbed directory is pending until applied", () => {
  const migrationsDir = join(projectRoot(), "migrations");
  assert.deepEqual(pendingMigrations(readdirSync(migrationsDir), []), [
    { name: "0001_auth.sql", path: "0001_auth.sql" },
    { name: "0002_estimator.sql", path: "0002_estimator.sql" },
  ]);
  assert.ok(readdirSync(join(migrationsDir, "auth")).includes("0001_auth.sql"));
});

test("this workspace's auth schema copy is byte-identical to its source", () => {
  // An edited copy diverges silently: basename keying skips it on a database
  // that already ran the original, and applies it on a fresh PGLite preview.
  const pair = authSchemaCopy(projectRoot());
  if (pair === null) return; // sign-in off — nothing has been copied up
  assert.equal(
    pair.copy,
    pair.source,
    "migrations/0001_auth.sql has been edited — it must stay a verbatim copy of migrations/auth/0001_auth.sql",
  );
});

test("the copy check reads both files and catches an edit", () => {
  const root = mkdtempSync(join(tmpdir(), "auth-schema-"));
  mkdirSync(join(root, "migrations/auth"), { recursive: true });
  writeFileSync(join(root, "migrations/auth", AUTH_MIGRATION), "create table t ();\n");
  assert.equal(authSchemaCopy(root), null);

  writeFileSync(join(root, "migrations", AUTH_MIGRATION), "create table t ();\n");
  const same = authSchemaCopy(root);
  assert.equal(same.copy, same.source);

  writeFileSync(join(root, "migrations", AUTH_MIGRATION), "create table t (x int);\n");
  const drifted = authSchemaCopy(root);
  assert.notEqual(drifted.copy, drifted.source);
});

test("phase 43 sql is additive, locks every new table, and has no open policy", () => {
  const sql = readFileSync(join(projectRoot(), "supabase/p43-seen-threads-2026-11-04.sql"), "utf8");
  const folded = sql.toLowerCase();
  assert.equal(/\bdrop\s+table\b/.test(folded), false);
  assert.equal(/\bdrop\s+column\b/.test(folded), false);
  const tables = [...folded.matchAll(/create table if not exists public\.(\w+)/g)].map((match) => match[1]);
  assert.ok(tables.includes("methodology_versions"));
  tables.forEach((name) => {
    assert.equal(folded.includes(`alter table public.${name} enable row level security`), true, name);
  });
  assert.equal(/using\s*\(\s*true\s*\)/.test(folded), false);
  assert.equal(folded.includes("to authenticated"), true);
  assert.equal(folded.includes("ce_threads_ce_id_idx"), true);
  assert.equal(folded.includes("ce_thread_messages_thread_id_idx"), true);
  assert.equal(folded.includes("app_notifications_to_user_id_idx"), true);
  assert.equal(/auth\.jwt\(\)\s*->>\s*'role'/.test(sql), false);
  assert.equal(/ce_threads inserts are server-only \(service role\)/.test(sql), true);
  const method = sql.slice(sql.indexOf("policy methodologies_read"));
  assert.equal(method.includes("app_metadata"), true);
  ["methodologies_read", "methodologies_write", "methodology_versions_read", "methodology_versions_write"].forEach((name) => {
    const start = sql.indexOf(`policy ${name}`);
    const end = sql.indexOf("drop policy", start + 1);
    const block = sql.slice(start, end === -1 ? sql.length : end);
    assert.equal(block.includes("app_metadata"), true, name);
  });
});
