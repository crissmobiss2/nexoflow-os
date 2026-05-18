---
created: 2026-05-18
modified: 2026-05-18
tags: [nexoflow, ai, system-design, methodology, llm, automation]
---

# AI System Design Guide

> *The methodology NexoFlow uses to design AI systems for clients. Not a list of tools — a way of thinking. Every AI engagement starts here.*

---

## The AI System Design Philosophy

Most AI projects fail because teams skip design and go straight to prompting.

NexoFlow's approach: **Design the system first. Build the AI second.**

The AI layer is just one component of a production system. It needs:
- Data inputs that are clean and structured
- Clear task boundaries (what does AI decide vs. what do rules decide?)
- Evaluation criteria (how do we know if it's working?)
- Fallbacks when the AI fails or hallucinates
- Cost controls (AI at scale gets expensive fast)

**The 4 questions before any AI build:**
```
1. What is the specific decision or transformation the AI performs?
2. What data goes in? What comes out? How is output used?
3. How do we measure if the output is good enough?
4. What happens when the AI gets it wrong?
```

---

## AI System Tier Framework

### Tier 1 — AI-Assisted (lowest complexity, highest reliability)

**Pattern:** Human workflow with AI suggestions. Human approves before action.

**When to use:**
- Drafting (emails, proposals, summaries)
- Classification with human review
- Research and summarisation

**Architecture:**
```
User input → Claude API → Structured response → Human review → Action
```

**Example: Proposal draft assistant**
```typescript
const draftProposal = async (discoveryNotes: string) => {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `You are a business proposal writer for ${companyName}.
      
      Based on these discovery notes, draft a proposal:
      ${discoveryNotes}
      
      Output JSON:
      {
        "executive_summary": "string",
        "scope": ["item1", "item2"],
        "deliverables": ["item1", "item2"],
        "timeline_weeks": number,
        "recommended_price_gbp": number,
        "why_us": "string"
      }`
    }],
  })
  return JSON.parse(response.content[0].text)
}
```

**Evaluation:** Human thumbs up/down. Track acceptance rate over time.

---

### Tier 2 — AI-Automated (medium complexity, needs monitoring)

**Pattern:** AI performs actions without human review. Results logged and auditable.

**When to use:**
- Lead qualification (initial scoring)
- Data enrichment (company size, industry classification)
- Content categorisation at scale
- Automated email responses to specific triggers

**Architecture:**
```
Trigger → AI processing → Confidence check → 
  High confidence → Execute action
  Low confidence → Queue for human review
```

**Example: Lead qualification scorer**
```typescript
interface LeadScore {
  score: number          // 0-100
  confidence: 'high' | 'medium' | 'low'
  signals: string[]
  recommendation: 'qualify' | 'nurture' | 'disqualify'
  reasoning: string
}

const scoreLeadWithAI = async (lead: Lead): Promise<LeadScore> => {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',  // Cheaper for high volume
    max_tokens: 500,
    system: `You are a B2B lead qualification specialist for a UK AI software agency.
    Ideal clients: UK professional services, 10-100 employees, £2M-£20M revenue, 
    operations-heavy, decision maker present.`,
    messages: [{
      role: 'user',
      content: `Score this lead:
      Company: ${lead.company}
      Industry: ${lead.industry}
      Employees: ${lead.employees}
      Revenue: ${lead.revenue}
      Contact title: ${lead.title}
      Message: ${lead.message}
      
      Return JSON matching the LeadScore interface.`
    }]
  })
  
  const result = JSON.parse(response.content[0].text) as LeadScore
  
  // Only auto-act on high confidence
  if (result.confidence === 'high') {
    await executeleadAction(lead, result)
  } else {
    await queueForHumanReview(lead, result)
  }
  
  return result
}
```

**Evaluation:** Weekly review of AI decisions vs. actual outcomes. Retrain signals monthly.

---

### Tier 3 — Agentic AI (high complexity, highest value)

**Pattern:** AI orchestrates multi-step workflows, uses tools, makes decisions across a session.

**When to use:**
- Complex research tasks (market analysis, competitor monitoring)
- Multi-step data processing (extract → classify → enrich → update CRM)
- Autonomous reporting (pull data → analyse → generate → send)

**Architecture:**
```
Trigger → Agent initialisation → Tool loop:
  Agent decides next action
  Execute tool (search, read, write, call API)
  Feed result back to agent
  Repeat until done
→ Final output → Notification
```

**Example: Automated client health monitoring agent**
```typescript
import Anthropic from '@anthropic-ai/sdk'

const tools: Anthropic.Tool[] = [
  {
    name: 'get_client_metrics',
    description: 'Get current health metrics for a client',
    input_schema: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        metric_type: { 
          type: 'string', 
          enum: ['usage', 'support_tickets', 'payment_status', 'last_contact']
        }
      },
      required: ['client_id', 'metric_type']
    }
  },
  {
    name: 'create_alert',
    description: 'Create an alert for a client risk or opportunity',
    input_schema: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
        message: { type: 'string' },
        recommended_action: { type: 'string' }
      },
      required: ['client_id', 'severity', 'message', 'recommended_action']
    }
  },
  {
    name: 'update_client_health_score',
    description: 'Update the health score in the client record',
    input_schema: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        score: { type: 'number' },
        factors: { type: 'array', items: { type: 'string' } }
      },
      required: ['client_id', 'score', 'factors']
    }
  }
]

const runClientHealthAgent = async (clientIds: string[]) => {
  const messages: Anthropic.MessageParam[] = [{
    role: 'user',
    content: `Analyse health for these clients: ${clientIds.join(', ')}.
    
    For each client:
    1. Check all metrics (usage, support, payment, last contact)
    2. Calculate a health score 1-25
    3. Create alerts for any risks
    4. Update the health score record
    
    Focus on churn risks and expansion opportunities.`
  }]
  
  while (true) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      tools,
      messages
    })
    
    messages.push({ role: 'assistant', content: response.content })
    
    if (response.stop_reason === 'end_turn') break
    
    const toolResults: Anthropic.MessageParam = {
      role: 'user',
      content: await Promise.all(
        response.content
          .filter(b => b.type === 'tool_use')
          .map(async (block) => {
            const result = await executeTool(block.name, block.input)
            return {
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: JSON.stringify(result)
            }
          })
      )
    }
    
    messages.push(toolResults)
  }
}
```

**Evaluation:** Accuracy of alerts (did the agent spot real risks?), false positive rate, token cost per client per run.

---

### Tier 4 — AI-Native Product (built from AI up)

**Pattern:** AI is the product. The UI is a wrapper around the AI capability.

**When to use:**
- The core value proposition IS the intelligence
- Users interact with AI directly as the primary workflow
- AI decisions are the product output

**Examples:** AI proposal generator, AI meeting debrief tool, AI lead scorer dashboard

**Architecture:**
```
User → Next.js UI → Vercel AI SDK streaming → Claude API
                 ↕
           Vector DB (pgvector) — context retrieval
                 ↕
           Postgres — structured data storage
```

**Key decisions for Tier 4:**
- **Streaming always** — users see output in real time, feels faster
- **Context management** — what goes in the system prompt vs. retrieved
- **State persistence** — conversation threads, user preferences
- **Rate limiting** — protect against API cost explosions
- **Evaluation pipeline** — how do you know if quality is degrading?

---

## Prompt Engineering Standards

### System Prompt Template
```
[ROLE]
You are [specific role] for [company/context].

[CONTEXT]
[What the AI needs to know about the business/situation]

[TASK FRAMING]
Your job is to [specific task]. You do NOT [boundaries].

[OUTPUT FORMAT]
Always respond with [format]. Example:
{
  "field": "description",
  ...
}

[CONSTRAINTS]
- [Constraint 1]
- [Constraint 2]

[QUALITY BAR]
A good response [specific quality criteria].
```

### Prompt Anti-Patterns
```
❌ "Do your best" — no quality bar
❌ "Think step by step" without specifying what steps
❌ Asking for prose when JSON is needed
❌ System prompt > 2000 tokens without RAG
❌ Asking Claude to "not hallucinate" — enforce with structured output + validation instead
❌ Single prompt for multi-step reasoning — break it up
❌ Using GPT-4 style prompts on Claude (different strengths)
```

### Output Validation Pattern
```typescript
import { z } from 'zod'

const AIOutputSchema = z.object({
  score: z.number().min(0).max(100),
  confidence: z.enum(['high', 'medium', 'low']),
  reasoning: z.string().min(10),
  recommendation: z.enum(['proceed', 'review', 'reject'])
})

const validateAIOutput = (raw: string) => {
  try {
    const parsed = JSON.parse(raw)
    return AIOutputSchema.parse(parsed)
  } catch (e) {
    // AI returned invalid JSON or schema mismatch
    // Log, alert, fallback to default
    console.error('AI output validation failed:', e)
    return null
  }
}
```

---

## Model Selection Guide

| Task | Model | Why |
|---|---|---|
| High-volume classification | claude-haiku-4-5 | Fast, cheap, accurate for simple tasks |
| Complex reasoning, proposals | claude-sonnet-4-6 | Balance of capability and cost |
| Deep analysis, strategy | claude-opus-4-7 | Maximum capability, use sparingly |
| Streaming UI responses | claude-sonnet-4-6 | Fast streaming, strong TTFB |
| Agentic workflows | claude-sonnet-4-6 | Best tool use capability at cost |

**Cost benchmarks (approximate):**
```
Haiku:  Input $0.25/MTok  | Output $1.25/MTok
Sonnet: Input $3/MTok     | Output $15/MTok
Opus:   Input $15/MTok    | Output $75/MTok
```

**Budget guardrails per use case:**
```
Per classification:    < £0.001 (Haiku)
Per proposal draft:   < £0.05  (Sonnet)
Per agent run:        < £0.50  (Sonnet, budget by token limit)
Per deep analysis:    < £2.00  (Opus, human-approved)
```

---

## Evaluation Framework

### Offline Evaluation (before launch)
```typescript
interface EvalCase {
  input: string
  expected_output: string
  actual_output?: string
  score?: number
}

const runEvalSuite = async (cases: EvalCase[]) => {
  const results = await Promise.all(cases.map(async (c) => {
    const actual = await callAI(c.input)
    const score = await scoreOutput(actual, c.expected_output)
    return { ...c, actual_output: actual, score }
  }))
  
  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length
  console.log(`Eval score: ${avgScore}/100 (${results.length} cases)`)
  return results
}
```

**Minimum eval bar before shipping:**
- Classification tasks: >90% accuracy on 50+ labelled examples
- Generation tasks: >80% "acceptable" rating from Christopher on 20+ examples
- Agentic tasks: >95% task completion without human intervention

### Online Evaluation (after launch)
```
Track weekly:
  - Token usage per user/task (cost drift indicator)
  - Error rate (JSON parse failures, timeouts, empty responses)
  - Latency P50 and P95
  - User feedback signals (if exposed to users)
  
Alert if:
  - Cost per task increases >20% week-on-week
  - Error rate >5%
  - P95 latency >10 seconds for non-streaming
```

---

## RAG Implementation Pattern

When context exceeds what fits in a prompt, use RAG.

```typescript
import { openai } from '@ai-sdk/openai'  // Using Vercel AI SDK embeddings
import { db } from '@/lib/db'
import { embeddings } from '@/lib/db/schema'
import { cosineDistance, desc, gt, sql } from 'drizzle-orm'

const generateEmbedding = async (text: string): Promise<number[]> => {
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: text
  })
  return embedding
}

const retrieveContext = async (query: string, topK = 5) => {
  const queryEmbedding = await generateEmbedding(query)
  
  const similarity = sql<number>`1 - (${cosineDistance(embeddings.embedding, queryEmbedding)})`
  
  const results = await db
    .select({
      content: embeddings.content,
      source: embeddings.source,
      similarity
    })
    .from(embeddings)
    .where(gt(similarity, 0.7))  // Threshold: only retrieve relevant context
    .orderBy(desc(similarity))
    .limit(topK)
    
  return results
}

const answerWithRAG = async (question: string) => {
  const context = await retrieveContext(question)
  
  const contextText = context
    .map(c => `[${c.source}]: ${c.content}`)
    .join('\n\n')
  
  const stream = await streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: `Answer questions using ONLY the provided context. 
    If the answer is not in the context, say so.`,
    messages: [{
      role: 'user',
      content: `Context:\n${contextText}\n\nQuestion: ${question}`
    }]
  })
  
  return stream
}
```

---

## AI Cost Management

**The golden rule:** Always set `max_tokens` based on what the output actually needs. Never leave it at the default.

```typescript
const tokenBudgets = {
  classification:    200,   // Just a label + confidence + reasoning
  short_summary:     500,   // A paragraph
  proposal_draft:   4000,   // Full proposal
  deep_analysis:    8000,   // Complex research output
  agent_step:       1000,   // Per step in an agentic loop
}
```

**Monthly cost tracking:**
```
Track per feature:
  - Total tokens in/out
  - Cost in £
  - Requests per day
  - Cost per unit of value (cost per lead scored, cost per proposal)

Alert: if any feature exceeds £50/month → review and optimise
```

---

## Related
- [[NexoFlow System/Knowledge and Tech/Architecture Patterns]] — system patterns that embed AI
- [[NexoFlow System/Knowledge and Tech/API Integration Library]] — Claude API integration code
- [[NexoFlow System/Playbooks/AI Automation Playbook]] — how to sell and deliver AI automation
- [[NexoFlow System/Standards/NexoFlow Standards]] — stack decisions including Claude
- [[NexoFlow System/Decision Log/DECL-009 - Vercel AI SDK]] — why Vercel AI SDK
