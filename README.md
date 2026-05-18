# NexoFlow OS

Internal build intelligence system. Submit a client brief → AI scores it, scopes it, architects it, and generates production-ready boilerplate using NexoFlow's full knowledge base.

## Stack

- **Next.js 15** (App Router, RSC)
- **tRPC v11** — type-safe API
- **Drizzle ORM + Postgres** — database
- **Claude API** (claude-sonnet-4-6 / claude-haiku-4-5) — AI generation
- **shadcn/ui + Tailwind CSS v4** — UI
- **Vercel** — deployment

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env file
cp .env.example .env.local

# 3. Fill in .env.local:
#    - DATABASE_URL (local Postgres or Neon)
#    - AUTH_SECRET (generate: openssl rand -base64 32)
#    - ANTHROPIC_API_KEY
#    - SECOND_BRAIN_PATH (path to your Obsidian vault)

# 4. Push database schema
npm run db:push

# 5. Start dev server
npm run dev
```

## How It Works

1. **Submit brief** at `/projects/new` — name, type, industry, budget, brief
2. **Auto-scored** immediately using NexoFlow's Opportunity Scoring Framework (0–70)
3. **Generate scope** — AI reads the brief + NexoFlow playbooks → produces client-ready scope doc
4. **Generate architecture** — AI reads scope + NexoFlow engineering standards → full system design
5. **Generate code** — AI produces production-ready boilerplate following NexoFlow standards

## Knowledge Sources

The AI engine loads context from the NexoFlow second brain (`SECOND_BRAIN_PATH`):

- Playbooks (Mobile, Desktop, Web)
- Engineering Standards (Mobile, Desktop, App Design System)
- Commercial Intelligence (Opportunity Scoring, Pricing)
- Product Strategy (Discovery, Scope Templates)
- Architecture Patterns

## Project Structure

```
src/
├── app/
│   ├── (app)/                  # Authenticated app
│   │   ├── page.tsx            # Dashboard
│   │   ├── projects/           # Project management
│   │   └── clients/            # Client list
│   └── api/trpc/               # tRPC API route
├── server/
│   ├── db/schema.ts            # Drizzle schema
│   ├── routers/                # tRPC routers
│   └── trpc.ts                 # tRPC setup
├── lib/
│   ├── ai/                     # Claude integration + prompts
│   │   ├── brain-context.ts    # Second brain loader
│   │   ├── generate.ts         # Generation functions
│   │   └── prompts.ts          # All AI prompts
│   └── trpc/                   # tRPC client/server
└── components/
    └── layout/sidebar.tsx
```
