---
type: build-scope
project: 
client: 
date: 
status: draft
version: 1.0
tags: [nexoflow, scope, delivery, project]
---

# Build Scope: [Project Name]

> *This document defines exactly what NexoFlow will build, what's excluded, and what "done" means for each deliverable. Signed by both parties before work begins. Changes require a written scope amendment.*

---

## Project Summary

**Client:** [Company name]  
**Project:** [What we're building in one sentence]  
**Outcome:** [What the client has when this is done]  
**Timeline:** [X weeks from signed SOW + deposit]  
**Estimated start:** [Date]  
**Estimated completion:** [Date]  
**Total fee:** £[X] + VAT  
**Payment schedule:** £[X] on signing (30%) | £[X] at [milestone] (40%) | £[X] on completion (30%)  

---

## Technology Stack

```
Frontend: [Next.js 15 / React Native + Expo / Tauri + React]
Backend: [Hono / Next.js API Routes]
Database: [Neon PostgreSQL with Drizzle ORM]
Auth: [Auth.js v5 / Expo SecureStore]
AI: [Claude API via Vercel AI SDK / n8n]
Hosting: [Vercel / TBD]
Other: [Stripe, Resend, Upstash, etc. — list with purpose]
```

---

## Scope — What's Included

### Core Features (Phase 1)

*These features are included in the quoted fee. All items are required for completion.*

**Feature 1: [Name]**
- Description: [What it does]
- User can: [specific actions]
- Acceptance criteria:
  - [ ] [Specific, testable criterion]
  - [ ] [Specific, testable criterion]

**Feature 2: [Name]**
- Description: [What it does]
- User can: [specific actions]
- Acceptance criteria:
  - [ ] [Specific, testable criterion]
  - [ ] [Specific, testable criterion]

**Feature 3: [Name]**
[Continue pattern]

### Non-Feature Deliverables

- [ ] Deployed to production hosting (Vercel) with custom domain configured
- [ ] Source code delivered to client's GitHub repository
- [ ] Environment variables documented and handed over
- [ ] Basic onboarding call (1 hour) for primary users
- [ ] 30-day warranty period for bugs in delivered scope

---

## Scope — What's NOT Included

*This section is as important as the inclusions. Anything not listed above is excluded.*

```
NOT INCLUDED in Phase 1:
  → [Feature X] — reason: [dependency / complexity / future phase]
  → [Feature Y] — reason: [out of scope per discovery]
  → [Mobile app] — this scope covers web only
  → [Third-party integrations beyond those listed above]
  → [Content entry, data migration, or seeding of production data]
  → [Design work beyond functional UI using NexoFlow's component library]
  → [Custom design system or brand design — separate engagement]
  → [Analytics beyond standard Vercel analytics]
  → [SEO optimization]
  → Ongoing maintenance (covered by separate retainer)
```

---

## Client Responsibilities

*Work that NexoFlow cannot complete without the client's input. Delays here delay delivery.*

```
Client must provide by [date]:
  □ Access to all systems requiring integration (credentials, API keys)
  □ Logo, brand colors, and any existing design assets
  □ Copy/text content for all pages (if content-heavy product)
  □ Sample data for development and testing
  □ Timely feedback during review periods (see Review Protocol below)
  □ Appointed a single point of contact (not multiple stakeholders)
  □ Active Apple Developer and/or Google Play accounts (if mobile)
```

---

## Review Protocol

*How feedback and approvals work during the build.*

```
Review gates (at each milestone):
  → NexoFlow delivers a staging environment for review
  → Client has 48 hours to review and provide written feedback
  → Feedback delivered outside this window may push the timeline
  → "Approved" means: no further changes to this scope item

Revision rounds:
  → Two rounds of revisions are included per major feature
  → Additional revisions beyond two rounds = scope change order (quoted separately)
  → Scope changes during build are paused, quoted, and agreed before implementation
```

---

## Timeline

| Milestone | Deliverable | Target Date |
|---|---|---|
| Kickoff | Environment setup + architecture confirmed | [Date] |
| Sprint 1 complete | [Core feature 1 + 2] | [Date] |
| Sprint 2 complete | [Core feature 3 + 4] | [Date] |
| Staging release | All features on staging for review | [Date] |
| Client review | Client feedback returned | [Date] |
| Revisions complete | All feedback addressed | [Date] |
| Production launch | Live on production | [Date] |
| Warranty starts | 30-day warranty period begins | [Date] |

**Timeline assumptions:**
- Client feedback returned within 48 hours of staging release
- No material scope changes after kickoff
- Client dependencies (API access, content) delivered by [Date]
- If any assumption is not met, NexoFlow will communicate a revised timeline in writing

---

## Acceptance Criteria Summary

The project is "complete" when:

```
□ All features listed in "Scope — What's Included" are working in production
□ All acceptance criteria for each feature are met
□ No P0 or P1 bugs exist (P0 = system unusable, P1 = core feature broken)
□ Performance benchmark met: [specific metric, e.g., "homepage loads in <2s on 4G"]
□ Primary user flow demonstrated to client contact and approved
□ Source code delivered to client's repository
□ Environment variables documented and handed over
□ Client has signed off on production deployment
```

---

## Warranty and Post-Launch

```
30-day warranty period:
  → Covers: bugs in delivered scope (features that don't work as specified)
  → Does NOT cover: new feature requests, design changes, or content updates
  → Response time: <24 hours for P0/P1, <72 hours for P2

After warranty:
  → Ongoing support via NexoFlow retainer
  → Ad-hoc projects quoted separately
  → Emergency support at £150/hr (minimum 1 hour, same-day response)
```

---

## Signatures

This scope document defines the engagement. Changes require a written amendment.

**NexoFlow:** Christopher Sumner | Date: ___________

**[Client Company]:** [Name] | Title: ___________ | Date: ___________

---

## Change Log

| Version | Date | Change | Approved by |
|---|---|---|---|
| 1.0 | [date] | Initial scope | [Both] |
