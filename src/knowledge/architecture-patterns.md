---
created: 2026-05-18
modified: 2026-05-18
tags: [nexoflow, architecture, patterns, reference]
---

# NexoFlow Architecture Patterns

> *Proven patterns for every type of system NexoFlow builds. Copy, adapt, ship. Don't reinvent.*

---

## Pattern 1 — Lead Automation System

**Use when:** Client needs AI-powered lead capture → qualify → respond → CRM update.

```
[Lead Source]
    │  (form submission / webhook / email)
    ▼
[n8n Trigger]
    │
    ├─► [Extract lead data]
    │       name, email, company, message, source
    │
    ├─► [AI Qualification] ──── Claude Haiku
    │       Input:  lead data
    │       Output: { score: "high|medium|low", reasoning, nextAction }
    │
    ├─► [Personalised Response] ── Claude Sonnet (for high/medium)
    │       Input:  lead data + qualification score + company context
    │       Output: personalised email (< 45 seconds from trigger)
    │
    ├─► [CRM Update]
    │       Create/update contact with score, source, notes
    │
    └─► [Route]
            high   → Slack alert to Christopher + email sent
            medium → Add to nurture sequence
            low    → Log only, optional auto-response
```

**Key design decisions:**
- Use Haiku for qualification (cheap, fast, structured output)
- Use Sonnet for email copy (quality matters for first impression)
- Idempotency key on lead email to prevent duplicate sends
- Store raw lead + AI output in DB for audit + retraining

**Reference result:** James Morrison — 156% more qualified leads, 45-second response time.

---

## Pattern 2 — Client Reporting Automation

**Use when:** Client needs automated reports from their operational data (CRM, spreadsheets, project tools).

```
[Schedule Trigger] ──── daily / weekly / monthly
    │
    ├─► [Data Collection]
    │       Pull from: CRM API, Google Sheets, database, analytics
    │
    ├─► [Data Transform]
    │       Normalise, aggregate, calculate KPIs
    │
    ├─► [AI Narrative] ──── Claude Sonnet
    │       Input:  structured data + previous period + targets
    │       Output: plain-English executive summary + highlights
    │
    ├─► [Report Assembly]
    │       Combine data tables + AI narrative → PDF or email
    │
    └─► [Delivery]
            Email to client contacts
            Optional: Slack post, dashboard update
```

**Key design decisions:**
- Always show raw numbers + AI interpretation (not just AI narrative)
- Include period-over-period comparison automatically
- Store every report in DB for history
- Allow client to configure recipients and schedule via a simple UI

**Reference result:** Sarah Pemberton — reporting time 4 hours/week → 0.

---

## Pattern 3 — Custom CRM / Client Portal

**Use when:** Client needs a tailored CRM or client-facing portal that off-the-shelf tools can't deliver.

```
Architecture:
  Frontend:  Next.js 15 App Router (RSC for data, client for interactions)
  API:       Hono routes OR Next.js Server Actions
  DB:        Drizzle ORM → Neon PostgreSQL
  Auth:      Auth.js v5 (internal staff + optional client login)
  State:     TanStack Query (server data) + Zustand (UI state)

Data model pattern:
  organisations → users (multi-tenant root)
  organisations → clients (the CRM entities)
  clients → contacts
  clients → deals / projects
  clients → activities (audit log)
  users → activities (who did what)

Access control pattern:
  organisationId on every table
  requireOrg() middleware checks session.user.organisationId === record.organisationId
  Never trust client-supplied IDs — always scope to session organisation
```

**Key UI patterns:**
```typescript
// Server Component for data fetching
async function ClientList({ orgId }: { orgId: string }) {
  const clients = await db.query.clients.findMany({
    where: and(eq(clients.orgId, orgId), isNull(clients.deletedAt)),
    orderBy: desc(clients.updatedAt),
    with: { contacts: true, latestDeal: true },
  })
  return <ClientTable clients={clients} />
}

// Optimistic update on status change
const mutation = useMutation({
  mutationFn: updateClientStatus,
  onMutate: async ({ clientId, status }) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.clients.byId(clientId) })
    const prev = queryClient.getQueryData(queryKeys.clients.byId(clientId))
    queryClient.setQueryData(queryKeys.clients.byId(clientId), old => ({ ...old, status }))
    return { prev }
  },
  onError: (_, __, ctx) => queryClient.setQueryData(queryKeys.clients.byId(ctx!.prev.id), ctx!.prev),
  onSettled: (_, __, { clientId }) => queryClient.invalidateQueries({ queryKey: queryKeys.clients.byId(clientId) }),
})
```

---

## Pattern 4 — AI Knowledge Assistant (RAG)

**Use when:** Client needs to query their own documents, policies, SOPs, or knowledge base via natural language.

