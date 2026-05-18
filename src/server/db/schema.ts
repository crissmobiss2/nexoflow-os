import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

export const projectTypeEnum = pgEnum("nf_project_type", [
  "website", "web_app", "mobile_app", "desktop_app",
  "saas", "marketplace", "internal_tool", "ai_product", "ecommerce", "portal",
]);

export const projectStatusEnum = pgEnum("nf_project_status", [
  "brief", "scored", "scoped", "architected", "generating", "ready", "archived",
]);

export const artifactTypeEnum = pgEnum("nf_artifact_type", [
  "scope_doc", "tech_stack", "architecture", "risk_register",
  "code_bundle", "file_tree", "database_schema", "deployment_config",
]);

export const phaseStatusEnum = pgEnum("nf_phase_status", [
  "pending", "in_progress", "completed", "skipped",
]);

export const scoreDecisionEnum = pgEnum("nf_score_decision", [
  "pass", "conditional", "build", "prioritise",
]);

export const sprintTaskStatusEnum = pgEnum("nf_sprint_status", [
  "backlog", "todo", "in_progress", "review", "done", "cancelled",
]);

export const aiModeEnum = pgEnum("nf_ai_mode", [
  "general", "architect", "tech_advisor", "code_review",
  "security", "performance", "estimator", "scope_writer",
]);

// ─── Clients ──────────────────────────────────────────────────────────────────

export const clients = pgTable("nf_clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  company: varchar("company", { length: 255 }),
  website: varchar("website", { length: 255 }),
  industry: varchar("industry", { length: 255 }),
  companySize: varchar("company_size", { length: 50 }),
  region: varchar("region", { length: 100 }),
  businessDescription: text("business_description"),
  targetCustomers: text("target_customers"),
  currentChallenges: text("current_challenges"),
  existingTech: text("existing_tech"),
  typicalBudget: varchar("typical_budget", { length: 100 }),
  urgency: varchar("urgency", { length: 50 }),
  decisionMakerRole: varchar("decision_maker_role", { length: 100 }),
  notes: text("notes"),
  onboardedAt: timestamp("onboarded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = pgTable(
  "nf_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    projectType: projectTypeEnum("project_type").notNull(),
    industry: varchar("industry", { length: 255 }),
    status: projectStatusEnum("status").default("brief").notNull(),
    opportunityScore: integer("opportunity_score"),
    scoreDecision: scoreDecisionEnum("score_decision"),
    budgetRange: varchar("budget_range", { length: 100 }),
    timelineWeeks: integer("timeline_weeks"),
    portalToken: text("portal_token").unique(),
    portalEnabled: boolean("portal_enabled").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("nf_projects_status_idx").on(t.status),
    index("nf_projects_client_idx").on(t.clientId),
  ],
);

// ─── Project Briefs ───────────────────────────────────────────────────────────

export const projectBriefs = pgTable("nf_project_briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  targetUser: text("target_user"),
  coreJobToBeDone: text("core_job_to_be_done"),
  existingTech: text("existing_tech"),
  keyIntegrations: text("key_integrations"),
  constraints: text("constraints"),
  additionalContext: text("additional_context"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

// ─── Opportunity Scores ───────────────────────────────────────────────────────

export const opportunityScores = pgTable("nf_opportunity_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull().unique(),
  marketSize: integer("market_size").notNull(),
  problemClarity: integer("problem_clarity").notNull(),
  competitiveGap: integer("competitive_gap").notNull(),
  revenueModel: integer("revenue_model").notNull(),
  teamFit: integer("team_fit").notNull(),
  timeToValue: integer("time_to_value").notNull(),
  strategicAlignment: integer("strategic_alignment").notNull(),
  totalScore: integer("total_score").notNull(),
  decision: scoreDecisionEnum("decision").notNull(),
  aiRationale: text("ai_rationale"),
  scoredAt: timestamp("scored_at").defaultNow().notNull(),
});

// ─── Artifacts ────────────────────────────────────────────────────────────────

export const projectArtifacts = pgTable(
  "nf_project_artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
    artifactType: artifactTypeEnum("artifact_type").notNull(),
    content: text("content").notNull(),
    version: integer("version").default(1).notNull(),
    modelUsed: varchar("model_used", { length: 100 }),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("nf_artifacts_project_type_idx").on(t.projectId, t.artifactType)],
);

