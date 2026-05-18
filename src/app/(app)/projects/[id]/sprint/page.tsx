"use client";

import { use, useState, useCallback } from "react";
import { api } from "@/lib/trpc/client";
import Link from "next/link";
import {
  ArrowLeft, Loader2, Plus, Sparkles, X, GripVertical,
  ChevronRight, Edit3, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done" | "cancelled";

const COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: "backlog", label: "Backlog", color: "hsl(220, 12%, 45%)" },
  { key: "todo", label: "To Do", color: "hsl(220, 90%, 62%)" },
  { key: "in_progress", label: "In Progress", color: "hsl(38, 92%, 58%)" },
  { key: "review", label: "Review", color: "hsl(262, 83%, 68%)" },
  { key: "done", label: "Done", color: "hsl(142, 68%, 52%)" },
];

const STATUS_BADGE: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  backlog: { label: "Backlog", color: "hsl(220, 12%, 45%)", bg: "hsl(220, 12%, 45%, 0.12)" },
  todo: { label: "To Do", color: "hsl(220, 90%, 62%)", bg: "hsl(220, 90%, 62%, 0.12)" },
  in_progress: { label: "In Progress", color: "hsl(38, 92%, 58%)", bg: "hsl(38, 92%, 58%, 0.12)" },
  review: { label: "Review", color: "hsl(262, 83%, 68%)", bg: "hsl(262, 83%, 68%, 0.12)" },
  done: { label: "Done", color: "hsl(142, 68%, 52%)", bg: "hsl(142, 68%, 52%, 0.12)" },
  cancelled: { label: "Cancelled", color: "hsl(0, 80%, 65%)", bg: "hsl(0, 80%, 65%, 0.12)" },
};

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Low", color: "hsl(220, 12%, 45%)" },
  1: { label: "Medium", color: "hsl(220, 90%, 62%)" },
  2: { label: "High", color: "hsl(38, 92%, 58%)" },
  3: { label: "Critical", color: "hsl(0, 80%, 65%)" },
};

