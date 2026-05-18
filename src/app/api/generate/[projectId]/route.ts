import { type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/server/db";
import { projects, projectArtifacts } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { loadBrainContext } from "@/lib/ai/brain-context";
import { env } from "@/env";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: { brief: true, artifacts: true },
  });

  if (!project) {
    return new Response("Project not found", { status: 404 });
  }

  const scopeArtifact = project.artifacts.find((a) => a.artifactType === "scope_doc");
  const archArtifact = project.artifacts.find((a) => a.artifactType === "architecture");

  if (!archArtifact) {
    return new Response("Generate architecture first", { status: 400 });
  }

  const context = await loadBrainContext(["standards", "tech"]);

  const systemPrompt = `You are the NexoFlow OS code generation engine. You produce production-ready boilerplate for software projects using NexoFlow's engineering standards.

NexoFlow default stacks:
- Web: Next.js 15 App Router + tRPC + Drizzle ORM + Postgres + shadcn/ui + Tailwind v4 + TypeScript strict
- Mobile: React Native + Expo (Expo Router) + TypeScript strict
- Desktop: Tauri v2 + React + TypeScript + Rust backend
- AI: Vercel AI SDK + @anthropic-ai/sdk + streaming responses

RULES:
- Generate complete, working files — no TODO comments or placeholder logic
- Use TypeScript strict mode everywhere
- Follow NexoFlow naming conventions and file structure
- Include all required dependencies in package.json
- Format each file exactly as: \`\`\`filepath:path/to/file.ext followed by content then \`\`\`
- Generate at minimum: package.json, tsconfig.json, README.md, and the 6 most important source files
- Never truncate files — always complete them fully`;

  const userPrompt = `Generate production-ready boilerplate for this project.

PROJECT: ${project.name}
TYPE: ${project.projectType}
INDUSTRY: ${project.industry ?? "general"}
BUDGET: ${project.budgetRange ?? "TBD"}

SCOPE DOCUMENT:
${scopeArtifact?.content ?? "No scope document — generate based on project type"}

ARCHITECTURE:
${archArtifact.content}

NEXOFLOW ENGINEERING CONTEXT:
${context}

Generate the complete starter codebase. For each file use this exact format:
\`\`\`filepath:relative/path/to/file.ts
<complete file content>
\`\`\`

Generate at minimum 8 files covering: package.json, tsconfig.json, environment config, database schema, core API layer, main layout/entry, one feature page, and README.`;

  const encoder = new TextEncoder();
  let fullContent = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const messageStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 8000,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        });

        for await (const event of messageStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const text = event.delta.text;
            fullContent += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }

        // Save artifact after streaming completes
        await db.insert(projectArtifacts).values({
          projectId,
          artifactType: "code_bundle",
          content: fullContent,
          modelUsed: "claude-sonnet-4-6",
          version: 1,
        }).onConflictDoNothing();

        // Update project status
        await db.update(projects)
          .set({ status: "ready", updatedAt: new Date() })
          .where(eq(projects.id, projectId));

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Generation failed";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
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
