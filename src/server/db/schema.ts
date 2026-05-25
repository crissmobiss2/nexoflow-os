import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
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

export const invoiceStatusEnum = pgEnum("nf_invoice_status", [
  "draft", "sent", "paid", "overdue", "cancelled",
]);

export const teamRoleEnum = pgEnum("nf_team_role", [
  "owner", "admin", "pm", "developer", "viewer",
]);

export const invitationStatusEnum = pgEnum("nf_invitation_status", [
  "pending", "accepted", "expired", "cancelled",
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
  portalToken: text("portal_token").unique(),
  portalEnabled: boolean("portal_enabled").default(false).notNull(),
  slackWebhookUrl: varchar("slack_webhook_url", { length: 500 }),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
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
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
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
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
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
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
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
    dueDate: timestamp("due_date"),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("nf_sprint_tasks_project_idx").on(t.projectId)],
);

// ─── Invoices ─────────────────────────────────────────────────────────────────

export const invoices = pgTable(
  "nf_invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    milestoneStep: integer("milestone_step"), // 1 = kickoff (30%), 2 = midpoint (40%), 3 = delivery (30%)
    invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
    status: invoiceStatusEnum("status").default("draft").notNull(),
    subtotal: integer("subtotal").notNull().default(0),
    tax: integer("tax").notNull().default(0),
    total: integer("total").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    recurringInterval: varchar("recurring_interval", { length: 20 }), // "monthly" | "weekly" | "quarterly"
    recurringEnabled: boolean("recurring_enabled").default(false).notNull(),
    nextRecurringAt: timestamp("next_recurring_at"),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    dueDate: timestamp("due_date"),
    paidDate: timestamp("paid_date"),
    notes: text("notes"),
    stripePaymentUrl: varchar("stripe_payment_url", { length: 1000 }),
    stripePaymentLinkId: varchar("stripe_payment_link_id", { length: 255 }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("nf_invoices_client_idx").on(t.clientId),
    index("nf_invoices_status_idx").on(t.status),
  ],
);

export const invoiceLineItems = pgTable(
  "nf_invoice_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    rate: integer("rate").notNull().default(0),
    amount: integer("amount").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("nf_line_items_invoice_idx").on(t.invoiceId)],
);

// ─── Teams ────────────────────────────────────────────────────────────────────

export const teams = pgTable("nf_teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const teamMembers = pgTable(
  "nf_team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    role: teamRoleEnum("role").default("developer").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("nf_team_members_team_idx").on(t.teamId),
    index("nf_team_members_user_idx").on(t.userId),
  ],
);

export const invitations = pgTable(
  "nf_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    role: teamRoleEnum("role").default("developer").notNull(),
    status: invitationStatusEnum("status").default("pending").notNull(),
    invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("nf_invitations_team_idx").on(t.teamId)],
);

// ─── Project Comments ─────────────────────────────────────────────────────────

export const comments = pgTable(
  "nf_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    authorName: varchar("author_name", { length: 255 }).notNull(),
    content: text("content").notNull(),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("nf_comments_project_idx").on(t.projectId)],
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
  comments: many(comments),
  sprintTasks: many(sprintTasks),
  playbook: one(projectPlaybooks, { fields: [projects.id], references: [projectPlaybooks.projectId] }),
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
  sprintTasks: many(sprintTasks),
  teamMemberships: many(teamMembers),
  invitedInvitations: many(invitations, { relationName: "invitedBy" }),
  createdInvoices: many(invoices, { relationName: "createdBy" }),
}));

export const invoiceRelations = relations(invoices, ({ one, many }) => ({
  client: one(clients, { fields: [invoices.clientId], references: [clients.id] }),
  project: one(projects, { fields: [invoices.projectId], references: [projects.id] }),
  author: one(users, { fields: [invoices.createdBy], references: [users.id], relationName: "createdBy" }),
  lineItems: many(invoiceLineItems),
}));

export const invoiceLineItemRelations = relations(invoiceLineItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceLineItems.invoiceId], references: [invoices.id] }),
}));

export const teamRelations = relations(teams, ({ many }) => ({
  members: many(teamMembers),
  invitations: many(invitations),
}));

export const teamMemberRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
}));

