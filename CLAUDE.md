# NexoFlow OS — Claude Code Guide

## What This Is
NexoFlow OS is a B2B SaaS platform that converts leads into personalized, AI-generated demo websites and software mockups. The core product loop: import a lead → scrape their business profile → generate a bespoke single-page demo site → share a token-gated link.

## Stack
- **Framework**: Next.js 15 App Router (TypeScript, Turbopack)
- **DB**: Postgres via Drizzle ORM (`src/server/db/`)
- **Auth**: NextAuth v5 (`src/lib/auth.ts`)
- **AI**: Anthropic SDK (`@anthropic-ai/sdk`) — `claude-sonnet-4-6`
- **Storage**: Vercel Blob (`src/lib/blob.ts` → `uploadHtml`)
- **Deployment**: Vercel (production: nexoflow-os.vercel.app)

## Key Routes
- `POST /api/admin/regen-demo` — regenerate a lead's demo (secret: `x-admin-secret` header)
- `GET /api/demo/[leadId]` — serve the token-gated demo HTML
- `POST /api/lead/[leadId]/scrape` — scrape and enrich a lead's business profile

## Demo Generation (`src/app/api/admin/regen-demo/route.ts`)
The `buildDemoPrompt()` function is the heart of NexoFlow's value prop. When editing it:
- Always output `<!DOCTYPE html>` as the VERY FIRST token — Claude fills token budget with CSS before writing body HTML if structure comes after styles
- Keep `max_tokens: 8000`, model `claude-sonnet-4-6`
- `maxDuration = 300` is required — Anthropic takes 60-90s at 8K tokens
- All 7 sections MUST be present: NAV, HERO, PROBLEMS (3 cards), SOLUTION (3-4 cards), STATS BAR, HOW IT WORKS (3 steps), CTA FOOTER
- Use inline SVGs only, no external icon libraries
- CSP for `/api/demo/*` is permissive (`default-src * 'unsafe-inline' 'unsafe-eval'`) — CDN fonts are fine

## Design System for Generated Demos
Apply these principles from UI UX Pro Max + gstack DESIGN.md:

### Typography
- Hero font: Google Fonts — Playfair Display (luxury/professional) or Satoshi (tech/startup)
- Body: Inter or DM Sans
- Load with `display=swap`, import in `<head>` before `<style>`
- Type scale: hero 64px, h1 48px, h2 32px, h3 24px, body 16px

### Color Strategy
- CSS custom properties: `--primary`, `--secondary`, `--bg`, `--text`, `--muted`, `--surface`, `--radius`
- Dark mode by default (`--bg: #0d0b09`, `--text: #fff`)
- Limit accent colors to 2-3; use `--primary` sparingly for CTAs only
- Grain texture on hero: SVG feTurbulence, opacity 0.03, position fixed, z-index 9999, pointer-events none

### Components
- Cards: `backdrop-filter: blur(12px)`, subtle border `rgba(255,255,255,0.08)`, `--radius: 16px`
- Buttons: primary solid + ghost outline pair; hover scale(1.02) transition
- Stats bar: full-width gradient strip with 3 big numbers + labels
- Nav: fixed top, `backdrop-filter: blur(16px)`, subtle bottom border

### Motion
- `fadeInUp` keyframe on hero text (60px → 0, opacity 0→1, 0.6s ease-out)
- `IntersectionObserver` on cards (staggered 0.1s delay per card)
- Hover transitions: 150-200ms ease

## Commands
```bash
npm run dev      # start Next.js dev server (Turbopack)
npm run build    # production build (runs ensure-schema first)
npm run lint     # ESLint
```

## Pre-build Schema Sync
`scripts/ensure-schema.ts` runs before `next build` via `package.json` build script.
It syncs the Postgres schema. Add `onnotice: () => {}` to the postgres connection to suppress NOTICE spam.

## Git Safety
- All source files MUST be committed to git — Vercel git-based deploys only include committed files
- Never use `git add .` — stage specific files to avoid committing secrets
- The `.env` file is local only; env vars live in Vercel dashboard

## Installed Skills
- **gstack** (`~/.claude/skills/gstack/`) — /review, /design-review, /qa, /ship, /investigate, /office-hours, /browse
- **dev-browser** (npm global) — headless browser for QA; pre-approved in `.claude/settings.json`
- **UI UX Pro Max** (`/ui-ux`) — design intelligence with 7 searchable domains
- **Context Engineering** (`/context`) — agent context optimization patterns
- **Remotion** (`/remotion`) — programmatic video generation with React

## Context Engineering Rules (Applied to All Work)
1. **Signal over noise** — every token in a prompt must earn its place; remove filler
2. **Structure before style** — establish HTML skeleton before CSS to prevent token budget waste
3. **Specificity beats length** — "3 glassmorphism feature cards with inline SVG icons" beats "nice cards"
4. **Sub-agents for isolation** — use parallel tool calls for independent research
5. **File-system state** — long-running context goes to files, not memory
