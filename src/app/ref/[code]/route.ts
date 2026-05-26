/**
 * GET /ref/[code]
 *
 * Affiliate referral redirect. Records a click server-side with no client JS,
 * sets a 90-day attribution cookie, then redirects to nexoflow.tech.
 *
 * Supports UTM passthrough: /ref/abc123?utm_source=twitter&utm_campaign=launch
 * Supports custom destination: /ref/abc123?to=https://nexoflow.tech/services
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/server/db";
import { affiliates, affiliateClicks } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

const DESTINATION = "https://nexoflow.tech";
const COOKIE_NAME = "nf_ref";
const COOKIE_DAYS = 90;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const { searchParams } = req.nextUrl;

  // Validate the code against an approved affiliate
  const affiliate = await db.query.affiliates.findFirst({
    where: and(eq(affiliates.referralCode, code), eq(affiliates.status, "approved")),
  });

  // Unknown or inactive code — still redirect gracefully, just don't track
  const redirectTo = buildRedirectUrl(searchParams, DESTINATION);
  if (!affiliate) return NextResponse.redirect(redirectTo);

  // Record the click asynchronously — don't block the redirect
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "";
  const ipHash = ip ? createHash("sha256").update(ip).digest("hex").slice(0, 64) : null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;
  const country = req.headers.get("cf-ipcountry") ?? null;

  void db.insert(affiliateClicks).values({
    affiliateId: affiliate.id,
    referralCode: code,
    ipHash,
    userAgent,
    landingPage: redirectTo,
    utmSource: searchParams.get("utm_source")?.slice(0, 100) ?? null,
    utmMedium: searchParams.get("utm_medium")?.slice(0, 100) ?? null,
    utmCampaign: searchParams.get("utm_campaign")?.slice(0, 100) ?? null,
    country: country?.slice(0, 2) ?? null,
  });

  // Set 90-day first-touch attribution cookie (don't overwrite existing)
  const existingCookie = req.cookies.get(COOKIE_NAME);
  const res = NextResponse.redirect(redirectTo);

  if (!existingCookie) {
    res.cookies.set(COOKIE_NAME, code, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * COOKIE_DAYS,
      path: "/",
    });
  }

  return res;
}

function buildRedirectUrl(searchParams: URLSearchParams, base: string): string {
  // Allow a custom destination (must still be on nexoflow.tech for safety)
  const rawTo = searchParams.get("to");
  if (rawTo) {
    try {
      const dest = new URL(rawTo);
      if (dest.hostname === "nexoflow.tech") return rawTo;
    } catch {
      // fall through to default
    }
  }

  const url = new URL(base);
  for (const [key, val] of searchParams.entries()) {
    if (key !== "to") url.searchParams.set(key, val);
  }
  return url.toString();
}
