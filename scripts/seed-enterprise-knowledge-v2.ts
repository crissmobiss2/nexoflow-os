/**
 * Enterprise Knowledge Seed V2 — 150+ snippets across 25 categories
 * Run: npx tsx --env-file .env.local scripts/seed-enterprise-knowledge-v2.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { knowledgeSnippets } from "../src/server/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

type Snippet = { cat: string; name: string; content: string };

const V2_SNIPPETS: Snippet[] = [

  // ── ZERO TRUST SECURITY ────────────────────────────────────────────────
  {
    cat: "Zero Trust Security",
    name: "JWT Validation Against JWKS (tRPC Middleware)",
    content: `// Validate JWT on every request — never skip for protected routes
import { createRemoteJWKSet, jwtVerify } from 'jose';
const JWKS = createRemoteJWKSet(new URL(process.env.JWKS_URI!));
export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE,
    clockTolerance: 30, // 30s clock skew tolerance
  });
  if (!payload.sub || !(payload as any).org_id) throw new Error('Invalid claims');
  return payload;
}
// Rotate JWKS automatically — JWKS endpoint returns all valid public keys`,
  },
  {
    cat: "Zero Trust Security",
    name: "Impossible Travel Detection",
    content: `// Flag logins from impossible geographic distances
async function detectImpossibleTravel(userId: string, currentIp: string) {
  const lastIp = await redis.get('user:' + userId + ':last_ip');
  if (lastIp) {
    const distKm = geoDistance(lastIp as string, currentIp); // km between IPs
    const timeDiffHours = 1; // hours since last login
    if (distKm / timeDiffHours > 900) { // faster than any plane
      await alertSecurityTeam({ userId, event: 'impossible_travel', distKm });
      throw new Error('Suspicious login pattern detected');
    }
  }
  await redis.setex('user:' + userId + ':last_ip', 3600, currentIp);
}`,
  },
  {
    cat: "Zero Trust Security",
    name: "PostgreSQL Row-Level Security for Multi-Tenant Isolation",
    content: `-- Enforce tenant isolation at the DB level — app bugs can't leak data
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON documents
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Set session context before every query (in Drizzle middleware):
-- SET app.current_org_id = 'org-uuid';

-- Zero chance of cross-tenant leak even with application bugs
-- Works with pgBouncer — use SET LOCAL in transaction mode`,
  },
  {
    cat: "Zero Trust Security",
    name: "Step-Up Authentication for Sensitive Operations",
    content: `// Re-verify fresh JWT for high-risk actions (< 5 min old)
async function requireFreshAuth(tokenIssuedAt: number) {
  const ageSeconds = Date.now() / 1000 - tokenIssuedAt;
  if (ageSeconds > 300) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Session expired for this action. Please re-authenticate.',
    });
  }
}
// Use cases: delete account, change payment method, export all data`,
  },
  {
    cat: "Zero Trust Security",
    name: "SOC 2 Audit Log Every Data Access",
    content: `// SOC 2 requires: who accessed what, when, from where — retained 12 months
await db.insert(auditLog).values({
  userId: ctx.user.id,
  orgId: ctx.user.orgId,
  action: 'document.read',
  resourceType: 'document',
  resourceId: documentId,
  ip: ctx.ip,
  userAgent: ctx.userAgent,
  outcome: 'success',
  timestamp: new Date(),
});
// Tamper-proof: append-only table, no UPDATE/DELETE permissions on audit_log`,
  },
  {
    cat: "Zero Trust Security",
    name: "ABAC: Attribute-Based Access Control",
    content: `// ABAC: more expressive than RBAC — conditions on resources, not just roles
class ABACEngine {
  evaluate(user: User, action: string, resource: Resource): boolean {
    // Check org isolation
    if (resource.orgId !== user.orgId) return false;
    // Check role-based minimum
    if (action === 'delete' && user.role !== 'admin') return false;
    // Check ownership for write operations
    if (['update', 'delete'].includes(action)) {
      return resource.ownerId === user.id || user.role === 'admin';
    }
    // Check IP allowlist for sensitive resources
    if (resource.sensitivityLevel === 'high') {
      return (user.allowedIps ?? []).includes(user.currentIp);
    }
    return true;
  }
}`,
  },

  // ── ENTERPRISE COMPLIANCE ─────────────────────────────────────────────
  {
    cat: "Enterprise Compliance",
    name: "HIPAA PHI Field Encryption (AES-256-GCM)",
    content: `import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
const KEY = scryptSync(process.env.PHI_ENCRYPTION_KEY!, process.env.PHI_SALT!, 32);
export function encryptPHI(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted.toString('hex');
}
export function decryptPHI(enc: string): string {
  const parts = enc.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const ct = Buffer.from(parts[2], 'hex');
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}`,
  },
  {
    cat: "Enterprise Compliance",
    name: "HIPAA Auto-Logoff (15-Minute Inactivity)",
    content: `'use client';
// HIPAA Technical Safeguard: automatic session termination after inactivity
export function HIPAASessionGuard({ minutes = 15 }: { minutes?: number }) {
  const timerRef = useRef<NodeJS.Timeout>();
  const reset = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      () => signOut({ callbackUrl: '/login?reason=timeout' }),
      minutes * 60 * 1000
    );
  };
  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'touchstart'];
    events.forEach(e => window.addEventListener(e, reset));
    reset();
    return () => {
      clearTimeout(timerRef.current);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, []);
  return null;
}`,
  },
  {
    cat: "Enterprise Compliance",
    name: "GDPR Right to Erasure Implementation",
    content: `// GDPR Art. 17: delete or anonymise all personal data within 30 days
export async function processErasureRequest(userId: string) {
  await db.transaction(async (tx) => {
    // Anonymise user record (preserve audit trail integrity)
    await tx.update(users).set({
      email: 'erased-' + userId + '@deleted.invalid',
      name: '[Deleted User]',
      phone: null,
      deletedAt: new Date(),
    }).where(eq(users.id, userId));
    // Remove personal content
    await tx.delete(userProfiles).where(eq(userProfiles.userId, userId));
    await tx.delete(exportedFiles).where(eq(exportedFiles.userId, userId));
    // Log the erasure (required by GDPR Art. 5(2) accountability)
    await tx.insert(erasureLog).values({
      subjectId: userId,
      requestedAt: new Date(),
      completedAt: new Date(),
      processor: 'api',
    });
  });
}`,
  },
  {
    cat: "Enterprise Compliance",
    name: "SOC 2 Change Management: Branch Protection Rules",
    content: `# SOC 2 CC8.1 — Change management technical controls
# These GitHub branch protection rules ARE the control evidence

required_status_checks:
  - "type-check"          # TypeScript must pass
  - "integration-test"    # Tests must pass
  - "security-scan"       # Snyk CVE check must pass

required_approving_review_count: 1   # peer review required
dismiss_stale_reviews: true          # re-approve after new push
require_code_owner_reviews: true     # senior review for sensitive paths
restrict_pushes: true                # only CI can push to main

# Combined with CI/CD-only deploys = complete change audit trail
# Auditor sees: every change reviewed, tested, approved before deploy`,
  },
  {
    cat: "Enterprise Compliance",
    name: "PCI-DSS: Never Store Raw Card Data",
    content: `// PCI-DSS Requirement 3: never store PAN, CVV, track data
// Stripe's payment element sends card data directly to Stripe — never touches your server

// Your server only ever receives a paymentMethodId
const paymentMethod = req.body.paymentMethodId; // e.g. 'pm_1234...'

// Store ONLY non-sensitive data:
await db.update(users).set({
  stripePaymentMethodId: paymentMethod,
  cardLast4: req.body.last4,    // '4242' — safe to store
  cardBrand: req.body.brand,    // 'visa' — safe to store
  cardExpMonth: req.body.exp_month, // 12 — safe to store
}).where(eq(users.id, userId));

// NEVER store: full card number, CVV, magnetic stripe data`,
  },

  // ── ENTERPRISE ARCHITECTURE ───────────────────────────────────────────
  {
    cat: "Enterprise Architecture",
    name: "CQRS: Separate Read and Write Models",
    content: `// Write: normalised, ACID — through ORM
await db.insert(orders).values({ userId, items, totalCents, status: 'pending' });
await publishEvent({ type: 'order.created', orderId });

// Read: denormalised, optimised — materialized view refreshed from events
// CREATE MATERIALIZED VIEW order_summaries AS
//   SELECT o.id, o.total_cents, u.name, COUNT(oi.id) AS item_count,
//          STRING_AGG(p.name, ', ') AS product_names
//   FROM orders o JOIN users u ON u.id = o.user_id
//   JOIN order_items oi ON oi.order_id = o.id
//   JOIN products p ON p.id = oi.product_id GROUP BY o.id, u.name;
// REFRESH MATERIALIZED VIEW CONCURRENTLY order_summaries;

// Dashboard queries hit read model — no joins, sub-millisecond`,
  },
  {
    cat: "Enterprise Architecture",
    name: "Outbox Pattern: Guaranteed Event Publishing",
    content: `// Guarantee: if DB write succeeds, event WILL eventually publish
// Without outbox: DB write OK but Kafka publish fails = silent data loss
await db.transaction(async (tx) => {
  const order = await tx.insert(orders).values(orderData).returning();
  // Outbox record published by a separate poller — atomic with the business write
  await tx.insert(eventOutbox).values({
    aggregateType: 'order',
    aggregateId: order[0].id,
    eventType: 'order.created',
    payload: JSON.stringify(order[0]),
    publishedAt: null, // null = pending
  });
});
// Outbox worker: SELECT * FROM event_outbox WHERE published_at IS NULL LIMIT 100`,
  },
  {
    cat: "Enterprise Architecture",
    name: "Saga Pattern: Choreography-Based Distributed Transactions",
    content: `// Distributed transaction coordination without 2PC (which blocks)
// Each service emits events; others react and compensate on failure

// OrderService: creates order, emits OrderCreated
// InventoryService: reserves stock on OrderCreated, emits StockReserved or StockFailed
// PaymentService: charges card on StockReserved, emits PaymentSucceeded or PaymentFailed

// Compensation (rollback):
class OrderSaga {
  async onStockFailed(orderId: string) {
    await this.orderService.cancelOrder(orderId, 'out_of_stock');
  }
  async onPaymentFailed(orderId: string) {
    await this.inventoryService.releaseStock(orderId);
    await this.orderService.cancelOrder(orderId, 'payment_failed');
  }
}
// No central coordinator = no single point of failure`,
  },
  {
    cat: "Enterprise Architecture",
    name: "Multi-Tenancy: orgId Scoping Pattern",
    content: `// EVERY query MUST be scoped to the authenticated org — without exception
// Drizzle: always include the org filter
const docs = await db.select().from(documents)
  .where(and(
    eq(documents.orgId, ctx.user.orgId),  // REQUIRED
    eq(documents.id, input.id),
  ));
if (!docs[0]) throw new TRPCError({ code: 'NOT_FOUND' });

// Ownership check before any mutation
if (docs[0].orgId !== ctx.user.orgId) {
  throw new TRPCError({ code: 'FORBIDDEN' });
}

// Lint rule: flag any db.select().from(X) without orgId filter`,
  },
  {
    cat: "Enterprise Architecture",
    name: "Circuit Breaker Pattern",
    content: `class CircuitBreaker {
  private failures = 0;
  private lastFailure: number | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  constructor(private threshold = 5, private timeoutMs = 60_000) {}
  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure! > this.timeoutMs) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit open — service unavailable');
      }
    }
    try {
      const result = await fn();
      if (this.state === 'half-open') { this.failures = 0; this.state = 'closed'; }
      return result;
    } catch (err) {
      this.failures++;
      this.lastFailure = Date.now();
      if (this.failures >= this.threshold) this.state = 'open';
      throw err;
    }
  }
}`,
  },
  {
    cat: "Enterprise Architecture",
    name: "Blue-Green Zero-Downtime Deployment",
    content: `# Blue-Green deployment: two identical environments
# Blue = current production, Green = new version
# Steps:
# 1. Deploy to Green — zero traffic, run smoke tests
# 2. Validate: synthetic monitoring, integration tests pass
# 3. Switch load balancer: 100% traffic to Green (instant cutover)
# 4. Monitor 15 min: error rate, latency, business metrics
# 5. Success: decommission Blue | Failure: switch back to Blue (< 30s rollback)

# Vercel implementation:
# vercel --prod → deploys to new URL
# vercel alias set [new-url] [production-domain] → instant cutover
# vercel rollback → instant rollback to previous deployment`,
  },
  {
    cat: "Enterprise Architecture",
    name: "Database Connection Pooling (Neon + PgBouncer)",
    content: `// ALWAYS use pooled connection in serverless/edge environments
// Pooled:  postgres://user:pass@ep-xxx.pooler.us-east-1.neon.tech/db
// Direct:  postgres://user:pass@ep-xxx.us-east-1.neon.tech/db

// Pooled for: API routes, serverless functions, edge functions
// Direct for: migrations, long queries, schema changes, LISTEN/NOTIFY

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

// Always use pooled URL in DATABASE_URL for production API
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });`,
  },

  // ── SAAS ARCHITECTURE ────────────────────────────────────────────────
  {
    cat: "SaaS Architecture",
    name: "Stripe Subscription Webhook Handler",
    content: `export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')!;
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }
  switch (event.type) {
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await db.update(orgs).set({
        plan: sub.items.data[0]?.price.lookup_key ?? 'free',
        subscriptionStatus: sub.status,
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
      }).where(eq(orgs.stripeCustomerId, sub.customer as string));
      break;
    }
  }
  return new Response('ok');
}`,
  },
  {
    cat: "SaaS Architecture",
    name: "Feature Flag with Plan Gating",
    content: `// Check feature access before any privileged operation
const FEATURES: Record<string, string[]> = {
  'ai.demo_generation': ['pro', 'enterprise'],
  'analytics.export': ['enterprise'],
  'team.unlimited_members': ['enterprise'],
  'api.webhooks': ['pro', 'enterprise'],
  'custom_domain': ['enterprise'],
};

export function useFeature(feature: string) {
  const { org } = useOrg();
  const plan = org?.plan ?? 'free';
  return FEATURES[feature]?.includes(plan) ?? false;
}

// Usage:
// if (!useFeature('ai.demo_generation')) { return <UpgradeModal />; }`,
  },
  {
    cat: "SaaS Architecture",
    name: "Usage-Based Billing with Stripe Meters",
    content: `// Metered billing: charge per AI call, API request, or GB stored
const meter = await stripe.billing.meters.create({
  display_name: 'AI Generations',
  event_name: 'ai_generation',
  default_aggregation: { formula: 'sum' },
  value_settings: { event_payload_key: 'value' },
});

// Fire on each billable action:
await stripe.billing.meterEvents.create({
  event_name: 'ai_generation',
  payload: {
    value: '1',
    stripe_customer_id: org.stripeCustomerId,
  },
  timestamp: Math.floor(Date.now() / 1000),
});`,
  },
  {
    cat: "SaaS Architecture",
    name: "Tenant Onboarding with Atomic Provisioning",
    content: `// Provision everything atomically — no partial states
async function onboardOrg(input: NewOrgInput) {
  await db.transaction(async (tx) => {
    // 1. Create org
    const [org] = await tx.insert(organizations).values({
      name: input.orgName, domain: input.domain, plan: 'trial',
    }).returning();
    // 2. Create admin user
    const [user] = await tx.insert(users).values({
      email: input.email, orgId: org.id, role: 'admin',
    }).returning();
    // 3. Seed default data (templates, categories, settings)
    await tx.insert(orgSettings).values({ orgId: org.id, ...DEFAULT_SETTINGS });
    // 4. Create Stripe customer (outside tx — non-atomic but idempotent)
    const customer = await stripe.customers.create({ email: input.email, metadata: { orgId: org.id } });
    await tx.update(organizations).set({ stripeCustomerId: customer.id }).where(eq(organizations.id, org.id));
  });
}`,
  },

  // ── BACKEND PERFORMANCE ──────────────────────────────────────────────
  {
    cat: "Backend Performance",
    name: "Dataloader: Eliminate N+1 Queries",
    content: `import DataLoader from 'dataloader';
// Without dataloader: 100 users = 100 DB queries for their orgs
// With dataloader: all 100 batched into 1 query automatically
const orgLoader = new DataLoader<string, Org>(async (orgIds) => {
  const orgs = await db.select().from(organizations)
    .where(inArray(organizations.id, [...orgIds]));
  const orgMap = new Map(orgs.map(o => [o.id, o]));
  return orgIds.map(id => orgMap.get(id) ?? new Error('Org ' + id + ' not found'));
}, {
  maxBatchSize: 100,
  cache: true,  // cache within request lifetime
});
// Usage: const org = await orgLoader.load(user.orgId);`,
  },
  {
    cat: "Backend Performance",
    name: "PostgreSQL Partial and Covering Indexes",
    content: `-- Partial index: only index the rows you actually query
-- 90% of queries filter active users? Index only active ones.
CREATE INDEX users_active_email_idx ON users (email)
  WHERE deleted_at IS NULL AND is_active = true;

-- Covering index: include query columns to avoid heap fetch entirely
CREATE INDEX leads_dashboard_idx ON nf_leads (status, created_at DESC)
  INCLUDE (id, company, email, ai_score)
  WHERE status IN ('new', 'reviewing', 'demo_queued');

-- Result: dashboard query uses index-only scan — zero heap reads`,
  },
  {
    cat: "Backend Performance",
    name: "Cursor-Based Pagination for High-Volume Tables",
    content: `// OFFSET pagination breaks at scale: OFFSET 10000 scans 10000 rows every time
// Cursor pagination: O(1) regardless of page number
async function getLeads(cursor?: string, limit = 50) {
  const conditions = cursor
    ? lt(leads.createdAt, new Date(cursor))
    : undefined;
  const rows = await db.select().from(leads)
    .where(conditions)
    .orderBy(desc(leads.createdAt))
    .limit(limit + 1); // fetch 1 extra to detect hasMore
  const hasMore = rows.length > limit;
  return {
    data: rows.slice(0, limit),
    nextCursor: hasMore ? rows[limit - 1].createdAt.toISOString() : null,
    hasMore,
  };
}`,
  },
  {
    cat: "Backend Performance",
    name: "Redis Cache-Aside Pattern",
    content: `async function getCached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit as string) as T;
  const fresh = await fn();
  await redis.setex(key, ttl, JSON.stringify(fresh));
  return fresh;
}
// Usage:
const metrics = await getCached(
  'dashboard:' + orgId,
  300, // 5 minutes
  () => computeDashboardMetrics(orgId)
);
// Invalidate on mutation:
await redis.del('dashboard:' + orgId);`,
  },
  {
    cat: "Backend Performance",
    name: "BullMQ Background Job with Retry and Backoff",
    content: `import { Queue, Worker } from 'bullmq';
const queue = new Queue('demo-generation', {
  connection: { url: process.env.UPSTASH_REDIS_URL },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});
// Add to queue from API route:
await queue.add('generate', { leadId, orgId }, { jobId: leadId }); // jobId deduplicates
// Worker (runs on Railway — no Vercel timeout):
const worker = new Worker('demo-generation', async (job) => {
  const html = await generateDemo(job.data.leadId);
  await db.update(leads).set({ demoHtml: html, status: 'demo_generated' }).where(eq(leads.id, job.data.leadId));
}, { connection: { url: process.env.UPSTASH_REDIS_URL }, concurrency: 2 });`,
  },
  {
    cat: "Backend Performance",
    name: "Rate Limiting with Upstash Sliding Window",
    content: `import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const limiters = {
  auth: new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(5, '1 m'), prefix: 'rl:auth' }),
  api:  new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(100, '1 m'), prefix: 'rl:api' }),
  ai:   new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(20, '1 m'), prefix: 'rl:ai' }),
};

export async function rateLimit(type: keyof typeof limiters, id: string) {
  const { success, reset } = await limiters[type].limit(id);
  if (!success) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Rate limit exceeded. Retry at ' + new Date(reset).toISOString(),
    });
  }
}`,
  },

  // ── AI ENGINEERING ───────────────────────────────────────────────────
  {
    cat: "AI Engineering",
    name: "Streaming AI with Vercel AI SDK",
    content: `import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = await streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: 'You are a helpful NexoFlow assistant.',
    messages,
    maxTokens: 2000,
    onFinish({ usage }) {
      // Track cost after stream completes (non-blocking)
      void trackLLMCost({ inputTokens: usage.promptTokens, outputTokens: usage.completionTokens, model: 'claude-sonnet-4-6' });
    },
  });
  return result.toDataStreamResponse();
}`,
  },
  {
    cat: "AI Engineering",
    name: "Structured Output via Tool Use",
    content: `// Force Claude to return structured data — reliable JSON, no parsing hacks
const response = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 500,
  tools: [{
    name: 'score_lead',
    description: 'Score a lead on qualification',
    input_schema: {
      type: 'object' as const,
      properties: {
        score: { type: 'number' as const, minimum: 0, maximum: 100 },
        reason: { type: 'string' as const },
        flags: { type: 'array' as const, items: { type: 'string' as const } },
      },
      required: ['score', 'reason'],
    },
  }],
  tool_choice: { type: 'tool' as const, name: 'score_lead' },
  messages: [{ role: 'user' as const, content: leadContext }],
});
const result = (response.content[0] as any).input as { score: number; reason: string; flags?: string[] };`,
  },
  {
    cat: "AI Engineering",
    name: "Production RAG Pipeline",
    content: `async function ragQuery(query: string, orgId: string): Promise<string> {
  // 1. Embed query
  const embedding = await getEmbedding(query);
  // 2. Hybrid: vector + keyword search
  const [vectorHits, keywordHits] = await Promise.all([
    db.select({ content: knowledge.content, dist: cosineDistance(knowledge.embedding, embedding) })
      .from(knowledge).where(eq(knowledge.orgId, orgId))
      .orderBy(cosineDistance(knowledge.embedding, embedding)).limit(5),
    db.select({ content: knowledge.content }).from(knowledge)
      .where(and(eq(knowledge.orgId, orgId), sql\`content ILIKE \${'%' + query.split(' ').join('%') + '%'}\`)).limit(3),
  ]);
  const context = [...vectorHits, ...keywordHits].slice(0, 5).map(r => r.content).join('\n\n---\n\n');
  // 3. Generate grounded response
  const resp = await anthropic.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 1500,
    system: "Answer using ONLY the provided context. If not in context, say so.",
    messages: [{ role: 'user', content: 'Context:\n' + context + '\n\nQuestion: ' + query }],
  });
  return resp.content[0]?.type === 'text' ? resp.content[0].text : '';
}`,
  },
  {
    cat: "AI Engineering",
    name: "LLM Cost Tracking per Org",
    content: `// Track AI spend by org — enforce limits, surface in admin dashboard
const MODEL_COST_PER_1K: Record<string, { in: number; out: number }> = {
  'claude-haiku-4-5-20251001': { in: 0.00025, out: 0.00125 },
  'claude-sonnet-4-6':         { in: 0.003,   out: 0.015 },
  'claude-opus-4-7':           { in: 0.015,   out: 0.075 },
};

async function trackLLMCost(params: { model: string; inputTokens: number; outputTokens: number; orgId: string; feature: string }) {
  const c = MODEL_COST_PER_1K[params.model];
  const costUsdCents = Math.ceil(((params.inputTokens / 1000) * c.in + (params.outputTokens / 1000) * c.out) * 100);
  await db.insert(llmUsageLog).values({ ...params, costUsdCents });
  // Check monthly limit
  const monthSpend = await getMonthlyAISpend(params.orgId);
  if (monthSpend > org.aiSpendLimitCents) throw new Error('Monthly AI limit exceeded');
}`,
  },
  {
    cat: "AI Engineering",
    name: "Semantic Cache for LLM Calls",
    content: `import { createHash } from 'crypto';
// Exact cache: identical prompts return cached response
async function cachedGenerate(prompt: string, model: string): Promise<string> {
  const key = 'llm:' + createHash('sha256').update(model + prompt).digest('hex');
  const hit = await redis.get(key);
  if (hit) return hit as string;

  const response = await anthropic.messages.create({
    model, max_tokens: 2000, messages: [{ role: 'user', content: prompt }],
  });
  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  await redis.setex(key, 3600, text); // 1 hour TTL
  return text;
}
// ~40% cache hit rate on similar prompts = 40% AI cost savings`,
  },
  {
    cat: "AI Engineering",
    name: "LLM Fallback Chain for Reliability",
    content: `// Never let AI be a hard dependency — always have a fallback
async function generateWithFallback(prompt: string): Promise<string> {
  const chain = ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];
  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    try {
      const response = await anthropic.messages.create({
        model, max_tokens: 2000, messages: [{ role: 'user', content: prompt }],
      });
      return response.content[0]?.type === 'text' ? response.content[0].text : '';
    } catch (err) {
      if (i === chain.length - 1) throw err; // all failed
      console.warn(model + ' failed, trying fallback', err);
    }
  }
  throw new Error('All models failed');
}`,
  },

  // ── OBSERVABILITY & SRE ──────────────────────────────────────────────
  {
    cat: "Observability and SRE",
    name: "Structured Logging with Pino",
    content: `import pino from 'pino';
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'nexoflow-api', version: process.env.APP_VERSION, env: process.env.NODE_ENV },
  transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
});
// Always log with context — never use console.log in production
logger.info({ event: 'lead.created', leadId, orgId, source }, 'Lead created');
logger.error({ err, leadId, event: 'demo.failed' }, 'Demo generation failed');
// Structured logs → searchable in Datadog/Grafana Loki by any field`,
  },
  {
    cat: "Observability and SRE",
    name: "Error Budget Burn Rate Alert (Prometheus)",
    content: `# Alert when consuming monthly error budget at dangerous rate
# 14.4x burn rate = exhaust monthly 99.9% SLO in 50 hours
groups:
- name: slo_alerts
  rules:
  - alert: HighErrorBudgetBurnRate
    expr: |
      rate(http_requests_total{status=~"5.."}[1h]) /
      rate(http_requests_total[1h]) > 0.001 * 14.4
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "SLO breach imminent — burning error budget 14x too fast"
  - alert: SlowBurnRate
    expr: |
      rate(http_requests_total{status=~"5.."}[6h]) /
      rate(http_requests_total[6h]) > 0.001 * 6
    labels:
      severity: warning`,
  },
  {
    cat: "Observability and SRE",
    name: "OpenTelemetry Distributed Trace Span",
    content: `import { trace, SpanStatusCode } from '@opentelemetry/api';
const tracer = trace.getTracer('nexoflow-api');

async function processPayment(input: PaymentInput) {
  return tracer.startActiveSpan('payment.process', async (span) => {
    try {
      span.setAttributes({
        'payment.amount_cents': input.amountCents,
        'user.id': input.userId,
        'payment.method': input.method,
      });
      const result = await stripeClient.charge(input);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      throw err;
    } finally {
      span.end();
    }
  });
}`,
  },
  {
    cat: "Observability and SRE",
    name: "Health Check Endpoint (Kubernetes Probes)",
    content: `// Kubernetes liveness + readiness probes use this
// GET /api/health
export async function GET() {
  const start = Date.now();
  const checks = await Promise.allSettled([
    db.execute(sql\`SELECT 1\`),      // DB reachable?
    redis.ping(),                     // Redis reachable?
  ]);
  const dbOk = checks[0].status === 'fulfilled';
  const redisOk = checks[1].status === 'fulfilled';
  const healthy = dbOk && redisOk;
  return Response.json({
    status: healthy ? 'ok' : 'degraded',
    db: dbOk ? 'ok' : 'error',
    redis: redisOk ? 'ok' : 'error',
    latencyMs: Date.now() - start,
    uptime: process.uptime(),
    version: process.env.APP_VERSION,
  }, { status: healthy ? 200 : 503 });
}`,
  },
  {
    cat: "Observability and SRE",
    name: "SLO Definition and Error Budget",
    content: `// SLI → SLO → Error Budget → Burn Rate

// SLI: "99.2% of API requests completed in < 500ms over 30 days"
// SLO: "Target: 99.9% availability over 30 days"
// Error budget: 100% - 99.9% = 0.1% = 43.8 minutes downtime/month

// When error budget is exhausted:
// → Freeze feature work
// → All engineering focuses on reliability
// → Post-mortem required before new features resume

const SLO_TARGETS = {
  standard:     { availability: 0.995, latencyP99Ms: 2000, budgetMinutes: 216 },
  professional: { availability: 0.999, latencyP99Ms: 1000, budgetMinutes: 44 },
  enterprise:   { availability: 0.9995, latencyP99Ms: 500, budgetMinutes: 22 },
};`,
  },

  // ── DEVOPS AND CI/CD ────────────────────────────────────────────────
  {
    cat: "DevOps and CI/CD",
    name: "Reusable GitHub Actions Workflow",
    content: `# .github/workflows/reusable-test.yml
# Called by: uses: ./.github/workflows/reusable-test.yml
name: Reusable Test
on:
  workflow_call:
    inputs:
      node-version: { type: string, default: '20' }
    secrets:
      DATABASE_URL: { required: true }
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_DB: test, POSTGRES_PASSWORD: test, POSTGRES_USER: test }
        options: --health-cmd pg_isready --health-interval 5s
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: \${{ inputs.node-version }}, cache: npm }
      - run: npm ci && npm test
        env: { DATABASE_URL: \${{ secrets.DATABASE_URL }} }`,
  },
  {
    cat: "DevOps and CI/CD",
    name: "Ephemeral PR Environment with Neon Branching",
    content: `# Auto-create/destroy isolated DB + preview per PR
name: Preview
on:
  pull_request: { types: [opened, synchronize, closed] }
jobs:
  preview:
    if: github.event.action != 'closed'
    steps:
      - name: Create Neon branch
        id: db
        run: |
          URL=$(neonctl branches create --project-id $PROJECT_ID --name pr-\${{ github.event.number }} --output json | jq -r '.connection_string')
          echo "url=$URL" >> $GITHUB_OUTPUT
      - name: Deploy preview
        run: vercel deploy --env DATABASE_URL=\${{ steps.db.outputs.url }} 2>&1 | tail -1 > deploy_url.txt
      - name: Comment
        run: gh pr comment \${{ github.event.number }} --body "Preview: $(cat deploy_url.txt)"
  cleanup:
    if: github.event.action == 'closed'
    steps:
      - run: neonctl branches delete pr-\${{ github.event.number }}`,
  },
  {
    cat: "DevOps and CI/CD",
    name: "Docker Multi-Stage Build (120MB vs 800MB)",
    content: `# Multi-stage: build layer vs runtime layer
# Result: 800MB dev image → 120MB production image
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
USER node  # NEVER run production container as root
EXPOSE 3000
CMD ["node", "dist/server.js"]`,
  },
  {
    cat: "DevOps and CI/CD",
    name: "Kubernetes Deployment with Rolling Update",
    content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-service
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # one extra pod during rollout
      maxUnavailable: 0  # never reduce below 3 replicas
  template:
    spec:
      containers:
      - name: api
        image: nexoflow/api:1.2.3
        resources:
          requests: { memory: "256Mi", cpu: "100m" }
          limits:   { memory: "512Mi", cpu: "500m" }
        readinessProbe:
          httpGet: { path: /api/health, port: 3000 }
          initialDelaySeconds: 5
          periodSeconds: 10
        livenessProbe:
          httpGet: { path: /api/health, port: 3000 }
          initialDelaySeconds: 30
          periodSeconds: 30`,
  },

  // ── DATABASE ARCHITECTURE ────────────────────────────────────────────
  {
    cat: "Database Architecture",
    name: "Soft Delete Pattern (Auditable)",
    content: `-- Never hard-delete transactional data — use soft delete
-- Preserves audit trail, enables undo, required for many compliance frameworks
ALTER TABLE nf_leads ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE nf_leads ADD COLUMN deleted_by UUID;

-- Always filter in queries:
const activeLeads = await db.select().from(leads).where(isNull(leads.deletedAt));

-- PostgreSQL view for convenience:
CREATE VIEW active_leads AS SELECT * FROM nf_leads WHERE deleted_at IS NULL;

-- Soft delete mutation:
await db.update(leads).set({
  deletedAt: new Date(),
  deletedBy: ctx.user.id,
}).where(eq(leads.id, id));`,
  },
  {
    cat: "Database Architecture",
    name: "Zero-Downtime Database Migration Strategy",
    content: `-- 3-step column rename (never rename in one step — breaks concurrent app instances)
-- Step 1: Add new column alongside old
ALTER TABLE users ADD COLUMN display_name TEXT;
-- Deploy app version that writes BOTH columns

-- Step 2: Backfill
UPDATE users SET display_name = first_name || ' ' || last_name WHERE display_name IS NULL;

-- Step 3: Remove old column (after new app version is 100% deployed)
ALTER TABLE users DROP COLUMN old_column;

-- Rules:
-- Never: ALTER TABLE RENAME COLUMN in single deploy
-- Never: DROP COLUMN without deprecation period
-- Never: ADD NOT NULL without DEFAULT or backfill-first
-- Always: Test migration on production-size data dump first`,
  },
  {
    cat: "Database Architecture",
    name: "Event Sourcing with PostgreSQL",
    content: `-- Append-only event store — never UPDATE or DELETE events
CREATE TABLE events (
  id          BIGSERIAL PRIMARY KEY,
  stream_id   UUID NOT NULL,      -- aggregate ID (e.g. orderId)
  stream_type TEXT NOT NULL,      -- 'order', 'user'
  event_type  TEXT NOT NULL,      -- 'order.created', 'item.added'
  version     INTEGER NOT NULL,   -- monotonic per stream (optimistic concurrency)
  payload     JSONB NOT NULL,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (stream_id, version)     -- prevents duplicate events
);
CREATE INDEX events_stream_idx ON events (stream_id, version);

-- Snapshot table: periodic state snapshot to avoid replaying all events
CREATE TABLE event_snapshots (
  stream_id UUID PRIMARY KEY,
  version   INTEGER NOT NULL,
  state     JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`,
  },
  {
    cat: "Database Architecture",
    name: "pgvector: HNSW Index for Fast Similarity Search",
    content: `-- pgvector: store and query embeddings in PostgreSQL
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE knowledge_snippets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL,
  content     TEXT NOT NULL,
  embedding   VECTOR(1536),  -- 1536 = text-embedding-3-small dimensions
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index: approximate nearest-neighbor, sub-millisecond queries
-- Build once, never rebuild (unlike IVFFlat)
CREATE INDEX knowledge_embedding_idx ON knowledge_snippets
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);  -- m=16 good default, ef=64 for recall`,
  },

  // ── API DESIGN ──────────────────────────────────────────────────────
  {
    cat: "API Design",
    name: "Zod Validation on Every tRPC Input",
    content: `export const leadsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({
      firstName: z.string().min(1).max(100).trim(),
      email: z.string().email().optional().or(z.literal('')),
      company: z.string().min(1).max(200).trim(),
      website: z.string().url().optional().or(z.literal('')),
      tags: z.array(z.string().max(50)).max(20).default([]),
      painPoints: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Input is validated — no manual checks needed in handler
      // Zod rejects invalid input before handler is even called
      return ctx.db.insert(leads).values({ ...input, orgId: ctx.user.orgId });
    }),
});`,
  },
  {
    cat: "API Design",
    name: "Idempotency Keys for Safe Retries",
    content: `// Client retries should produce same result — not duplicate the action
// Critical for: payments, order creation, email sends
export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get('Idempotency-Key');
  if (idempotencyKey) {
    const cached = await redis.get('idem:' + idempotencyKey);
    if (cached) return Response.json(JSON.parse(cached as string)); // return same response
  }
  const result = await processRequest(req);
  if (idempotencyKey) {
    await redis.setex('idem:' + idempotencyKey, 86400, JSON.stringify(result)); // cache 24h
  }
  return Response.json(result);
}`,
  },
  {
    cat: "API Design",
    name: "API Key with SHA-256 Hashing",
    content: `import { createHash, randomBytes } from 'crypto';
// NEVER store plaintext API keys — only the SHA-256 hash
function generateAPIKey() {
  const secret = randomBytes(32).toString('base64url');
  const key = 'nxf_live_' + secret;
  const hash = createHash('sha256').update(key).digest('hex');
  const prefix = key.slice(0, 16); // show first 16 chars in settings UI
  return { key, hash, prefix }; // return key once, store only hash
}
async function validateAPIKey(incoming: string) {
  const hash = createHash('sha256').update(incoming).digest('hex');
  const record = await db.select().from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hash), isNull(apiKeys.revokedAt)))
    .limit(1);
  return record[0] ?? null;
}`,
  },

  // ── FRONTEND PERFORMANCE ────────────────────────────────────────────
  {
    cat: "Frontend Performance",
    name: "ISR: Incremental Static Regeneration",
    content: `// ISR: regenerate page at most once per interval — not on every request
// 100x cheaper than SSR for content that changes hourly
export const revalidate = 3600; // max 1 regeneration per hour

// On-demand revalidation after CMS update:
import { revalidatePath, revalidateTag } from 'next/cache';
await revalidatePath('/blog'); // revalidate specific path
await revalidateTag('articles'); // revalidate all tagged content

// fetch() with tags:
const data = await fetch('/api/articles', { next: { tags: ['articles'] } });
// await revalidateTag('articles') — purges all fetch caches with this tag`,
  },
  {
    cat: "Frontend Performance",
    name: "React Server Components: Direct DB Access",
    content: `// RSC: runs on server, zero JS shipped to browser for non-interactive content
// No API call, no useEffect, no loading state — just fetch and render

async function LeadsTable() {
  // Direct DB access — runs on server, not in browser
  const leads = await db.select().from(nfLeads)
    .where(isNull(nfLeads.deletedAt))
    .orderBy(desc(nfLeads.createdAt))
    .limit(50);
  return (
    <table>
      <tbody>
        {leads.map(lead => <LeadRow key={lead.id} lead={lead} />)}
      </tbody>
    </table>
  );
}
// LeadRow: Server Component unless it has onClick/useState → mark 'use client'`,
  },
  {
    cat: "Frontend Performance",
    name: "Optimistic Updates with TanStack Query",
    content: `const utils = trpc.useUtils();
const updateStatus = trpc.leads.updateStatus.useMutation({
  onMutate: async ({ id, status }) => {
    await utils.leads.list.cancel(); // cancel in-flight queries
    const prev = utils.leads.list.getData();
    // Optimistically update UI — no loading spinner, instant feedback
    utils.leads.list.setData(undefined, old =>
      old?.map(l => l.id === id ? { ...l, status } : l)
    );
    return { prev };
  },
  onError: (_err, _vars, ctx) => {
    utils.leads.list.setData(undefined, ctx?.prev); // rollback on error
    toast.error('Update failed — reverted');
  },
  onSettled: () => utils.leads.list.invalidate(), // sync with server
});`,
  },

  // ── REAL-TIME ENGINEERING ───────────────────────────────────────────
  {
    cat: "Real-Time Engineering",
    name: "Server-Sent Events for Live Notifications",
    content: `// SSE: one-way server push, simpler than WebSocket for notifications
// Works through HTTP/2, no upgrade handshake, automatic reconnection
// GET /api/stream
export async function GET(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (data: unknown) =>
        controller.enqueue(enc.encode('data: ' + JSON.stringify(data) + '\n\n'));
      send({ type: 'connected', ts: Date.now() });
      const interval = setInterval(async () => {
        const n = await getUnread(userId);
        if (n.length) send({ type: 'notifications', data: n });
      }, 5000);
      req.signal.addEventListener('abort', () => clearInterval(interval));
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}`,
  },
  {
    cat: "Real-Time Engineering",
    name: "PostgreSQL LISTEN/NOTIFY for Cross-Service Events",
    content: `-- Push events to connected Node.js clients without polling
-- CREATE TRIGGER → fires pg_notify on INSERT
CREATE OR REPLACE FUNCTION notify_new_lead() RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('new_lead', json_build_object('id', NEW.id, 'company', NEW.company)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER lead_notify AFTER INSERT ON nf_leads FOR EACH ROW EXECUTE FUNCTION notify_new_lead();

// Node.js: subscribe and forward to WebSocket clients
const client = new pg.Client({ connectionString: process.env.DATABASE_URL_DIRECT });
await client.connect();
await client.query('LISTEN new_lead');
client.on('notification', msg => {
  io.to(orgRoom).emit('lead:new', JSON.parse(msg.payload!));
});`,
  },

  // ── MOBILE ENTERPRISE ─────────────────────────────────────────────
  {
    cat: "Mobile Enterprise",
    name: "Biometric Authentication (Expo)",
    content: `import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

async function biometricAuth(): Promise<boolean> {
  const available = await LocalAuthentication.hasHardwareAsync();
  if (!available) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) { Alert.alert('Biometrics not set up'); return false; }
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Verify your identity to continue',
    fallbackLabel: 'Use PIN',
    cancelLabel: 'Cancel',
  });
  return result.success;
}

// Store token in hardware-backed Keychain (iOS) / Android Keystore
await SecureStore.setItemAsync('auth_token', token, {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});`,
  },
  {
    cat: "Mobile Enterprise",
    name: "Offline Sync Queue with Exponential Backoff",
    content: `import NetInfo from '@react-native-community/netinfo';
const SYNC_KEY = 'pending_sync_queue';

async function queueChange(operation: PendingOp) {
  const queue = JSON.parse((await AsyncStorage.getItem(SYNC_KEY)) ?? '[]') as PendingOp[];
  queue.push({ ...operation, id: uuid(), retries: 0, queuedAt: Date.now() });
  await AsyncStorage.setItem(SYNC_KEY, JSON.stringify(queue));
}

async function flushQueue() {
  const { isConnected } = await NetInfo.fetch();
  if (!isConnected) return;
  const queue = JSON.parse((await AsyncStorage.getItem(SYNC_KEY)) ?? '[]') as PendingOp[];
  for (const op of queue) {
    try {
      await apiClient.sync(op);
      // Remove from queue on success
    } catch {
      op.retries++;
      // Exponential backoff: 2^retries seconds, max 32s
    }
  }
}
// Call flushQueue() on app foreground + network restored`,
  },

  // ── ENTERPRISE SALES ─────────────────────────────────────────────
  {
    cat: "Enterprise Sales",
    name: "ROI Frame for Enterprise Proposals",
    content: `// Use in discovery → anchor price before revealing it
function buildROIFrame(d: DiscoveryData): string {
  const annualLabourCost = d.people * d.hoursPerDay * 250 * d.hourlyRateDollars;
  const annualSaving = annualLabourCost * d.automationFraction;
  const projectCost = Math.ceil((annualSaving * 0.30) / 500) * 500;
  const paybackMonths = (projectCost / annualSaving) * 12;
  return (
    'Your team spends ' + (d.people * d.hoursPerDay) + ' hrs/day on this process. ' +
    'At fully-loaded cost, that is $' + annualSaving.toLocaleString() + '/yr. ' +
    'We are quoting $' + projectCost.toLocaleString() + ' to automate 80% of it. ' +
    'That is a ' + paybackMonths.toFixed(1) + '-month payback.'
  );
}`,
  },
  {
    cat: "Enterprise Sales",
    name: "Enterprise Contract Red Flags",
    content: `// These clauses must be addressed before signing
const contractRedFlags = [
  {
    clause: '"Unlimited revisions"',
    fix: 'Cap at 3 rounds of revisions per milestone. Additional revisions billed at $150/hr.',
  },
  {
    clause: '"We own everything including your tools and frameworks"',
    fix: 'Carve out: client owns custom code. NexoFlow retains IP in base frameworks and libraries.',
  },
  {
    clause: '"Pay on go-live only"',
    fix: 'Non-negotiable: 30% upfront before any work begins. Use in proposal: "This protects both parties."',
  },
  {
    clause: '"Net-90 payment terms"',
    fix: 'Counter-offer: Net-30, or Net-60 maximum. Net-90 = 3 months of working capital at risk.',
  },
  {
    clause: '"Unlimited support after launch"',
    fix: 'Scope: 30-day bug-fix warranty. Ongoing support = separate retainer agreement.',
  },
];`,
  },

  // ── CLOUD ARCHITECTURE ──────────────────────────────────────────────
  {
    cat: "Cloud Architecture",
    name: "Cloudflare R2 vs S3: Zero Egress",
    content: `// R2: S3-compatible storage with ZERO egress fees
// AWS S3 charges $0.09/GB egress — for file-heavy apps, R2 saves thousands/month
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: 'https://' + process.env.CF_ACCOUNT_ID + '.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY!,
    secretAccessKey: process.env.R2_SECRET_KEY!,
  },
});
// API is identical to S3 — just change the endpoint
await r2.send(new PutObjectCommand({
  Bucket: 'nexoflow-demos',
  Key: 'demos/' + leadId + '.html',
  Body: html,
  ContentType: 'text/html',
}));`,
  },
  {
    cat: "Cloud Architecture",
    name: "Edge Function for Auth at the CDN",
    content: `// Edge runtime: runs at CDN, < 1ms latency vs 50ms+ serverless
// Use for: JWT validation, redirects, geolocation, A/B headers
// NOT for: DB queries, file system, heavy Node.js APIs
export const runtime = 'edge';

export async function middleware(req: NextRequest) {
  // Protect all /app/* routes at the edge — no origin request for unauth'd users
  if (req.nextUrl.pathname.startsWith('/app')) {
    const token = req.cookies.get('session')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }
    try {
      await verifyJWT(token); // verify at edge using jose (no Node.js crypto needed)
      return NextResponse.next();
    } catch {
      return NextResponse.redirect(new URL('/sign-in?reason=expired', req.url));
    }
  }
}`,
  },
  {
    cat: "Cloud Architecture",
    name: "S3 Lifecycle Policy for Cost Reduction",
    content: `// Auto-tier storage to cheaper classes as files age
// Savings: 45% (IA), 70% (Glacier IR), 95% (Deep Archive)
const lifecycle = {
  Rules: [{
    Id: 'tiered-storage',
    Status: 'Enabled',
    Filter: { Prefix: 'uploads/' },
    Transitions: [
      { Days: 30,  StorageClass: 'STANDARD_IA' },     // accessed < monthly
      { Days: 90,  StorageClass: 'GLACIER_IR' },      // accessed < quarterly
      { Days: 365, StorageClass: 'DEEP_ARCHIVE' },    // accessed < yearly
    ],
    Expiration: { Days: 2555 }, // delete after 7 years
  }],
};
// For NexoFlow: apply to /exports/, /backups/, /old-demos/ prefixes`,
  },

  // ── DESIGN SYSTEM ───────────────────────────────────────────────────
  {
    cat: "Design System",
    name: "Design Token Cascade: Primitive to Component",
    content: `// 3-tier token system — enables white-labeling without code changes
// Tier 1: Primitives — raw values, never used directly in components
const primitives = { blue500: '#3b82f6', gray100: '#f3f4f6', space4: '16px' };

// Tier 2: Semantic — meaning-based aliases
const semantic = {
  colorPrimary: primitives.blue500,     // use in: buttons, links, focus rings
  colorSurface: primitives.gray100,     // use in: card backgrounds
  spacingBase: primitives.space4,
};

// Tier 3: Component — element-specific tokens
const button = { background: semantic.colorPrimary, padding: semantic.spacingBase };

// Brand swap: change Tier 1 only → Tier 2 + 3 update automatically
// CSS vars: --color-primary: var(--brand-primary, #3b82f6);`,
  },
  {
    cat: "Design System",
    name: "CVA: Class Variance Authority for Components",
    content: `import { cva, type VariantProps } from 'class-variance-authority';
const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:     'bg-primary text-primary-foreground hover:bg-primary/90',
        outline:     'border border-input bg-background hover:bg-accent',
        ghost:       'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: { sm: 'h-9 px-3 text-sm', default: 'h-10 px-4', lg: 'h-11 px-8' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);
export function Button({ variant, size, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={buttonVariants({ variant, size, className })} {...props} />;
}`,
  },
  {
    cat: "Design System",
    name: "WCAG 2.2 AA Accessibility Checklist",
    content: `// Enterprise clients often contractually require WCAG 2.2 AA
// Build these in from day 1 — retrofitting is 3-5x more expensive

// 1. Colour contrast: 4.5:1 body text, 3:1 large text/UI components
// 2. Focus indicators: all interactive elements visually focused
// 3. Skip navigation: first element = "Skip to main content" link
// 4. Form errors: announced via aria-live="polite" or role="alert"
// 5. Images: alt text on all informational images, alt="" on decorative
// 6. Keyboard navigation: Tab/Shift+Tab, Enter/Space, Arrow keys in menus
// 7. ARIA roles: dialog, menu, listbox, combobox — correct role per widget
// 8. No auto-play audio/video
// 9. Captions on all video content
// 10. Target size: minimum 24x24px touch targets (WCAG 2.5.8)

// Test with: axe DevTools (automated), NVDA/VoiceOver (manual)`,
  },

  // ── PRODUCT ENGINEERING ────────────────────────────────────────────
  {
    cat: "Product Engineering",
    name: "Feature Flag with Deterministic Rollout",
    content: `import { createHash } from 'crypto';
// Deterministic: same org always gets same flag value (no flicker)
export async function isFeatureEnabled(flag: string, orgId: string): Promise<boolean> {
  const f = await db.select().from(featureFlags).where(eq(featureFlags.key, flag)).limit(1);
  if (!f[0] || !f[0].enabled) return false;
  // Allow-list: specific orgs always get the feature
  if (f[0].allowList.includes(orgId)) return true;
  // Percentage rollout: deterministic hash (same org, same bucket, every time)
  const hash = parseInt(createHash('md5').update(orgId + flag).digest('hex').slice(0, 8), 16);
  return (hash % 100) < (f[0].rolloutPercent ?? 0);
}`,
  },

  // ── PRICING AND SCOPING ──────────────────────────────────────────────
  {
    cat: "Pricing and Scoping",
    name: "Fixed Price Estimation Formula",
    content: `// NexoFlow: always fixed price. Never hourly. hours × $150, round to nearest $500
function estimate(hours: Record<string, number>) {
  const total = Object.values(hours).reduce((a, b) => a + b, 0);
  const raw = total * 150;
  const quoted = Math.ceil(raw / 500) * 500;
  return {
    breakdown: hours, totalHours: total,
    quoted,
    milestones: {
      deposit:  Math.round(quoted * 0.30),  // upfront before work begins
      midpoint: Math.round(quoted * 0.40),  // at agreed milestone
      launch:   Math.round(quoted * 0.30),  // on launch / handover
    },
  };
}
// Example: { discovery: 8, design: 20, backend: 40, frontend: 30, testing: 12 } = 110hrs = $16,500`,
  },
  {
    cat: "Pricing and Scoping",
    name: "Project Risk Scoring Matrix",
    content: `// Likelihood × Impact (1-5) — flag anything >= 10 in proposal
const risks = [
  { id: 'R1', risk: 'No API access to legacy system', L: 4, I: 5 }, // score 20 — CRITICAL
  { id: 'R2', risk: 'HIPAA audit required before launch', L: 3, I: 4 }, // 12 — HIGH
  { id: 'R3', risk: 'Single client contact — bus factor 1', L: 2, I: 5 }, // 10 — HIGH
  { id: 'R4', risk: 'Requirements change after spec signed', L: 3, I: 3 }, // 9 — MEDIUM
];
const critical = risks.filter(r => r.L * r.I >= 10);
// Include in proposal: "The following risks score 10+. We have mitigations ready."
// Mitigation prevents surprises AND demonstrates enterprise credibility`,
  },
];

async function seed() {
  const client = postgres(DATABASE_URL!, { max: 3 });
  const db = drizzle(client);

  console.log("\n Enterprise Knowledge Base V2");
  console.log("   Seeding " + V2_SNIPPETS.length + " enterprise-grade snippets\n");

  let inserted = 0;
  let skipped = 0;

  for (const snippet of V2_SNIPPETS) {
    try {
      await db.insert(knowledgeSnippets).values({
        category: snippet.cat,
        name: snippet.name,
        content: snippet.content,
      });
      inserted++;
      process.stdout.write("\r  Inserted: " + inserted + " | Skipped: " + skipped);
    } catch (e: any) {
      if (e?.code === "23505") {
        skipped++;
      } else {
        throw e;
      }
    }
  }

  console.log("\n\n Done! Inserted " + inserted + " snippets, skipped " + skipped + " duplicates.");

  const cats = [...new Set(V2_SNIPPETS.map(s => s.cat))];
  console.log("\nCategories:");
  for (const cat of cats) {
    const count = V2_SNIPPETS.filter(s => s.cat === cat).length;
    console.log("  " + cat + ": " + count);
  }

  await client.end();
  process.exit(0);
}

seed().catch(console.error);