export const invitationRelations = relations(invitations, ({ one }) => ({
  team: one(teams, { fields: [invitations.teamId], references: [teams.id] }),
  inviter: one(users, { fields: [invitations.invitedBy], references: [users.id], relationName: "invitedBy" }),
}));

export const commentRelations = relations(comments, ({ one }) => ({
  project: one(projects, { fields: [comments.projectId], references: [projects.id] }),
}));

// ─── API Keys ─────────────────────────────────────────────────────────────────

export const apiKeys = pgTable(
  "nf_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    keyPrefix: varchar("key_prefix", { length: 8 }).notNull(),
    keyHash: text("key_hash").notNull(),
    keyLastChars: varchar("key_last_chars", { length: 4 }).notNull(),
    permissions: text("permissions").notNull().default("read"), // comma-separated scopes
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("nf_api_keys_prefix_idx").on(t.keyPrefix)],
);

export const apiKeyRelations = relations(apiKeys, ({ one }) => ({
  creator: one(users, { fields: [apiKeys.createdBy], references: [users.id] }),
}));

// ─── Audit Log ────────────────────────────────────────────────────────────────

export const auditLogs = pgTable(
  "nf_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    userName: varchar("user_name", { length: 255 }),
    action: varchar("action", { length: 100 }).notNull(), // e.g. "create", "update", "delete"
    targetType: varchar("target_type", { length: 100 }).notNull(), // e.g. "project", "client", "api_key"
    targetId: varchar("target_id", { length: 255 }),
    details: text("details"), // JSON string
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("nf_audit_logs_action_idx").on(t.action),
    index("nf_audit_logs_user_idx").on(t.userId),
    index("nf_audit_logs_target_idx").on(t.targetType, t.targetId),
    index("nf_audit_logs_created_idx").on(t.createdAt),
  ],
);

export const auditLogRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

// ─── Project Templates ────────────────────────────────────────────────────────

export const projectTemplates = pgTable(
  "nf_project_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    projectType: projectTypeEnum("project_type").notNull(),
    defaultBriefTemplate: text("default_brief_template"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    isBuiltIn: boolean("is_built_in").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("nf_templates_type_idx").on(t.projectType)],
);

export const projectTemplateItems = pgTable(
  "nf_project_template_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id")
      .references(() => projectTemplates.id, { onDelete: "cascade" })
      .notNull(),
    phaseName: varchar("phase_name", { length: 100 }).notNull(),
    phaseOrder: integer("phase_order").notNull(),
    description: text("description"),
  },
  (t) => [index("nf_template_items_template_idx").on(t.templateId)],
);

export const projectTemplateRelations = relations(projectTemplates, ({ one, many }) => ({
  creator: one(users, { fields: [projectTemplates.createdBy], references: [users.id] }),
  phases: many(projectTemplateItems),
}));

export const projectTemplateItemRelations = relations(projectTemplateItems, ({ one }) => ({
  template: one(projectTemplates, {
    fields: [projectTemplateItems.templateId],
    references: [projectTemplates.id],
  }),
}));

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationTypeEnum = pgEnum("nf_notification_type", [
  "project_status", "sprint_task", "comment", "invoice", "team_invite", "ai_conversation", "client_onboarding",
]);

export const notifications = pgTable(
  "nf_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(), // No FK — allows userId='system' for system-generated notifications
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    message: text("message"),
    link: text("link"),
    read: boolean("read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("nf_notifications_user_read_idx").on(t.userId, t.read),
    index("nf_notifications_created_idx").on(t.createdAt),
  ],
);

// notificationRelations: userId is plain text (no FK), so no relation defined

// ─── Sync Metadata ────────────────────────────────────────────────────────────

export const syncMetadata = pgTable("nf_sync_metadata", {
  id: uuid("id").primaryKey().defaultRandom(),
  lastSyncAt: timestamp("last_sync_at").defaultNow().notNull(),
  filesCount: integer("files_count").default(0).notNull(),
  status: varchar("status", { length: 50 }).default("idle").notNull(), // idle | syncing | error
  errorMessage: text("error_message"),
});

// ─── Decision Log ────────────────────────────────────────────────────────────

export const decisionLogStatusEnum = pgEnum("nf_decl_status", [
  "proposed", "accepted", "deprecated", "superseded",
]);

