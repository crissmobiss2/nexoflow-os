---
tags: [nexoflow, scoring, opportunities, framework]
aliases:
  - Opportunity Scoring
  - Scoring Framework
created: 2026-05-18
trust_level: 2
---

# Opportunity Scoring Framework

> A quantitative scoring system for evaluating product and service opportunities. Use this framework to objectively compare opportunities, prioritize build decisions, and reduce bias in product strategy.

---

## Scoring Dimensions

Each opportunity is scored on **7 dimensions**, each rated **1–10**.

| # | Dimension | Description |
|---|-----------|-------------|
| 1 | **Pain Level** | How intense is the problem? Do people actively complain, search, or pay for solutions? |
| 2 | **Budget Signal** | Is there clear evidence that customers will pay meaningful money? Are budgets allocated? |
| 3 | **Urgency** | Is the market actively seeking solutions now, or is this a "someday" problem? |
| 4 | **Distribution Potential** | How easily can we reach buyers? One channel to 100 customers? Viral loops? |
| 5 | **Defensensibility** | Can we build moats — network effects, data advantages, switching costs, IP? |
| 6 | **Speed to Value** | How fast can we deliver a useful v1? Weeks? Months? Years? |
| 7 | **Strategic Fit** | Does this align with existing capabilities, brand, audience, and long-term direction? |

### Detailed Rubric

#### Pain Level (1–10)
| Score | Description |
|-------|-------------|
| 1–3 | Nice-to-have. No one is asking for this. |
| 4–5 | Mild annoyance. People cope with workarounds. |
| 6–7 | Significant friction. People spend money on bandaids. |
| 8–9 | Critical pain. Existing solutions are expensive/terrible. |
| 10 | Existential threat. Must solve or business fails. |

#### Budget Signal (1–10)
| Score | Description |
|-------|-------------|
| 1–3 | No willingness to pay. Free alternatives dominate. |
| 4–5 | Some willingness, but low price expectations (<$20/mo). |
| 6–7 | Clear willingness ($50–200/mo). Existing competitors charge. |
| 8–9 | High willingness ($200–1000+/mo). Budgets exist. |
| 10 | Enterprise budgets. $10K+/yr per customer is normal. |

#### Urgency (1–10)
| Score | Description |
|-------|-------------|
| 1–3 | "Someday" problem. No search volume, no buying intent. |
| 4–5 | Growing awareness. Some search, but not urgent. |
| 6–7 | Active market. People are buying solutions now. |
| 8–9 | Rapidly growing demand. Market is heating up. |
| 10 | Crisis mode. Regulatory deadline, tech shift, mass migration. |

#### Distribution Potential (1–10)
| Score | Description |
|-------|-------------|
| 1–3 | Requires outbound sales to each customer. No channel. |
| 4–5 | One solid channel exists but requires effort. |
| 6–7 | Product-led growth possible. One channel can reach 100 customers. |
| 8–9 | Built-in distribution. Platform, API, partner network. |
| 10 | Viral or network effects. Users bring users. |

#### Defensibility (1–10)
| Score | Description |
|-------|-------------|
| 1–3 | Commodity. Easily copied. No moat. |
| 4–5 | Some differentiation — brand, UX, first-mover. |
| 6–7 | Switching costs or data network effects. |
| 8–9 | Hard tech moat (IP, algorithms, regulatory). |
| 10 | Impossible to replicate without massive investment. |

#### Speed to Value (1–10)
| Score | Description |
|-------|-------------|
| 1–3 | v1 takes 6+ months. |
| 4–5 | v1 takes 3–6 months. |
| 6–7 | v1 takes 4–8 weeks. |
| 8–9 | v1 takes 2–4 weeks. |
| 10 | v1 in <2 weeks. Near-zero build time. |

#### Strategic Fit (1–10)
| Score | Description |
|-------|-------------|
| 1–3 | Distraction. No alignment with current capabilities. |
| 4–5 | Tangential fit. Requires new skills/audience. |
| 6–7 | Good fit. Leverages existing strengths. |
| 8–9 | Strong fit. Direct line to core business. |
| 10 | Perfect fit. This IS the core strategy. |

---

## Weighted Scoring Formula

Not all dimensions are equal. Apply these weights based on your current stage:

### Default Weights (Growth Stage)
| Dimension | Weight |
|-----------|--------|
| Pain Level | 20% |
| Budget Signal | 15% |
| Urgency | 10% |
| Distribution Potential | 20% |
| Defensibility | 10% |
| Speed to Value | 10% |
| Strategic Fit | 15% |

**Formula:**
```
Total Score = (Pain × 0.20) + (Budget × 0.15) + (Urgency × 0.10)
            + (Distribution × 0.20) + (Defensibility × 0.10)
            + (Speed × 0.10) + (Strategic Fit × 0.15)
```

**Maximum possible score: 10.0**

