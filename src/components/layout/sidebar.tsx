"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, FolderKanban, Users, Plus, Zap,
  BookOpen, Brain, Sparkles, LogOut, BarChart2,
  Key, Search, LayoutTemplate, ScrollText, Database,
  Target, Star, Link2, Clock, TrendingUp, CheckSquare,
  FileText, Handshake,
} from "lucide-react";
import type { Session } from "next-auth";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import { SyncStatus } from "@/components/sync/SyncStatus";

const NAV_SECTIONS = [
  {
    label: "Intelligence",
    items: [
      { href: "/ai",        label: "AI Studio",      icon: Brain,    badge: "New" as const },
      { href: "/knowledge", label: "Knowledge Hub",  icon: BookOpen, badge: null },
      { href: "/wiki",      label: "Internal Wiki",  icon: FileText, badge: null },
      { href: "/playbooks", label: "Playbooks",      icon: Sparkles, badge: null },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { href: "/leads",         label: "Lead Pipeline",  icon: Target,   badge: null },
      { href: "/affiliates",    label: "Affiliates",     icon: Link2,    badge: null },
      { href: "/case-studies",  label: "Case Studies",   icon: Star,     badge: null },
    ],
  },
  {
    label: "Clients & Revenue",
    items: [
      { href: "/clients",       label: "Clients",        icon: Users,       badge: null },
      { href: "/onboarding",    label: "Onboarding",     icon: CheckSquare, badge: null },
      { href: "/invoices",      label: "Invoices",       icon: Handshake,   badge: null },
      { href: "/revenue",       label: "Revenue",        icon: TrendingUp,  badge: "New" as const },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/",              label: "Dashboard",      icon: LayoutDashboard, badge: null },
      { href: "/team-standup",  label: "Team Standup",   icon: Zap,             badge: null },
      { href: "/time-tracking", label: "Time Tracking",  icon: Clock,           badge: null },
      { href: "/projects",      label: "Projects",       icon: FolderKanban,    badge: null },
      { href: "/projects/board", label: "Board",         icon: LayoutDashboard, badge: null },
      { href: "/analytics",     label: "Analytics",      icon: BarChart2,       badge: null },
      { href: "/search",        label: "Search",         icon: Search,          badge: null },
      { href: "/templates",     label: "Templates",      icon: LayoutTemplate,  badge: null },
    ],
  },
];

export function Sidebar({ session }: { session: Session | null }) {
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
        <div className="flex items-center gap-1">
          <Link
            href="/ai"
            className="flex items-center gap-2 flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-90"
            style={{ background: "hsl(262 83% 68% / 0.15)", color: "hsl(262, 83%, 68%)" }}
          >
            <Brain className="w-3.5 h-3.5" /> Ask AI Studio
          </Link>
          <NotificationDropdown />
        </div>
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

        {/* Sync Status */}
        <div className="px-2.5">
          <SyncStatus />
        </div>
      </nav>

      {/* Settings */}
      <div className="shrink-0 px-2.5 pb-2">
        <div className="space-y-0.5">
          <Link
            href="/settings/api-keys"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
            style={{ color: pathname.startsWith("/settings") ? "var(--brand-primary)" : "var(--text-secondary)" }}
          >
            <Key className="w-4 h-4 shrink-0" strokeWidth={pathname.startsWith("/settings") ? 2 : 1.75} />
            API Keys
          </Link>
          <Link
            href="/settings/audit-log"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
            style={{ color: pathname.startsWith("/settings") ? "var(--brand-primary)" : "var(--text-secondary)" }}
          >
            <ScrollText className="w-4 h-4 shrink-0" strokeWidth={pathname.startsWith("/settings") ? 2 : 1.75} />
            Audit Log
          </Link>
          <Link
            href="/settings/data"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
            style={{ color: pathname.startsWith("/settings") ? "var(--brand-primary)" : "var(--text-secondary)" }}
          >
            <Database className="w-4 h-4 shrink-0" strokeWidth={pathname.startsWith("/settings") ? 2 : 1.75} />
            Data Export
          </Link>
        </div>
      </div>

      {/* User section */}
      <div className="shrink-0" style={{ borderTop: "1px solid var(--surface-border)" }}>
        {session?.user && (
          <div className="px-4 py-3 flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: "var(--brand-gradient)" }}
            >
              {session.user.name?.charAt(0)?.toUpperCase() ?? session.user.email?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {session.user.name ?? session.user.email ?? "User"}
              </div>
              <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                {session.user.role ?? "viewer"}
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="p-1.5 rounded-lg transition-all duration-150 hover:opacity-80 shrink-0"
              style={{ color: "var(--text-muted)" }}
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
        {!session?.user && (
          <div className="p-4 shrink-0">
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>NexoFlow OS · v2.0</div>
          </div>
        )}
      </div>
    </aside>
  );
}