export const decisionLog = pgTable("nf_decision_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  declNumber: varchar("decl_number", { length: 50 }).unique().notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  status: decisionLogStatusEnum("status").default("proposed").notNull(),
  affectedStandards: text("affected_standards").array(),
  affectedMocs: text("affected_mocs").array(),
  context: text("context"),
  decision: text("decision").notNull(),
  consequences: text("consequences"),
  date: timestamp("date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const decisionLogRelations = relations(decisionLog, () => ({}));

// ─── Project Playbooks ────────────────────────────────────────────────────────
// Sanitized playbook content from vault, stored for client portal access

export const projectPlaybooks = pgTable("nf_project_playbooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  playbookName: varchar("playbook_name", { length: 255 }).notNull(),
  content: text("content").notNull(),
  version: integer("version").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectPlaybookRelations = relations(projectPlaybooks, ({ one }) => ({
  project: one(projects, { fields: [projectPlaybooks.projectId], references: [projects.id] }),
}));

// ─── Leads / Pipeline ────────────────────────────────────────────────────────

export const leadStatusEnum = pgEnum("nf_lead_status", [
  "new", "reviewing", "demo_queued", "demo_generated", "sent", "replied", "won", "lost", "archived",
]);

export const leadSourceEnum = pgEnum("nf_lead_source", [
  "csv_import", "manual", "api", "web_scraper",
]);

export const outreachChannelEnum = pgEnum("nf_outreach_channel", [
  "email", "whatsapp", "sms", "link",
]);

export const leads = pgTable(
  "nf_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: varchar("first_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    linkedIn: varchar("linkedin", { length: 500 }),
    company: varchar("company", { length: 255 }),
    website: varchar("website", { length: 500 }),
    industry: varchar("industry", { length: 255 }),
    companySize: varchar("company_size", { length: 50 }),
    region: varchar("region", { length: 100 }),
    jobTitle: varchar("job_title", { length: 255 }),
    techStack: text("tech_stack"),
    painPoints: text("pain_points"),
    scrapedData: text("scraped_data"),
    scrapedProfile: jsonb("scraped_profile").$type<ScrapedProfile>(),
    scrapedAt: timestamp("scraped_at"),
    businessProfile: jsonb("business_profile").$type<BusinessProfile>(),
    businessProfileAt: timestamp("business_profile_at"),
    status: leadStatusEnum("status").default("new").notNull(),
    source: leadSourceEnum("source").default("manual").notNull(),
    aiInsights: text("ai_insights"),
    aiScore: integer("ai_score"), // 0-100
    aiScoreReason: text("ai_score_reason"),
    enrichedAt: timestamp("enriched_at"),
    demoHtml: text("demo_html"),
    demoUrl: varchar("demo_url", { length: 500 }),
    demoBlobUrl: varchar("demo_blob_url", { length: 1000 }),
    demoGeneratedAt: timestamp("demo_generated_at"),
    demoViewCount: integer("demo_view_count").default(0).notNull(),
    demoLastViewedAt: timestamp("demo_last_viewed_at"),
    demoTotalSeconds: integer("demo_total_seconds").default(0).notNull(),
    shareToken: varchar("share_token", { length: 64 }),
    shareRevokedAt: timestamp("share_revoked_at"),
    proposalHtml: text("proposal_html"),
    proposalUrl: varchar("proposal_url", { length: 500 }),
    proposalBlobUrl: varchar("proposal_blob_url", { length: 1000 }),
    industryProfileId: uuid("industry_profile_id"),
    wonValueCents: integer("won_value_cents"),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
    assignedTo: text("assigned_to").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    tags: text("tags").array(),
    sourceDetail: varchar("source_detail", { length: 255 }),
    affiliateCode: varchar("affiliate_code", { length: 32 }),
    bookingRef: varchar("booking_ref", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("nf_leads_status_idx").on(t.status),
    index("nf_leads_team_idx").on(t.teamId),
    index("nf_leads_email_idx").on(t.email),
    index("nf_leads_share_token_idx").on(t.shareToken),
  ],
);

export const leadOutreach = pgTable(
  "nf_lead_outreach",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }).notNull(),
    channel: outreachChannelEnum("channel").notNull(),
    subject: varchar("subject", { length: 500 }),
    message: text("message").notNull(),
    shareLink: varchar("share_link", { length: 500 }),
    providerMessageId: varchar("provider_message_id", { length: 255 }),
    providerStatus: varchar("provider_status", { length: 64 }),
    providerError: text("provider_error"),
    openedAt: timestamp("opened_at"),
    clickedAt: timestamp("clicked_at"),
    repliedAt: timestamp("replied_at"),
    sentBy: text("sent_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("nf_lead_outreach_lead_idx").on(t.leadId),
    index("nf_lead_outreach_provider_id_idx").on(t.providerMessageId),
  ],
);

// ─── Demo views (per-session telemetry) ──────────────────────────────────────

export const leadDemoViews = pgTable(
  "nf_lead_demo_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }).notNull(),
    sessionId: varchar("session_id", { length: 64 }).notNull(),
    referrer: varchar("referrer", { length: 500 }),
    userAgent: text("user_agent"),
    ipHash: varchar("ip_hash", { length: 64 }),
    secondsOnPage: integer("seconds_on_page").default(0).notNull(),
    scrollDepthPct: integer("scroll_depth_pct").default(0).notNull(),
    ctaClicks: integer("cta_clicks").default(0).notNull(),
    firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  },
  (t) => [
    index("nf_lead_demo_views_lead_idx").on(t.leadId),
    index("nf_lead_demo_views_session_idx").on(t.sessionId),
  ],
);