export default function SprintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: project } = api.projects.get.useQuery({ id });
  const { data: tasks, refetch, isLoading } = api.sprintTasks.list.useQuery({ projectId: id });
  const createTask = api.sprintTasks.create.useMutation({ onSuccess: () => void refetch() });
  const updateTask = api.sprintTasks.update.useMutation({ onSuccess: () => void refetch() });
  const deleteTask = api.sprintTasks.delete.useMutation({ onSuccess: () => void refetch() });
  const reorderTask = api.sprintTasks.reorder.useMutation({ onSuccess: () => void refetch() });
  const generateTasks = api.sprintTasks.generateFromScope.useMutation({ onSuccess: () => void refetch() });

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPoints, setEditPoints] = useState(1);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const columnTasks = useCallback((status: TaskStatus) => {
    return (tasks ?? [])
      .filter((t) => t.status === status)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [tasks]);

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createTask.mutate({
      projectId: id,
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
    });
    setNewTitle("");
    setNewDesc("");
    setShowAddForm(false);
  };

  const handleUpdate = (taskId: string) => {
    updateTask.mutate({
      id: taskId,
      title: editTitle.trim(),
      description: editDesc.trim() || undefined,
      storyPoints: editPoints,
    });
    setEditingTask(null);
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    const currentTasks = columnTasks(newStatus);
    reorderTask.mutate({
      projectId: id,
      taskId,
      newStatus,
      newOrder: currentTasks.length,
    });
  };

  const startEdit = (task: NonNullable<typeof tasks>[number]) => {
    if (!task) return;
    setEditingTask(task.id);
    setEditTitle(task.title);
    setEditDesc(task.description ?? "");
    setEditPoints(task.storyPoints ?? 1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: "var(--text-secondary)" }}>
        <Link href={`/projects/${id}`} className="hover:opacity-80 flex items-center gap-1.5 transition-opacity">
          <ArrowLeft className="w-3.5 h-3.5" />
          {project?.name ?? "Project"}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 opacity-40" />
        <span style={{ color: "var(--text-primary)" }}>Sprint Planner</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Sprint Planner
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {tasks?.length ?? 0} tasks ·{" "}
            {tasks?.reduce((s, t) => s + (t.storyPoints ?? 0), 0) ?? 0} story points
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => generateTasks.mutate({ projectId: id })}
            disabled={generateTasks.isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50"
            style={{
              color: "var(--brand-primary)",
              borderColor: "var(--brand-primary)",
              background: "hsl(220, 90%, 62%, 0.08)",
            }}
          >
            {generateTasks.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            AI Generate Tasks
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{
              background: "var(--brand-gradient)",
              color: "#fff",
              border: "none",
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Task
          </button>
        </div>
      </div>

      {/* Add Task Form */}
      {showAddForm && (
        <div
          className="rounded-xl p-4 mb-6"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>New Task</h3>
            <button onClick={() => setShowAddForm(false)} className="p-1 rounded hover:opacity-70 transition-opacity">
              <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            </button>
          </div>
          <div className="space-y-3">
            <input
              className="nf-input"
              placeholder="Task title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <textarea
              className="nf-input min-h-[60px] resize-y"
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowAddForm(false); setNewTitle(""); setNewDesc(""); }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
                style={{ color: "var(--text-secondary)", borderColor: "var(--surface-border)", background: "var(--surface-elevated)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim() || createTask.isPending}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ background: "var(--brand-gradient)", color: "#fff", border: "none" }}
              >
                {createTask.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  "Create"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div className="grid grid-cols-5 gap-4 min-h-[60vh]">
        {COLUMNS.map((col) => {
          const columnTasksList = columnTasks(col.key);
          return (
            <div
              key={col.key}
              className="rounded-xl flex flex-col"
              style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
            >
              {/* Column header */}
              <div
                className="flex items-center justify-between px-3 py-2.5 border-b rounded-t-xl"
                style={{ borderColor: "var(--surface-border)", background: "var(--surface-elevated)" }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                  <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                    {col.label}
                  </span>
                </div>
                <span className="text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded"
                  style={{ color: "var(--text-muted)", background: "var(--surface-bg)" }}>
                  {columnTasksList.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[65vh]">
                {columnTasksList.map((task) => {
                  const isEditing = editingTask === task.id;
                  const priorityInfo = PRIORITY_LABELS[task.priority] ?? PRIORITY_LABELS[0]!;
                  const badge = STATUS_BADGE[task.status as TaskStatus] ?? STATUS_BADGE.backlog;

                  if (isEditing) {
                    return (
                      <div
                        key={task.id}
                        className="rounded-lg p-3"
                        style={{ background: "var(--surface-elevated)", border: "1px solid var(--brand-primary)" }}
                      >
                        <input
                          className="nf-input text-sm mb-2"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          autoFocus
                        />
                        <textarea
                          className="nf-input text-xs min-h-[50px] resize-y mb-2"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          placeholder="Description..."
                        />
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>SP:</span>
                          {[1, 2, 3, 5, 8, 13].map((p) => (
                            <button
                              key={p}
                              onClick={() => setEditPoints(p)}
                              className={cn(
                                "text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors",
                                editPoints === p ? "font-bold" : ""
                              )}
                              style={{
                                background: editPoints === p ? "var(--brand-primary)" : "var(--surface-bg)",
                                color: editPoints === p ? "#fff" : "var(--text-secondary)",
                                border: "1px solid var(--surface-border)",
                              }}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-end gap-1.5 mt-2">
                          <button
                            onClick={() => setEditingTask(null)}
                            className="px-2 py-1 text-[10px] font-medium rounded transition-colors"
                            style={{ color: "var(--text-muted)" }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleUpdate(task.id)}
                            className="px-2 py-1 text-[10px] font-medium rounded transition-colors"
                            style={{ background: "var(--brand-primary)", color: "#fff" }}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={task.id}
                      className="rounded-lg p-3 cursor-pointer transition-all hover:opacity-85 group relative"
                      style={{
                        background: "var(--surface-elevated)",
                        border: "1px solid var(--surface-border)",
                      }}
                      onClick={() => startEdit(task as any)}
                    >
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <span className="text-xs font-medium leading-snug line-clamp-2 flex-1"
                          style={{ color: "var(--text-primary)" }}>
                          {task.title}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this task?")) {
                              deleteTask.mutate({ id: task.id });
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded shrink-0"
                          style={{ color: "var(--status-error)" }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {task.description && (
                        <p className="text-[11px] line-clamp-2 mb-2"
                          style={{ color: "var(--text-muted)" }}>
                          {task.description}
                        </p>
                      )}

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded"
                          style={{
                            background: "hsl(220, 90%, 62%, 0.1)",
                            color: "var(--brand-primary)",
                            border: "1px solid hsl(220, 90%, 62%, 0.2)",
                          }}
                        >
                          {task.storyPoints}sp
                        </span>
                        <span
                          className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            background: priorityInfo.color + "15",
                            color: priorityInfo.color,
                            border: `1px solid ${priorityInfo.color}25`,
                          }}
                        >
                          {priorityInfo.label}
                        </span>
                        <span
                          className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.color}25`,
                          }}
                        >
                          {badge.label}
                        </span>
                      </div>

                      {/* Status change quick actions */}
                      <div className="hidden group-hover:flex absolute -bottom-2 left-1/2 -translate-x-1/2 gap-0.5 rounded-lg overflow-hidden shadow-lg"
                        style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
                        onClick={(e) => e.stopPropagation()}>
                        {COLUMNS.filter(c => c.key !== task.status && c.key !== "cancelled").map((c) => (
                          <button
                            key={c.key}
                            onClick={() => handleStatusChange(task.id, c.key)}
                            className="px-1.5 py-1 text-[9px] font-medium uppercase tracking-wider transition-colors hover:opacity-80"
                            style={{ color: c.color }}
                          >
                            {c.label.slice(0, 4)}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {columnTasksList.length === 0 && (
                  <div className="flex items-center justify-center h-16">
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      No tasks
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
