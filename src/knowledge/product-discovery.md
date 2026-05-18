---
created: 2026-05-18
modified: 2026-05-18
tags: [nexoflow, discovery, product, playbook, research, scoping]
---

# Product Discovery Playbook

> *Discovery is the most important phase of any build. Every scope dispute, timeline overrun, and client disappointment traces back to a discovery failure. This playbook governs how NexoFlow runs discovery so that builds start with the right foundation.*

---

## Why Discovery Exists

Building software without discovery is like building a house without a floor plan. You'll build something — it just won't be what the client needs.

Discovery answers three questions before code is written:
1. **What problem are we actually solving?** (Often different from what the client says)
2. **Who specifically are we solving it for?** (One primary user, not "our customers")
3. **How do we know when we've solved it?** (Measurable, not "it's live")

---

## Discovery Modes

**Minimum viable discovery (3–5 days):** For projects under £15K or where the scope is largely defined. Confirm the critical unknowns. Don't over-engineer the discovery.

**Full discovery (2–3 weeks):** For projects over £20K, new product categories, or clients with unclear requirements. Worth the investment — every hour here saves 3 hours in rework.

**Discovery Sprint product:** Offered as [[NexoFlow System/Product Strategy/Offer Design System#Archetype 4 — Strategy Intensive]] — paid, standalone, leads to a project.

---

## The 5 Discovery Artifacts

These must exist before any architecture is discussed. If they don't exist, extend discovery.

### Artifact 1 — Problem Statement
```
Format:
[Target user] experiences [specific problem] when [context/trigger].
This causes [specific consequence: time lost, money lost, risk, frustration].
Current workaround: [what they do today].
Ideal outcome: [what success looks like in one sentence].

Example:
"Operations managers at UK accounting firms (5-30 staff) spend 8-12 hours per month 
manually compiling client reporting data from Xero, QBO, and Excel. This causes delayed 
reports, formatting errors, and partner-level time wasted on admin. Current workaround: 
junior staff manually pull data every month. Ideal: automated report generation in <10 minutes."
```

### Artifact 2 — User Personas (1–3 maximum)
```
Primary user: [who uses this daily?]
  Role: [job title]
  Context: [when do they use this? what are they trying to accomplish?]
  Primary frustration: [what's broken about their current experience?]
  Technical comfort: [high / medium / low — affects UI complexity decisions]
  Success metric: [what does a successful session look like for them?]

Secondary user: [who uses this occasionally or approves it?]
  [Shorter — focus on how their needs differ from the primary user]

DO NOT create personas for hypothetical users. Only document personas for real people you've interviewed.
```

### Artifact 3 — Jobs to be Done
```
The job is the fundamental task the user is trying to accomplish. 
Not "use the software" — the underlying goal.

Format: "When [situation], I want to [motivation], so I can [outcome]."

Example:
  "When monthly reporting is due, I want to compile client data automatically, 
   so I can deliver reports in hours instead of days."

List 3–5 primary jobs. Rank by frequency and importance.
The system architecture should be optimised for the top 1–2 jobs.
```

### Artifact 4 — Success Metrics
```
Define success before building. These are reviewed at launch and at 3-month, 6-month checkpoints.

Technical metrics:
  → Page load time: <[X]ms
  → Uptime target: [99.X]%
  → Error rate: <[X]%

Business metrics (the ones that actually matter):
  → [Metric 1]: [current baseline] → [target at 3 months]
  → [Metric 2]: [current baseline] → [target at 3 months]

User adoption metrics:
  → Active users: [N] within [X] weeks of launch
  → Primary task completion rate: >[X]%

Agreement: client and NexoFlow sign off on these before build. They're the benchmark for scope disputes.
```

### Artifact 5 — Risk Register
```
Three categories. 3 risks per category maximum (if you have more, you haven't prioritised).

Technical risks:
  → [Risk]: [Probability HIGH/MED/LOW] | [Mitigation]

Commercial risks:
  → [Risk]: [Probability] | [Mitigation]

Delivery risks:
  → [Risk]: [Probability] | [Mitigation]

High probability + high impact = must be addressed in Phase 1 scope.
Low probability + high impact = must have a contingency plan.
```

---

## The Discovery Interview Guide

15 questions for stakeholder interviews. Use these verbatim or as guides. Listen 80%, speak 20%.

**Problem Understanding:**
1. "Walk me through what you do on a typical [day/week] when this problem occurs."
2. "How long have you been dealing with this? How has it changed over time?"
3. "What's the most frustrating part? Not the whole problem — the specific moment."
4. "What have you tried to fix this before? What worked and what didn't?"
5. "If this problem disappeared tomorrow, what would change for you?"

**Current State:**
6. "Show me how you do this today. Can you walk me through the actual steps?"
7. "Who else is involved in this process? Where does it break down for them?"
8. "What tools do you currently use? What do you like about them? What's missing?"
9. "How much time does this take per week/month? How do you know?"

**Future State:**
10. "What would the ideal solution look like? Be as specific as possible."
11. "What would you sacrifice for speed? What can't you compromise on?"
12. "Who else would use this? Would you want them all to have the same access?"
13. "What would make you NOT use a new system? What are the dealbreakers?"

**Commercial:**
14. "How is this problem affecting your business outcomes? Revenue, costs, risk?"
15. "If we solved this completely, what would that be worth to the business?"

**After each interview:** Write up the key themes immediately. Don't rely on memory.

---

## Common Discovery Anti-Patterns

```
❌ Feature list as discovery output
   Client gives you 30 features. You scope those 30 features. 
   The real problem is in none of them.
   FIX: Always ask "why" for each feature request.

❌ Designing for the CEO, not the user
   The CEO commissions the project. The admin team uses it daily.
   FIX: Interview the actual users, not just the decision-maker.

❌ Undefined success criteria
   "The project is done when it's live" is not a success criterion.
   FIX: Define measurable outcomes before build begins.

❌ Scope agreed on day 1 before discovery
   Scope agreed in the sales call is just a guess.
   FIX: Scope is locked after discovery, not before.

❌ Skipping discovery because "we've done this before"
   Every client's context is different. The pattern is familiar — the specifics aren't.
   FIX: Do abbreviated discovery, not zero discovery.
```

---

## Discovery-to-Scope Handoff

When discovery is complete, the transition to scoping follows this sequence:

```
1. Discovery debrief with client:
   → Present the 5 artifacts back to the client
   → Confirm: "Is this an accurate picture of the problem?"
   → Surface any gaps or corrections

2. Architecture brief (Tyler):
   → Problem statement → technology approach
   → Data model sketch
   → Integration requirements
   → Technical risks from discovery

3. Scope document:
   → Inclusions: features directly solving the primary Job to be Done
   → Exclusions: explicitly named (prevents "I assumed this was included")
   → Future scope: features in Phase 2 (manages expectations)
   → Acceptance criteria: how each feature is tested

4. Proposal:
   → Based on scope document
   → Success metrics agreed in discovery become the delivery benchmark
   → Timeline tied to Christopher + Tyler availability
```

---

## When to Stop Discovery

Discovery is not research for its own sake. Stop when:

```
□ Problem statement is clear and validated by ≥2 stakeholders
□ At least 3 user interviews completed
□ Primary Job to be Done agreed
□ Success metrics confirmed and written
□ Top risks identified with mitigations
□ Scope can be written without guessing

If you can't stop discovery cleanly: the client's requirements are too unclear to scope.
In that case: run a paid Discovery Sprint (Offer Archetype 4) to buy time for clarity.
```

---

## Related
- [[NexoFlow System/Product Strategy/Client Software Strategy Template]]
- [[NexoFlow System/Client Delivery/Proposal Builder]]
- [[NexoFlow System/Product Strategy/Offer Design System]]
- [[NexoFlow System/Knowledge and Tech/Architecture Patterns]]
- [[NexoFlow System/Cognitive Frameworks]]
