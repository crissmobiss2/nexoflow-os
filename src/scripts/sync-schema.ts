/**
 * Safe schema sync — adds missing columns/tables without touching existing data.
 * Run with: DATABASE_URL=... npx tsx src/scripts/sync-schema.ts
 */
import postgres from "postgres";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL required");

const sql = postgres(DB_URL, { ssl: "require" });

async function colExists(table: string, col: string) {
  const r = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=${table} AND column_name=${col}
  `;
  return r.length > 0;
}

async function tableExists(table: string) {
  const r = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name=${table}
  `;
  return r.length > 0;
}

async function enumExists(name: string) {
  const r = await sql`SELECT 1 FROM pg_type WHERE typname=${name}`;
  return r.length > 0;
}

async function main() {
  console.log("🔍 Checking schema gaps...\n");

  // ── Enums ────────────────────────────────────────────────────────────────────
  if (!await enumExists("nf_decl_status")) {
    await sql`CREATE TYPE nf_decl_status AS ENUM ('draft','sent','viewed','accepted','declined','expired')`;
    console.log("✅ Created enum nf_decl_status");
  }

  // ── nf_clients: add team_id ──────────────────────────────────────────────────
  if (await tableExists("nf_clients") && !await colExists("nf_clients", "team_id")) {
    await sql`ALTER TABLE nf_clients ADD COLUMN team_id uuid REFERENCES nf_teams(id) ON DELETE CASCADE`;
    console.log("✅ nf_clients.team_id added");
  }

  // ── nf_projects: add team_id ─────────────────────────────────────────────────
  if (await tableExists("nf_projects") && !await colExists("nf_projects", "team_id")) {
    await sql`ALTER TABLE nf_projects ADD COLUMN team_id uuid REFERENCES nf_teams(id) ON DELETE CASCADE`;
    console.log("✅ nf_projects.team_id added");
  }

  // ── nf_knowledge_snippets: add team_id ───────────────────────────────────────
  if (await tableExists("nf_knowledge_snippets") && !await colExists("nf_knowledge_snippets", "team_id")) {
    await sql`ALTER TABLE nf_knowledge_snippets ADD COLUMN team_id uuid REFERENCES nf_teams(id) ON DELETE CASCADE`;
    console.log("✅ nf_knowledge_snippets.team_id added");
  }

  // ── Print current tables ─────────────────────────────────────────────────────
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' ORDER BY table_name
  `;
  console.log("\n📋 Tables in DB:", tables.map((t: any) => t.table_name).join(", "));

  // ── Check for auth tables (needed by Auth.js DrizzleAdapter) ─────────────────
  const authTables = ["users","sessions","accounts","verification_tokens"];
  for (const t of authTables) {
    const exists = await tableExists(t);
    console.log(`${exists ? "✅" : "❌"} Auth table: ${t}`);
  }

  // ── Check nf_projects columns ────────────────────────────────────────────────
  const projCols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='nf_projects' ORDER BY column_name
  `;
  console.log("\nnf_projects columns:", projCols.map((c: any) => c.column_name).join(", "));

  // ── Check nf_clients columns ─────────────────────────────────────────────────
  const clientCols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='nf_clients' ORDER BY column_name
  `;
  console.log("nf_clients columns:", clientCols.map((c: any) => c.column_name).join(", "));

  await sql.end();
  console.log("\n✅ Done.");
}

main().catch(e => { console.error("❌ Error:", e.message); process.exit(1); });