export const leadDemoViewsRelations = relations(leadDemoViews, ({ one }) => ({
  lead: one(leads, { fields: [leadDemoViews.leadId], references: [leads.id] }),
}));

// ─── Industry profile templates (demo angles per industry) ───────────────────

export const industryProfiles = pgTable(
  "nf_industry_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    industry: varchar("industry", { length: 255 }).notNull(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    description: text("description"),
    commonPainPoints: jsonb("common_pain_points").$type<string[]>(),
    typicalOffers: jsonb("typical_offers").$type<string[]>(),
    demoAngle: text("demo_angle"),
    proposalAngle: text("proposal_angle"),
    suggestedFeatures: jsonb("suggested_features").$type<string[]>(),
    brandPalette: jsonb("brand_palette").$type<string[]>(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("nf_industry_profiles_industry_idx").on(t.industry)],
);

// ─── Lead outcomes (conversion feedback loop) ────────────────────────────────

export const leadOutcomes = pgTable(
  "nf_lead_outcomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }).notNull(),
    outcome: varchar("outcome", { length: 32 }).notNull(),
    valueCents: integer("value_cents"),
    notes: text("notes"),
    industryProfileId: uuid("industry_profile_id"),
    demoStyleTag: varchar("demo_style_tag", { length: 64 }),
    capturedBy: text("captured_by").references(() => users.id, { onDelete: "set null" }),
    capturedAt: timestamp("captured_at").defaultNow().notNull(),
  },
  (t) => [
    index("nf_lead_outcomes_lead_idx").on(t.leadId),
    index("nf_lead_outcomes_outcome_idx").on(t.outcome),
  ],
);

export const leadOutcomesRelations = relations(leadOutcomes, ({ one }) => ({
  lead: one(leads, { fields: [leadOutcomes.leadId], references: [leads.id] }),
}));

// ─── Structured types for jsonb columns ──────────────────────────────────────

export type ScrapedProfile = {
  homepage?: { title?: string; description?: string; h1?: string; markdown?: string };
  about?: string;
  services?: string[];
  products?: string[];
  team?: { name?: string; role?: string }[];
  socialLinks?: Record<string, string>;
  contactEmails?: string[];
  contactPhones?: string[];
  brandColors?: string[];
  brandFonts?: string[];
  logoUrl?: string;
  faviconUrl?: string;
  techSignals?: string[];
  blogPosts?: { title: string; url: string; excerpt?: string }[];
  pages?: { url: string; title?: string }[];
  rawMarkdown?: string;
  scrapedFrom?: "firecrawl" | "native";
  scrapedAt?: string;
  errors?: string[];
};

