import postgres from "postgres";
async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const rows = await sql`SELECT
    business_profile_at,
    business_profile->>'summary' as summary,
    business_profile->>'offer' as offer,
    business_profile->>'targetCustomer' as target,
    business_profile->>'toneOfVoice' as tone,
    business_profile->>'demoAngle' as demo_angle,
    business_profile->>'estimatedValue' as value,
    business_profile->>'industryFit' as industry_fit,
    jsonb_array_length(COALESCE(business_profile->'brandColors','[]'::jsonb)) as n_colors,
    jsonb_array_length(COALESCE(business_profile->'visibleWeaknesses','[]'::jsonb)) as n_weaknesses,
    jsonb_array_length(COALESCE(business_profile->'buildOpportunities','[]'::jsonb)) as n_opps,
    business_profile->'buildOpportunities'->0->>'title' as first_opp,
    industry_profile_id
    FROM nf_leads ORDER BY created_at DESC LIMIT 1`;
  console.log(JSON.stringify(rows[0], null, 2));
  await sql.end();
}
main();
