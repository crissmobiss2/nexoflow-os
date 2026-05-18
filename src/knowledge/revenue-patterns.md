---
created: 2026-05-18
modified: 2026-05-18
tags: [nexoflow, commercial, revenue, architecture, pricing, models]
status: canonical
---

# Revenue Architecture Patterns

> *The 8 revenue models NexoFlow uses and recommends. Each has different unit economics, growth ceiling, and NexoFlow's role. Choose the right architecture at the start — it shapes everything.*

---

## Pattern 1 — Fixed-Price Project

**What it is:** Defined scope, defined deliverable, one-time payment.

```
Structure: 30% deposit → 40% milestone → 30% completion
Typical range: £5K–£60K
Payment terms: Net 14 per invoice
```

**When to use:**
- Client has a clear, bounded problem
- Scope can be defined before build starts
- High-trust, first engagement with a client

**NexoFlow's role:** Builder + project manager. Christopher scopes, Tyler builds.

**Unit economics:**
```
Revenue: £[fee]
Tyler cost: [weeks] × [Tyler weekly cost ≈ £1,680]
Christopher overhead: ~£200-400 total
Gross margin: target 65-75%
```

**Growth ceiling:** Limited. Each project requires Tyler's time. Doesn't scale beyond ~8-10 projects/year.

**Strategic use:** Entry point for new clients. Every project ends with a retainer conversation.

---

## Pattern 2 — Retainer / Managed Service

**What it is:** Monthly recurring fee for ongoing access to NexoFlow's capacity and expertise.

```
Structure: Monthly invoice, rolling or annual contract
Typical range: £1,500–£5,000/month
Payment terms: Net 7 (faster than projects — predictable cashflow)
Notice period: 30 days minimum, 60 days preferred
```

**When to use:**
- Client has ongoing development, support, or AI needs
- Long-term relationship is established or being built
- Client's system needs regular iteration, not one-time build

**NexoFlow's role:** Fractional CTO/dev team. Tyler has allocated hours, Christopher does monthly strategy call.

**Unit economics:**
```
Revenue: £[monthly] × 12 = £[ARR]
Tyler cost: [hours/month] × £66/hr fully loaded
Christopher overhead: ~2hrs/month × £75/hr = £150/month
Gross margin: 70%+
```

**Growth ceiling:** Tyler's hours. At 10 retainer clients × 20hrs/month = 200hrs/month = Tyler's capacity.

**Strategic use:** The primary target. Every project should convert to retainer. MRR = stability.

---

## Pattern 3 — SaaS Subscription (Flat Rate / Tiered / Per-Seat)

**What it is:** Access to software NexoFlow builds and hosts, charged monthly.

```
Flat rate: £[X]/month for unlimited users — simple to sell, simple to support
Tiered: Starter/Growth/Enterprise at increasing price — captures more willingness to pay
Per-seat: £[X]/user/month — scales with customer's team growth
```

**When to use:**
- NexoFlow has built a productized system for a specific vertical
- 10+ potential customers exist with similar needs
- Customer derives ongoing value, not just one-time setup

**NexoFlow's role:** Product company. Build once, support many. Christopher sells, Tyler maintains + iterates.

**Unit economics (at scale):**
```
MRR: [N customers] × £[price/month]
COGS: hosting (Vercel + Neon ≈ £50-200/month at small scale) + Tyler's maintenance time
Gross margin: 75-85% at 20+ customers (infrastructure cost doesn't grow linearly)
```

**Growth ceiling:** Near unlimited — the business model that NexoFlow 2030 is built on.

**The pricing ladder:**
- Starter: £149-£299/month (SMB, 1-5 users)
- Growth: £499-£999/month (growing team, more features)
- Enterprise: £1,500-£3,000/month (large org, custom integrations, SLA)

---

## Pattern 4 — Usage-Based / Consumption

**What it is:** Charge based on what the customer uses — API calls, documents processed, AI tokens, compute.

```
Examples:
  £0.10 per document processed
  £5 per 1,000 API calls
  £50 per user per active month (not just licensed month)
```

**When to use:**
- AI-powered products with variable usage patterns
- Customers have highly variable volumes
- Product delivers clear per-transaction value

**NexoFlow's role:** API product provider. Infrastructure cost must stay below revenue at every volume tier.

**Unit economics:**
```
Revenue: usage × unit price
COGS: Claude API cost + compute + storage
Gross margin: must be >60% at target usage levels (model the economics at low, mid, high usage)
```

**Risk:** Revenue is unpredictable. Customers can churn or reduce usage instantly.

**NexoFlow's best use:** Layer on top of SaaS subscription (base fee + usage overage) — not as standalone model.

---

