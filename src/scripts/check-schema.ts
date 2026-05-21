import postgres from "postgres";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.production") });

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });

  // List all tables
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name
  `;
  console.log("Tables:", tables.map((t: any) => t.table_name));

  // Check columns on projects table
  const projectsCols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' ORDER BY column_name
  `;
  console.log("projects columns:", projectsCols.map((c: any) => c.column_name));

  // Check for verification_tokens table
  const vt = tables.find((t: any) => t.table_name === "verification_tokens" || t.table_name === "verification_token");
  console.log("verification_tokens exists:", !!vt);

  await sql.end();
}

main().catch(console.error);
