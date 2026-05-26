import postgres from "postgres";
async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  // Inject a tiny demo HTML + share token on the most recent lead so we can test /api/demo and tracking
  const [lead] = await sql`SELECT id FROM nf_leads WHERE email = 'test+stripe@nexoflow.tech' LIMIT 1`;
  if (!lead) { console.log('no lead found'); return; }
  const html = `<!DOCTYPE html><html><head><title>Stripe Demo</title></head><body><h1>Demo for Stripe</h1><p>Custom built by NexoFlow.</p><a href="#cta">CTA</a></body></html>`;
  const token = 'test_token_' + Math.random().toString(36).slice(2, 10);
  await sql`UPDATE nf_leads SET demo_html=${html}, demo_url=${'/api/demo/' + lead.id + '?t=' + token}, share_token=${token}, status='demo_generated', demo_generated_at=NOW() WHERE id=${lead.id}`;
  console.log('seeded demo on lead', lead.id, 'with token', token);
  await sql.end();
}
main();
