/**
 * Enterprise Knowledge Base Seed — NexoFlow OS
 * Adds deep enterprise-level snippets to nf_knowledge_snippets.
 * Run: npx tsx --env-file .env.local scripts/seed-enterprise-knowledge.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { knowledgeSnippets } from "../src/server/db/schema";
import { sql } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

type Snippet = { cat: string; name: string; content: string };

const ENTERPRISE_SNIPPETS: Snippet[] = [

  // ─────────────────────────────────────────────────────────────────────────
  // ENTERPRISE ARCHITECTURE
  // ─────────────────────────────────────────────────────────────────────────
  {
    cat: "Enterprise Architecture",
    name: "Microservices Decomposition Strategy",
    content: `## Microservices Decomposition — When & How

**Rule: Start monolith. Decompose on pain, not on principle.**

### Decomposition triggers
- Independent deploy cadence needed (teams blocked by others)
- Extreme scale difference (auth: 10k rps vs reporting: 100/day)
- Technology boundary (ML service needs Python, rest is Node)
- Compliance isolation (PCI scope reduction)

### Decomposition patterns
| Pattern | Use case | Example |
|---------|----------|---------|
| Domain-driven | Clear bounded contexts | Orders vs Inventory vs Payments |
| Strangler fig | Migrate from monolith safely | Extract auth first, wrap with API gateway |
| Anti-corruption layer | Legacy integration | Adapter over old SOAP service |

### Service communication
- **Sync**: REST or gRPC for request-response (queries, mutations needing immediate answer)
- **Async**: Message queue (RabbitMQ, SQS, Kafka) for events where producer doesn't need reply
- **Never**: Direct DB access between services — own your data

### NexoFlow default split for SaaS
\`\`\`
api-gateway  → auth, rate limiting, routing
app-service  → core business logic (tRPC)
worker-service → background jobs, email, webhooks
analytics-service → read-heavy reporting (separate DB replica)
ai-service   → LLM calls (isolated for cost tracking)
\`\`\``,
  },
  {
    cat: "Enterprise Architecture",
    name: "Event-Driven Architecture Patterns",
    content: `## Event-Driven Architecture (EDA)

### Core patterns

**Event Notification**: Service emits event, others react independently
\`\`\`
OrderPlaced → [EmailService, InventoryService, AnalyticsService]
\`\`\`

**Event-Carried State Transfer**: Event contains full payload (not just ID)
\`\`\`json
{ "type": "OrderPlaced", "orderId": "abc", "items": [...], "total": 4900, "userId": "xyz" }
\`\`\`
Receivers are autonomous — no follow-up queries needed.

**Event Sourcing**: Persist events, derive state by replaying
- Full audit trail built in
- Time-travel debugging
- Snapshots for performance
- Complex: eventual consistency, schema evolution

### Queue vs Stream
| | Queue (SQS/RabbitMQ) | Stream (Kafka/Kinesis) |
|---|---|---|
| Message retention | Deleted on consume | Retained (configurable) |
| Consumers | Competing (one wins) | Independent (each reads at own offset) |
| Use case | Task distribution | Event log, replay, analytics |
| Order guarantee | Per queue | Per partition |

### Outbox pattern (guaranteed delivery)
\`\`\`sql
-- Write event to outbox in SAME transaction as business data
BEGIN;
  UPDATE orders SET status = 'confirmed' WHERE id = $1;
  INSERT INTO outbox (event_type, payload) VALUES ('OrderConfirmed', $2);
COMMIT;
-- Separate poller reads outbox and publishes to queue
\`\`\`
Prevents: DB write succeeds but message publish fails.`,
  },
  {
    cat: "Enterprise Architecture",
    name: "CQRS Pattern — When to Use It",
    content: `## CQRS — Command Query Responsibility Segregation

**Only reach for CQRS when read/write models diverge significantly.**

### Structure
\`\`\`
Commands (write side) → domain logic → events → write DB
Queries (read side)   ← read DB (optimised projections/views)
\`\`\`

### When it pays off
- Complex domain with many aggregates that need different query shapes
- Read traffic 100x+ write traffic — scale independently
- Different teams own reads vs writes
- Regulatory audit trail needed (combine with event sourcing)

### Simple CQRS in Next.js / tRPC
\`\`\`typescript
// Command — goes through domain logic, validates, emits events
router.createOrder = protectedProcedure
  .input(CreateOrderSchema)
  .mutation(async ({ ctx, input }) => {
    const order = await OrderAggregate.create(input);
    await ctx.db.insert(orders).values(order.state);
    await ctx.eventBus.emit(order.events);
    return { id: order.id };
  });

// Query — hits optimised read model / materialized view
router.getOrderSummary = protectedProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    return ctx.db
      .select()
      .from(orderSummaryView)
      .where(eq(orderSummaryView.id, input.id))
      .then(([row]) => row);
  });
\`\`\`

### Anti-pattern: CQRS everywhere
Adding CQRS to simple CRUD just doubles complexity with no benefit. Use it surgically.`,
  },
  {
    cat: "Enterprise Architecture",
    name: "Saga Pattern for Distributed Transactions",
    content: `## Saga Pattern — Distributed Transaction Coordination

### Problem
Can't use ACID transactions across microservices. Need to coordinate multi-step business processes.

### Two implementations

**Choreography** (event-driven, no central coordinator)
\`\`\`
OrderService → OrderCreated → PaymentService → PaymentProcessed
→ InventoryService → InventoryReserved → ShippingService
\`\`\`
- Decoupled
- Hard to track overall progress
- Good for simple, linear flows

**Orchestration** (central saga coordinator)
\`\`\`
SagaOrchestrator:
  1. CreateOrder → success/fail
  2. ProcessPayment → success → continue / fail → compensate step 1
  3. ReserveInventory → success → continue / fail → compensate steps 1+2
  4. CreateShipment
\`\`\`
- Easier to track, debug, monitor
- Single point of coordination
- Better for complex flows with branching

### Compensation (rollback equivalent)
Each step must have a compensating transaction:
\`\`\`
CreateOrder → CancelOrder
ProcessPayment → RefundPayment
ReserveInventory → ReleaseInventory
\`\`\`

### NexoFlow implementation: Temporal.io or BullMQ workflows
\`\`\`typescript
// BullMQ saga with retry + compensation
const sagaQueue = new Queue('order-saga');
await sagaQueue.add('process-order', { orderId }, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
});
\`\`\``,
  },
  {
    cat: "Enterprise Architecture",
    name: "API Gateway Patterns",
    content: `## API Gateway — Enterprise Patterns

### Core responsibilities
1. **Authentication/Authorization** — verify JWT, check scopes before routing
2. **Rate limiting** — per client, per endpoint, per tier
3. **Request routing** — path → service mapping
4. **Protocol translation** — HTTP/REST → gRPC, WebSocket
5. **Observability** — request logging, tracing headers, latency metrics
6. **Caching** — edge caching for GET responses
7. **Circuit breaking** — stop cascading failures

### Patterns
| Pattern | Use | Example |
|---------|-----|---------|
| Backend for Frontend (BFF) | Different clients need different shapes | Mobile BFF vs Web BFF |
| API Aggregation | Single request → multiple services | Dashboard data in one call |
| Request/Response Transform | Shape client vs service contract | Rename fields, add computed properties |

### NexoFlow: Vercel Edge Middleware as gateway
\`\`\`typescript
// middleware.ts
export const config = { matcher: ['/api/:path*'] };

export function middleware(req: NextRequest) {
  // Auth check
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token && !isPublicRoute(req.nextUrl.pathname)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit (Upstash Redis)
  const ip = req.ip ?? '127.0.0.1';
  const { success } = await ratelimit.limit(ip);
  if (!success) return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });

  // Add tracing header
  const requestId = crypto.randomUUID();
  const res = NextResponse.next();
  res.headers.set('x-request-id', requestId);
  return res;
}
\`\`\``,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ENTERPRISE SECURITY
  // ─────────────────────────────────────────────────────────────────────────
  {
    cat: "Enterprise Security",
    name: "SOC 2 Type II Compliance Checklist",
    content: `## SOC 2 Type II — Engineering Checklist

### Trust Service Criteria (TSC) implemented in code

**CC6 — Logical & Physical Access Controls**
- [ ] MFA enforced for all admin accounts
- [ ] RBAC implemented (least privilege principle)
- [ ] User access reviewed quarterly (automated report)
- [ ] Privileged access logged and alerted
- [ ] Session timeout: 15 min idle for sensitive operations
- [ ] Offboarding procedure: revoke access within 24h

**CC7 — System Operations**
- [ ] Change management: PRs required, no direct prod deploys
- [ ] Vulnerability scanning in CI (Snyk, Dependabot)
- [ ] Incident response runbook documented
- [ ] Anomaly detection alerting configured
- [ ] Log retention: 90 days minimum, 365 days for audit logs

**CC8 — Change Management**
- [ ] All prod deployments via CI/CD (no manual SSH)
- [ ] Infrastructure as code (Terraform/Pulumi)
- [ ] Feature flags for rollback capability
- [ ] Staging environment mirrors production

**A1 — Availability**
- [ ] Uptime SLA documented (99.9% = 8.7h/year downtime budget)
- [ ] Disaster recovery plan tested annually
- [ ] Database backups: daily + PITR, tested monthly
- [ ] Incident communication page (statuspage.io)

**C1 — Confidentiality**
- [ ] Data classification policy (public/internal/confidential/restricted)
- [ ] Encryption at rest (AES-256) and in transit (TLS 1.3)
- [ ] PII fields encrypted at application layer for restricted data
- [ ] Data retention and deletion policy implemented`,
  },
  {
    cat: "Enterprise Security",
    name: "Zero Trust Architecture Implementation",
    content: `## Zero Trust — Never Trust, Always Verify

### Core principles
1. **Verify explicitly** — authenticate and authorise every request
2. **Least privilege** — minimum permissions needed, time-bound where possible
3. **Assume breach** — segment network, encrypt internal traffic, monitor everything

### Implementation layers

**Identity (verify who)**
\`\`\`typescript
// Every API call validates JWT with JWKS verification
async function verifyToken(token: string): Promise<JWTPayload> {
  const JWKS = createRemoteJWKSet(new URL(process.env.AUTH_JWKS_URL!));
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: process.env.AUTH_ISSUER,
    audience: process.env.AUTH_AUDIENCE,
  });
  return payload;
}
\`\`\`

**Device/context (verify where from)**
- Check IP reputation (AbuseIPDB integration)
- Detect impossible travel (login from NYC, then London 10min later)
- Device fingerprinting for sensitive operations

**Network (segment access)**
- Service mesh with mutual TLS (mTLS) between internal services
- No direct database access from internet
- VPC private subnets for databases and workers

**Data (protect the asset)**
\`\`\`typescript
// Field-level encryption for PII
const encryptedSSN = await encrypt(ssn, { key: KMS_KEY_ID, context: { userId } });
// Stored encrypted, decrypted only when needed with audit log entry
\`\`\`

**Monitoring (detect anomalies)**
- Baseline normal behaviour, alert on deviation
- >5 failed auth attempts → lock + notify
- Unusual data export volume → alert security team`,
  },
  {
    cat: "Enterprise Security",
    name: "OWASP Top 10 — Code-Level Mitigations",
    content: `## OWASP Top 10 (2021) — Engineering Mitigations

### A01: Broken Access Control
\`\`\`typescript
// BAD — trusts user-supplied ID
const order = await db.query.orders.findFirst({ where: eq(orders.id, input.orderId) });

// GOOD — scope to authenticated user
const order = await db.query.orders.findFirst({
  where: and(eq(orders.id, input.orderId), eq(orders.userId, ctx.user.id))
});
\`\`\`

### A02: Cryptographic Failures
- Never store passwords in plaintext or MD5/SHA1 — use bcrypt/Argon2 (cost factor 12+)
- TLS 1.3 only. Disable TLS 1.0/1.1. HSTS header with 1yr max-age.
- Secrets in env vars only — never in code, never in logs

### A03: Injection
\`\`\`typescript
// SQL injection impossible with Drizzle ORM parameterised queries
const users = await db.select().from(users).where(eq(users.email, input.email));

// XSS — sanitise if rendering user HTML
import DOMPurify from 'dompurify';
const safe = DOMPurify.sanitize(userHtml, { ALLOWED_TAGS: ['b', 'i', 'p'] });
\`\`\`

### A05: Security Misconfiguration
\`\`\`typescript
// Security headers via Next.js config
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'nonce-{NONCE}'" },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];
\`\`\`

### A07: Auth & Session Failures
- Session tokens: 32+ bytes random, rotated on privilege escalation
- Short-lived JWTs (15min) + refresh tokens (30 days, single use)
- Re-authenticate for sensitive actions (password change, payment)`,
  },
  {
    cat: "Enterprise Security",
    name: "HIPAA Technical Safeguards for Healthcare Apps",
    content: `## HIPAA Technical Safeguards — Engineering Requirements

### PHI definition (must protect ALL of these)
Names, dates (DOB, admission), phone, fax, email, SSN, MRN, account numbers, certificate numbers, VINs, URLs, IPs, biometric IDs, full-face photos, any unique identifier.

### Required technical safeguards

**Access Control (§164.312(a)(1))**
\`\`\`typescript
// Unique user IDs — no shared accounts
// Automatic logoff — 15 min idle
// Encryption/decryption of ePHI
const encryptedData = await kms.encrypt({
  KeyId: process.env.KMS_KEY_ID_PHI,
  Plaintext: Buffer.from(JSON.stringify(phi)),
  EncryptionContext: { patientId, purpose: 'storage' }
});
\`\`\`

**Audit Controls (§164.312(b))**
\`\`\`typescript
// Log every access to PHI
await auditLog.record({
  action: 'PHI_READ',
  userId: ctx.user.id,
  resourceType: 'patient_record',
  resourceId: patientId,
  timestamp: new Date(),
  ip: ctx.ip,
  outcome: 'success',
});
\`\`\`

**Integrity (§164.312(c)(1))**
- Checksums on stored PHI records
- Write-once audit logs (append only, no updates/deletes)
- Digital signatures for exchanged PHI

**Transmission Security (§164.312(e)(1))**
- TLS 1.3 for all transmissions
- No PHI in URLs or query strings (use POST body)
- No PHI in logs, error messages, or analytics events

### Business Associate Agreements (BAA)
Required with: AWS, Google Cloud, Vercel Enterprise, Twilio, SendGrid/Resend, any vendor touching PHI.`,
  },
  {
    cat: "Enterprise Security",
    name: "GDPR Engineering Checklist",
    content: `## GDPR Technical Compliance — Engineering Checklist

### Lawful basis implementation
\`\`\`typescript
// Record consent at collection time
await db.insert(consentRecords).values({
  userId, purpose: 'marketing_email',
  consentText: 'I agree to receive marketing emails',
  collectedAt: new Date(), collectedFrom: 'signup_form_v3',
  ip: ctx.ip, userAgent: ctx.userAgent,
});
\`\`\`

### Data subject rights (must implement all)

**Right to Access (Art. 15)** — export all personal data within 30 days
\`\`\`typescript
router.exportMyData = protectedProcedure.mutation(async ({ ctx }) => {
  const [user, orders, sessions, auditLogs] = await Promise.all([
    db.select().from(users).where(eq(users.id, ctx.user.id)),
    db.select().from(orders).where(eq(orders.userId, ctx.user.id)),
    db.select().from(sessions).where(eq(sessions.userId, ctx.user.id)),
    db.select().from(auditLog).where(eq(auditLog.userId, ctx.user.id)),
  ]);
  // Return JSON export download
});
\`\`\`

**Right to Erasure (Art. 17)** — delete or anonymise within 30 days
\`\`\`typescript
async function deleteUserData(userId: string) {
  await db.update(users).set({
    email: \`deleted_\${userId}@deleted.invalid\`,
    name: 'Deleted User', phone: null, deletedAt: new Date(),
  }).where(eq(users.id, userId));
  // Keep orders with anonymised user reference for accounting
  await db.update(orders).set({ userId: 'ANONYMISED' }).where(eq(orders.userId, userId));
}
\`\`\`

**Data Minimisation** — only collect what you need. Audit field usage quarterly.

**Privacy by Default** — opt-out of analytics, not opt-in.

**Breach Notification** — 72h window to notify supervisory authority.`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BACKEND EXCELLENCE
  // ─────────────────────────────────────────────────────────────────────────
  {
    cat: "Backend Performance",
    name: "Node.js Production Performance Tuning",
    content: `## Node.js — Production Performance Checklist

### Event loop — keep it free
\`\`\`typescript
// BAD — blocks event loop with CPU-intensive work
app.get('/hash', (req, res) => {
  const hash = expensiveHashFunction(req.body.data); // blocks for 200ms
  res.json({ hash });
});

// GOOD — offload to worker thread
import { Worker, isMainThread, parentPort } from 'worker_threads';
// Or use job queue (BullMQ) for background processing
await hashQueue.add('compute', { data: req.body.data });
\`\`\`

### Memory management
\`\`\`
node --max-old-space-size=4096  # Set heap limit explicitly
node --expose-gc                # Allow manual GC for debugging
\`\`\`
- Use streams for large data — never buffer entire file in memory
- WeakMap/WeakRef for caches tied to object lifetime
- Profile with \`clinic.js\` or Chrome DevTools (--inspect)

### Clustering (utilise all CPU cores)
\`\`\`typescript
import cluster from 'cluster';
import os from 'os';

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  for (let i = 0; i < numCPUs; i++) cluster.fork();
  cluster.on('exit', () => cluster.fork()); // Auto-restart dead workers
} else {
  startServer();
}
// On Vercel/Lambda — handled by platform, don't cluster
\`\`\`

### Connection pooling
\`\`\`typescript
// Postgres — pool per lambda instance
const client = postgres(DATABASE_URL, {
  max: 10,           // max connections per pool
  idle_timeout: 30,  // close idle after 30s
  connect_timeout: 10,
});
// PgBouncer or Neon connection pooling for serverless
\`\`\`

### Key metrics to watch
- Event loop lag (> 100ms = problem): \`perf_hooks.monitorEventLoopDelay()\`
- Heap usage > 80% of max = memory leak
- GC pause > 50ms = too much allocation`,
  },
  {
    cat: "Backend Performance",
    name: "PostgreSQL Query Optimisation Playbook",
    content: `## PostgreSQL — Query Optimisation Playbook

### Step 1: Find slow queries
\`\`\`sql
-- Enable pg_stat_statements
CREATE EXTENSION pg_stat_statements;

-- Top 10 slowest queries
SELECT query, calls, total_exec_time/calls AS avg_ms, rows/calls AS avg_rows
FROM pg_stat_statements
ORDER BY avg_ms DESC LIMIT 10;
\`\`\`

### Step 2: EXPLAIN ANALYZE
\`\`\`sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM orders WHERE user_id = 'abc' AND status = 'pending';
-- Look for: Seq Scan (bad on large tables), high cost nodes, nested loops on big sets
\`\`\`

### Step 3: Index strategy
\`\`\`sql
-- Composite index — order matters (most selective first, OR match query order)
CREATE INDEX CONCURRENTLY idx_orders_user_status
ON orders(user_id, status) WHERE status != 'archived';

-- Partial index (only index what you query)
CREATE INDEX CONCURRENTLY idx_orders_pending
ON orders(created_at) WHERE status = 'pending';

-- GIN index for JSONB
CREATE INDEX idx_leads_profile ON leads USING GIN(business_profile);

-- Full text search
CREATE INDEX idx_clients_search ON clients USING GIN(to_tsvector('english', name || ' ' || email));
\`\`\`

### Step 4: Query patterns
\`\`\`sql
-- Use covering index to avoid table lookup
CREATE INDEX idx_users_email_name ON users(email) INCLUDE (id, name, role);

-- Pagination: keyset > OFFSET for large tables
-- BAD: OFFSET 10000 LIMIT 20 (scans 10020 rows)
-- GOOD:
SELECT * FROM orders WHERE (created_at, id) < ($lastDate, $lastId)
ORDER BY created_at DESC, id DESC LIMIT 20;
\`\`\`

### N+1 detection
\`\`\`typescript
// Log query count per request in dev
// Drizzle: use .with() for eager loading
const usersWithOrders = await db.query.users.findMany({
  with: { orders: { limit: 5 } }  // Single query with JOIN
});
\`\`\``,
  },
  {
    cat: "Backend Performance",
    name: "Redis Caching Patterns",
    content: `## Redis Caching — Production Patterns

### Cache-aside (most common)
\`\`\`typescript
async function getUser(userId: string) {
  const cacheKey = \`user:\${userId}\`;

  // 1. Check cache
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // 2. Cache miss — fetch from DB
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return null;

  // 3. Populate cache with TTL
  await redis.setex(cacheKey, 300, JSON.stringify(user)); // 5 min TTL
  return user;
}

// Invalidate on update
async function updateUser(userId: string, data: Partial<User>) {
  await db.update(users).set(data).where(eq(users.id, userId));
  await redis.del(\`user:\${userId}\`);  // Invalidate
}
\`\`\`

### Write-through (keep cache warm)
\`\`\`typescript
async function updateUser(userId: string, data: Partial<User>) {
  const [updated] = await db.update(users).set(data).where(eq(users.id, userId)).returning();
  await redis.setex(\`user:\${userId}\`, 300, JSON.stringify(updated)); // Update cache too
  return updated;
}
\`\`\`

### Patterns by use case
| Pattern | Use case | TTL |
|---------|----------|-----|
| Cache-aside | General queries | 5-15 min |
| Write-through | High read:write ratio | Invalidate on write |
| Read-through | Transparent caching | Library-managed |
| Pub/Sub | Real-time events | N/A |
| Leaderboard | Sorted sets | Continuous update |
| Rate limiting | Per-IP counters | Sliding window |
| Session store | Auth sessions | 30 days |

### Cache stampede prevention
\`\`\`typescript
// Probabilistic early expiration OR mutex lock
const lock = await redis.set(\`lock:\${key}\`, '1', { nx: true, ex: 10 });
if (!lock) return getCachedOrWait(key); // Another process is refreshing
try {
  const fresh = await fetchFromDB();
  await redis.setex(key, 300, JSON.stringify(fresh));
  return fresh;
} finally {
  await redis.del(\`lock:\${key}\`);
}
\`\`\``,
  },
  {
    cat: "API Design",
    name: "REST API Design Standards",
    content: `## REST API Design — Enterprise Standards

### Resource naming
\`\`\`
GET    /orders              → list orders
POST   /orders              → create order
GET    /orders/:id          → get order
PATCH  /orders/:id          → partial update
DELETE /orders/:id          → delete
GET    /orders/:id/items    → nested resource
POST   /orders/:id/cancel   → action (verb when needed)
\`\`\`

### Response envelope
\`\`\`json
{
  "data": { ... },
  "meta": { "page": 1, "perPage": 20, "total": 847, "cursor": "abc" },
  "error": null
}
\`\`\`

### Error format (RFC 7807 Problem Details)
\`\`\`json
{
  "type": "https://api.nexoflow.com/errors/validation-failed",
  "title": "Validation Failed",
  "status": 422,
  "detail": "The 'email' field is not a valid email address.",
  "instance": "/orders/create",
  "errors": [{ "field": "email", "code": "invalid_format", "message": "..." }]
}
\`\`\`

### Versioning
\`\`\`
/api/v1/orders    ← URL versioning (most common, explicit)
Accept: application/vnd.nexoflow.v2+json  ← Header versioning (cleaner, harder for clients)
\`\`\`

### Pagination
\`\`\`typescript
// Cursor pagination (performant for large datasets)
router.listOrders = protectedProcedure
  .input(z.object({ cursor: z.string().optional(), limit: z.number().max(100).default(20) }))
  .query(async ({ ctx, input }) => {
    const items = await db.select().from(orders)
      .where(input.cursor ? lt(orders.id, input.cursor) : undefined)
      .orderBy(desc(orders.createdAt)).limit(input.limit + 1);
    const hasMore = items.length > input.limit;
    return { items: items.slice(0, input.limit), nextCursor: hasMore ? items[input.limit - 1]!.id : null };
  });
\`\`\`

### Rate limit headers
\`\`\`
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1716393600
Retry-After: 30  (on 429)
\`\`\``,
  },
  {
    cat: "API Design",
    name: "gRPC vs REST vs GraphQL Decision Matrix",
    content: `## gRPC vs REST vs GraphQL — Choose the Right Protocol

### Decision matrix
| Criterion | REST | GraphQL | gRPC |
|-----------|------|---------|------|
| Browser support | Native | Native (via HTTP) | Needs grpc-web |
| Mobile support | Excellent | Good | Good |
| Internal service comms | Good | Overkill | Excellent |
| Flexible queries | No | Yes | No |
| Schema/contract | OpenAPI | SDL | Proto |
| Streaming | SSE/WS | Subscriptions | Native (4 modes) |
| Performance | Good | Good | Excellent (binary) |
| Tooling | Best | Excellent | Good |
| Learning curve | Low | Medium | Medium |

### Use cases
**REST**: Public APIs, browser-first apps, mobile apps, partner integrations
**GraphQL**: Product APIs with many clients needing different shapes, BFF layer, rapid iteration
**gRPC**: Internal service-to-service, high-throughput, polyglot microservices, streaming data

### gRPC in Node.js (NexoFlow recommendation for internal services)
\`\`\`proto
// orders.proto
service OrderService {
  rpc CreateOrder (CreateOrderRequest) returns (Order);
  rpc StreamOrders (StreamRequest) returns (stream Order);  // server streaming
}
\`\`\`
\`\`\`typescript
// 60-80% smaller payload vs JSON, 7-10x faster serialisation
// Use @grpc/grpc-js + @grpc/proto-loader
\`\`\`

### tRPC (NexoFlow default)
tRPC gives end-to-end TypeScript type safety with RPC semantics over HTTP, without the proto ceremony. Best for monorepo Next.js apps where client and server share types.`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FRONTEND EXCELLENCE
  // ─────────────────────────────────────────────────────────────────────────
  {
    cat: "Frontend Performance",
    name: "Core Web Vitals — Engineering Fixes",
    content: `## Core Web Vitals — Engineering Fixes

### LCP (Largest Contentful Paint) — target < 2.5s
The largest image or text block visible in viewport.

**Fix 1: Preload hero image**
\`\`\`html
<link rel="preload" fetchpriority="high" as="image" href="/hero.webp" />
\`\`\`

**Fix 2: Next.js Image with priority**
\`\`\`tsx
<Image src="/hero.webp" priority fill sizes="100vw" alt="Hero" />
\`\`\`

**Fix 3: Reduce server response time (TTFB)**
- Use ISR (revalidate: 60) for marketing pages instead of SSR
- Add CDN caching headers: \`Cache-Control: public, max-age=31536000, immutable\`

### INP (Interaction to Next Paint) — target < 200ms
Measures responsiveness to all user interactions.

**Fix: Avoid long tasks**
\`\`\`typescript
// Break long JS tasks with scheduler
async function processLargeList(items: Item[]) {
  const CHUNK_SIZE = 50;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    processChunk(items.slice(i, i + CHUNK_SIZE));
    await scheduler.yield(); // Yield to browser between chunks
  }
}
\`\`\`

**Fix: Defer non-critical JS**
\`\`\`tsx
import dynamic from 'next/dynamic';
const HeavyChart = dynamic(() => import('./HeavyChart'), { ssr: false, loading: () => <ChartSkeleton /> });
\`\`\`

### CLS (Cumulative Layout Shift) — target < 0.1
Unexpected layout shifts during page load.

**Fix: Reserve space for async content**
\`\`\`css
.avatar { width: 40px; height: 40px; } /* Always set explicit dimensions */
.ad-slot { min-height: 250px; }         /* Reserve ad space before load */
\`\`\`

**Fix: font-display: optional** for web fonts to prevent FOUT shift.`,
  },
  {
    cat: "Frontend Performance",
    name: "Next.js 16 Optimisation Patterns",
    content: `## Next.js 16 — Advanced Optimisation Patterns

### Rendering strategy decision tree
\`\`\`
Is data the same for all users?
  └─ Yes → Static (generateStaticParams) or ISR (revalidate)
Is data personalised per user?
  └─ Yes → Server Component with auth check
  └─ Data changes every request? → dynamic = 'force-dynamic'
  └─ Data stale ok for Xmin? → revalidate: X
Is interactivity required?
  └─ Yes → Client Component ('use client')
  └─ Minimal interaction? → Server Component + Server Action
\`\`\`

### Parallel data fetching in Server Components
\`\`\`tsx
// BAD: Waterfall (total: 900ms)
const user = await getUser(id);           // 300ms
const orders = await getOrders(id);       // 300ms
const analytics = await getAnalytics(id); // 300ms

// GOOD: Parallel (total: ~300ms)
const [user, orders, analytics] = await Promise.all([
  getUser(id), getOrders(id), getAnalytics(id)
]);
\`\`\`

### Partial Prerendering (PPR) — Next.js 15+
\`\`\`tsx
// Static shell renders instantly, dynamic parts stream in
export const experimental_ppr = true;

export default function Dashboard() {
  return (
    <StaticShell>  {/* Pre-rendered at build time */}
      <Suspense fallback={<MetricsSkeleton />}>
        <DynamicMetrics />  {/* Streams in after hydration */}
      </Suspense>
    </StaticShell>
  );
}
\`\`\`

### Bundle optimisation
\`\`\`typescript
// next.config.ts
export default {
  experimental: { optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'] },
  // Analyse bundle
  bundleAnalyzer: { enabled: process.env.ANALYZE === 'true' },
};
\`\`\`

### Image optimisation
\`\`\`tsx
// Always use Next.js Image — automatic WebP, responsive sizes, lazy loading
<Image src={url} width={800} height={400}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px"
  quality={75} placeholder="blur" blurDataURL={blurUrl}
/>
\`\`\``,
  },
  {
    cat: "Frontend Architecture",
    name: "Component Architecture — Enterprise Scale",
    content: `## Component Architecture at Enterprise Scale

### Atomic Design adapted for Next.js
\`\`\`
src/components/
├── ui/              # Atoms: Button, Input, Badge, Avatar (shadcn/ui)
├── patterns/        # Molecules: SearchBar, DataTable, FormField
├── features/        # Organisms: LeadCard, InvoiceForm, ProjectBoard
├── layouts/         # Templates: DashboardLayout, PublicLayout
└── pages/           # (App Router: src/app/**/page.tsx)
\`\`\`

### Server vs Client component split
\`\`\`tsx
// Server Component (default) — data fetching, no interactivity
// LeadDetail.tsx
export default async function LeadDetail({ id }: { id: string }) {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, id) });
  return (
    <div>
      <LeadHeader lead={lead} />    {/* Server: static display */}
      <LeadActions leadId={id} />   {/* Client: needs onClick */}
    </div>
  );
}

// Client Component — interaction only
// 'use client' at the top, no async data fetching
\`\`\`

### State management decision
| Scenario | Solution |
|----------|----------|
| Server data (API) | TanStack Query (caching, refetch, optimistic) |
| Local UI state | useState / useReducer |
| Cross-component UI | Zustand (lightweight store) |
| URL state | useSearchParams (shareable, bookmarkable) |
| Form state | React Hook Form + Zod |
| Global auth | React Context (session) |

### Performance rules
1. Default to Server Components — zero client JS
2. Split client boundary as low as possible
3. Memoize expensive pure computations (\`useMemo\`, \`React.memo\`)
4. Virtualise lists > 100 rows (TanStack Virtual)
5. Defer non-critical components with dynamic import + Suspense`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MOBILE DEVELOPMENT
  // ─────────────────────────────────────────────────────────────────────────
  {
    cat: "Mobile Development",
    name: "React Native Enterprise Architecture",
    content: `## React Native — Enterprise Architecture (2025)

### Stack (NexoFlow default)
\`\`\`
Framework:     Expo SDK 53 + Expo Router v4
State:         Zustand (local) + TanStack Query v5 (server)
Navigation:    Expo Router (file-based, like Next.js)
Styling:       NativeWind v4 (Tailwind for RN)
API:           tRPC client (shared types with Next.js backend)
Storage:       MMKV (sync, 10x faster than AsyncStorage)
Auth:          Expo AuthSession + SecureStore (biometrics)
Push:          Expo Notifications + FCM
OTA updates:   Expo Updates (hotfix without App Store review)
Build/CI:      EAS Build + EAS Submit
Crash reports: Sentry (RN SDK)
\`\`\`

### Project structure
\`\`\`
app/
├── (auth)/           # Public screens (login, onboarding)
│   ├── sign-in.tsx
│   └── _layout.tsx
├── (app)/            # Protected screens
│   ├── _layout.tsx   # Tab navigator
│   ├── index.tsx     # Home
│   ├── orders/
│   │   ├── index.tsx
│   │   └── [id].tsx
│   └── profile/
└── _layout.tsx       # Root layout with providers
components/
lib/
  ├── api.ts          # tRPC client
  ├── store.ts        # Zustand store
  └── storage.ts      # MMKV wrapper
\`\`\`

### Performance rules
1. \`FlatList\` not \`ScrollView\` for any list > 10 items
2. \`useCallback\` on ALL functions passed to list \`renderItem\`
3. \`React.memo\` on list item components
4. \`InteractionManager.runAfterInteractions\` for heavy work after navigation
5. Avoid \`{}}\` style objects inline — use \`StyleSheet.create\` or NativeWind classes
6. Image caching: \`expo-image\` not \`Image\` from RN core`,
  },
  {
    cat: "Mobile Development",
    name: "Offline-First Mobile Architecture",
    content: `## Offline-First Mobile — Architecture & Implementation

### Why offline-first
- Mobile networks are unreliable (tunnels, elevators, rural areas)
- Users expect instant response regardless of connectivity
- Sync conflict resolution is the hard part

### Layers

**1. Local storage (MMKV for speed)**
\`\`\`typescript
import { MMKV } from 'react-native-mmkv';
const storage = new MMKV({ id: 'app-storage', encryptionKey: secureKey });

// 1000x faster than AsyncStorage, sync API
storage.set('user.profile', JSON.stringify(user));
const cached = storage.getString('user.profile');
\`\`\`

**2. Optimistic updates (TanStack Query)**
\`\`\`typescript
const createOrder = useMutation({
  mutationFn: api.orders.create.mutate,
  onMutate: async (newOrder) => {
    await queryClient.cancelQueries({ queryKey: ['orders'] });
    const previous = queryClient.getQueryData(['orders']);
    // Immediately update UI
    queryClient.setQueryData(['orders'], (old) => [...(old ?? []), { ...newOrder, id: 'temp', syncing: true }]);
    return { previous };
  },
  onError: (err, newOrder, context) => {
    queryClient.setQueryData(['orders'], context!.previous); // Roll back
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
});
\`\`\`

**3. Sync queue (operations while offline)**
\`\`\`typescript
// Queue mutations when offline, drain when reconnected
const syncQueue = MMKV.getString('sync.queue');
NetInfo.addEventListener(state => {
  if (state.isConnected) drainSyncQueue();
});
\`\`\`

**4. Conflict resolution strategies**
- Last-write-wins (simple, loses data)
- Server-wins (safe default for most apps)
- Merge (complex, use for collaborative docs)
- Operational Transformation (Google Docs-style, very complex)`,
  },
  {
    cat: "Mobile Development",
    name: "App Store Submission Checklist",
    content: `## App Store & Google Play — Submission Checklist

### iOS App Store (Apple)
**Build requirements**
- [ ] EAS Build with production profile (\`eas build --platform ios --profile production\`)
- [ ] Code signed with Distribution certificate + App Store provisioning profile
- [ ] App notarised (automatic with EAS)
- [ ] Minimum iOS version set (iOS 16+ recommended, 15+ for broader reach)

**Assets**
- [ ] App icon: 1024×1024 PNG (no alpha, no rounded corners — Apple applies mask)
- [ ] Screenshots: all 4 required sizes (6.9", 6.5", 5.5", iPad 12.9")
- [ ] Preview video: optional but increases conversion

**Compliance**
- [ ] Privacy Nutrition Labels filled in App Store Connect
- [ ] NSPermission strings for all permissions (camera, location, notifications)
- [ ] No private API usage (\`ipa-guard\` scan)
- [ ] No crashes on launch (TestFlight beta required)
- [ ] App Review Guidelines 2.x compliance (no web-view shells)

### Google Play
- [ ] AAB (not APK) uploaded
- [ ] Target API Level 34+ (required for new apps)
- [ ] 64-bit support (required)
- [ ] Data Safety section completed
- [ ] Content rating questionnaire completed

### Both stores
- [ ] Privacy policy URL live
- [ ] Terms of service URL live
- [ ] Support email address
- [ ] Tested on real devices (not just simulator)
- [ ] Crash-free rate > 99% on TestFlight/internal test

### EAS Submit
\`\`\`bash
eas submit --platform ios --latest
eas submit --platform android --latest
\`\`\``,
  },
  {
    cat: "Mobile Development",
    name: "Push Notifications — Production Setup",
    content: `## Push Notifications — Expo + FCM Production Setup

### Architecture
\`\`\`
App (register) → Expo Push Token → Backend DB
Backend → Expo Push API → FCM/APNs → Device
\`\`\`

### 1. Register device token
\`\`\`typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

async function registerForPush() {
  if (!Device.isDevice) return; // Simulator can't receive push

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const token = (await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig!.extra!.eas.projectId,
  })).data;

  // Save token to backend
  await api.users.updatePushToken.mutate({ token });
  return token;
}
\`\`\`

### 2. Send from backend
\`\`\`typescript
import Expo, { ExpoPushMessage } from 'expo-server-sdk';
const expo = new Expo();

async function sendPush(tokens: string[], title: string, body: string, data?: object) {
  const messages: ExpoPushMessage[] = tokens
    .filter(t => Expo.isExpoPushToken(t))
    .map(token => ({ to: token, sound: 'default', title, body, data }));

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    // Check tickets for errors, remove invalid tokens
  }
}
\`\`\`

### 3. Handle foreground/background
\`\`\`typescript
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
\`\`\``,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SAAS ARCHITECTURE
  // ─────────────────────────────────────────────────────────────────────────
  {
    cat: "SaaS Architecture",
    name: "Multi-Tenancy Patterns",
    content: `## Multi-Tenancy — Three Patterns

### Pattern 1: Row-level (shared DB, shared schema)
\`\`\`sql
-- Every table has tenant_id column
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  ...
);
CREATE INDEX idx_projects_tenant ON projects(tenant_id);
-- Row Level Security (PostgreSQL)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON projects
  USING (tenant_id = current_setting('app.current_tenant')::UUID);
\`\`\`
**Pros**: Simple, cost-effective, easy to scale
**Cons**: Data leakage risk if RLS misconfigured, noisy neighbour

### Pattern 2: Schema-per-tenant
\`\`\`sql
CREATE SCHEMA tenant_abc;
CREATE TABLE tenant_abc.projects (...); -- Isolated
SET search_path = tenant_abc;
\`\`\`
**Pros**: Strong isolation, easy tenant offboarding
**Cons**: Schema management complexity, migration overhead

### Pattern 3: DB-per-tenant (enterprise)
Each tenant gets a separate Neon branch or RDS instance.
**Pros**: Complete isolation, compliance-friendly, custom SLAs
**Cons**: Expensive, complex infrastructure

### NexoFlow recommendation
- Startup → Row-level with RLS (Neon Postgres)
- Mid-market → Row-level with strict application-layer checks
- Enterprise → Schema-per-tenant or DB-per-tenant for largest accounts

### Critical: Tenant context in every query
\`\`\`typescript
// tRPC middleware — inject tenant context
const tenantMiddleware = t.middleware(async ({ ctx, next }) => {
  const tenantId = ctx.user?.tenantId;
  if (!tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, tenantId } });
});
// Every protected procedure uses tenantMiddleware
// Every query filters by ctx.tenantId — never trust client input
\`\`\``,
  },
  {
    cat: "SaaS Architecture",
    name: "Stripe Billing — Complete Implementation",
    content: `## Stripe Billing — Production Implementation

### Subscription lifecycle
\`\`\`
Checkout → subscription.created → active
→ invoice.payment_succeeded (monthly) → subscription continues
→ invoice.payment_failed → past_due (3 retries) → canceled
→ customer.subscription.deleted → access revoked
\`\`\`

### Webhook handler (most important file in a SaaS)
\`\`\`typescript
export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')!;
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch { return new Response('Invalid signature', { status: 400 }); }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await syncSubscription(event.data.object as Stripe.Subscription); break;
    case 'customer.subscription.deleted':
      await revokeAccess(event.data.object as Stripe.Subscription); break;
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice); break;
  }
  return new Response('ok');
}

async function syncSubscription(sub: Stripe.Subscription) {
  await db.update(tenants).set({
    stripeSubscriptionId: sub.id,
    stripeStatus: sub.status,
    stripePriceId: sub.items.data[0]!.price.id,
    planName: getPlanFromPriceId(sub.items.data[0]!.price.id),
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
  }).where(eq(tenants.stripeCustomerId, sub.customer as string));
}
\`\`\`

### Feature gating
\`\`\`typescript
function canUseFeature(tenant: Tenant, feature: string): boolean {
  const limits: Record<string, Record<string, number | boolean>> = {
    starter: { leads: 100, aiInsights: false, customDomain: false },
    pro: { leads: 1000, aiInsights: true, customDomain: false },
    enterprise: { leads: Infinity, aiInsights: true, customDomain: true },
  };
  return !!limits[tenant.planName]?.[feature];
}
\`\`\``,
  },
  {
    cat: "SaaS Architecture",
    name: "Feature Flags — LaunchDarkly & Homegrown",
    content: `## Feature Flags — Production Patterns

### Why feature flags
- Ship dark (deploy without activating)
- Gradual rollout (1% → 10% → 100%)
- Kill switch for incidents
- A/B testing
- Tenant-specific beta access

### Homegrown (Upstash Redis — NexoFlow lightweight approach)
\`\`\`typescript
// lib/flags.ts
const FLAGS_KEY = 'feature_flags';

type Flag = {
  enabled: boolean;
  rolloutPct?: number;       // 0-100
  allowedTenants?: string[]; // Tenant IDs for early access
  allowedEmails?: string[];  // User emails for internal testing
};

export async function isEnabled(flag: string, ctx: { userId?: string; tenantId?: string }): Promise<boolean> {
  const flags = await redis.hgetall(FLAGS_KEY);
  const config: Flag = flags[flag] ? JSON.parse(flags[flag]) : { enabled: false };

  if (!config.enabled) return false;
  if (ctx.tenantId && config.allowedTenants?.includes(ctx.tenantId)) return true;
  if (ctx.userId && config.allowedEmails?.includes(ctx.userId)) return true;
  if (config.rolloutPct !== undefined) {
    const bucket = hash(ctx.userId ?? 'anonymous') % 100;
    return bucket < config.rolloutPct;
  }
  return true;
}
\`\`\`

### In Server Components
\`\`\`tsx
export default async function Dashboard() {
  const user = await getCurrentUser();
  const showNewChart = await isEnabled('new_revenue_chart', { userId: user.id, tenantId: user.tenantId });
  return showNewChart ? <NewRevenueChart /> : <LegacyRevenueChart />;
}
\`\`\`

### LaunchDarkly (for serious A/B testing)
Use when: complex targeting rules, experiment tracking, SDK for mobile + web + server all needed.`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DEVOPS & INFRASTRUCTURE
  // ─────────────────────────────────────────────────────────────────────────
  {
    cat: "DevOps Practices",
    name: "CI/CD Pipeline — Enterprise Setup",
    content: `## CI/CD Pipeline — Enterprise GitHub Actions

\`\`\`yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint          # ESLint
      - run: pnpm typecheck     # tsc --noEmit
      - run: pnpm test:unit     # Vitest

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: snyk/actions/node@master  # Vulnerability scan
        env: { SNYK_TOKEN: \${{ secrets.SNYK_TOKEN }} }
      - uses: gitleaks/gitleaks-action@v2  # Secret leak detection

  preview:
    needs: quality
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx vercel deploy --token \${{ secrets.VERCEL_TOKEN }}
        env: { VERCEL_ORG_ID: ..., VERCEL_PROJECT_ID: ... }

  deploy:
    needs: [quality, security]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production  # Requires manual approval in GitHub
    steps:
      - uses: actions/checkout@v4
      - run: npx vercel deploy --prod --token \${{ secrets.VERCEL_TOKEN }}
      - name: Notify Slack
        uses: slackapi/slack-github-action@v2
        with:
          payload: '{"text":"✅ Deployed to production: \${{ github.sha }}"}'
        env: { SLACK_WEBHOOK_URL: \${{ secrets.SLACK_DEPLOY_WEBHOOK }} }
\`\`\``,
  },
  {
    cat: "DevOps Practices",
    name: "Infrastructure as Code — Terraform Patterns",
    content: `## Terraform — NexoFlow Infrastructure Patterns

### Project structure
\`\`\`
infra/
├── modules/
│   ├── neon-db/        # Database provisioning
│   ├── vercel-project/ # Vercel project + env vars
│   ├── upstash-redis/  # Redis provisioning
│   └── cloudflare-r2/  # Object storage
├── environments/
│   ├── staging/
│   │   ├── main.tf
│   │   └── terraform.tfvars
│   └── production/
│       ├── main.tf
│       └── terraform.tfvars
├── main.tf
└── variables.tf
\`\`\`

### Neon Postgres module
\`\`\`hcl
module "database" {
  source = "./modules/neon-db"
  project_name = var.project_name
  region       = "aws-us-east-2"

  branches = {
    production = { compute_units_min = 0.25, compute_units_max = 4 }
    staging    = { compute_units_min = 0.25, compute_units_max = 1 }
  }
}

output "database_url" {
  value     = module.database.connection_string
  sensitive = true
}
\`\`\`

### State management
\`\`\`hcl
terraform {
  backend "s3" {
    bucket         = "nexoflow-tf-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "nexoflow-tf-locks"  # Prevent concurrent applies
  }
}
\`\`\`

### Golden rules
1. Never commit \`.tfstate\` to git
2. \`terraform plan\` in CI, \`terraform apply\` with human approval
3. Use \`terraform import\` for existing resources before managing with TF
4. Tag all resources: environment, project, owner, cost-center`,
  },
  {
    cat: "DevOps Practices",
    name: "Docker — Production Best Practices",
    content: `## Docker — Production Best Practices

### Multi-stage build (Next.js)
\`\`\`dockerfile
# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# Stage 3: Production runner (minimal image)
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
\`\`\`

### Security hardening
\`\`\`dockerfile
# Use specific digest, not :latest tag
FROM node:22.3.0-alpine@sha256:abc123...

# Drop all capabilities, add only what's needed
# Run as non-root user (shown above)
# No secrets in Dockerfile (use --secret or env at runtime)
\`\`\`

### Image size checklist
- [ ] Multi-stage build
- [ ] Alpine base image
- [ ] \`.dockerignore\` excludes node_modules, .git, .env files
- [ ] Only production dependencies in final stage
- [ ] Use Next.js standalone output (\`output: 'standalone'\`)

### docker-compose for local development
\`\`\`yaml
services:
  app: { build: '.', ports: ['3000:3000'], env_file: ['.env.local'] }
  db:  { image: 'postgres:16', environment: { POSTGRES_DB: nexoflow }, volumes: ['pgdata:/var/lib/postgresql/data'] }
  redis: { image: 'redis:7-alpine', ports: ['6379:6379'] }
volumes: { pgdata: }
\`\`\``,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // OBSERVABILITY
  // ─────────────────────────────────────────────────────────────────────────
  {
    cat: "Monitoring",
    name: "Observability Three Pillars Implementation",
    content: `## Observability — Logs, Metrics, Traces

### Logs — structured JSON
\`\`\`typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: { level: (label) => ({ level: label }) },
  base: { service: 'nexoflow-api', env: process.env.NODE_ENV },
});

// ALWAYS structured, never string interpolation
logger.info({ userId: ctx.user.id, action: 'order.create', orderId: order.id }, 'Order created');
// BAD:
logger.info('User ' + userId + ' created order ' + orderId); // Unsearchable
\`\`\`

### Metrics — Prometheus + Grafana
\`\`\`typescript
import { register, Counter, Histogram } from 'prom-client';

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'status'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000],
});

const apiErrors = new Counter({
  name: 'api_errors_total',
  help: 'Total API errors',
  labelNames: ['route', 'error_code'],
});

// GET /metrics for Prometheus scrape
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
\`\`\`

### Traces — OpenTelemetry
\`\`\`typescript
import { NodeTracerProvider } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const provider = new NodeTracerProvider();
provider.addSpanProcessor(new BatchSpanProcessor(new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
})));
provider.register();

// In request handlers
const span = tracer.startSpan('db.query.getUser');
span.setAttribute('db.system', 'postgresql');
try { const user = await getUser(id); span.setStatus({ code: SpanStatusCode.OK }); return user; }
catch (e) { span.recordException(e as Error); throw e; }
finally { span.end(); }
\`\`\`

### Alert thresholds
| Metric | Warning | Critical |
|--------|---------|----------|
| p95 API latency | > 500ms | > 2s |
| Error rate | > 1% | > 5% |
| CPU usage | > 70% | > 90% |
| Memory | > 75% | > 90% |`,
  },
  {
    cat: "Monitoring",
    name: "Sentry Error Monitoring — Best Practices",
    content: `## Sentry — Production Error Monitoring

### Next.js setup
\`\`\`typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in prod
  profilesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0, // Always capture replay on error
  integrations: [Sentry.replayIntegration()],
  beforeSend(event) {
    // Scrub PII before sending
    if (event.user?.email) event.user.email = '[scrubbed]';
    return event;
  },
});
\`\`\`

### Enriching errors with context
\`\`\`typescript
// Set user context on auth
Sentry.setUser({ id: user.id, username: user.email });

// Add breadcrumbs for debugging
Sentry.addBreadcrumb({ category: 'navigation', message: 'User visited /checkout', level: 'info' });

// Capture with extra context
try {
  await processPayment(order);
} catch (error) {
  Sentry.withScope(scope => {
    scope.setTag('payment.provider', 'stripe');
    scope.setContext('order', { id: order.id, total: order.total });
    Sentry.captureException(error);
  });
  throw error;
}
\`\`\`

### Alert rules (configure in Sentry)
1. New issue → Slack #engineering immediately
2. Issue regression (was resolved, now occurring again) → PagerDuty
3. Error rate > 10/min → PagerDuty on-call
4. Unhandled promise rejection spike → Slack

### Performance monitoring
\`\`\`typescript
const transaction = Sentry.startInactiveSpan({ name: 'Weekly Report Generation' });
// ...processing...
transaction.end();
\`\`\``,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DATABASE DESIGN
  // ─────────────────────────────────────────────────────────────────────────
  {
    cat: "Database Design",
    name: "Drizzle ORM — Advanced Patterns",
    content: `## Drizzle ORM — Advanced Enterprise Patterns

### Schema design best practices
\`\`\`typescript
import { pgTable, uuid, text, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const projects = pgTable('nf_projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  status: text('status', { enum: ['active', 'archived', 'completed'] }).default('active').notNull(),
  metadata: jsonb('metadata').$type<ProjectMetadata>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => ({
  tenantIdx: index('idx_projects_tenant').on(t.tenantId),
  nameIdx: index('idx_projects_name').on(t.tenantId, t.name),
}));

export const projectRelations = relations(projects, ({ one, many }) => ({
  tenant: one(tenants, { fields: [projects.tenantId], references: [tenants.id] }),
  tasks: many(tasks),
}));
\`\`\`

### Complex queries
\`\`\`typescript
// Subquery
const activeProjects = db
  .select({ id: projects.id })
  .from(projects)
  .where(eq(projects.status, 'active'));

const tasksInActiveProjects = await db
  .select().from(tasks)
  .where(inArray(tasks.projectId, activeProjects));

// Window functions
const rankedLeads = await db.execute(sql\`
  SELECT *, RANK() OVER (PARTITION BY tenant_id ORDER BY ai_score DESC) as rank
  FROM nf_leads WHERE tenant_id = \${tenantId}
\`);

// JSON operations
const leadsWithBrand = await db
  .select()
  .from(leads)
  .where(sql\`business_profile->>'primaryColor' IS NOT NULL\`);
\`\`\`

### Transactions
\`\`\`typescript
const result = await db.transaction(async (tx) => {
  const [project] = await tx.insert(projects).values(projectData).returning();
  await tx.insert(auditLog).values({ action: 'project.create', resourceId: project!.id });
  return project;
});
\`\`\``,
  },
  {
    cat: "Database Design",
    name: "Database Migration Strategy",
    content: `## Database Migrations — Zero-Downtime Patterns

### Golden rule: migrations must be backward compatible

### Unsafe operations (never do on live traffic)
- DROP COLUMN (old code still references it)
- RENAME COLUMN (breaks old queries immediately)
- ADD NOT NULL without DEFAULT (fails on existing rows)
- Change column type (casting may fail)

### Safe patterns

**Add column**
\`\`\`sql
-- Phase 1: Add nullable (no lock, safe immediately)
ALTER TABLE users ADD COLUMN phone_verified BOOLEAN;
-- Phase 2: Backfill
UPDATE users SET phone_verified = false WHERE phone_verified IS NULL;
-- Phase 3 (next deploy): Add NOT NULL + DEFAULT
ALTER TABLE users ALTER COLUMN phone_verified SET NOT NULL;
ALTER TABLE users ALTER COLUMN phone_verified SET DEFAULT false;
\`\`\`

**Rename column** (3-phase)
\`\`\`
Phase 1: Add new column (phone_number), copy data, write to both
Phase 2: Read from new column, write to both (deploy)
Phase 3: Remove old column (next deploy)
\`\`\`

**Expand-contract for type changes**
\`\`\`
Phase 1: Add new column with new type
Phase 2: Write to both, read from old
Phase 3: Backfill new column, read from new
Phase 4: Drop old column
\`\`\`

### Drizzle migrations
\`\`\`bash
npx drizzle-kit generate  # Generate SQL migration files
npx drizzle-kit migrate   # Apply to DB

# Always review generated SQL before applying to production
# Store migrations in git alongside application code
\`\`\`

### Lock-free index creation
\`\`\`sql
-- CONCURRENTLY — no table lock (takes longer but safe on live DB)
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
\`\`\``,
  },
  {
    cat: "Database Design",
    name: "Vector Database & RAG Architecture",
    content: `## Vector Database & RAG — Production Architecture

### Stack (NexoFlow AI default)
\`\`\`
Storage:    Neon Postgres with pgvector extension
Embeddings: Voyage AI voyage-3 (1024 dimensions) or OpenAI text-embedding-3-small
Search:     HNSW index for approximate nearest neighbour
Reranking:  Voyage AI rerank-2 for precision boost
\`\`\`

### Schema
\`\`\`typescript
import { vector } from 'drizzle-orm/pg-core';

export const documents = pgTable('nf_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1024 }),
  metadata: jsonb('metadata').$type<{ source: string; chunkIndex: number }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  embeddingIdx: index('idx_documents_embedding')
    .using('hnsw', t.embedding.op('vector_cosine_ops'))
    .with({ m: 16, ef_construction: 64 }),
}));
\`\`\`

### RAG query pipeline
\`\`\`typescript
async function ragQuery(query: string, tenantId: string, topK = 10) {
  // 1. Embed the query
  const queryEmbedding = await voyageai.embed(query, { model: 'voyage-3' });

  // 2. Vector similarity search
  const candidates = await db.execute(sql\`
    SELECT id, content, metadata,
           1 - (embedding <=> \${JSON.stringify(queryEmbedding)}::vector) AS similarity
    FROM nf_documents
    WHERE tenant_id = \${tenantId} AND embedding IS NOT NULL
    ORDER BY embedding <=> \${JSON.stringify(queryEmbedding)}::vector
    LIMIT \${topK * 3}  -- Get more candidates for reranking
  \`);

  // 3. Rerank for precision
  const reranked = await voyageai.rerank(query, candidates.map(c => c.content), { model: 'rerank-2', topK });

  // 4. Build context for LLM
  return reranked.map((r) => candidates[r.index]!.content).join('\n\n---\n\n');
}
\`\`\`

### Chunking strategy
- 512 tokens per chunk, 50-token overlap
- Split on paragraph boundaries, not mid-sentence
- Include document title in each chunk for context`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // AI & LLM ENGINEERING
  // ─────────────────────────────────────────────────────────────────────────
  {
    cat: "AI Engineering",
    name: "Claude API — Production Patterns",
    content: `## Claude API — Production Patterns (2025)

### Model selection
| Task | Model | Reason |
|------|-------|--------|
| Complex reasoning, architecture | claude-opus-4-7 | Best quality |
| Standard generation, coding | claude-sonnet-4-6 | Best quality/cost |
| Classification, routing, simple | claude-haiku-4-5-20251001 | Fast, cheap |

### Streaming response (tRPC + SSE)
\`\`\`typescript
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic();

// Server-Sent Events from API route
export async function POST(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const apiStream = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: history,
        stream: true,
      });
      for await (const event of apiStream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          controller.enqueue(enc.encode(\`data: \${JSON.stringify({ text: event.delta.text })}\n\n\`));
        }
        if (event.type === 'message_stop') {
          controller.enqueue(enc.encode('data: {"done":true}\n\n'));
        }
      }
      controller.close();
    }
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
}
\`\`\`

### Prompt caching (60-80% cost reduction)
\`\`\`typescript
await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 4096,
  system: [
    { type: 'text', text: LARGE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }
  ],
  messages: [{ role: 'user', content: userMessage }],
});
// Cache hit: 10x cheaper on input tokens
\`\`\`

### Tool use (function calling)
\`\`\`typescript
const tools: Anthropic.Tool[] = [{
  name: 'search_knowledge_base',
  description: 'Search the company knowledge base for relevant snippets',
  input_schema: {
    type: 'object',
    properties: { query: { type: 'string', description: 'Search query' } },
    required: ['query'],
  },
}];
\`\`\``,
  },
  {
    cat: "AI Engineering",
    name: "Prompt Engineering — Enterprise Patterns",
    content: `## Prompt Engineering — Enterprise Patterns

### System prompt structure
\`\`\`
[ROLE & IDENTITY]
You are {specific role} at {company}. {1-2 sentences about what you do.}

[CONTEXT]
{Company overview, relevant knowledge, operating constraints}

[TASK INSTRUCTIONS]
When {trigger}, you will {action}. Always {rule}. Never {anti-rule}.

[OUTPUT FORMAT]
Return {format specification}. No {what to exclude}.

[EXAMPLES]
Input: {example}
Output: {expected output}
\`\`\`

### Chain-of-thought for complex reasoning
\`\`\`
"Think through this step by step before giving your answer.
First, identify the key requirements. Second, consider trade-offs.
Third, give your recommendation with rationale."
\`\`\`

### Output control
\`\`\`
"Return ONLY valid JSON. No markdown, no explanation, no code fences.
If you cannot determine a value, use null.
Example: {"score": 7, "recommendation": "proceed"}"
\`\`\`

### Reliability patterns
1. **Temperature**: 0.0 for deterministic outputs (classification, extraction), 0.7 for creative
2. **max_tokens**: Always set explicitly — never leave unbounded
3. **Retry with exponential backoff**: Anthropic API is 99.9% uptime but add retries for 529/500
4. **Validation**: Parse and validate all JSON outputs with Zod before using
\`\`\`typescript
const result = LLMOutputSchema.safeParse(JSON.parse(response));
if (!result.success) throw new Error(\`Invalid LLM output: \${result.error.message}\`);
\`\`\`

### Cost optimisation
- Cache static system prompts (prompt caching)
- Haiku for classification/routing, Sonnet for generation
- Limit context window — trim old messages aggressively
- Batch requests where real-time not needed (Anthropic Batch API)`,
  },
  {
    cat: "AI Engineering",
    name: "AI Agent Patterns — Autonomous Workflows",
    content: `## AI Agents — Production Patterns

### ReAct pattern (Reason + Act)
\`\`\`
Think → Act → Observe → Think → Act → Observe → ... → Final Answer
\`\`\`
\`\`\`typescript
async function runAgent(goal: string, tools: Tool[], maxSteps = 10) {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: goal }];

  for (let step = 0; step < maxSteps; step++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 4096,
      tools, messages,
    });

    if (response.stop_reason === 'end_turn') return extractFinalAnswer(response);

    if (response.stop_reason === 'tool_use') {
      const toolUse = response.content.find(b => b.type === 'tool_use')!;
      const toolResult = await executeTool(toolUse.name, toolUse.input);

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(toolResult) }] });
    }
  }
  throw new Error('Max steps exceeded');
}
\`\`\`

### Safety guardrails
1. **Max iterations**: Hard cap at 15 steps, log and alert on > 10
2. **Tool whitelisting**: Agents can only call pre-approved tools
3. **Human-in-the-loop**: Pause for confirmation before destructive actions
4. **Sandboxed execution**: Never give agents shell access in production
5. **Output validation**: Validate all agent outputs before acting on them
6. **Audit log**: Log every tool call, input, output, cost

### Cost tracking
\`\`\`typescript
const usage = response.usage;
const cost = (usage.input_tokens * 0.000003) + (usage.output_tokens * 0.000015); // Sonnet pricing
await db.insert(aiUsageLog).values({ agentId, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens, costCents: Math.ceil(cost * 100) });
\`\`\``,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TESTING
  // ─────────────────────────────────────────────────────────────────────────
  {
    cat: "Testing",
    name: "Testing Strategy — The Right Pyramid",
    content: `## Testing Strategy — The Pragmatic Pyramid

### Distribution (for a SaaS product)
\`\`\`
        [E2E: 10%]
          /      \\
    [Integration: 30%]
      /              \\
[Unit Tests: 60%]
\`\`\`

### Unit tests (Vitest — fast, pure logic)
\`\`\`typescript
import { describe, it, expect } from 'vitest';
import { calculateInvoiceTotal } from '@/lib/billing';

describe('calculateInvoiceTotal', () => {
  it('applies tax correctly', () => {
    const result = calculateInvoiceTotal({ subtotal: 10000, taxPct: 20 });
    expect(result).toEqual({ subtotal: 10000, tax: 2000, total: 12000 });
  });
  it('handles zero tax', () => {
    expect(calculateInvoiceTotal({ subtotal: 5000, taxPct: 0 }).total).toBe(5000);
  });
});
\`\`\`

### Integration tests (real DB, real queries)
\`\`\`typescript
// Use test database — never mock Drizzle
beforeEach(() => db.execute(sql\`TRUNCATE users CASCADE\`));

it('creates user and sets default role', async () => {
  const user = await createUser({ email: 'test@example.com', name: 'Test' });
  const found = await db.query.users.findFirst({ where: eq(users.id, user.id) });
  expect(found?.role).toBe('member');
});
\`\`\`

### E2E tests (Playwright)
\`\`\`typescript
test('complete checkout flow', async ({ page }) => {
  await page.goto('/checkout');
  await page.fill('[name=card]', '4242424242424242');
  await page.click('button[type=submit]');
  await expect(page.locator('[data-testid=success-message]')).toBeVisible();
  // Verify order in DB
  const order = await db.query.orders.findFirst({ orderBy: desc(orders.createdAt) });
  expect(order?.status).toBe('confirmed');
});
\`\`\`

### What NOT to test
- Drizzle ORM internals
- React component rendering of static text
- Third-party library behaviour
- Implementation details (test behaviour, not code)`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PRODUCT & UX
  // ─────────────────────────────────────────────────────────────────────────
  {
    cat: "Product Engineering",
    name: "Analytics Implementation — PostHog",
    content: `## PostHog — Product Analytics Implementation

### Setup (Next.js)
\`\`\`typescript
// providers.tsx
'use client';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';

if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: '/ingest',  // Proxy to avoid ad-blockers
    capture_pageview: false, // Manual pageviews for SPA
    capture_pageleave: true,
    session_recording: { maskAllInputs: true }, // GDPR compliance
  });
}
\`\`\`

### Event taxonomy (consistent naming)
\`\`\`typescript
// Format: object_action
posthog.capture('lead_created', { source: 'manual', industry: lead.industry });
posthog.capture('demo_generated', { leadId, durationMs, brandColorCount });
posthog.capture('invoice_sent', { total: invoice.total, currency: 'USD' });
posthog.capture('feature_used', { feature: 'ai_insights', leadId });
\`\`\`

### Feature flags in PostHog
\`\`\`typescript
import { useFeatureFlagEnabled } from 'posthog-js/react';

function Dashboard() {
  const showNewUI = useFeatureFlagEnabled('new_dashboard_v2');
  return showNewUI ? <NewDashboard /> : <LegacyDashboard />;
}
\`\`\`

### Funnel tracking
\`\`\`typescript
// Track every step of critical funnels
posthog.capture('onboarding_step_completed', { step: 'company_profile', stepNumber: 2 });
posthog.capture('onboarding_completed', { totalSteps: 5, durationMs: elapsed });

// Identify users (server-side for accuracy)
posthog.identify(user.id, {
  email: user.email, name: user.name, plan: user.plan,
  createdAt: user.createdAt, company: user.company,
});
\`\`\`

### Key metrics to track
- Activation rate (user completes first meaningful action)
- Feature adoption (% of users who use each feature)
- Retention (D1, D7, D30)
- Conversion funnel (signup → trial → paid)`,
  },
  {
    cat: "Product Engineering",
    name: "Onboarding Flow Engineering",
    content: `## Onboarding Flow — Engineering Best Practices

### Activation metric
Define ONE action that separates engaged users from casual visitors.
Example: "User has created their first lead and generated a demo"

### Flow architecture
\`\`\`typescript
// Track onboarding state in DB
export const onboardingSteps = pgTable('nf_onboarding', {
  userId: uuid('user_id').primaryKey().references(() => users.id),
  completedSteps: jsonb('completed_steps').$type<string[]>().default([]),
  activatedAt: timestamp('activated_at'),
  completedAt: timestamp('completed_at'),
});

// Check gate on each step
function getNextOnboardingStep(completedSteps: string[]): OnboardingStep | null {
  const STEPS = ['company_profile', 'first_lead', 'first_demo', 'first_outreach'];
  return STEPS.find(s => !completedSteps.includes(s)) ?? null;
}
\`\`\`

### Checklist-driven onboarding (best conversion rate)
\`\`\`tsx
function OnboardingChecklist() {
  const { data: progress } = api.onboarding.getProgress.useQuery();
  return (
    <div>
      {STEPS.map(step => (
        <OnboardingItem key={step.id} completed={progress?.completedSteps.includes(step.id)}>
          <step.Icon /> {step.label}
          {!completed && <Link href={step.href}>Start →</Link>}
        </OnboardingItem>
      ))}
      <progress value={completedCount} max={STEPS.length} />
    </div>
  );
}
\`\`\`

### Email sequence trigger
\`\`\`typescript
// On signup → D0 welcome, D1 tip, D3 activation nudge, D7 check-in
await resend.emails.send({
  from: 'Chris <chris@nexoflow.com>',
  to: user.email,
  subject: 'Welcome to NexoFlow — start here',
  react: WelcomeEmail({ name: user.firstName }),
  scheduledAt: new Date(Date.now() + 60 * 1000), // Send 1 min after signup
});
\`\`\``,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ENTERPRISE SALES & PRICING
  // ─────────────────────────────────────────────────────────────────────────
  {
    cat: "Sales Playbook",
    name: "Enterprise Sales Process — Software Agency",
    content: `## Enterprise Sales Process — NexoFlow

### Stages & exit criteria

**1. Lead (0-10 days)**
Exit: Qualified on BANT — Budget confirmed, Authority (decision maker), Need (real pain), Timeline (< 6 months)

**2. Discovery (1-2 calls)**
Goal: Understand the business problem deeply, not the feature list.
Questions:
- "What's the cost of NOT solving this problem in the next 12 months?"
- "Who else needs to sign off on this decision?"
- "What have you tried before and why didn't it work?"
- "What does success look like to you 6 months after launch?"

**3. Proposal (3-5 days)**
Outputs: Scope doc + architecture overview + fixed-price quote
Pricing anchor: Lead with value, not cost. "This will generate X or save Y — our fee is Z."

**4. Negotiation**
NexoFlow rules:
- Never discount rate — offer scope reduction instead
- Payment terms: 50% upfront, 50% on completion (no 3-stage payments on < $30K projects)
- Add retainer conversation to every close

**5. Close**
- Send contract same day as verbal yes
- DocuSign — signed within 24-48h while enthusiasm is high
- Invoice for deposit immediately on signature

### Objection handling
| Objection | Response |
|-----------|----------|
| "Too expensive" | "What budget were you expecting? Let's see what we can build for that." |
| "We'll build in-house" | "Great — what's your team's capacity? This would take a senior dev 3 months full-time." |
| "Need to think about it" | "What's the specific concern? Let me address that directly." |
| "Getting other quotes" | "Absolutely. Here's what to compare: timeline, technology choices, and who's actually building it." |`,
  },
  {
    cat: "Pricing and Scoping",
    name: "Value-Based Pricing Framework",
    content: `## Value-Based Pricing — NexoFlow Framework

### The formula
**Price = 15-25% of Year 1 value the client derives**

### Calculating client value
\`\`\`
Revenue increase: new sales × avg order value × months
Cost reduction:   hours saved/week × hourly rate × 52 weeks
Risk reduction:   probability of loss × magnitude (compliance, etc.)

Example (restaurant ordering app):
- Online orders: 200 orders/week × $45 avg × 52 = $468,000/year
- NexoFlow captures 3% commission OR flat fee
- Value to client: $468,000 in new revenue
- NexoFlow price: $50,000 = 10.7% of Year 1 value (below 15% floor — price higher)
\`\`\`

### Packaging tiers
| Tier | Scope | Price | What's different |
|------|-------|-------|-----------------|
| Starter | MVP, core features only | $10K–$25K | 1 platform, no mobile |
| Growth | Full product + mobile | $30K–$70K | iOS + Android, integrations |
| Enterprise | Custom, ongoing | $80K+ | Dedicated team, SLA, retainer |

### Anchor high, then right-size
Always present 3 options. Middle option is what you want to sell.
High anchor makes middle look reasonable. Low option captures budget-constrained clients.

### Retainer pitch (close every project with this)
"We typically offer a post-launch retainer at $2,500/month covering:
monitoring, bug fixes, minor enhancements, and a quarterly strategy call.
Most clients stay on for 12+ months — it's significantly cheaper than a re-engagement."`,
  },
  {
    cat: "Client Delivery",
    name: "Project Kickoff — Client Handover Checklist",
    content: `## Project Kickoff Checklist — NexoFlow

### Before kickoff call
- [ ] Contract signed, deposit invoice paid
- [ ] Project created in NexoFlow OS, team assigned
- [ ] Shared Notion/Linear workspace set up
- [ ] Figma project created with NexoFlow branding guide
- [ ] Staging environment provisioned
- [ ] Communication channel created (Slack Connect or Teams)

### Kickoff call agenda (60 min)
1. **Introductions** (5 min) — who does what on both sides
2. **Vision alignment** (15 min) — success looks like X in 6 months
3. **Scope walkthrough** (20 min) — confirm every feature, resolve ambiguities
4. **Client responsibilities** (10 min) — what we need from them and when
5. **Timeline & milestones** (5 min) — key dates, review checkpoints
6. **Communication cadence** (5 min) — weekly async update + biweekly review call

### First week deliverables (NexoFlow)
- [ ] Final data model shared for client review
- [ ] Figma wireframes for all key screens
- [ ] Technical architecture document
- [ ] Sprint 1 backlog in Linear, prioritised

### Client responsibilities (get explicit sign-off)
- [ ] Content and copy (by what date)
- [ ] Brand assets (logo SVG, colour codes, fonts)
- [ ] Access credentials (existing systems, APIs)
- [ ] Domain/DNS access
- [ ] Timely feedback (48h turnaround SLA both ways)
- [ ] Nominated single point of contact

### Change request process
"Any scope addition is scoped and priced in 24h. Written approval required before work begins. No gold-plating — this protects both sides."`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CLOUD ARCHITECTURE
  // ─────────────────────────────────────────────────────────────────────────
  {
    cat: "Cloud Architecture",
    name: "Serverless vs Always-On Decision Framework",
    content: `## Serverless vs Always-On — Decision Framework

### Serverless (Vercel Functions, AWS Lambda)
**Best for:**
- Variable/unpredictable traffic
- API endpoints (< 30s response time)
- Event-driven processing (webhooks, cron)
- Startup cost sensitivity (pay per request, not per hour)

**Constraints:**
- Cold start latency (50–500ms for Node.js, mitigated by edge)
- Max execution time (Vercel Hobby: 10s, Pro: 60s, Enterprise: 300s)
- No persistent connections (use connection pooling: PgBouncer/Neon)
- Stateless only (no in-memory caches across invocations)

### Always-on (Railway, Fly.io, EC2)
**Best for:**
- WebSocket servers (real-time features)
- Background workers (BullMQ, long-running jobs)
- Services with > 1000 requests/second (cold start overhead adds up)
- Persistent in-memory state (rates, session caches)

### NexoFlow standard architecture
\`\`\`
Vercel (Next.js):     App + API routes (serverless, autoscaling)
Railway:              BullMQ workers, WebSocket server, cron runners
Neon Postgres:        Database (serverless, autoscaling, branching)
Upstash Redis:        Cache, rate limiting, pub/sub (serverless)
Cloudflare R2:        Object storage (S3-compatible, no egress fees)
\`\`\`

### Edge vs Node runtime
\`\`\`typescript
// Edge: faster cold start (0ms), limited Node APIs
export const runtime = 'edge'; // Middleware, simple API routes

// Node: full Node.js, database access, file I/O
export const runtime = 'nodejs'; // Default for complex routes
\`\`\``,
  },
  {
    cat: "Cloud Architecture",
    name: "Disaster Recovery & Business Continuity",
    content: `## Disaster Recovery — Engineering Requirements

### RTO & RPO targets
| Tier | RTO (Recovery Time) | RPO (Data Loss) | Example |
|------|---------------------|-----------------|---------|
| Tier 0 — critical | < 15 min | < 1 min | Payments, auth |
| Tier 1 — important | < 4 hours | < 15 min | Core app |
| Tier 2 — standard | < 24 hours | < 1 hour | Analytics, reports |
| Tier 3 — archival | < 1 week | < 24 hours | Historical data |

### Backup strategy (Neon Postgres)
\`\`\`
Neon automatic: PITR (Point-in-Time Recovery) to any second in last 7 days
Manual snapshots: Daily at 02:00 UTC, retained 30 days
Cross-region: Export daily to S3 in different region

Test monthly: Restore to isolated environment, verify data integrity
\`\`\`

### Multi-region active-passive
\`\`\`
Primary: us-east-1 (Vercel iad1)
Standby: us-west-2 (Vercel sfo1)
Database: Neon with read replica in standby region
DNS failover: Cloudflare with health check on primary
Failover time: < 5 minutes (manual), < 2 minutes (automated)
\`\`\`

### Chaos engineering (test your DR)
\`\`\`typescript
// Monthly DR drill checklist
// 1. Take DB snapshot
// 2. Simulate primary region failure (point DNS to standby)
// 3. Verify app works on standby
// 4. Measure actual RTO achieved
// 5. Document findings, update runbook
\`\`\`

### Incident runbook template
\`\`\`markdown
## Incident: [description]
Severity: P0/P1/P2/P3
1. Detect: How is this detected?
2. Notify: Who to page, Slack channel to post in
3. Mitigate: Immediate actions to reduce impact
4. Resolve: Root cause fix
5. Post-mortem: 48h blameless review
\`\`\``,
  },
  {
    cat: "Cloud Architecture",
    name: "CDN & Edge Caching Strategy",
    content: `## CDN & Edge Caching — Vercel + Cloudflare Strategy

### Cache-Control headers for Next.js
\`\`\`typescript
// Static assets (immutable — content-hashed URLs)
'Cache-Control': 'public, max-age=31536000, immutable'

// ISR pages (stale-while-revalidate)
'Cache-Control': 's-maxage=60, stale-while-revalidate=3600'

// API responses (short-lived)
'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30'

// Personalised/auth content (never CDN cache)
'Cache-Control': 'private, no-store'
\`\`\`

### Vercel edge config (sub-millisecond reads)
\`\`\`typescript
import { get } from '@vercel/edge-config';

// Feature flags, maintenance mode, dynamic routing rules
// Read from Edge Config — 0ms latency from any edge node
const maintenanceMode = await get('maintenance_mode');
if (maintenanceMode) return NextResponse.rewrite('/maintenance');
\`\`\`

### Cloudflare Cache Rules
\`\`\`
# Static: /assets/*, /_next/static/* → Cache Everything, max-age 1 year
# ISR pages: /blog/*, /docs/* → Cache with Respect Existing Headers
# API: /api/* → Bypass Cache
# Auth: /dashboard/* → Bypass Cache
\`\`\`

### Image CDN (Next.js Image Optimisation)
\`\`\`typescript
// next.config.ts — allow external image domains
images: {
  remotePatterns: [
    { protocol: 'https', hostname: '*.cloudflare.com' },
    { protocol: 'https', hostname: 'storage.googleapis.com' },
  ],
  minimumCacheTTL: 86400, // 24h minimum
  formats: ['image/avif', 'image/webp'],
}
\`\`\`

### Cache invalidation
- On-demand ISR: \`revalidatePath('/blog/' + slug)\` after CMS update
- Tag-based: \`revalidateTag('products')\` to invalidate product pages globally
- Vercel Deploy Hooks: Trigger revalidation from headless CMS webhooks`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DESIGN SYSTEM
  // ─────────────────────────────────────────────────────────────────────────
  {
    cat: "Design System",
    name: "shadcn/ui — Enterprise Component Patterns",
    content: `## shadcn/ui — Enterprise Patterns

### Custom design tokens (CSS variables)
\`\`\`css
/* globals.css */
:root {
  --brand-primary: hsl(220, 90%, 56%);
  --brand-gradient: linear-gradient(135deg, hsl(220, 90%, 56%), hsl(262, 83%, 62%));
  --surface-bg: hsl(220, 20%, 6%);
  --surface-card: hsl(220, 18%, 10%);
  --surface-elevated: hsl(220, 16%, 14%);
  --surface-border: hsl(220, 16%, 20%);
  --surface-border-subtle: hsl(220, 14%, 16%);
  --text-primary: hsl(220, 20%, 95%);
  --text-secondary: hsl(220, 12%, 65%);
  --text-muted: hsl(220, 10%, 45%);
}
\`\`\`

### Extending shadcn components
\`\`\`typescript
// components/ui/data-table.tsx
import { useReactTable, getCoreRowModel, getSortedRowModel, ColumnDef } from '@tanstack/react-table';

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  onRowClick?: (row: TData) => void;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
}

export function DataTable<TData>({ columns, data, onRowClick, isLoading, emptyState }: DataTableProps<TData>) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
  if (isLoading) return <DataTableSkeleton columns={columns.length} />;
  if (!data.length) return emptyState ?? <EmptyState />;
  // ...render table
}
\`\`\`

### Component variant pattern (cva)
\`\`\`typescript
import { cva, type VariantProps } from 'class-variance-authority';

const badge = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      variant: {
        default: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
        success: 'bg-green-500/10 text-green-400 border border-green-500/20',
        warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
        destructive: 'bg-red-500/10 text-red-400 border border-red-500/20',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);
\`\`\``,
  },
  {
    cat: "Design System",
    name: "Accessibility — WCAG 2.2 AA Compliance",
    content: `## Accessibility — WCAG 2.2 AA Engineering Checklist

### Automated (Axe / Lighthouse)
\`\`\`typescript
// Playwright accessibility check in tests
import { checkA11y } from 'axe-playwright';
test('dashboard passes accessibility audit', async ({ page }) => {
  await page.goto('/dashboard');
  await checkA11y(page, undefined, { runOnly: ['wcag2a', 'wcag2aa'] });
});
\`\`\`

### Manual checklist

**Keyboard navigation**
- [ ] All interactive elements reachable via Tab
- [ ] Focus indicator visible and clear (never \`outline: none\` without replacement)
- [ ] Escape closes modals, dropdowns, tooltips
- [ ] Arrow keys navigate menus and tabs
- [ ] Skip-to-content link at top of page

**Screen reader**
- [ ] Images have descriptive \`alt\` text (or \`alt=""\` for decorative)
- [ ] Icon buttons have \`aria-label\`
- [ ] Form inputs have \`<label>\` or \`aria-label\`
- [ ] Dynamic content updates announced via \`aria-live\`
- [ ] Modals trap focus and restore on close

**Colour & contrast**
- [ ] Text contrast ratio ≥ 4.5:1 (normal text), ≥ 3:1 (large text)
- [ ] UI component contrast ≥ 3:1 against background
- [ ] No information conveyed by colour alone (add icon or text)

**Forms**
\`\`\`tsx
<div role="group" aria-labelledby="shipping-label">
  <h3 id="shipping-label">Shipping Address</h3>
  <label htmlFor="street">Street Address</label>
  <input id="street" type="text" aria-required="true" aria-describedby="street-error" />
  {error && <span id="street-error" role="alert">{error}</span>}
</div>
\`\`\``,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // REAL-TIME FEATURES
  // ─────────────────────────────────────────────────────────────────────────
  {
    cat: "Real-Time Engineering",
    name: "WebSockets vs Server-Sent Events vs Polling",
    content: `## Real-Time: WebSocket vs SSE vs Polling

### Decision matrix
| | WebSocket | SSE | Long Polling | Short Polling |
|---|---|---|---|---|
| Direction | Bidirectional | Server → Client | Server → Client | Server → Client |
| Protocol | WS | HTTP | HTTP | HTTP |
| Browser support | Excellent | Excellent | Excellent | Excellent |
| Proxies/firewalls | Sometimes blocked | Works everywhere | Works everywhere | Works everywhere |
| Reconnect | Manual | Automatic | Manual | N/A |
| Complexity | High | Low | Medium | Very Low |
| Use case | Chat, collaboration | Notifications, feeds | Moderate frequency | Infrequent updates |

### SSE in Next.js (NexoFlow default for one-way streams)
\`\`\`typescript
// app/api/stream/route.ts
export async function GET(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (data: object) => controller.enqueue(enc.encode(\`data: \${JSON.stringify(data)}\n\n\`));

      // Subscribe to Redis pub/sub or DB polling
      const unsubscribe = await redis.subscribe('notifications:' + userId, (msg) => send(JSON.parse(msg)));
      req.signal.addEventListener('abort', () => { unsubscribe(); controller.close(); });
    }
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
}

// Client
const evtSource = new EventSource('/api/stream');
evtSource.onmessage = (e) => setNotifications(prev => [...prev, JSON.parse(e.data)]);
\`\`\`

### WebSocket (Partykit / Socket.io — for bidirectional)
Use for: live cursors, collaborative editing, real-time games, chat.
\`\`\`typescript
// Partykit server (runs on CF Workers)
export default class Room implements Party.Server {
  onMessage(message: string, sender: Party.Connection) {
    this.party.broadcast(message, [sender.id]); // Echo to all except sender
  }
}
\`\`\``,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ENTERPRISE CONTRACTS & LEGAL
  // ─────────────────────────────────────────────────────────────────────────
  {
    cat: "Commercial Intelligence",
    name: "SaaS SLA Tiers — Enterprise Contracts",
    content: `## SaaS SLAs — Enterprise Contract Structure

### Uptime SLA tiers
| Tier | SLA | Annual downtime budget | Target market |
|------|-----|----------------------|---------------|
| Standard | 99.5% | 43.8 hours | SMB |
| Professional | 99.9% | 8.76 hours | Mid-market |
| Enterprise | 99.95% | 4.38 hours | Enterprise |
| Mission-critical | 99.99% | 52.6 minutes | Healthcare, Finance |

### What counts as downtime
- Define precisely: "Service is unavailable when API returns 5xx for > 1% of requests for > 5 consecutive minutes"
- Exclusions: scheduled maintenance (with 48h notice), force majeure, customer-caused outages, third-party failures

### SLA credits (standard structure)
\`\`\`
99.5–99.9% → 5% monthly fee credit
99.0–99.5% → 10% credit
< 99.0%    → 25% credit
\`\`\`

### Support tiers
| Level | Response time | Channel | Who |
|-------|--------------|---------|-----|
| Standard | 48h business hours | Email | Support team |
| Priority | 4h business hours | Email + Slack | Senior support |
| Enterprise | 1h (P0: 15min) | 24/7 dedicated Slack, phone | Named CSM |

### Data portability clause (include in all enterprise contracts)
"Upon termination, Customer may export all data in machine-readable format (JSON/CSV) for 90 days. Provider will provide export tool and technical assistance."

### Enterprise security addendum checklist
- [ ] SAML/SSO support (Okta, Azure AD)
- [ ] IP allowlisting
- [ ] Audit log export API
- [ ] Custom data retention policies
- [ ] BAA (if healthcare)
- [ ] DPA (if processing EU personal data)`,
  },
  {
    cat: "Commercial Intelligence",
    name: "Enterprise Deal Qualification — MEDDIC",
    content: `## Enterprise Deal Qualification — MEDDIC Framework

### Metrics — What is the quantified business impact?
"Reduce manual data entry by 15 hours/week × $60/hour × 52 weeks = $46,800/year saved"
If they can't quantify impact, they won't justify budget.

### Economic Buyer — Who controls the budget?
The economic buyer is NOT the person you're talking to. They sign the cheque.
"Who needs to approve a purchase of this size?" → Get in front of them.

### Decision Criteria — What are they evaluating?
"What are the top 3 criteria you'll use to choose between vendors?"
Common: integration with existing stack, security/compliance, reference customers, support SLA.

### Decision Process — How do they buy?
"Walk me through your typical procurement process for a $50K purchase."
Map: stakeholders → approvals → legal review → security review → timeline.

### Identify Pain — What's the specific, quantified problem?
Surface pain → Urgency → Impact. The pain must be sharp enough to justify the spend now.
"What happens if this isn't solved in the next 3 months?"

### Champion — Who is selling internally for you?
Your internal champion has: access to economic buyer, influence, and personal win tied to your solution.
"What's your stake in getting this solved? How can I help you make the case internally?"

### NexoFlow MEDDIC audit
After every enterprise discovery call, score 1-5 on each:
- Metrics defined: /5
- Economic buyer identified: /5
- Decision criteria known: /5
- Decision process mapped: /5
- Pain quantified: /5
- Champion strength: /5
Total < 20: Pause, gather intel. 20-25: Proceed. 25-30: Fast-track.`,
  },
];

async function seed() {
  const client = postgres(DATABASE_URL!, { max: 3 });
  const db = drizzle(client);

  console.log(`\n🧠 NexoFlow Enterprise Knowledge Base Expansion`);
  console.log(`   Seeding ${ENTERPRISE_SNIPPETS.length} enterprise-level snippets\n`);

  const BATCH = 50;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < ENTERPRISE_SNIPPETS.length; i += BATCH) {
    const batch = ENTERPRISE_SNIPPETS.slice(i, i + BATCH);

    for (const snippet of batch) {
      try {
        await db.insert(knowledgeSnippets).values({
          category: snippet.cat,
          name: snippet.name,
          content: snippet.content,
        });
        inserted++;
      } catch (e: any) {
        // Skip duplicates (unique constraint on name)
        if (e?.code === '23505') { skipped++; }
        else throw e;
      }
    }
    const pct = (((i + batch.length) / ENTERPRISE_SNIPPETS.length) * 100).toFixed(0);
    process.stdout.write(`\r  Progress: ${i + batch.length}/${ENTERPRISE_SNIPPETS.length} (${pct}%) — inserted: ${inserted}, skipped: ${skipped}`);
  }

  console.log(`\n\n✅ Done! Inserted ${inserted} new snippets, skipped ${skipped} duplicates.`);
  console.log(`\nCategories added:`);
  const cats = [...new Set(ENTERPRISE_SNIPPETS.map(s => s.cat))];
  cats.forEach(c => {
    const count = ENTERPRISE_SNIPPETS.filter(s => s.cat === c).length;
    console.log(`  • ${c}: ${count} snippets`);
  });

  await client.end();
  process.exit(0);
}

seed().catch(console.error);