## Pattern 5 — Marketplace Commission

**What it is:** NexoFlow builds a two-sided marketplace; takes a percentage of transactions.

```
Typical commission: 5-15% of GMV
Alternative: listing fees + transaction fees
```

**When to use:**
- Client's business model IS a marketplace
- NexoFlow is building the platform, not one side of it

**NexoFlow's role:** Marketplace builder. Project fee for build, potential revenue share on ongoing commission.

**The revenue share model:**
```
Christopher negotiates: NexoFlow builds marketplace at reduced project fee + 
  ongoing rev share of [2-5]% of commission for [3-5 years]
  
Risk: marketplace may not reach scale (revenue share = £0)
Upside: marketplace succeeds = passive income for NexoFlow
```

**Recommendation:** Only take revenue share in addition to a project fee, never instead of it. Speculative income is not income.

---

## Pattern 6 — Productized Service

**What it is:** Fixed-scope, fixed-price, repeatable service. Narrower than a full project, faster to deliver.

```
Examples:
  "AI Readiness Audit" — £2,500, 3 days, specific deliverable
  "Landing Page Conversion Sprint" — £1,800, 5 days, specific output
  "API Integration" — £1,200, 2 days, standard scope
```

**When to use:**
- Entry-level offer for new clients who don't know NexoFlow yet
- Lead-gen for larger projects (discovery often becomes a project)
- Specific, repeatable tasks Tyler can do in a defined time box

**Unit economics:**
```
Revenue: £[fixed price]
Tyler time: [days] × [daily cost ≈ £336]
Gross margin: 65-70%
Volume: could do 2-3/month if standardized
```

**Strategic use:** Discovery Audit → leads to project. AI Sprint → leads to retainer. Low risk for client, good lead quality for NexoFlow.

---

## Pattern 7 — Licensing / White-Label

**What it is:** NexoFlow builds a system once and licenses it to multiple organizations under their own branding.

```
Flat licence fee: £5,000-£20,000/year per organization
Or: per-seat licence: £[X]/user/year
Or: revenue share on client's ARR from the system
```

**When to use:**
- NexoFlow has built a well-validated product
- Multiple organizations want it under their own brand
- The product is stable enough for NexoFlow to be "invisible"

**NexoFlow's role:** Software licensor. Christopher sells licences, Tyler handles implementations per client.

**Risk:** Support burden grows with each licencee. Price licence + support appropriately.

---

## Pattern 8 — AI Strategy Advisory

**What it is:** Consulting engagements where NexoFlow provides strategic AI advice without building.

```
Format: Day rates, fixed-scope engagements, or retained advisory
Day rate: £900-£1,200 (Christopher)
Fixed scope: "AI Strategy Intensive" — £3,500-£5,500 for 2-day workshop + report
```

**When to use:**
- Client needs direction before committing to a build
- Christopher as sole deliverable — no Tyler required
- High-value relationships that need nurturing before they're ready to build

**Unit economics:**
```
Revenue: £[fee] — 100% margin (Christopher's time only)
No Tyler cost
Risk: Christopher's time is finite — advisory doesn't scale
```

**Strategic use:** Advisory leads to builds. Never let it become the majority of NexoFlow's revenue.

---

## Hybrid Revenue Stacks

NexoFlow's ideal client generates multiple revenue streams:

```
Year 1: £20,000 fixed-price project (Pattern 1)
  ↓ project completion
Year 1–3: £2,500/month retainer (Pattern 2) = £30,000/year
  ↓ expansion identified
Year 2: £12,000 expansion project (Pattern 1)
  ↓ productization opportunity
Year 3: £800/month SaaS (Pattern 3) — rolled out to client's network
  
Total LTV over 3 years: £20K + £90K retainer + £12K + £28.8K SaaS = £150,800
```

This is the client trajectory NexoFlow should engineer deliberately.

---

## UK Commercial Considerations

```
VAT: Register if revenue >£90,000. Most clients are VAT-registered businesses → add 20%.
Invoice terms: Net 14 standard (not Net 30 — faster cashflow is worth the ask)
Late payment: UK Late Payment Act — entitled to 8% + BoE base rate on late invoices
Contracts: all projects require signed SOW before work begins (no exceptions)
IR35: Tyler as employee; contractors must assess their own status
Corporation Tax: 19% (profits <£50K), 25% (profits >£250K) as of 2023
```

---

## Related
- [[NexoFlow System/Financial Intelligence]]
- [[NexoFlow System/Pricing Intelligence]]
- [[NexoFlow System/Commercial Intelligence/Productization Decision Framework]]
- [[NexoFlow System/NexoFlow Services]]
- [[NexoFlow System/Annual Business Plan]]
