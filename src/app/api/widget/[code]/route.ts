import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { affiliates } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const affiliate = await db
    .select({ referralCode: affiliates.referralCode, name: affiliates.name, status: affiliates.status })
    .from(affiliates)
    .where(eq(affiliates.referralCode, code))
    .limit(1);

  if (!affiliate[0] || affiliate[0].status !== "approved") {
    return new NextResponse(`console.warn("NexoFlow: affiliate code '${code}' not found or not approved");`, {
      headers: { "Content-Type": "application/javascript" },
    });
  }

  const baseUrl = req.nextUrl.origin;
  const refCode = affiliate[0].referralCode;

  const script = `
(function() {
  var NEXO_REF = "${refCode}";
  var NEXO_BASE = "${baseUrl}";

  // Inject button
  var btn = document.createElement("a");
  btn.href = NEXO_BASE + "/?ref=" + NEXO_REF;
  btn.target = "_blank";
  btn.rel = "noopener noreferrer";
  btn.innerHTML = "Get a Free Quote →";
  btn.style.cssText = [
    "display:inline-flex", "align-items:center", "gap:8px",
    "padding:12px 24px", "border-radius:8px",
    "background:linear-gradient(135deg,#7c5cbf,#a855f7)",
    "color:#fff", "font-family:Inter,sans-serif", "font-size:14px",
    "font-weight:600", "text-decoration:none", "cursor:pointer",
    "box-shadow:0 4px 14px rgba(124,92,191,0.4)",
    "transition:opacity 0.2s"
  ].join(";");
  btn.onmouseover = function() { btn.style.opacity = "0.85"; };
  btn.onmouseout = function() { btn.style.opacity = "1"; };

  var containers = document.querySelectorAll("[data-nexoflow-widget]");
  if (containers.length > 0) {
    containers.forEach(function(c) { c.appendChild(btn.cloneNode(true)); });
  } else {
    // Floating bottom-right button
    var wrap = document.createElement("div");
    wrap.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:99999";
    wrap.appendChild(btn);
    document.body.appendChild(wrap);
  }
})();
`.trim();

  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
