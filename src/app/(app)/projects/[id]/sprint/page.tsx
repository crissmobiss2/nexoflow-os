"use client";

import { use, useState, useCallback, useMemo } from "react";
import { api } from "@/lib/trpc/client";
import Link from "next/link";
import {
  ArrowLeft, Loader2, Plus, X, ChevronRight,
  Calendar, List, Columns3, GripVertical,
  User, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, ComposedChart, Legend, CartesianGrid,
} from "recharts";

type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done" | "cancelled";

const COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: "backlog", label: "Backlog", color: "hsl(220, 12%, 45%)" },
  { key: "todo", label: "To Do", color: "hsl(220, 90%, 62%)" },
  { key: "in_progress", label: "In Progress", color: "hsl(38, 92%, 58%)" },
  { key: "review", label: "Review", color: "hsl(262, 83%, 68%)" },
  { key: "done", label: "Done", color: "hsl(142, 68%, 52%)" },
];

const PRIORITY_CONFIG: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: "Low", color: "hsl(220, 12%, 45%)", bg: "hsl(220, 12%, 45%, 0.12)" },
  1: { label: "Medium", color: "hsl(220, 90%, 62%)", bg: "hsl(220, 90%, 62%, 0.12)" },
  2: { label: "High", color: "hsl(38, 92%, 58%)", bg: "hsl(38, 92%, 58%, 0.12)" },
  3: { label: "Critical", color: "hsl(0, 80%, 65%)", bg: "hsl(0, 80%, 65%, 0.12)" },
};

const STORY_POINT_OPTIONS = [1, 2, 3, 5, 8, 13];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Task = any;

