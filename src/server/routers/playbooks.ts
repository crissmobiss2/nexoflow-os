import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { projects, projectPlaybooks } from "../db/schema";
import fs from "fs/promises";
import path from "path";

/**
 * Map project types to playbook filenames
 */
const PLAYBOOK_MAP: Record<string, string> = {
  website: "Website Build Playbook",
  web_app: "Website Build Playbook",
  mobile_app: "Mobile App Build Playbook",
  desktop_app: "Desktop App Build Playbook",
  saas: "SaaS Build Playbook",
  marketplace: "SaaS Build Playbook",
  internal_tool: "Data Engineering Playbook",
  ai_product: "AI Automation Playbook",
  ecommerce: "Website Build Playbook",
  portal: "Website Build Playbook",
};

/**
 * Get the path to the playbooks directory from SECOND_BRAIN_PATH or default
 */
function getPlaybooksDir(): string {
  const secondBrainPath = process.env.SECOND_BRAIN_PATH;
  if (secondBrainPath) {
    return path.join(secondBrainPath, "NexoFlow System", "Playbooks");
  }
  return "/opt/data/second-brain/NexoFlow System/Playbooks";
}

/**
 * Sanitize playbook content: remove frontmatter, limit length, strip sensitive data
 */
function sanitizePlaybookContent(content: string): string {
  // Remove YAML frontmatter
  let clean = content.replace(/^---[\s\S]*?---\n*/, "").trim();

  // Remove internal tags and references
  clean = clean.replace(/\btags:\s*\[.*?\]/gi, "");
  clean = clean.replace(/\[nexoflow.*?\]/gi, "");

  // Limit to first 15,000 chars for client view
  if (clean.length > 15000) {
    clean = clean.slice(0, 15000) + "\n\n*…playbook truncated for client view*";
  }

  return clean;
}

export const playbookRouter = createTRPCRouter({
  /**
   * Generate or refresh a project's playbook from the vault.
   * Reads the relevant playbook from the Second Brain filesystem,
   * sanitizes it, and stores it in the database.
   */
  generatePlaybook: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { projectId } = input;

      // Fetch the project to determine its type
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });

      if (!project) {
        throw new Error("Project not found");
      }

      const playbookName = PLAYBOOK_MAP[project.projectType] ?? "SaaS Build Playbook";
      const playbooksDir = getPlaybooksDir();
      const filePath = path.join(playbooksDir, `${playbookName}.md`);

      let rawContent: string;
      try {
        rawContent = await fs.readFile(filePath, "utf-8");
      } catch {
        // Fallback to a default playbook
        rawContent = `# ${playbookName}\n\n> Build playbook for ${project.projectType} projects.\n\n## Phase 1 — Define\n\nDefine the scope and requirements.\n\n## Phase 2 — Build\n\nExecute the build according to the scope.\n\n## Phase 3 — Launch\n\nDeploy and launch.\n`;
      }

      const sanitizedContent = sanitizePlaybookContent(rawContent);

      // Upsert into the database
      const existing = await ctx.db.query.projectPlaybooks.findFirst({
        where: eq(projectPlaybooks.projectId, projectId),
      });

      if (existing) {
        await ctx.db
          .update(projectPlaybooks)
          .set({
            playbookName,
            content: sanitizedContent,
            version: existing.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(projectPlaybooks.projectId, projectId));
      } else {
        await ctx.db.insert(projectPlaybooks).values({
          projectId,
          playbookName,
          content: sanitizedContent,
          version: 1,
        });
      }

      return { playbookName, version: existing ? existing.version + 1 : 1 };
    }),

  /**
   * Get the playbook for a project (public, for portal access)
   */
  getProjectPlaybook: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const playbook = await ctx.db.query.projectPlaybooks.findFirst({
        where: eq(projectPlaybooks.projectId, input.projectId),
      });

      if (!playbook) {
        return null;
      }

      return {
        id: playbook.id,
        playbookName: playbook.playbookName,
        content: playbook.content,
        version: playbook.version,
        createdAt: playbook.createdAt,
      };
    }),

  /**
   * Get the playbook for a portal by token
   */
  getPortalPlaybook: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: eq(projects.portalToken, input.token),
      });

      if (!project) return null;

      const playbook = await ctx.db.query.projectPlaybooks.findFirst({
        where: eq(projectPlaybooks.projectId, project.id),
      });

      if (!playbook) return null;

      return {
        id: playbook.id,
        playbookName: playbook.playbookName,
        content: playbook.content,
        version: playbook.version,
        createdAt: playbook.createdAt,
      };
    }),
});
