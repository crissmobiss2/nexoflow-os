"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, FolderKanban, Users, Plus, Zap,
  BookOpen, Brain, Sparkles,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    label: "Intelligence",
    items: [
      { href: "/ai",        label: "AI Studio",      icon: Brain,          badge: "New" },
      { href: "/knowledge", label: "Knowledge Hub",  icon: BookOpen,       badge: null },
      { href: "/playbooks", label: "Playbooks",      icon: Sparkles,       badge: null },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/",          label: "Dashboard",      icon: LayoutDashboard, badge: null },
      { href: "/clients",   label: "Clients",        icon: Users,           badge: null },
      { href: "/projects",  label: "Projects",       icon: FolderKanban,    badge: null },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside
      className="w-56 min-h-screen flex flex-col shrink-0"
      style={{ background: "var(--surface-card)", borderRight: "1px solid var(--surface-border)" }}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-5 shrink-0" style={{ borderBottom: "1px solid var(--surface-border)" }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--brand-gradient)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold leading-none" style={{ color: "var(--text-primary)" }}>NexoFlow</div>
            <div className="text-[10px] leading-none mt-0.5 font-medium tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>OS</div>
          </div>
        </div>
      </div>

      {/* Primary CTA */}
      <div className="p-3 space-y-1.5" style={{ borderBottom: "1px solid var(--surface-border)" }}>
        <Link
          href="/clients/new"
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--brand-gradient)" }}
        >
          <Plus className="w-3.5 h-3.5" /> Onboard Client
        </Link>
        <Link
          href="/ai"
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-90"
          style={{ background: "hsl(262 83% 68% / 0.15)", color: "hsl(262, 83%, 68%)" }}
        >
          <Brain className="w-3.5 h-3.5" /> Ask AI Studio
        </Link>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 p-2.5 space-y-4 overflow-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="px-2 py-1 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                {section.label}
              </span>
            </div>
            <div className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon, badge }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                      active ? "text-[var(--brand-primary)]" : "hover:text-[var(--text-primary)]",
                    )}
                    style={
                      active
                        ? { background: "hsl(220 90% 62% / 0.15)", boxShadow: "inset 0 0 0 1px hsl(220 90% 62% / 0.2)" }
                        : { color: "var(--text-secondary)" }
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" strokeWidth={active ? 2 : 1.75} />
                    <span className="flex-1">{label}</span>
                    {badge && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: "hsl(262 83% 68% / 0.2)", color: "hsl(262, 83%, 68%)" }}
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Quick action */}
        <div>
          <div className="px-2 py-1 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Quick</span>
          </div>
          <Link
            href="/projects/new"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 hover:text-[var(--text-primary)]"
            style={{ color: "var(--text-secondary)" }}
          >
            <Zap className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            New Project
          </Link>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 shrink-0" style={{ borderTop: "1px solid var(--surface-border)" }}>
        <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>NexoFlow OS · v2.0</div>
      </div>
    </aside>
  );
}
