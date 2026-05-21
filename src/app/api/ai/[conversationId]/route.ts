import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/server/db";
import { aiConversations, aiMessages, knowledgeSnippets } from "@/server/db/schema";
import { eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getVaultContext, formatVaultContext } from "@/lib/ai/vault-context";

const client = new Anthropic();

// Maps AI mode to relevant snippet categories
const MODE_CATEGORIES: Record<string, string[]> = {
  general:      ["Architecture", "Software Design Patterns", "Clean Code", "Engineering Ethics", "Reference"],
  architect:    ["Architecture", "System Design", "System Design & Architecture", "Microservices", "Database Design", "Cloud Architecture", "API Design"],
  tech_advisor: ["Architecture", "Frontend", "Backend", "Mobile", "Database", "Cloud", "DevOps", "AI", "Build Tools"],
  code_review:  ["Clean Code", "Code Quality", "Code Review", "Testing", "Security", "SOLID Principles", "Refactoring", "Error Handling"],
  security:     ["Security", "Application Security", "Security Deep", "Web Security", "Authentication", "Authorization", "OWASP", "Cloud Security"],
  performance:  ["Performance", "Frontend Performance", "Backend Performance", "Database Performance", "Web Performance", "Performance Engineering", "Caching"],
  estimator:    ["Career Growth", "Agile Practices", "Project Management", "Software Development Lifecycle", "Communication"],
  scope_writer: ["Architecture", "System Design", "API Design", "Database Design", "DevOps Practices", "Security"],
};

// System prompts per mode
const MODE_SYSTEM: Record<string, string> = {
  general: `You are the NexoFlow OS AI — a senior engineering intelligence assistant for the NexoFlow team. NexoFlow is a UK-based software studio building websites, web apps, mobile apps, SaaS products, and AI systems for ambitious clients worldwide.

You have access to NexoFlow's complete second brain: 67,607 knowledge snippets covering architecture, security, performance, frontend, backend, mobile, DevOps, AI, databases, testing, design patterns, and more.

Answer questions with precision, use concrete examples, and always reference what NexoFlow would actually use (Next.js 16+, tRPC, Drizzle, React Native + Expo, Tauri, Claude AI). Be opinionated — give the best answer, not a safe one.`,

  architect: `You are NexoFlow's Senior Solutions Architect. Your job is to design production-grade systems for NexoFlow's clients.

Default stack: Next.js 16+ (App Router), tRPC v11, Drizzle ORM + Neon Postgres, Auth.js v5, shadcn/ui + Tailwind v4, Vercel hosting.

When designing architecture: think about scalability first, security second, developer experience third. Always explain trade-offs. Give specific decisions — never hedge with "it depends" without giving a recommendation.`,

  tech_advisor: `You are NexoFlow's Tech Stack Advisor. When a team member describes a project, you recommend the exact technology stack with version numbers, explain why, and identify risks.

Always reference NexoFlow's defaults and only deviate when there's a clear technical reason. Be decisive. Clients pay for opinions, not options.`,

  code_review: `You are NexoFlow's Lead Code Reviewer. Review code for correctness, security, performance, and maintainability.

Check for: SQL injection, XSS, N+1 queries, type safety issues, missing error handling, race conditions, memory leaks, and accessibility problems. Be specific about line numbers and exact fixes.`,

  security: `You are NexoFlow's Security Engineer. Conduct security audits and identify vulnerabilities in code, architecture, and configuration.

Cover OWASP Top 10, authentication/authorization issues, secrets management, dependency vulnerabilities, and infrastructure security. Provide severity ratings (Critical/High/Medium/Low) and specific remediation steps.`,

  performance: `You are NexoFlow's Performance Engineer. Identify and fix performance bottlenecks across frontend, backend, and database layers.

Focus on: Core Web Vitals (LCP < 2.5s, INP < 200ms, CLS < 0.1), database query optimization, caching strategies, bundle size, and server response times. Provide before/after metrics when possible.`,

  estimator: `You are NexoFlow's Project Estimator. Give accurate, realistic estimates for software projects.

Use story points (1=minutes, 2=hours, 3=half day, 5=day, 8=multi-day, 13=break it down). Include risk buffers. Account for: discovery, design, development, testing, deployment, and documentation. Always give a range, not a single number. Flag your biggest uncertainty assumptions.`,

  scope_writer: `You are NexoFlow's Senior Product Manager. Write precise, professional scope documents for client projects.

Use NexoFlow's scope format: Overview, What We're Building (concrete features, not vague descriptions), What's Not Included, Technical Approach, Client Responsibilities, Timeline, Investment (value-based pricing), Risks. Write like a client will read it tomorrow.`,
};

