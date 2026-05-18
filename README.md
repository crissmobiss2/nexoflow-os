# NexoFlow OS

The NexoFlow second brain turned into software. Submit a client brief → AI scores it → generates scope → generates architecture → streams production-ready boilerplate using every playbook and standard from the vault.

---

## Setup (10 minutes)

### 1. Get a free Postgres database
Go to [neon.tech](https://neon.tech) → Create project → Copy the connection string.
It looks like: `postgresql://user:pass@ep-xxx.eu-west-2.aws.neon.tech/neondb?sslmode=require`

### 2. Get your Anthropic API key
Go to [console.anthropic.com](https://console.anthropic.com) → API Keys → Create key.

### 3. Configure environment
```bash
cp .env.example .env.local
```
Edit `.env.local`:
```
DATABASE_URL=postgresql://...your-neon-url...
ANTHROPIC_API_KEY=sk-ant-...your-key...
SECOND_BRAIN_PATH=C:/NexoFlow Second-Brain/second-brain
```

### 4. Install and run
```bash
npm install
npm run db:push     # creates database tables
npm run dev         # starts at http://localhost:3000
```

---

## How It Works

| Step | What happens |
|---|---|
| Submit brief | Fill in project name, type, industry, budget, brief details |
| Auto-scored | Claude Haiku scores it 0–70 using Opportunity Scoring Framework |
| Generate Scope | Claude Sonnet reads brief + NexoFlow playbooks → client-ready scope doc |
| Generate Architecture | Claude reads scope + engineering standards → full system design |
| Generate Code | Streams production-ready boilerplate. Watch it write in real time. |
| Download | Export all generated files as ZIP |

---

## The AI Context

Every generation loads live content from your second brain at `SECOND_BRAIN_PATH`:

- **Playbooks** — Mobile App, Desktop App build playbooks
- **Standards** — Mobile Engineering, Desktop Engineering, App Design System
- **Commercial** — Opportunity Scoring Framework, Pricing Intelligence
- **Product** — Discovery Playbook, Scope Templates, Client Strategy Templates
- **Architecture** — Architecture Patterns, Stack Deep Dives

The AI literally uses your NexoFlow knowledge to generate the output. Better knowledge = better output.

---

## Stack

```
Next.js 16 (App Router)    — framework
tRPC v11                   — type-safe mutations (scoring, generation triggers)
Drizzle ORM + Postgres     — database
@anthropic-ai/sdk          — Claude API (Sonnet 4.6 + Haiku 4.5)
shadcn/ui + Tailwind v4    — UI
JSZip                      — ZIP export
marked                     — Markdown rendering
```

---

## File Structure

```
src/
├── app/
│   ├── (app)/                         # Main app shell
│   │   ├── page.tsx                   # Dashboard
│   │   ├── projects/
│   │   │   ├── page.tsx               # Projects list
│   │   │   ├── new/page.tsx           # Brief intake (2-step form)
│   │   │   └── [id]/
│   │   │       ├── page.tsx           # Project detail + pipeline
│   │   │       ├── scope/page.tsx     # Scope document viewer
│   │   │       ├── architecture/      # Architecture doc viewer
│   │   │       └── generate/page.tsx  # Live code generation
│   │   └── clients/page.tsx
│   └── api/
│       ├── trpc/[trpc]/route.ts       # tRPC handler
│       └── generate/[projectId]/      # SSE streaming for code gen
├── server/
│   ├── db/schema.ts                   # Drizzle schema (nf_* tables)
│   ├── routers/projects.ts            # Scoring + generation mutations
│   └── trpc.ts
└── lib/
    ├── ai/
    │   ├── brain-context.ts           # Loads second brain files as context
    │   ├── generate.ts                # Claude API functions
    │   └── prompts.ts                 # All system + user prompts
    └── markdown.ts                    # marked renderer
```

---

## Database Schema

All tables use `nf_` prefix:

- `nf_clients` — client records
- `nf_projects` — projects with type, status, score
- `nf_project_briefs` — brief fields per project
- `nf_opportunity_scores` — 7-dimension scoring breakdown
- `nf_project_artifacts` — generated docs and code (scope, arch, code_bundle)
- `nf_project_phases` — build phase tracking (Discovery → Launch)

---

## Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set env vars in Vercel dashboard or:
vercel env add DATABASE_URL
vercel env add ANTHROPIC_API_KEY
vercel env add SECOND_BRAIN_PATH
```

Note: `SECOND_BRAIN_PATH` only works locally (reads files from disk).
For Vercel deployment, the brain context files need to be bundled or served from an API.
