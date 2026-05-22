const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;

export async function notifySlack(text: string, fields?: { title: string; value: string }[]) {
  if (!SLACK_WEBHOOK) return;
  try {
    const blocks: unknown[] = [{ type: "section", text: { type: "mrkdwn", text } }];
    if (fields?.length) {
      blocks.push({
        type: "section",
        fields: fields.map((f) => ({ type: "mrkdwn", text: `*${f.title}*\n${f.value}` })),
      });
    }
    await fetch(SLACK_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });
  } catch { /* best-effort */ }
}

export const slack = {
  leadWon: (name: string, company: string, value?: string) =>
    notifySlack(`🎉 *Lead Won!* ${name} @ ${company}`, value ? [{ title: "Deal Value", value }] : undefined),
  invoicePaid: (number: string, amount: string, client?: string) =>
    notifySlack(`💰 *Invoice Paid* — ${number}`, [{ title: "Amount", value: amount }, { title: "Client", value: client ?? "—" }]),
  newLead: (name: string, source: string) =>
    notifySlack(`📥 *New Lead* — ${name}`, [{ title: "Source", value: source }]),
  proposalSigned: (leadName: string, company: string) =>
    notifySlack(`✍️ *Proposal Signed!* ${leadName} @ ${company}`),
  newAffiliate: (name: string, email: string) =>
    notifySlack(`🤝 *New Affiliate Application* — ${name}`, [{ title: "Email", value: email }]),
};