```
INGEST PIPELINE (run once + on document updates):
  Document upload
      → Extract text (PDF: pdf-parse, DOCX: mammoth, MD: direct)
      → Chunk (800 tokens, 100 overlap, break at sentences)
      → Embed (OpenAI text-embedding-3-small)
      → Store in Neon with pgvector

QUERY PIPELINE (real-time):
  User question
      → Embed question
      → Vector similarity search (cosine, threshold 0.7, top-5 chunks)
      → Augmented prompt: question + retrieved chunks
      → Claude Sonnet → streamed answer
      → Log: question + answer + sources used
```

```typescript
// pgvector schema
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  sourceFile: text('source_file').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Similarity search
const results = await db.execute(sql`
  SELECT id, content, source_file,
         1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) AS similarity
  FROM documents
  WHERE org_id = ${orgId}
    AND 1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) > 0.7
  ORDER BY similarity DESC
  LIMIT 5
`)
```

---

## Pattern 5 — Background Job System

**Use when:** Work that takes > 5 seconds, must be reliable, or needs retry logic.

```
Use cases: email sending, PDF generation, AI calls, webhook delivery, report generation

Stack:
  Queue:   Upstash QStash (serverless) OR BullMQ + Railway Redis (persistent)
  Worker:  Hono endpoint (for QStash) OR BullMQ worker process (for BullMQ)

QStash pattern (serverless-first):
  Client → POST /api/enqueue → QStash.publishJSON({ url, body, retries: 3 })
  QStash → POST /api/workers/[jobType] (with signature verification)
  Worker → process job → return 200 (success) or 4xx (don't retry) or 5xx (retry)

BullMQ pattern (when you need complex queues):
  Producer: await queue.add('job-name', payload, { attempts: 3, backoff: 'exponential' })
  Worker: worker.process(async (job) => { /* do work */ })
  Dashboard: Bull Board for visibility
```

```typescript
// QStash job handler (Hono)
app.post('/api/workers/send-email', async (c) => {
  // Verify QStash signature
  const sig = c.req.header('Upstash-Signature')
  const valid = await qstash.verify({ signature: sig, body: await c.req.text() })
  if (!valid) return c.json({ error: 'Invalid signature' }, 401)

  const { to, template, data } = await c.req.json()
  await sendEmail({ to, template, data })
  return c.json({ success: true })
})
```

---

## Pattern 6 — Multi-Tenant SaaS

**Use when:** Building a product where multiple organisations each have isolated data.

```
Tenancy model: Organisation-level isolation (row-level, same database)

Schema:
  Every table has: orgId uuid NOT NULL REFERENCES organisations(id)
  Every query scoped to: WHERE org_id = $currentOrgId

Session:
  session.user.orgId — set at login, used for all data access

Middleware:
  export async function requireOrg(c: Context) {
    const session = await auth()
    if (!session?.user?.orgId) return c.json({ error: 'UNAUTHORIZED' }, 401)
    c.set('orgId', session.user.orgId)
  }

Onboarding flow:
  1. User signs up → org created → user linked as owner
  2. User can invite members (role: admin | member | viewer)
  3. First-run wizard: collect org details, connect integrations

Billing (Stripe):
  organisations.stripeCustomerId → Stripe Customer
  organisations.subscriptionStatus → active | trialing | past_due | canceled
  Feature gates check: requireSubscription(orgId)
```

---

## Pattern 7 — Real-Time Notifications

**Use when:** User needs to see updates without refreshing (job status, new lead alert, live dashboard).

```
Options ranked by complexity:
  1. Polling (TanStack Query refetchInterval) — simplest, good enough for most
  2. Server-Sent Events (SSE)               — one-way server→client, no WS needed
  3. WebSockets                             — bidirectional, more complex

SSE pattern (recommended for most use cases):
  Server: /api/stream → text/event-stream response
  Client: useEventSource hook or native EventSource

  // Server (Hono)
  app.get('/api/stream', async (c) => {
    return streamSSE(c, async (stream) => {
      while (true) {
        const events = await getNewEvents(userId, lastEventId)
        for (const event of events) {
          await stream.writeSSE({ data: JSON.stringify(event), id: event.id })
        }
        await stream.sleep(2000)
      }
    })
  })
```

---

## Anti-Patterns to Avoid

```
❌ Storing secrets in code or git history
❌ User-supplied IDs without ownership check (IDOR vulnerability)
❌ Fetching all rows without pagination (N+1 at scale)
❌ Calling AI APIs synchronously from a user-facing request (use job queue)
❌ Hard-coding environment URLs (use environment variables)
❌ Running migrations against production without a rollback plan
❌ Trusting client-side data for business logic (validate on server)
❌ Single-env deployment (always have dev → staging → production)
```

---

## Related
- [[NexoFlow System/Standards/NexoFlow Standards]] — Stack standards
- [[NexoFlow System/Playbooks/AI Automation Playbook]] — AI build tiers
- [[NexoFlow System/Playbooks/SaaS Build Playbook]] — Full build sequence
- [[NexoFlow System/Knowledge and Tech/Stack Deep Dives Index]] — Code patterns per tool
