/**
 * NexoFlow OS — Safe Migration Script
 *
 * This script should be run BEFORE deploying to production.
 * It:
 *   1. Checks for unapplied migrations
 *   2. Creates a database backup (if pg_dump is available)
 *   3. Applies pending migrations
 *   4. Logs results
 *
 * Usage:
 *   npx tsx scripts/migrate.ts
 *   DATABASE_URL=... npx tsx scripts/migrate.ts
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";

const LOG_FILE = resolve(process.cwd(), "logs", "migrations.log");

function log(msg: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  try {
    mkdirSync(resolve(process.cwd(), "logs"), { recursive: true });
    appendFileSync(LOG_FILE, line + "\n");
  } catch {
    // best-effort logging
  }
}

function run(cmd: string, opts?: { cwd?: string }) {
  log(`Running: ${cmd}`);
  try {
    const output = execSync(cmd, {
      encoding: "utf-8",
      cwd: opts?.cwd ?? process.cwd(),
      env: { ...process.env },
    });
    log(`Output: ${output.trim()}`);
    return { success: true, output };
  } catch (err: any) {
    const msg = err?.stderr ?? err?.message ?? String(err);
    log(`Error: ${msg}`);
    return { success: false, output: msg };
  }
}

async function main() {
  log("═══════════════════════════════════════════════");
  log("NexoFlow OS — Database Migration");
  log("═══════════════════════════════════════════════");

  // ── Step 1: Check DATABASE_URL ─────────────────────────────────────────
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set. Set it or run with DATABASE_URL=...");
    process.exit(1);
  }
  log(`✓ DATABASE_URL is set (${process.env.DATABASE_URL.slice(0, 30)}...)`);

  // ── Step 2: Check for drizzle directory ─────────────────────────────────
  const drizzleDir = resolve(process.cwd(), "drizzle");
  if (!existsSync(drizzleDir)) {
    log("⚠ No drizzle/ directory found — running `drizzle-kit generate` first...");
    const gen = run("npx drizzle-kit generate");
    if (!gen.success) {
      console.error("❌ Failed to generate migrations. Aborting.");
      process.exit(1);
    }
  }
  log("✓ drizzle/ directory exists");

  // ── Step 3: Check for pending migrations ────────────────────────────────
  log("Checking for pending migrations...");
  const pendingCheck = run("npx drizzle-kit check", { cwd: process.cwd() });
  // drizzle-kit check returns exit code 1 when there are pending migrations
  // If it succeeds (exit 0), there are no pending migrations
  if (pendingCheck.success) {
    log("✓ No pending migrations found. Database is up to date.");
    console.log("\n✅ No migrations needed. Database is synchronized.");
    return;
  }
  log("→ Pending migrations detected");

  // ── Step 4: Backup (if pg_dump is available) ────────────────────────────
  log("Checking for pg_dump...");
  try {
    execSync("which pg_dump", { encoding: "utf-8" });
    log("✓ pg_dump is available");

    const backupDir = resolve(process.cwd(), "backups");
    mkdirSync(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = resolve(backupDir, `nexoflow-backup-${timestamp}.sql`);

    log(`Creating database backup: ${backupFile} ...`);
    const backup = execSync(`pg_dump "${process.env.DATABASE_URL}" --no-owner --no-acl -f "${backupFile}"`, {
      encoding: "utf-8",
      env: { ...process.env },
    });
    log(`✓ Backup created: ${backupFile} (${(existsSync(backupFile) ? require("fs").statSync(backupFile).size : 0) / 1024} KB)`);
  } catch {
    log("⚠ pg_dump not found or backup failed — skipping backup. Set POSTGRES_HOST/PORT/USER/PASSWORD or install pg_dump.");
    console.warn("⚠ Warning: No database backup was created. Consider running pg_dump manually.");
  }

  // ── Step 5: Apply migrations ───────────────────────────────────────────
  log("Applying pending migrations...");
  console.log("\n📦 Applying migrations...\n");

  const migrate = run("npx drizzle-kit migrate");

  if (migrate.success) {
    log("✓ Migrations applied successfully");
    console.log("\n✅ Migrations complete!");
  } else {
    console.error("\n❌ Migration failed. Check logs/migrations.log for details.");
    process.exit(1);
  }

  log("═══════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
