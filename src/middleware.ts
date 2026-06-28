import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require authentication
const PUBLIC_PATHS = new Set([
  "/sign-in",
  "/api/auth",          // NextAuth routes
  "/api/trpc",          // tRPC API — auth enforced at page level (middleware protects pages; portal/proposal/showcase procedures are token-gated at DB level)
  "/api/demo",          // Public demo links (token-validated in the route itself)
  "/api/track",         // Demo engagement tracking
  "/api/admin",         // Admin API routes (protected by x-admin-secret header)
  "/api/background",    // Internal background workers (protected by x-internal-secret)
  "/api/cron",          // Vercel cron jobs (protected by x-cron-secret)
  "/api/webhooks",      // External webhook integrations
  "/api/widget",        // Embeddable widget
  "/api/integration",   // External intake forms
  "/portal",            // Client portals (token-validated in route)
  "/showcase",          // Public showcase page
  "/ref",               // Affiliate referral redirect links
  "/api/ref",           // Affiliate click-tracking API
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  for (const prefix of PUBLIC_PATHS) {
    if (pathname.startsWith(prefix + "/") || pathname.startsWith(prefix + "?")) return true;
  }
  // Static assets, Next internals
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".webp")
  ) return true;
  return false;
}

export default auth(async function middleware(req: NextRequest & { auth?: unknown }) {
  const { pathname } = req.nextUrl;

  // Allow public paths through
  if (isPublicPath(pathname)) return NextResponse.next();

  // Check session
  const session = (req as { auth?: { user?: { id?: string } } }).auth;
  const isAuthenticated = !!(session?.user?.id);

  if (!isAuthenticated) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Run middleware on all routes except static files
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|ttf)).*)",
  ],
};