export default function SprintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: project } = api.projects.get.useQuery({ id });
  const { data: tasks, refetch, isLoading } = api.sprintTasks.list.useQuery({ projectId: id });
  const createTask = api.sprintTasks.create.useMutation({ onSuccess: () => void refetch() });
  const updateTask = api.sprintTasks.update.useMutation({ onSuccess: () => void refetch() });
  const deleteTask = api.sprintTasks.delete.useMutation({ onSuccess: () => void refetch() });
  const bulkReorder = api.sprintTasks.bulkReorder.useMutation({ onSuccess: () => void refetch() });

  const [viewMode, setViewMode] = useState<"kanban" | "week">("kanban");
  const [addColumn, setAddColumn] = useState<TaskStatus | null>(null);
  const [addTitle, setAddTitle] = useState("");
  const [addPoints, setAddPoints] = useState(1);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [detailTitle, setDetailTitle] = useState("");
  const [detailDesc, setDetailDesc] = useState("");
  const [detailPriority, setDetailPriority] = useState(0);
  const [detailPoints, setDetailPoints] = useState(1);
  const [detailDueDate, setDetailDueDate] = useState("");
  const [detailAssignee, setDetailAssignee] = useState("");

  const columnTasks = useCallback(
    (status: TaskStatus) => {
      return (tasks ?? [])
        .filter((t) => t.status === status)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    },
    [tasks],
  );

  // ─── Drag & Drop ──────────────────────────────────────────────────────────

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;
      const { draggableId, destination, source } = result;
      const newStatus = destination.droppableId as TaskStatus;
      const sourceStatus = source.droppableId as TaskStatus;

      const sourceList = columnTasks(sourceStatus);
      const destList = columnTasks(newStatus);

      // Build updated order for both source and destination
      const updates: { id: string; status: TaskStatus; order: number }[] = [];

      if (sourceStatus === newStatus) {
        // Reorder within same column
        const reordered = Array.from(sourceList);
        const [moved] = reordered.splice(source.index, 1);
        if (!moved) return;
        reordered.splice(destination.index, 0, moved);
        reordered.forEach((t, i) => {
          updates.push({ id: t.id, status: newStatus, order: i });
        });
      } else {
        // Move between columns
        const newSourceList = Array.from(sourceList).filter((t) => t.id !== draggableId);
        const task = sourceList.find((t) => t.id === draggableId);
        if (!task) return;

        const newDestList = Array.from(destList);
        newDestList.splice(destination.index, 0, task);

        newSourceList.forEach((t, i) => {
          updates.push({ id: t.id, status: sourceStatus, order: i });
        });
        newDestList.forEach((t, i) => {
          updates.push({ id: t.id, status: newStatus, order: i });
        });
      }

      bulkReorder.mutate({ projectId: id, tasks: updates });
    },
    [id, columnTasks, bulkReorder],
  );

  // ─── Add Task ─────────────────────────────────────────────────────────────

  const handleAddTask = (status: TaskStatus) => {
    if (!addTitle.trim()) return;
    createTask.mutate({
      projectId: id,
      title: addTitle.trim(),
      storyPoints: addPoints,
      status,
    });
    setAddTitle("");
    setAddPoints(1);
    setAddColumn(null);
  };

  // ─── Detail Modal ─────────────────────────────────────────────────────────

  const openDetail = (task: Task) => {
    setDetailTask(task);
    setDetailTitle(task.title);
    setDetailDesc(task.description ?? "");
    setDetailPriority(task.priority ?? 0);
    setDetailPoints(task.storyPoints ?? 1);
    setDetailDueDate(task.dueDate ? String(new Date(task.dueDate).toISOString().split("T")[0]) : "");
    setDetailAssignee(task.assigneeId ?? "");
  };

  const saveDetail = () => {
    if (!detailTask) return;
    updateTask.mutate({
      id: detailTask.id,
      title: detailTitle.trim(),
      description: detailDesc.trim() || undefined,
      priority: detailPriority,
      storyPoints: detailPoints,
      dueDate: detailDueDate ? new Date(detailDueDate).toISOString() : undefined,
      assigneeId: detailAssignee || undefined,
    });
    setDetailTask(null);
  };

  // ─── Burndown Chart Data ─────────────────────────────────────────────────

  const burndownData = useMemo(() => {
    if (!tasks) return [];
    const totalPoints = tasks.reduce((s, t) => s + (t.storyPoints ?? 0), 0);
    const donePoints = tasks
      .filter((t) => t.status === "done")
      .reduce((s, t) => s + (t.storyPoints ?? 0), 0);
    const inProgressPoints = tasks
      .filter((t) => t.status === "in_progress" || t.status === "review")
      .reduce((s, t) => s + (t.storyPoints ?? 0), 0);

    const points = [5, 4, 3, 2, 1, 0];
    return points.map((day) => ({
      day: `Day ${day}`,
      ideal: Math.round((totalPoints / 5) * (5 - day)),
      actual: day >= 3
        ? totalPoints - donePoints
        : day >= 1
        ? totalPoints - donePoints - Math.round(inProgressPoints * 0.5)
        : totalPoints,
    })).reverse();
  }, [tasks]);

  // ─── Week View Data ──────────────────────────────────────────────────────

  const weekTasks = useMemo(() => {
    if (!tasks) return [];
    const sorted = [...tasks].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // Group by week (simple: group by the ISO week of created date)
    const groups: Record<string, Task[]> = {};
    sorted.forEach((t) => {
      const d = new Date(t.createdAt);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().split("T")[0]!;
      if (!groups[key]) groups[key] = [];
      groups[key]!.push(t);
    });

    return Object.entries(groups).map(([week, taskList]) => ({
      week,
      tasks: taskList,
      points: taskList.reduce((s, t) => s + (t.storyPoints ?? 0), 0),
    }));
  }, [tasks]);

  // ─── Rendering ────────────────────────────────────────────────────────────

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
          {/* View toggle */}
          <div
            className="flex rounded-lg overflow-hidden border"
            style={{ borderColor: "var(--surface-border)" }}
          >
            <button
              onClick={() => setViewMode("kanban")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                viewMode === "kanban" ? "text-white" : "",
              )}
              style={{
                background: viewMode === "kanban" ? "var(--brand-primary)" : "var(--surface-elevated)",
                color: viewMode === "kanban" ? "#fff" : "var(--text-secondary)",
              }}
            >
              <Columns3 className="w-3.5 h-3.5" />
              Kanban
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                viewMode === "week" ? "text-white" : "",
              )}
              style={{
                background: viewMode === "week" ? "var(--brand-primary)" : "var(--surface-elevated)",
                color: viewMode === "week" ? "#fff" : "var(--text-secondary)",
              }}
            >
              <Calendar className="w-3.5 h-3.5" />
              Week View
            </button>
          </div>
        </div>
      </div>

      {/* Burndown Chart */}
      {burndownData.length > 0 && (
        <div
          className="rounded-xl p-5 mb-6"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
        >
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
            Burndown Chart
          </h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={burndownData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-card)",
                    border: "1px solid var(--surface-border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "var(--text-primary)" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Line
                  type="monotone"
                  dataKey="ideal"
                  stroke="hsl(220, 12%, 45%)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Ideal"
                  dot={false}
                />
                <Bar
                  dataKey="actual"
                  fill="var(--brand-primary)"
                  radius={[3, 3, 0, 0]}
                  name="Actual"
                  opacity={0.7}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Content */}
      {viewMode === "kanban" ? (
        <KanbanView
          columns={COLUMNS}
          columnTasks={columnTasks}
          onDragEnd={handleDragEnd}
          addColumn={addColumn}
          setAddColumn={setAddColumn}
          addTitle={addTitle}
          setAddTitle={setAddTitle}
          addPoints={addPoints}
          setAddPoints={setAddPoints}
          onAddTask={handleAddTask}
          onOpenDetail={openDetail}
          onDeleteTask={(id) => deleteTask.mutate({ id })}
          createPending={createTask.isPending}
        />
      ) : (
        <WeekView
          weekTasks={weekTasks}
          onOpenDetail={openDetail}
        />
      )}

      {/* Task Detail Modal */}
      {detailTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setDetailTask(null)}
        >
          <div
            className="rounded-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto"
            style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--surface-border)" }}>
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Task Detail</h3>
              <button
                onClick={() => setDetailTask(null)}
                className="p-1 rounded hover:opacity-70 transition-opacity"
              >
                <X className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Title */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-muted)" }}>
                  Title
                </label>
                <input
                  className="nf-input text-sm"
                  value={detailTitle}
                  onChange={(e) => setDetailTitle(e.target.value)}
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-muted)" }}>
                  Description
                </label>
                <textarea
                  className="nf-input text-sm min-h-[100px] resize-y"
                  value={detailDesc}
                  onChange={(e) => setDetailDesc(e.target.value)}
                  placeholder="No description..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Priority */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-muted)" }}>
                    Priority
                  </label>
                  <select
                    className="nf-input text-sm"
                    value={detailPriority}
                    onChange={(e) => setDetailPriority(Number(e.target.value))}
                  >
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>

                {/* Story Points */}
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-muted)" }}>
                    Story Points
                  </label>
                  <div className="flex gap-1.5">
                    {STORY_POINT_OPTIONS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setDetailPoints(p)}
                        className={cn(
                          "text-xs font-mono px-2 py-1 rounded transition-colors",
                          detailPoints === p ? "text-white" : "",
                        )}
                        style={{
                          background: detailPoints === p ? "var(--brand-primary)" : "var(--surface-elevated)",
                          color: detailPoints === p ? "#fff" : "var(--text-secondary)",
                          border: "1px solid var(--surface-border)",
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-muted)" }}>
                  Due Date
                </label>
                <input
                  type="date"
                  className="nf-input text-sm"
                  value={detailDueDate}
                  onChange={(e) => setDetailDueDate(e.target.value)}
                />
              </div>

              {/* Assignee */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest mb-1 block" style={{ color: "var(--text-muted)" }}>
                  Assignee
                </label>
                <input
                  className="nf-input text-sm"
                  value={detailAssignee}
                  onChange={(e) => setDetailAssignee(e.target.value)}
                  placeholder="User ID or name"
                />
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                  Current: {detailTask.assignee?.name ?? detailTask.assigneeId ?? "Unassigned"}
                </p>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: "var(--surface-border)" }}>
              <button
                onClick={() => setDetailTask(null)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors"
                style={{ color: "var(--text-secondary)", borderColor: "var(--surface-border)", background: "var(--surface-elevated)" }}
              >
                Cancel
              </button>
              <button
                onClick={saveDetail}
                disabled={updateTask.isPending || !detailTitle.trim()}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ background: "var(--brand-gradient)", color: "#fff", border: "none" }}
              >
                {updateTask.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Kanban View ──────────────────────────────────────────────────────────

function KanbanView({
  columns,
  columnTasks,
  onDragEnd,
  addColumn,
  setAddColumn,
  addTitle,
  setAddTitle,
  addPoints,
  setAddPoints,
  onAddTask,
  onOpenDetail,
  onDeleteTask,
  createPending,
}: {
  columns: typeof COLUMNS;
  columnTasks: (status: TaskStatus) => Task[];
  onDragEnd: (result: DropResult) => void;
  addColumn: TaskStatus | null;
  setAddColumn: (s: TaskStatus | null) => void;
  addTitle: string;
  setAddTitle: (s: string) => void;
  addPoints: number;
  setAddPoints: (n: number) => void;
  onAddTask: (status: TaskStatus) => void;
  onOpenDetail: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  createPending: boolean;
}) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-5 gap-4 min-h-[60vh]">
        {columns.map((col) => {
          const tasks = columnTasks(col.key);
          return (
            <Droppable key={col.key} droppableId={col.key}>
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
                  {/* Column header */}
                  <div
                    className="flex items-center justify-between px-3 py-2.5 border-b rounded-t-xl shrink-0"
                    style={{ borderColor: "var(--surface-border)", background: "var(--surface-elevated)" }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                      <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                        {col.label}
                      </span>
                    </div>
                    <span
                      className="text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded"
                      style={{ color: "var(--text-muted)", background: "var(--surface-bg)" }}
                    >
                      {tasks.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 320px)" }}>
                    {tasks.map((task, index) => {
                      const priorityInfo = PRIORITY_CONFIG[task.priority ?? 0] ?? PRIORITY_CONFIG[0]!;
                      const assigneeName = task.assignee?.name ?? task.assigneeId ?? null;
                      const dueDate = task.dueDate ? new Date(task.dueDate) : null;

                      return (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className="rounded-lg p-3 cursor-pointer transition-all group relative"
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
                              }}
                              onClick={() => onOpenDetail(task)}
                            >
                              {/* Drag handle */}
                              <div
                                {...provided.dragHandleProps}
                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                                style={{ color: "var(--text-muted)" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <GripVertical className="w-3 h-3" />
                              </div>

                              {/* Title */}
                              <span
                                className="text-xs font-medium leading-snug line-clamp-2 block mb-2 pr-5"
                                style={{ color: "var(--text-primary)" }}
                              >
                                {task.title}
                              </span>

                              {/* Badges row */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {/* Story Points */}
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

                                {/* Priority indicator */}
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
                                  style={{
                                    background: priorityInfo.bg,
                                    color: priorityInfo.color,
                                    border: `1px solid ${priorityInfo.color}25`,
                                  }}
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ background: priorityInfo.color }}
                                  />
                                  {priorityInfo.label}
                                </span>
                              </div>

                              {/* Footer row */}
                              <div className="flex items-center justify-between mt-2 pt-2 border-t" style={{ borderColor: "var(--surface-border-subtle)" }}>
                                {/* Assignee */}
                                <div className="flex items-center gap-1">
                                  {assigneeName ? (
                                    <>
                                      <div
                                        className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                                        style={{
                                          background: "var(--brand-gradient)",
                                          color: "#fff",
                                        }}
                                      >
                                        {assigneeName.charAt(0).toUpperCase()}
                                      </div>
                                      <span className="text-[10px] truncate max-w-[60px]" style={{ color: "var(--text-muted)" }}>
                                        {assigneeName}
                                      </span>
                                    </>
                                  ) : (
                                    <User className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                                  )}
                                </div>

                                {/* Due date */}
                                {dueDate && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                                      {dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}

                    {/* Empty state */}
                    {tasks.length === 0 && !snapshot.isDraggingOver && addColumn !== col.key && (
                      <div className="flex items-center justify-center h-16">
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>No tasks</p>
                      </div>
                    )}

                    {/* Inline Add Task */}
                    {addColumn === col.key ? (
                      <div
                        className="rounded-lg p-3 space-y-2"
                        style={{ background: "var(--surface-elevated)", border: "1px solid var(--brand-primary)" }}
                      >
                        <input
                          className="nf-input text-xs"
                          placeholder="Task title..."
                          value={addTitle}
                          onChange={(e) => setAddTitle(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && onAddTask(col.key)}
                          autoFocus
                        />
                        <div className="flex items-center gap-1">
                          {STORY_POINT_OPTIONS.map((p) => (
                            <button
                              key={p}
                              onClick={() => setAddPoints(p)}
                              className={cn(
                                "text-[10px] font-mono px-1.5 py-0.5 rounded transition-colors",
                                addPoints === p ? "text-white" : "",
                              )}
                              style={{
                                background: addPoints === p ? "var(--brand-primary)" : "var(--surface-bg)",
                                color: addPoints === p ? "#fff" : "var(--text-secondary)",
                                border: "1px solid var(--surface-border)",
                              }}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => { setAddColumn(null); setAddTitle(""); }}
                            className="px-2 py-1 text-[10px] font-medium rounded transition-colors"
                            style={{ color: "var(--text-muted)" }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => onAddTask(col.key)}
                            disabled={!addTitle.trim() || createPending}
                            className="px-2 py-1 text-[10px] font-medium rounded transition-colors disabled:opacity-50"
                            style={{ background: "var(--brand-primary)", color: "#fff" }}
                          >
                            {createPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              "Add"
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddColumn(col.key); setAddTitle(""); setAddPoints(1); }}
                        className="w-full py-2 rounded-lg text-[11px] font-medium transition-colors opacity-0 group-hover:opacity-100 hover:opacity-100"
                        style={{
                          color: "var(--text-muted)",
                          border: "1px dashed var(--surface-border)",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-elevated)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
                      >
                        <Plus className="w-3 h-3 inline-block mr-1" />
                        Add Task
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────

function WeekView({
  weekTasks,
  onOpenDetail,
}: {
  weekTasks: { week: string; tasks: Task[]; points: number }[];
  onOpenDetail: (task: Task) => void;
}) {
  if (weekTasks.length === 0) {
    return (
      <div
        className="rounded-xl p-8 text-center"
        style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
      >
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>No tasks yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {weekTasks.map(({ week, tasks, points }) => {
        const weekLabel = new Date(week + "T00:00:00").toLocaleDateString("en-GB", {
          day: "numeric", month: "short", year: "numeric",
        });
        return (
          <div
            key={week}
            className="rounded-xl overflow-hidden"
            style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
          >
            {/* Week header */}
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ background: "var(--surface-elevated)", borderBottom: "1px solid var(--surface-border)" }}
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                  W/C {weekLabel}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {tasks.length} tasks
                </span>
                <span className="text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded"
                  style={{ color: "var(--brand-primary)", background: "hsl(220, 90%, 62%, 0.1)" }}>
                  {points}sp
                </span>
              </div>
            </div>

            {/* Task list */}
            <div className="divide-y" style={{ borderColor: "var(--surface-border-subtle)" }}>
              {tasks.map((task) => {
                const priorityInfo = PRIORITY_CONFIG[task.priority ?? 0] ?? PRIORITY_CONFIG[0]!;
                const assigneeName = task.assignee?.name ?? task.assigneeId ?? null;
                const dueDate = task.dueDate ? new Date(task.dueDate) : null;

                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors hover:opacity-80"
                    onClick={() => onOpenDetail(task)}
                    style={{ borderColor: "var(--surface-border-subtle)" }}
                  >
                    {/* Priority dot */}
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: priorityInfo.color }} />

                    {/* Title */}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block" style={{ color: "var(--text-primary)" }}>
                        {task.title}
                      </span>
                      {task.description && (
                        <span className="text-xs truncate block mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {task.description}
                        </span>
                      )}
                    </div>

                    {/* Status badge */}
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0"
                      style={{
                        background: `${(() => {
                          const m: Record<string, string> = {
                            backlog: "hsl(220, 12%, 45%)",
                            todo: "hsl(220, 90%, 62%)",
                            in_progress: "hsl(38, 92%, 58%)",
                            review: "hsl(262, 83%, 68%)",
                            done: "hsl(142, 68%, 52%)",
                          };
                          return m[task.status] ?? "hsl(220, 12%, 45%)";
                        })()}15`,
                        color: (() => {
                          const m: Record<string, string> = {
                            backlog: "hsl(220, 12%, 45%)",
                            todo: "hsl(220, 90%, 62%)",
                            in_progress: "hsl(38, 92%, 58%)",
                            review: "hsl(262, 83%, 68%)",
                            done: "hsl(142, 68%, 52%)",
                          };
                          return m[task.status] ?? "hsl(220, 12%, 45%)";
                        })(),
                      }}
                    >
                      {task.status.replace(/_/g, " ")}
                    </span>

                    {/* Story points */}
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: "hsl(220, 90%, 62%, 0.1)", color: "var(--brand-primary)" }}
                    >
                      {task.storyPoints}sp
                    </span>

                    {/* Assignee */}
                    {assigneeName && (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                        style={{ background: "var(--brand-gradient)", color: "#fff" }}
                        title={assigneeName}
                      >
                        {assigneeName.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Due date */}
                    {dueDate && (
                      <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>
                        {dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Priority Config (exported for use in sub-components) ─────────────────

const PRIORITY_CONFIG_EXPORT: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: "Low", color: "hsl(220, 12%, 45%)", bg: "hsl(220, 12%, 45%, 0.12)" },
  1: { label: "Medium", color: "hsl(220, 90%, 62%)", bg: "hsl(220, 90%, 62%, 0.12)" },
  2: { label: "High", color: "hsl(38, 92%, 58%)", bg: "hsl(38, 92%, 58%, 0.12)" },
  3: { label: "Critical", color: "hsl(0, 80%, 65%)", bg: "hsl(0, 80%, 65%, 0.12)" },
};
