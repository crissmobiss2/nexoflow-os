import { createTRPCRouter } from "../trpc";
import { projectsRouter } from "./projects";
import { clientsRouter } from "./clients";
import { knowledgeRouter } from "./knowledge";
import { aiRouter } from "./ai";

export const appRouter = createTRPCRouter({
  projects: projectsRouter,
  clients: clientsRouter,
  knowledge: knowledgeRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;
