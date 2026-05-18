import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
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

// ─── Clients ──────────────────────────────────────────────────────────────────
// Full onboarding profile — collected before any project is created

export const clients = pgTable("nf_clients", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Contact
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),

  // Company
  company: varchar("company", { length: 255 }),
  website: varchar("website", { length: 255 }),
  industry: varchar("industry", { length: 255 }),
  companySize: varchar("company_size", { length: 50 }),   // "1-10" | "11-50" | "51-200" | "201-1000" | "1000+"
  region: varchar("region", { length: 100 }),

  // Business context
  businessDescription: text("business_description"),       // What they do
  targetCustomers: text("target_customers"),               // Who their customers are
  currentChallenges: text("current_challenges"),           // Pain points we're solving
  existingTech: text("existing_tech"),                     // Their current stack / tools

  // Commercial
  typicalBudget: varchar("typical_budget", { length: 100 }), // Budget expectation
  urgency: varchar("urgency", { length: 50 }),             // "exploring" | "planning" | "urgent"
  decisionMakerRole: varchar("decision_maker_role", { length: 100 }),

  // Internal
  notes: text("notes"),
  onboardedAt: timestamp("onboarded_at"),                  // null = incomplete onboarding

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
