import postgres from "postgres";
async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const rows = await sql`SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'nf_lead_source') ORDER BY enumsortorder`;
  console.log('nf_lead_source values:', rows.map((r: any) => r.enumlabel));
  await sql.end();
}
main();
