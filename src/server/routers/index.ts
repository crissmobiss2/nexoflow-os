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
import { analyticsRouter } from "./analytics";
import { notificationsRouter } from "./notifications";
import { dataRouter } from "./data";
import { syncRouter } from "./sync";
import { decisionLogRouter } from "./decisionLog";
import { playbookRouter } from "./playbooks";
import { leadsRouter } from "./leads";
import { industryProfilesRouter } from "./industryProfiles";
import { outreachTemplatesRouter } from "./outreachTemplates";
import { affiliatesRouter } from "./affiliates";
import { caseStudiesRouter } from "./caseStudies";
import { timeTrackingRouter } from "./timeTracking";
import { onboardingRouter } from "./onboarding";
import { wikiRouter } from "./wiki";
import { clientMessagesRouter } from "./clientMessages";
import { proposalsRouter } from "./proposals";

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
  analytics: analyticsRouter,
  notifications: notificationsRouter,
  data: dataRouter,
  sync: syncRouter,
  decisionLog: decisionLogRouter,
  playbooks: playbookRouter,
  leads: leadsRouter,
  industryProfiles: industryProfilesRouter,
  outreachTemplates: outreachTemplatesRouter,
  affiliates: affiliatesRouter,
  caseStudies: caseStudiesRouter,
  timeTracking: timeTrackingRouter,
  onboarding: onboardingRouter,
  wiki: wikiRouter,
  clientMessages: clientMessagesRouter,
  proposals: proposalsRouter,
});

export type AppRouter = typeof appRouter;
