import { createTRPCRouter } from "../trpc";
import { projectsRouter } from "./projects";
import { clientsRouter } from "./clients";

export const appRouter = createTRPCRouter({
  projects: projectsRouter,
  clients: clientsRouter,
});

export type AppRouter = typeof appRouter;
