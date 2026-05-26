import postgres from "postgres";
async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const rows = await sql`SELECT id, company, source::text, scraped_at, business_profile_at,
    jsonb_typeof(scraped_profile) as scraped_type,
    scraped_profile->'homepage'->>'title' as page_title,
    scraped_profile->'homepage'->>'description' as page_desc,
    jsonb_array_length(COALESCE(scraped_profile->'brandColors','[]'::jsonb)) as n_colors,
    jsonb_array_length(COALESCE(scraped_profile->'techSignals','[]'::jsonb)) as n_signals,
    jsonb_array_length(COALESCE(scraped_profile->'pages','[]'::jsonb)) as n_pages,
    scraped_profile->>'scrapedFrom' as scraped_from
    FROM nf_leads ORDER BY created_at DESC LIMIT 1`;
  console.log(JSON.stringify(rows[0], null, 2));
  await sql.end();
}
main();