export type BusinessProfile = {
  summary?: string;
  offer?: string;
  targetCustomer?: string;
  toneOfVoice?: string;
  positioningStatement?: string;
  brandColors?: string[];
  brandFonts?: string[];
  visibleWeaknesses?: string[];
  buildOpportunities?: { title: string; description: string; effort: string }[];
  softwareRecommendations?: { name: string; category: string; reason: string; url?: string }[];
  roiEstimate?: string;
  urgencySignals?: string[];
  quickWins?: { title: string; description: string; timeline: string }[];
  competitorContext?: string;
  industryFit?: string;
  demoAngle?: string;
  recommendedFeatures?: string[];
  estimatedValue?: string;
  generatedAt?: string;
};

export const leadRelations = relations(leads, ({ one, many }) => ({
  project: one(projects, { fields: [leads.projectId], references: [projects.id] }),
  client: one(clients, { fields: [leads.clientId], references: [clients.id] }),
  assignee: one(users, { fields: [leads.assignedTo], references: [users.id] }),
  outreach: many(leadOutreach),
  calls: many(leadCalls),
  proposalVersions: many(proposalVersions),
  followUpSequences: many(followUpSequences),
}));

export const leadOutreachRelations = relations(leadOutreach, ({ one }) => ({
  lead: one(leads, { fields: [leadOutreach.leadId], references: [leads.id] }),
  sender: one(users, { fields: [leadOutreach.sentBy], references: [users.id] }),
}));

// ─── Reusable outreach templates (openers, follow-ups, breakups) ──────────────

export const outreachTemplates = pgTable(
  "nf_outreach_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    channel: outreachChannelEnum("channel").notNull(),
    subject: varchar("subject", { length: 500 }),
    body: text("body").notNull(),
    tags: text("tags").array(),
    industry: varchar("industry", { length: 255 }),
    useCount: integer("use_count").default(0).notNull(),
    wonCount: integer("won_count").default(0).notNull(),
    lastUsedAt: timestamp("last_used_at"),
    isActive: boolean("is_active").default(true).notNull(),
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    teamId: uuid("team_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("nf_outreach_templates_channel_idx").on(t.channel),
    index("nf_outreach_templates_industry_idx").on(t.industry),
  ],
);

export const outreachTemplatesRelations = relations(outreachTemplates, ({ one }) => ({
  owner: one(users, { fields: [outreachTemplates.ownerId], references: [users.id] }),
}));

// ─── Affiliates ───────────────────────────────────────────────────────────────

export const affiliateStatusEnum = pgEnum("nf_affiliate_status", [
  "pending", "approved", "rejected", "suspended",
]);

export const affiliateTierEnum = pgEnum("nf_affiliate_tier", [
  "base", "silver", "gold",
]);

export const affiliates = pgTable(
  "nf_affiliates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    website: varchar("website", { length: 500 }),
    promoMethod: varchar("promo_method", { length: 100 }),
    status: affiliateStatusEnum("status").default("pending").notNull(),
    tier: affiliateTierEnum("tier").default("base").notNull(),
    referralCode: varchar("referral_code", { length: 32 }).notNull().unique(),
    paypalEmail: varchar("paypal_email", { length: 255 }),
    totalReferrals: integer("total_referrals").default(0).notNull(),
    totalEarningsCents: integer("total_earnings_cents").default(0).notNull(),
    paidOutCents: integer("paid_out_cents").default(0).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("nf_affiliates_email_idx").on(t.email), index("nf_affiliates_code_idx").on(t.referralCode)],
);

export const affiliateReferralStatusEnum = pgEnum("nf_affiliate_referral_status", [
  "pending", "converted", "paid", "cancelled",
]);

export const affiliateReferrals = pgTable(
  "nf_affiliate_referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    affiliateId: uuid("affiliate_id").references(() => affiliates.id, { onDelete: "cascade" }).notNull(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    status: affiliateReferralStatusEnum("status").default("pending").notNull(),
    commissionPct: integer("commission_pct").notNull().default(10),
    projectValueCents: integer("project_value_cents").default(0),
    commissionCents: integer("commission_cents").default(0),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("nf_affiliate_refs_affiliate_idx").on(t.affiliateId)],
);

export const affiliateRelations = relations(affiliates, ({ many }) => ({
  referrals: many(affiliateReferrals),
}));

export const affiliateReferralRelations = relations(affiliateReferrals, ({ one }) => ({
  affiliate: one(affiliates, { fields: [affiliateReferrals.affiliateId], references: [affiliates.id] }),
  lead: one(leads, { fields: [affiliateReferrals.leadId], references: [leads.id] }),
  project: one(projects, { fields: [affiliateReferrals.projectId], references: [projects.id] }),
}));

