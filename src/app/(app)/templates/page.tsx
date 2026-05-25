"use client";

import { api } from "@/lib/trpc/client";
import Link from "next/link";
import { Plus, LayoutTemplate, Loader2, Globe, Smartphone, Monitor, Box, ShoppingBag, Wrench, Brain, Store, LayoutDashboard, User, ArrowRight, Trash2 } from "lucide-react";
import { formatProjectType, formatRelativeTime } from "@/lib/utils";

const TYPE_ICONS: Record<string, typeof Globe> = {
  website: Globe,
  web_app: LayoutDashboard,
  mobile_app: Smartphone,
  desktop_app: Monitor,
  saas: Box,
  marketplace: Store,
  internal_tool: Wrench,
  ai_product: Brain,
  ecommerce: ShoppingBag,
  portal: User,
};

export default function TemplatesPage() {
  const utils = api.useUtils();
  const { data: templates = [], isLoading } = api.templates.list.useQuery();
  const deleteTemplate = api.templates.delete.useMutation({
    onSuccess: () => { void utils.templates.list.invalidate(); },
  });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-5 rounded-full" style={{ background: "var(--brand-gradient)" }} />
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Project Templates</h1>
          </div>
          <p className="text-sm pl-3.5" style={{ color: "var(--text-secondary)" }}>
            Pre-configured templates to bootstrap projects faster
          </p>
        </div>
        <Link
          href="/templates/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--brand-gradient)" }}
        >
          <Plus className="w-4 h-4" /> New Template
        </Link>
      </div>

      {/* Templates list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      ) : templates.length === 0 ? (
        <div
          className="rounded-2xl flex flex-col items-center justify-center py-20 text-center"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: "hsl(220 90% 62% / 0.1)" }}
          >
            <LayoutTemplate className="w-6 h-6" style={{ color: "var(--brand-primary)" }} />
          </div>
          <h2 className="text-base font-semibold mb-2" style={{ color: "var(--text-primary)" }}>No templates yet</h2>
          <p className="text-sm mb-6 max-w-sm" style={{ color: "var(--text-secondary)" }}>
            Create templates for common project types: define phases, default brief content, and more to speed up project creation.
          </p>
          <Link
            href="/templates/new"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--brand-gradient)" }}
          >
            <Plus className="w-4 h-4" /> Create first template
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => {
            const Icon = TYPE_ICONS[template.projectType] ?? LayoutTemplate;
            return (
              <div
                key={template.id}
                className="rounded-xl p-5 transition-all group hover:scale-[1.01]"
                style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "hsl(220 90% 62% / 0.12)" }}
                  >
                    <Icon className="w-5 h-5" style={{ color: "var(--brand-primary)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{template.name}</h3>
                      {template.isBuiltIn && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "hsl(262 83% 68% / 0.15)", color: "hsl(262, 83%, 68%)" }}>
                          Built-in
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                      {formatProjectType(template.projectType)}
                    </p>
                  </div>
                </div>

                {template.description && (
                  <p className="text-xs mb-3 line-clamp-2" style={{ color: "var(--text-muted)" }}>
                    {template.description}
                  </p>
                )}

                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                    {template.phases?.length ?? 0} phase{(template.phases?.length ?? 0) !== 1 ? "s" : ""}
                  </span>
                  {template.phases && template.phases.length > 0 && (
                    <div className="flex gap-0.5">
                      {template.phases.slice(0, 5).map((p) => (
                        <div
                          key={p.id}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: "hsl(220 90% 62% / 0.4)" }}
                          title={p.phaseName}
                        />
                      ))}
                      {template.phases.length > 5 && (
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>+{template.phases.length - 5}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--surface-border-subtle)" }}>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/projects/new?templateId=${template.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ background: "var(--brand-gradient)" }}
                    >
                      <ArrowRight className="w-3 h-3" /> Use Template
                    </Link>
                    {!template.isBuiltIn && (
                      <button
                        onClick={() => {
                          if (confirm(`Delete template "${template.name}"?`)) {
                            deleteTemplate.mutate({ id: template.id });
                          }
                        }}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete template"
                      >
                        <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                      </button>
                    )}
                  </div>
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {formatRelativeTime(template.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
