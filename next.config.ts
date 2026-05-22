import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent clickjacking
  { key: "X-Frame-Options", value: "DENY" },
  // Stop MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Force HTTPS for 2 years, include subdomains
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Minimal referrer leakage
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features we don't use
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // XSS protection header (legacy browsers)
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // DNS prefetch control
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Content Security Policy
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Scripts: self + Next.js inline scripts + Vercel live preview
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://va.vercel-scripts.com",
      // Styles: self + inline (Tailwind) + Google Fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Fonts: self + Google Fonts CDN
      "font-src 'self' https://fonts.gstatic.com",
      // Images: self + blob/data + any HTTPS (for scraped logos/og images)
      "img-src 'self' blob: data: https:",
      // API connections: self + Anthropic + Upstash + Vercel
      "connect-src 'self' https://api.anthropic.com https://*.upstash.io https://vercel.live wss://ws-us3.pusher.com https://*.ingest.sentry.io",
      // Frames: deny everything
      "frame-src 'none'",
      // Objects: deny Flash/plugins
      "object-src 'none'",
      // Base URI: only self
      "base-uri 'self'",
      // Form submissions: only self
      "form-action 'self'",
      // Block mixed content upgrades
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

// Demo pages serve AI-generated HTML that may load arbitrary CDNs.
// We still apply basic transport/MIME headers but can't enforce a strict CSP.
const demoHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  // Allow demos to be embedded (prospect shares link / opens in iframe)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Permissive CSP — demo HTML is sandboxed by share-token auth, not CSP
  {
    key: "Content-Security-Policy",
    value: [
      "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const config: NextConfig = {
  async headers() {
    return [
      {
        // Strict headers for the main app
        source: "/((?!api/demo).*)",
        headers: securityHeaders,
      },
      {
        // Relaxed headers for AI-generated demo pages
        source: "/api/demo/:path*",
        headers: demoHeaders,
      },
    ];
  },
  // Prevent server-side source maps leaking internals
  productionBrowserSourceMaps: false,
  // Strict mode for React
  reactStrictMode: true,
};

export default config;
