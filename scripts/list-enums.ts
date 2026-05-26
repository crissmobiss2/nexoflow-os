import postgres from "postgres";
async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  for (const name of ["nf_lead_status","nf_lead_source","nf_outreach_channel","nf_followup_status","nf_call_outcome"]) {
    const rows = await sql`SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = ${name}) ORDER BY enumsortorder`;
    console.log(name, '→', rows.map((r: any) => r.enumlabel));
  }
  await sql.end();
}
main();
