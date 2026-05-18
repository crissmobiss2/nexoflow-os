import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const projectTypeEnum = pgEnum("project_type", [
  "website",
  "web_app",
  "mobile_app",
  "desktop_app",
  "saas",
  "marketplace",
  "internal_tool",
  "ai_product",
  "ecommerce",
  "portal",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "brief",
  "scored",
  "scoped",
  "architected",
  "generating",
  "ready",
  "archived",
]);

export const artifactTypeEnum = pgEnum("artifact_type", [
  "scope_doc",
  "tech_stack",
  "architecture",
  "risk_register",
  "code_bundle",
  "file_tree",
  "database_schema",
  "deployment_config",
]);

export const phaseStatusEnum = pgEnum("phase_status", [
  "pending",
  "in_progress",
  "completed",
  "skipped",
]);

export const scoreDecisionEnum = pgEnum("score_decision", [
  "pass",
  "conditional",
  "build",
  "prioritise",
]);

// ─── Clients ─────────────────────────────────────────────────────────────────

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  company: varchar("company", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = pgTable(
  "projects",
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
  (t) => [index("projects_status_idx").on(t.status), index("projects_client_idx").on(t.clientId)],
);

// ─── Project Briefs ───────────────────────────────────────────────────────────

export const projectBriefs = pgTable("project_briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  targetUser: text("target_user"),
  coreJobToBeDone: text("core_job_to_be_done"),
  existingTech: text("existing_tech"),
  keyIntegrations: text("key_integrations"),
  constraints: text("constraints"),
  additionalContext: text("additional_context"),
  rawFields: jsonb("raw_fields"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

// ─── Opportunity Score Breakdown ──────────────────────────────────────────────

export const opportunityScores = pgTable("opportunity_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
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

// ─── Project Artifacts ─────────────────────────────────────────────────────────

export const projectArtifacts = pgTable(
  "project_artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    artifactType: artifactTypeEnum("artifact_type").notNull(),
    content: text("content").notNull(),
    version: integer("version").default(1).notNull(),
    modelUsed: varchar("model_used", { length: 100 }),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("artifacts_project_type_idx").on(t.projectId, t.artifactType),
  ],
);

// ─── Project Phases ────────────────────────────────────────────────────────────

export const projectPhases = pgTable("project_phases", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
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
