import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const cols = await sql`
    SELECT column_name, udt_name FROM information_schema.columns
    WHERE table_name='nf_leads' AND column_name IN (
      'scraped_profile','business_profile','share_token','demo_view_count',
      'demo_total_seconds','demo_blob_url','proposal_blob_url','industry_profile_id',
      'won_value_cents','share_revoked_at','business_profile_at','scraped_at','demo_last_viewed_at'
    )
    ORDER BY column_name
  `;
  const tables = await sql`
    SELECT tablename FROM pg_tables
    WHERE tablename IN ('nf_industry_profiles','nf_outreach_templates','nf_lead_outcomes','nf_lead_demo_views')
    ORDER BY tablename
  `;
  const outreachCols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='nf_lead_outreach' AND column_name IN ('provider_message_id','provider_status','provider_error')
    ORDER BY column_name
  `;
  const seed = await sql`SELECT count(*)::int as c, array_agg(industry ORDER BY industry) as inds FROM nf_industry_profiles`;
  console.log('=== new nf_leads cols (13 expected) ===');
  console.log('found:', cols.length);
  console.log(cols.map((c: any) => `  ${c.column_name}: ${c.udt_name}`).join('\n'));
  console.log('\n=== new outreach cols (3 expected) ===');
  console.log(outreachCols.map((c: any) => `  ${c.column_name}`).join('\n'));
  console.log('\n=== new tables (4 expected) ===');
  console.log(tables.map((t: any) => `  ${t.tablename}`).join('\n'));
  console.log('\n=== seeded industries ===');
  console.log(`  count: ${seed[0]!.c}, industries: ${seed[0]!.inds?.join(', ')}`);
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
