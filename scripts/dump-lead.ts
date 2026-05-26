import postgres from "postgres";
async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const r = await sql`
    SELECT company, industry, website, pain_points,
           scraped_profile, business_profile
    FROM nf_leads
    WHERE id = '634f66c8-ab26-4545-9395-064c13d88edb'
  `;
  console.log(JSON.stringify(r[0], null, 2));
  await sql.end();
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
