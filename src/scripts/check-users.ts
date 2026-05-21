import postgres from "postgres";

async function main() {
  const DB = "postgresql://neondb_owner:npg_rbd9w2LXIACW@ep-aged-voice-apdmonw0-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
  const sql = postgres(DB, { ssl: "require" });

  const users = await sql`SELECT id, email, name, role FROM users ORDER BY "createdAt" DESC LIMIT 10`;
  console.log("Users:", JSON.stringify(users, null, 2));

  const sessions = await sql`SELECT id, "userId", expires FROM sessions ORDER BY expires DESC LIMIT 5`;
  console.log("Active sessions:", JSON.stringify(sessions, null, 2));

  await sql.end();
}

main().catch(console.error);