// ─── Case Studies ─────────────────────────────────────────────────────────────

export const caseStudies = pgTable(
  "nf_case_studies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientName: varchar("client_name", { length: 255 }).notNull(),
    clientTitle: varchar("client_title", { length: 255 }),
    clientCompany: varchar("client_company", { length: 255 }),
    clientIndustry: varchar("client_industry", { length: 255 }),
    avatarInitials: varchar("avatar_initials", { length: 4 }),
    testimonial: text("testimonial").notNull(),
    metric1Label: varchar("metric1_label", { length: 100 }),
    metric1Value: varchar("metric1_value", { length: 50 }),
    metric2Label: varchar("metric2_label", { length: 100 }),
    metric2Value: varchar("metric2_value", { length: 50 }),
    metric3Label: varchar("metric3_label", { length: 100 }),
    metric3Value: varchar("metric3_value", { length: 50 }),
    published: boolean("published").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    linkedProjectId: uuid("linked_project_id").references(() => projects.id, { onDelete: "set null" }),
    linkedClientId: uuid("linked_client_id").references(() => clients.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("nf_case_studies_published_idx").on(t.published)],
);

export const caseStudyRelations = relations(caseStudies, ({ one }) => ({
  project: one(projects, { fields: [caseStudies.linkedProjectId], references: [projects.id] }),
  client: one(clients, { fields: [caseStudies.linkedClientId], references: [clients.id] }),
}));

// ─── Lead Calls ───────────────────────────────────────────────────────────────

export const callOutcomeEnum = pgEnum("nf_call_outcome", [
  "no_show", "won", "lost", "follow_up", "not_interested", "rescheduled",
]);

export const leadCalls = pgTable(
  "nf_lead_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }).notNull(),
    scheduledAt: timestamp("scheduled_at"),
    completedAt: timestamp("completed_at"),
    outcome: callOutcomeEnum("outcome"),
    notes: text("notes"),
    calledBy: text("called_by").references(() => users.id, { onDelete: "set null" }),
    bookingRef: varchar("booking_ref", { length: 255 }),
    durationMinutes: integer("duration_minutes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("nf_lead_calls_lead_idx").on(t.leadId)],
);

export const leadCallRelations = relations(leadCalls, ({ one }) => ({
  lead: one(leads, { fields: [leadCalls.leadId], references: [leads.id] }),
  caller: one(users, { fields: [leadCalls.calledBy], references: [users.id] }),
}));

// ─── Proposal Versions ────────────────────────────────────────────────────────

export const proposalVersions = pgTable(
  "nf_proposal_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }).notNull(),
    version: integer("version").notNull().default(1),
    html: text("html").notNull(),
    signedAt: timestamp("signed_at"),
    signerName: varchar("signer_name", { length: 255 }),
    signerEmail: varchar("signer_email", { length: 255 }),
    signerIp: varchar("signer_ip", { length: 45 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("nf_proposal_versions_lead_idx").on(t.leadId)],
);

export const proposalVersionRelations = relations(proposalVersions, ({ one }) => ({
  lead: one(leads, { fields: [proposalVersions.leadId], references: [leads.id] }),
}));

// ─── Follow-up Sequences ──────────────────────────────────────────────────────

export const followUpSequenceStatusEnum = pgEnum("nf_followup_status", [
  "active", "paused", "completed", "cancelled",
]);

export const followUpSequences = pgTable(
  "nf_follow_up_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }).notNull(),
    name: varchar("name", { length: 255 }).notNull().default("Default Sequence"),
    status: followUpSequenceStatusEnum("status").default("active").notNull(),
    currentStep: integer("current_step").default(0).notNull(),
    totalSteps: integer("total_steps").default(3).notNull(),
    nextSendAt: timestamp("next_send_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("nf_followup_lead_idx").on(t.leadId)],
);

export const followUpSequenceRelations = relations(followUpSequences, ({ one }) => ({
  lead: one(leads, { fields: [followUpSequences.leadId], references: [leads.id] }),
}));

// ─── Relations for new tables added above ─────────────────────────────────────

export const accountRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));
