import { createTRPCRouter } from "../trpc";
import { projectsRouter } from "./projects";
import { clientsRouter } from "./clients";
import { knowledgeRouter } from "./knowledge";
import { aiRouter } from "./ai";
import { sprintTasksRouter } from "./sprintTasks";
import { invoicesRouter } from "./invoices";
import { teamRouter } from "./team";
import { commentsRouter } from "./comments";
import { apiKeysRouter } from "./apiKeys";
import { auditLogRouter } from "./auditLog";
import { templatesRouter } from "./templates";
import { searchRouter } from "./search";

export const appRouter = createTRPCRouter({
  projects: projectsRouter,
  clients: clientsRouter,
  knowledge: knowledgeRouter,
  ai: aiRouter,
  sprintTasks: sprintTasksRouter,
  invoices: invoicesRouter,
  team: teamRouter,
  comments: commentsRouter,
  apiKeys: apiKeysRouter,
  auditLog: auditLogRouter,
  templates: templatesRouter,
  search: searchRouter,
});

export type AppRouter = typeof appRouter;
