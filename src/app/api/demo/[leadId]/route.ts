import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { leads } from "@/server/db/schema";
import { eq } from "drizzle-orm";

const TRACKING_SCRIPT = `<script>(function(){
  try {
    var leadId = window.__NF_LEAD_ID__;
    if (!leadId) return;
    var sid = sessionStorage.getItem('nf_sid');
    if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('nf_sid', sid); }
    var start = Date.now();
    var maxScroll = 0;
    var ctaClicks = 0;
    function depth(){
      var h = document.documentElement;
      var pct = h.scrollHeight > h.clientHeight
        ? Math.round((window.scrollY + h.clientHeight) / h.scrollHeight * 100)
        : 100;
      if (pct > maxScroll) maxScroll = pct;
    }
    document.addEventListener('scroll', depth, { passive: true });
    document.addEventListener('click', function(e){
      var t = e.target;
      while (t && t !== document.body) {
        if (t.tagName === 'A' || t.tagName === 'BUTTON' || (t.getAttribute && t.getAttribute('role') === 'button')) { ctaClicks++; break; }
        t = t.parentNode;
      }
    });
    function beacon(closing){
      var data = {
        sessionId: sid,
        seconds: Math.round((Date.now() - start) / 1000),
        scroll: maxScroll,
        ctaClicks: ctaClicks,
        referrer: document.referrer || '',
        closing: !!closing
      };
      var url = '/api/track/' + leadId;
      try {
        if (navigator.sendBeacon) navigator.sendBeacon(url, JSON.stringify(data));
        else fetch(url, { method: 'POST', body: JSON.stringify(data), keepalive: true });
      } catch(e){}
    }
    var pingHandle = setInterval(beacon, 15000);
    window.addEventListener('beforeunload', function(){ clearInterval(pingHandle); beacon(true); });
    document.addEventListener('visibilitychange', function(){ if (document.visibilityState === 'hidden') beacon(false); });
  } catch(e){}
})();</script>`;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;
  const url = new URL(req.url);
  const providedToken = url.searchParams.get("t");

  const [lead] = await db
    .select({
      demoHtml: leads.demoHtml,
      demoBlobUrl: leads.demoBlobUrl,
      shareToken: leads.shareToken,
      shareRevokedAt: leads.shareRevokedAt,
      company: leads.company,
    })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!lead) {
    return new NextResponse("Demo not found", { status: 404 });
  }

  // Token validation: if a token is set, require a match; if no token, allow (legacy)
  if (lead.shareToken && lead.shareToken !== providedToken) {
    return notFoundPage();
  }
  if (lead.shareRevokedAt) {
    return revokedPage();
  }

  let html = lead.demoHtml ?? "";

  // Fall back to Blob if local html is empty but blob url exists
  if (!html && lead.demoBlobUrl) {
    try {
      const blobResp = await fetch(lead.demoBlobUrl, { cache: "no-store" });
      if (blobResp.ok) html = await blobResp.text();
    } catch {
      // ignore
    }
  }

  if (!html) {
    return new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Demo Not Ready</title>
<style>body{background:#0a0a0f;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;}h1{font-size:1.5rem;margin-bottom:.5rem;}p{color:#888;font-size:.9rem;}</style>
</head><body><div><h1>Demo Not Generated Yet</h1><p>The demo for this lead hasn't been generated. Open the lead in NexoFlow and click "Generate Demo".</p></div></body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  // Inject tracking before </body> (or append if no </body>)
  const beaconBlock = `<script>window.__NF_LEAD_ID__=${JSON.stringify(leadId)};</script>${TRACKING_SCRIPT}`;
  if (html.toLowerCase().includes("</body>")) {
    html = html.replace(/<\/body>/i, `${beaconBlock}</body>`);
  } else {
    html = html + beaconBlock;
  }

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

function notFoundPage() {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Demo Not Found</title>
<style>body{background:#0a0a0f;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;}h1{font-size:1.5rem;margin-bottom:.5rem;}p{color:#888;font-size:.9rem;}</style>
</head><body><div><h1>Demo link expired or invalid</h1><p>This share link is no longer valid. Contact NexoFlow for a new one.</p></div></body></html>`,
    { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function revokedPage() {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Demo Revoked</title>
<style>body{background:#0a0a0f;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;}h1{font-size:1.5rem;margin-bottom:.5rem;}p{color:#888;font-size:.9rem;}</style>
</head><body><div><h1>This demo has been revoked</h1><p>Reach out to NexoFlow for a refreshed link.</p></div></body></html>`,
    { status: 410, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