### Early-Stage Weights (Pre-Product-Market Fit)
| Dimension | Weight |
|-----------|--------|
| Pain Level | 25% |
| Budget Signal | 15% |
| Urgency | 15% |
| Distribution Potential | 20% |
| Defensibility | 5% |
| Speed to Value | 15% |
| Strategic Fit | 5% |

### Enterprise Weights
| Dimension | Weight |
|-----------|--------|
| Pain Level | 15% |
| Budget Signal | 25% |
| Urgency | 10% |
| Distribution Potential | 10% |
| Defensibility | 20% |
| Speed to Value | 5% |
| Strategic Fit | 15% |

---

## Score Interpretation

| Score Range | Verdict | Action |
|-------------|---------|--------|
| **8.0–10.0** | 🟢 **Build Now** | High confidence. Allocate resources. Start building. |
| **6.0–7.9** | 🟡 **Validate** | Promising. Invest in lightweight validation (landing pages, interviews, prototypes). |
| **4.0–5.9** | 🟠 **Watch** | Keep an eye on it. Re-score monthly or when conditions change. |
| **< 4.0** | 🔴 **Pass** | Low confidence. Move on. Revisit only if major shift in market data. |

> **Note:** The 40+/30–39/20–29/<20 scale referenced in the original system corresponds to an **unweighted sum** (7 dimensions × 10 = 70 max). That equivalent mapping is: Build Now (40+), Validate (30–39), Watch (20–29), Pass (<20). Use whichever format you prefer — the weighted formula above is more precise.

---

## Example Scoring

### Example 1: AI-Powered Code Review Tool
| Dimension | Score | Notes |
|-----------|-------|-------|
| Pain Level | 8 | Code review is a known bottleneck |
| Budget Signal | 7 | Dev teams pay for tools ($30–100/seat) |
| Urgency | 7 | AI coding wave is driving demand |
| Distribution Potential | 8 | GitHub/VS Code marketplace distribution |
| Defensibility | 6 | Data moat from training on reviews |
| Speed to Value | 9 | Can ship v1 in 2–3 weeks as a plugin |
| Strategic Fit | 8 | Aligns with developer tooling expertise |
| **Weighted Score** | **7.6** | **🟡 Validate** |

### Example 2: Compliance Automation for Fintechs
| Dimension | Score | Notes |
|-----------|-------|-------|
| Pain Level | 9 | Regulatory compliance is existential |
| Budget Signal | 9 | $1K–5K/mo is normal for compliance tools |
| Urgency | 8 | Regulatory deadlines create forced buying |
| Distribution Potential | 5 | Requires direct sales to compliance officers |
| Defensibility | 9 | Certification moats, regulatory complexity |
| Speed to Value | 4 | v1 takes 4–6 months due to compliance needs |
| Strategic Fit | 6 | New vertical, but adjacent to existing fintech work |
| **Weighted Score** | **7.4** | **🟡 Validate** |

### Example 3: ChatGPT Wrapper for Meeting Notes
| Dimension | Score | Notes |
|-----------|-------|-------|
| Pain Level | 5 | Mild annoyance. Many free alternatives. |
| Budget Signal | 3 | Hard to charge when Otter/ others offer free tiers |
| Urgency | 5 | Growing interest but no buying frenzy |
| Distribution Potential | 4 | Requires Chrome store discovery or paid ads |
| Defensibility | 2 | Zero moat. Anyone can build this with an API call. |
| Speed to Value | 8 | Can build in 1 week |
| Strategic Fit | 5 | Tangential to core capabilities |
| **Weighted Score** | **4.5** | **🟠 Watch** |

---

## Scoring Worksheet Template

Copy this block for each opportunity:

```markdown
## Opportunity Score: [Opportunity Name]

| Dimension | Score (1–10) | Weight | Weighted |
|-----------|:------------:|:------:|:--------:|
| Pain Level |              | 20%    |          |
| Budget Signal |           | 15%    |          |
| Urgency |                | 10%    |          |
| Distribution Potential | | 20%    |          |
| Defensibility |          | 10%    |          |
| Speed to Value |         | 10%    |          |
| Strategic Fit |          | 15%    |          |
| **Total** |               | **100%** | **____** |

**Raw Sum:** ___ / 70
**Weighted Score:** ___ / 10.0
**Verdict:** Build / Validate / Watch / Pass
**Confidence:** Low / Medium / High
```

---

## When to Re-Score

| Trigger | Action |
|---------|--------|
| **Monthly review** | Re-score all Watch opportunities |
| **Market data changes** | New competitor, funding round, regulation change |
| **Customer discovery** | New evidence changes Pain Level or Budget Signal |
| **Build start** | Final score review before committing resources |
| **Quarterly planning** | Batch re-score all opportunities in the pipeline |

---

## Related

- [[Million-Dollar Product Filters]] — Pre-scoring filter for $1M ARR potential
- [[Product Opportunity Template]] — Full template for deep evaluation
- [[Niche Evaluation Template]] — Market niche evaluation