// ─── Phases ───────────────────────────────────────────────────────────────────

export const projectPhases = pgTable("nf_project_phases", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  phaseName: varchar("phase_name", { length: 100 }).notNull(),
  phaseOrder: integer("phase_order").notNull(),
  status: phaseStatusEnum("status").default("pending").notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

// ─── Knowledge Snippets ───────────────────────────────────────────────────────
// Seeded from the Second Brain snippets.json (67,607 snippets, 123 categories)

export const knowledgeSnippets = pgTable(
  "nf_knowledge_snippets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: varchar("category", { length: 255 }).notNull(),
    name: varchar("name", { length: 500 }).notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1024 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("nf_snippets_category_idx").on(t.category),
    index("nf_snippets_name_idx").on(t.name),
    index("nf_snippets_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

// ─── AI Conversations ─────────────────────────────────────────────────────────

export const aiConversations = pgTable("nf_ai_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  title: varchar("title", { length: 500 }),
  mode: aiModeEnum("mode").default("general").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const aiMessages = pgTable(
  "nf_ai_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .references(() => aiConversations.id, { onDelete: "cascade" })
      .notNull(),
    role: varchar("role", { length: 20 }).notNull(),
    content: text("content").notNull(),
    contextSnippets: integer("context_snippets").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("nf_messages_conv_idx").on(t.conversationId)],
);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const users = pgTable("nf_user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  role: varchar("role", { length: 20 }).default("viewer").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accounts = pgTable(
  "nf_account",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  }),
);

export const sessions = pgTable("nf_session", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "nf_verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  }),
);

// ─── Sprint Tasks ──────────────────────────────────────────────────────────────

export const sprintTasks = pgTable(
  "nf_sprint_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
    phaseId: uuid("phase_id").references(() => projectPhases.id, { onDelete: "set null" }),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    storyPoints: integer("story_points").default(1),
    status: sprintTaskStatusEnum("status").default("backlog").notNull(),
    assigneeId: text("assignee_id").references(() => users.id, { onDelete: "set null" }),
    priority: integer("priority").default(0),
    order: integer("order_val").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("nf_sprint_tasks_project_idx").on(t.projectId)],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const clientRelations = relations(clients, ({ many }) => ({
  projects: many(projects),
}));

export const projectRelations = relations(projects, ({ one, many }) => ({
  client: one(clients, { fields: [projects.clientId], references: [clients.id] }),
  brief: one(projectBriefs, { fields: [projects.id], references: [projectBriefs.projectId] }),
  score: one(opportunityScores, { fields: [projects.id], references: [opportunityScores.projectId] }),
  artifacts: many(projectArtifacts),
  phases: many(projectPhases),
  conversations: many(aiConversations),
}));

export const briefRelations = relations(projectBriefs, ({ one }) => ({
  project: one(projects, { fields: [projectBriefs.projectId], references: [projects.id] }),
}));

export const artifactRelations = relations(projectArtifacts, ({ one }) => ({
  project: one(projects, { fields: [projectArtifacts.projectId], references: [projects.id] }),
}));

export const phaseRelations = relations(projectPhases, ({ one }) => ({
  project: one(projects, { fields: [projectPhases.projectId], references: [projects.id] }),
}));

export const sprintTaskRelations = relations(sprintTasks, ({ one }) => ({
  project: one(projects, { fields: [sprintTasks.projectId], references: [projects.id] }),
  assignee: one(users, { fields: [sprintTasks.assigneeId], references: [users.id] }),
}));

export const conversationRelations = relations(aiConversations, ({ one, many }) => ({
  project: one(projects, { fields: [aiConversations.projectId], references: [projects.id] }),
  messages: many(aiMessages),
}));

export const messageRelations = relations(aiMessages, ({ one }) => ({
  conversation: one(aiConversations, { fields: [aiMessages.conversationId], references: [aiConversations.id] }),
}));

export const userRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const accountRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));