function sse(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

async function getRelevantContext(conversationId: string, userMessage: string, mode: string): Promise<{ context: string; count: number; vaultSnippets: { name: string; category: string }[] }> {
  const modeCategories = MODE_CATEGORIES[mode] ?? MODE_CATEGORIES.general!;

  // Pull snippets: prioritise by category match and keyword match in name
  const keywords = userMessage
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5);

  let snippets: { category: string; name: string; content: string }[] = [];
  const vaultSnippets: { name: string; category: string }[] = [];

  // First: try live vault RAG with semantic search
  try {
    const vaultResults = await getVaultContext(userMessage, 10);
    if (vaultResults.length > 0) {
      const formattedLive = formatVaultContext(vaultResults);
      for (const r of vaultResults) {
        vaultSnippets.push({ name: r.name, category: r.category });
      }
      snippets = vaultResults.map((r) => ({
        category: r.category,
        name: r.name,
        content: r.content,
      }));
    }
  } catch {
    // Fall through to existing context mechanism
  }

  // Fallback: use existing text-based context mechanism
  if (snippets.length === 0) {
    // First: keyword matches across relevant categories
    if (keywords.length > 0) {
      const keyword = keywords[0]!;
      const nameMatches = await db
        .select({ category: knowledgeSnippets.category, name: knowledgeSnippets.name, content: knowledgeSnippets.content })
        .from(knowledgeSnippets)
        .where(
          or(
            ilike(knowledgeSnippets.name, `%${keyword}%`),
            ...(keywords.slice(1).map((k) =>
              ilike(knowledgeSnippets.name, `%${k}%`)
            )),
          ),
        )
        .limit(15);
      snippets = [...nameMatches];
    }

    // Then: category-based snippets
    const catSnippets = await db
      .select({ category: knowledgeSnippets.category, name: knowledgeSnippets.name, content: knowledgeSnippets.content })
      .from(knowledgeSnippets)
      .where(inArray(knowledgeSnippets.category, modeCategories))
      .orderBy(sql`random()`)
      .limit(20);

    snippets = [...snippets, ...catSnippets];
  }

  // Deduplicate by name
  const seen = new Set<string>();
  const unique = snippets.filter((s) => {
    if (seen.has(s.name)) return false;
    seen.add(s.name);
    return true;
  }).slice(0, 25);

  if (unique.length === 0) return { context: "", count: 0, vaultSnippets };

  const context = `## NexoFlow Second Brain Context (${unique.length} relevant snippets)\n\n` +
    unique.map((s) => `### [${s.category}] ${s.name}\n\n${s.content}`).join("\n\n---\n\n");

  return { context, count: unique.length, vaultSnippets };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;

  let body: { message: string };
  try {
    body = await req.json() as { message: string };
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { message } = body;
  if (!message?.trim()) return new Response("Message required", { status: 400 });

  // Load conversation
  const convo = await db.query.aiConversations.findFirst({
    where: eq(aiConversations.id, conversationId),
    with: { messages: { orderBy: (m, { asc }) => [asc(m.createdAt)] } },
  });

  if (!convo) return new Response("Conversation not found", { status: 404 });

  // Get relevant second brain context
  const { context, count, vaultSnippets } = await getRelevantContext(conversationId, message, convo.mode);

  // Save user message
  await db.insert(aiMessages).values({
    conversationId,
    role: "user",
    content: message,
  });

  // Build message history for Claude
  const history: Anthropic.MessageParam[] = convo.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  history.push({ role: "user", content: message });

  const systemPrompt = [
    MODE_SYSTEM[convo.mode] ?? MODE_SYSTEM.general!,
    context ? `\n\n${context}` : "",
  ].join("");

  // Stream response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = "";

      try {
        const apiStream = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          system: systemPrompt,
          messages: history,
          stream: true,
        });

        controller.enqueue(encoder.encode(sse({ snippets: count, vaultSnippets: vaultSnippets.length })));

        for await (const event of apiStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            fullResponse += event.delta.text;
            controller.enqueue(encoder.encode(sse({ text: event.delta.text })));
          }
          if (event.type === "message_stop") {
            // Save assistant message
            await db.insert(aiMessages).values({
              conversationId,
              role: "assistant",
              content: fullResponse,
              contextSnippets: count,
            });
            await db
              .update(aiConversations)
              .set({ updatedAt: new Date() })
              .where(eq(aiConversations.id, conversationId));

            controller.enqueue(encoder.encode(sse({ done: true })));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(sse({ error: msg })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
