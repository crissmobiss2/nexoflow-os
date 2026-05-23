/**
 * Twilio sender for SMS and WhatsApp.
 *
 * Gracefully no-ops if env vars are missing — callers still record the outreach
 * row but `providerStatus` is set to "not_configured" so the UI can surface it.
 */

type SendResult =
  | { ok: true; messageId: string; status: string }
  | { ok: false; error: string; status: "not_configured" | "failed" };

interface SendInput {
  to: string;
  body: string;
}

export async function sendSms(input: SendInput): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_SMS;
  if (!sid || !token || !from) {
    return { ok: false, error: "Twilio SMS not configured", status: "not_configured" };
  }
  return twilioSend(sid, token, from, input.to, input.body);
}

export async function sendWhatsApp(input: SendInput): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_WHATSAPP;
  if (!sid || !token || !from) {
    return { ok: false, error: "Twilio WhatsApp not configured", status: "not_configured" };
  }
  // Twilio requires `whatsapp:` prefix for both ends
  const wFrom = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;
  const wTo = input.to.startsWith("whatsapp:") ? input.to : `whatsapp:${input.to}`;
  return twilioSend(sid, token, wFrom, wTo, input.body);
}

async function twilioSend(sid: string, token: string, from: string, to: string, body: string): Promise<SendResult> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await resp.json()) as { sid?: string; status?: string; message?: string; code?: number };
    if (!resp.ok) {
      return { ok: false, error: json.message ?? `HTTP ${resp.status}`, status: "failed" };
    }
    return { ok: true, messageId: json.sid ?? "", status: json.status ?? "queued" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown", status: "failed" };
  }
}

export function twilioConfigured(channel: "sms" | "whatsapp"): boolean {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return false;
  return channel === "sms" ? !!process.env.TWILIO_FROM_SMS : !!process.env.TWILIO_FROM_WHATSAPP;
}
