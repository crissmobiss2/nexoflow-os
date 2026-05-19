"use client";

import { use, useMemo, useState, useCallback, useEffect } from "react";
import { api } from "@/lib/trpc/client";
import Link from "next/link";
import {
  ArrowLeft, Loader2, Search, X, LayoutList, LayoutGrid,
} from "lucide-react";
import { cn, formatProjectType, formatScore } from "@/lib/utils";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";

const STATUS_LANES = [
  { key: "brief", label: "Brief", color: "hsl(220, 12%, 45%)" },
  { key: "scored", label: "Scored", color: "hsl(220, 90%, 62%)" },
  { key: "scoped", label: "Scoped", color: "hsl(262, 83%, 68%)" },
  { key: "architected", label: "Architected", color: "hsl(190, 90%, 58%)" },
  { key: "generating", label: "Generating", color: "hsl(38, 92%, 58%)" },
  { key: "ready", label: "Ready", color: "hsl(142, 68%, 52%)" },
  { key: "archived", label: "Archived", color: "hsl(220, 8%, 55%)" },
];

const PROJECT_TYPES = [
  "website", "web_app", "mobile_app", "desktop_app",
  "saas", "marketplace", "internal_tool", "ai_product", "ecommerce", "portal",
] as const;

const TYPE_COLORS: Record<string, string> = {
  website: "hsl(220, 90%, 62%)",
  web_app: "hsl(262, 83%, 68%)",
  mobile_app: "hsl(142, 68%, 52%)",
  desktop_app: "hsl(190, 90%, 58%)",
  saas: "hsl(38, 92%, 58%)",
  marketplace: "hsl(340, 80%, 58%)",
  internal_tool: "hsl(220, 12%, 45%)",
  ai_product: "hsl(280, 80%, 60%)",
  ecommerce: "hsl(160, 70%, 50%)",
  portal: "hsl(0, 80%, 65%)",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Project = any;

export default function BoardPage() {
  const { data: projects, refetch, isLoading } = api.projects.list.useQuery();
  const updateStatus = api.projects.updateStatus.useMutation({ onSuccess: () => void refetch() });

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState<string | null>(null);

  const uniqueClients = useMemo(() => {
    if (!projects) return [];
    const names = new Set<string>();
    projects.forEach((p) => {
      if (p.client?.company) names.add(p.client.company);
      else if (p.client?.name) names.add(p.client.name);
    });
    return Array.from(names).sort();
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    return projects.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        if (!p.name.toLowerCase().includes(q)) return false;
      }
      if (typeFilter && p.projectType !== typeFilter) return false;
      if (clientFilter) {
        const clientName = p.client?.company ?? p.client?.name ?? "";
        if (clientName !== clientFilter) return false;
      }
      return true;
    });
  }, [projects, search, typeFilter, clientFilter]);

  const laneProjects = useCallback(
    (status: string) => {
      return filteredProjects
        .filter((p) => p.status === status)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    [filteredProjects],
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;
      const { draggableId, destination } = result;
      const newStatus = destination.droppableId;
      updateStatus.mutate({ id: draggableId, status: newStatus as any });
    },
    [updateStatus],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: "var(--text-secondary)" }}>
        <Link href="/projects" className="hover:opacity-80 flex items-center gap-1.5 transition-opacity">
          <ArrowLeft className="w-3.5 h-3.5" />
          Projects
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-5 rounded-full" style={{ background: "var(--brand-gradient)" }} />
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Kanban Board</h1>
          </div>
          <p className="text-sm pl-3.5" style={{ color: "var(--text-secondary)" }}>
            {projects?.length ?? 0} projects in pipeline
          </p>
        </div>
        <Link
          href="/projects"
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors"
          style={{
            color: "var(--text-secondary)",
            borderColor: "var(--surface-border)",
            background: "var(--surface-elevated)",
          }}
        >
          <LayoutList className="w-3.5 h-3.5" />
          Table View
        </Link>
      </div>

      {/* Filter Bar */}
      <div
        className="flex items-center gap-3 mb-6 p-3 rounded-xl flex-wrap"
        style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
          <input
            className="nf-input pl-8 text-sm w-full"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:opacity-70"
            >
              <X className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
            </button>
          )}
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Type:
          </span>
          <button
            onClick={() => setTypeFilter(null)}
            className={cn(
              "text-[11px] px-2 py-1 rounded font-medium transition-colors",
              !typeFilter ? "text-white" : "",
            )}
            style={{
              background: !typeFilter ? "var(--brand-primary)" : "var(--surface-elevated)",
              color: !typeFilter ? "#fff" : "var(--text-secondary)",
              border: "1px solid var(--surface-border)",
            }}
          >
            All
          </button>
          {PROJECT_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t ? null : t)}
              className={cn("text-[11px] px-2 py-1 rounded font-medium transition-colors")}
              style={{
                background: typeFilter === t ? (TYPE_COLORS[t] ?? "var(--brand-primary)") : "var(--surface-elevated)",
                color: typeFilter === t ? "#fff" : "var(--text-secondary)",
                border: `1px solid ${typeFilter === t ? "transparent" : "var(--surface-border)"}`,
              }}
            >
              {formatProjectType(t)}
            </button>
          ))}
        </div>

        {/* Client filter */}
        {uniqueClients.length > 0 && (
          <select
            value={clientFilter ?? ""}
            onChange={(e) => setClientFilter(e.target.value || null)}
            className="nf-input text-sm max-w-[180px]"
            style={{ background: "var(--surface-elevated)" }}
          >
            <option value="">All Clients</option>
            {uniqueClients.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-7 gap-3 min-h-[65vh]">
          {STATUS_LANES.map((lane) => {
            const projectsInLane = laneProjects(lane.key);
            return (
              <Droppable key={lane.key} droppableId={lane.key}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="rounded-xl flex flex-col"
                    style={{
                      background: snapshot.isDraggingOver
                        ? "hsl(220, 90%, 62%, 0.06)"
                        : "var(--surface-card)",
                      border: snapshot.isDraggingOver
                        ? "2px dashed var(--brand-primary)"
                        : "1px solid var(--surface-border)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {/* Lane Header */}
                    <div
                      className="flex items-center justify-between px-3 py-2.5 border-b rounded-t-xl shrink-0"
                      style={{ borderColor: "var(--surface-border)", background: "var(--surface-elevated)" }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: lane.color }} />
                        <span className="text-[11px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                          {lane.label}
                        </span>
                      </div>
                      <span
                        className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded shrink-0 ml-1"
                        style={{ color: "var(--text-muted)", background: "var(--surface-bg)" }}
                      >
                        {projectsInLane.length}
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[100px]" style={{ maxHeight: "calc(100vh - 300px)" }}>
                      {projectsInLane.map((project, index) => {
                        const scoreInfo = project.opportunityScore
                          ? formatScore(project.opportunityScore)
                          : null;
                        const typeColor = TYPE_COLORS[project.projectType] ?? "hsl(220, 12%, 45%)";

                        return (
                          <Draggable key={project.id} draggableId={project.id} index={index}>
                            {(provided, snapshot) => (
                              <Link
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                href={`/projects/${project.id}`}
                                className="block rounded-lg p-3 transition-all group"
                                style={{
                                  background: snapshot.isDragging
                                    ? "var(--surface-elevated)"
                                    : "var(--surface-elevated)",
                                  border: snapshot.isDragging
                                    ? "1px solid var(--brand-primary)"
                                    : "1px solid var(--surface-border)",
                                  boxShadow: snapshot.isDragging
                                    ? "0 8px 24px rgba(0,0,0,0.2)"
                                    : "none",
                                  textDecoration: "none",
                                  color: "inherit",
                                }}
                              >
                                {/* Project name */}
                                <div className="text-xs font-semibold leading-snug line-clamp-2 mb-1.5"
                                  style={{ color: "var(--text-primary)" }}>
                                  {project.name}
                                </div>

                                {/* Client name */}
                                {(project.client?.company || project.client?.name) && (
                                  <div className="text-[10px] mb-1.5 truncate"
                                    style={{ color: "var(--text-muted)" }}>
                                    {project.client.company ?? project.client.name}
                                  </div>
                                )}

                                {/* Score + Budget row */}
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                  {scoreInfo ? (
                                    <span className={cn("text-[11px] font-bold tabular-nums", scoreInfo.color)}>
                                      {project.opportunityScore}/70
                                    </span>
                                  ) : (
                                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>—</span>
                                  )}
                                  {project.budgetRange && (
                                    <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                                      {project.budgetRange}
                                    </span>
                                  )}
                                </div>

                                {/* Type badge */}
                                <span
                                  className="inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded"
                                  style={{
                                    background: `${typeColor}18`,
                                    color: typeColor,
                                    border: `1px solid ${typeColor}30`,
                                  }}
                                >
                                  {formatProjectType(project.projectType)}
                                </span>
                              </Link>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}

                      {/* Empty state */}
                      {projectsInLane.length === 0 && !snapshot.isDraggingOver && (
                        <div className="flex items-center justify-center h-20">
                          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            No projects
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
