---
name: context
description: Context engineering principles for building high-quality AI agent systems — context optimization, prompt architecture, multi-agent patterns
---

# Context Engineering for AI Agent Systems

Context engineering is the discipline of managing the model's context window holistically — system prompts, tool definitions, retrieved documents, message history, and tool outputs. Signal-to-noise ratio beats raw context size.

## Core Principles

### 1. Signal Over Noise
Every token must earn its place. Remove:
- Filler phrases ("Please", "As an AI", "Certainly!")
- Redundant restatements of obvious facts
- Over-hedged disclaimers that dilute the directive
- Explanations of what the code does (let names explain)

### 2. Structure Before Style
For generation tasks (HTML, code), establish the **skeleton first**:
```
BAD:  "Write a complete website with CSS, animations, and sections..."
GOOD: "Output <!DOCTYPE html> first. Structure: [7 explicit sections]. 
       Then <style> block. Then body content for each section."
```
Without this, models fill the token budget with CSS before writing body HTML.

### 3. Specificity Beats Length
Replace vague adjectives with specific outcomes:
```
BAD:  "nice modern cards with good design"
GOOD: "3 glassmorphism cards (backdrop-filter:blur(12px), border:1px solid rgba(255,255,255,0.08)) 
       each with a 32×32 inline SVG icon, 18px heading, 14px description"
```

### 4. Front-Load Critical Constraints
Put the most important constraints at the TOP of the prompt, not buried:
```
BAD:  [500 words of context] ... "Output ONLY HTML, no markdown"
GOOD: "Output ONLY valid HTML starting with <!DOCTYPE html> — no markdown, no explanation.
       [then context]"
```

### 5. Use Examples, Not Instructions
Show the desired output pattern directly:
```
BAD:  "Use CSS custom properties for colors"
GOOD: ":root{--primary:#7c5cbf;--bg:#0d0b09;--text:#fff;--muted:#a0a0b0}"
```

## Prompt Architecture Patterns

### The Three-Part Structure
```
[ROLE + FORMAT DIRECTIVE]     ← 1-2 sentences, front-loaded
[CONTEXT BLOCK]               ← structured data about the prospect/task
[TECHNICAL SPEC]              ← exact requirements, not aspirational goals
```

### Context Blocks (Use Tables or Labeled Sections)
```
PROSPECT
Company: Acme Corp | Industry: SaaS | Contact: Jane Smith (CTO)
Pain points: manual reporting, 3-hour weekly data exports
Target customers: mid-market operations teams

BRAND  
Primary: #1a56db | Secondary: #7c3aed | Font: Plus Jakarta Sans
```

### The "What NOT to Do" Directive
Including 1-3 anti-patterns is more effective than repeating what to do:
```
CONSTRAINTS
- No external images — CSS gradients only
- No icon libraries — inline SVG only  
- No markdown output — pure HTML starting with <!DOCTYPE
```

## Multi-Agent Context Isolation

Sub-agents exist to **isolate context**, not simulate org roles.

### When to Use Sub-Agents
- Task A and Task B need different context windows (e.g., research vs. code generation)
- One task's output floods context before another task needs it
- Parallel execution saves wall-clock time on independent operations

### File System as Context Buffer
For tasks that exceed 1 context window, use files as the handoff medium:
1. Agent 1 writes research to `context/research.md`
2. Agent 2 reads only what it needs from that file
3. Context stays clean in each agent

## Token Budget Management

### For 8K Token Generation (HTML demos)
- Prompt: ~800 tokens (100 lines)
- CSS style block: ~2000 tokens
- HTML body with 7 sections: ~5000 tokens
- Reserve: ~200 tokens

### Efficiency Rules
- CSS: use shorthand, combine selectors, CSS custom properties
- HTML: semantic structure, no div soup
- Inline SVGs: keep paths under 200 chars; use simple geometric shapes

## Context Degradation Patterns to Avoid

### The Telephone Problem
Each sub-agent call that summarizes and passes context loses fidelity.
Fix: pass the original data, not a summary of a summary.

### Context Stuffing
Sending 10KB of irrelevant codebase context to a focused task.
Fix: extract only the relevant section, not the entire file.

### Recency Bias
Models weight recent tokens more heavily. Put your most important directive last in the prompt, not first.
Exception: FORMAT directives (like "output only HTML") go first to prevent markdown wrapping.
