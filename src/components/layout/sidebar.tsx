"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, FolderKanban, Users, Plus, Zap,
  BookOpen, Brain, Sparkles, LogOut, BarChart2,
  Key, Search, LayoutTemplate, ScrollText, Database,
  Target, Star, Link2, Clock, TrendingUp, CheckSquare,
  FileText, Handshake, Menu, X,
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
      { href: "/leads",        label: "Lead Pipeline", icon: Target, badge: null },
      { href: "/affiliates",   label: "Affiliates",    icon: Link2,  badge: null },
      { href: "/case-studies", label: "Case Studies",  icon: Star,   badge: null },
    ],
  },
  {
    label: "Clients & Revenue",
    items: [
      { href: "/clients",    label: "Clients",    icon: Users,       badge: null },
      { href: "/onboarding", label: "Onboarding", icon: CheckSquare, badge: null },
      { href: "/invoices",   label: "Invoices",   icon: Handshake,   badge: null },
      { href: "/revenue",    label: "Revenue",    icon: TrendingUp,  badge: "New" as const },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/",              label: "Dashboard",    icon: LayoutDashboard, badge: null },
      { href: "/team-standup",  label: "Team Standup", icon: Zap,             badge: null },
      { href: "/time-tracking", label: "Time Tracking",icon: Clock,           badge: null },
      { href: "/projects",      label: "Projects",     icon: FolderKanban,    badge: null },
      { href: "/analytics",     label: "Analytics",    icon: BarChart2,       badge: null },
      { href: "/search",        label: "Search",       icon: Search,          badge: null },
      { href: "/templates",     label: "Templates",    icon: LayoutTemplate,  badge: null },
    ],
  },
];

const BOTTOM_NAV = [
  { href: "/",         label: "Home",     icon: LayoutDashboard },
  { href: "/clients",  label: "Clients",  icon: Users },
  { href: "/ai",       label: "AI",       icon: Brain },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/revenue",  label: "Revenue",  icon: TrendingUp },
];

const ALL_ROUTES = NAV_SECTIONS.flatMap((s) => s.items);

function getPageTitle(pathname: string): string {
  const exact = ALL_ROUTES.find((item) => item.href === pathname);
  if (exact) return exact.label;
  const prefix = ALL_ROUTES
    .filter((item) => item.href !== "/" && pathname.startsWith(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (prefix) return prefix.label;
  if (pathname.startsWith("/settings")) return "Settings";
  return "NexoFlow";
}

export function Sidebar({ session }: { session: Session | null }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pageTitle = useMemo(() => getPageTitle(pathname), [pathname]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="h-14 flex items-center px-5 shrink-0" style={{ borderBottom: "1px solid var(--surface-border)" }}>
        <div className="flex items-center gap-2.5 flex-1">
          <img src="/nexoflow-logo.jpg" alt="NexoFlow" className="w-7 h-7 rounded-lg object-cover shrink-0" />
          <div>
            <div className="text-sm font-semibold leading-none" style={{ color: "var(--text-primary)" }}>NexoFlow</div>
            <div className="text-[10px] leading-none mt-0.5 font-medium tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>OS</div>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-xl transition-all active:scale-90"
          style={{ color: "var(--text-muted)", background: "var(--surface-elevated)" }}
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Primary CTAs */}
      <div className="p-3 space-y-1.5" style={{ borderBottom: "1px solid var(--surface-border)" }}>
        <Link
          href="/clients/new"
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-white transition-all active:scale-[0.97] active:opacity-80"
          style={{ background: "var(--brand-gradient)" }}
        >
          <Plus className="w-3.5 h-3.5" /> Onboard Client
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/ai"
            className="flex items-center gap-2 flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.97] active:opacity-80"
            style={{ background: "hsl(262 83% 68% / 0.15)", color: "hsl(262, 83%, 68%)" }}
          >
            <Brain className="w-3.5 h-3.5" /> Ask AI Studio
          </Link>
          <NotificationDropdown />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2.5 space-y-4 overflow-y-auto overscroll-contain">
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
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.98]",
                      active ? "text-[var(--brand-primary)]" : "hover:text-[var(--text-primary)]",
                    )}
                    style={active
                      ? { background: "hsl(220 90% 62% / 0.12)", boxShadow: "inset 0 0 0 1px hsl(220 90% 62% / 0.18)" }
                      : { color: "var(--text-secondary)" }
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
                    <span className="flex-1">{label}</span>
                    {badge && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "hsl(262 83% 68% / 0.2)", color: "hsl(262, 83%, 68%)" }}>
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <div className="px-2 py-1 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Quick</span>
          </div>
          <Link
            href="/projects/new"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-[0.98] hover:text-[var(--text-primary)]"
            style={{ color: "var(--text-secondary)" }}
          >
            <Zap className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            New Project
          </Link>
        </div>

        <div className="px-2.5">
          <SyncStatus />
        </div>
      </nav>

      {/* Settings */}
      <div className="shrink-0 px-2.5 pb-2">
        <div className="space-y-0.5">
          {[
            { href: "/settings/api-keys",  label: "API Keys",   icon: Key },
            { href: "/settings/audit-log", label: "Audit Log",  icon: ScrollText },
            { href: "/settings/data",      label: "Data Export",icon: Database },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-[0.98]"
              style={{ color: pathname.startsWith("/settings") ? "var(--brand-primary)" : "var(--text-secondary)" }}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* User */}
      <div className="shrink-0" style={{ borderTop: "1px solid var(--surface-border)" }}>
        {session?.user && (
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "var(--brand-gradient)" }}>
              {session.user.name?.charAt(0)?.toUpperCase() ?? session.user.email?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {session.user.name ?? session.user.email ?? "User"}
              </div>
              <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                {(session.user as { role?: string }).role ?? "admin"}
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="p-1.5 rounded-lg hover:opacity-80 active:scale-90 shrink-0 transition-all"
              style={{ color: "var(--text-muted)" }}
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* ── Mobile top header ──────────────────────────────────────────── */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center h-14 px-3 gap-3"
        style={{
          background: "var(--surface-card)",
          borderBottom: "1px solid var(--surface-border)",
          boxShadow: "0 1px 12px hsl(222 30% 4% / 0.5)",
        }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center justify-center w-9 h-9 rounded-xl transition-all active:scale-90 shrink-0"
          style={{ color: "var(--text-secondary)", background: "var(--surface-elevated)", border: "1px solid var(--surface-border)" }}
          aria-label="Open menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold leading-tight truncate" style={{ color: "var(--text-primary)" }}>
            {pageTitle}
          </div>
          <div className="text-[9px] font-semibold uppercase tracking-widest leading-none mt-0.5" style={{ color: "var(--text-muted)" }}>
            NexoFlow OS
          </div>
        </div>

        <NotificationDropdown />
      </header>

      {/* ── Mobile overlay backdrop ──────────────────────────────────────── */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-40 transition-all duration-300",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
        onClick={() => setMobileOpen(false)}
      />

      {/* ── Sidebar ── desktop always visible, mobile slide-in drawer ──── */}
      <aside
        className={cn(
          "fixed md:sticky top-0 inset-y-0 left-0 z-50 flex flex-col shrink-0",
          "transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          "md:translate-x-0 md:w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{
          width: "min(88vw, 300px)",
          background: "var(--surface-card)",
          borderRight: "1px solid var(--surface-border)",
        }}
      >
        {sidebarContent}
      </aside>

      {/* ── Mobile bottom nav ──────────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30"
        style={{
          background: "var(--surface-card)",
          borderTop: "1px solid var(--surface-border)",
          boxShadow: "0 -1px 12px hsl(222 30% 4% / 0.4)",
        }}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${BOTTOM_NAV.length}, 1fr)`,
            paddingBottom: "env(safe-area-inset-bottom, 20px)",
          }}
        >
          {BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center justify-center pt-2 pb-2.5 gap-1 relative transition-all active:scale-90 active:opacity-70"
                style={{ minHeight: "56px" }}
              >
                {/* Active top-bar indicator */}
                {active && (
                  <span
                    className="absolute top-0 rounded-b-full"
                    style={{ left: "30%", right: "30%", height: "2px", background: "var(--brand-primary)" }}
                  />
                )}

                {/* Icon with pill background when active */}
                <div
                  className="flex items-center justify-center rounded-xl transition-all duration-150"
                  style={{
                    width: 42, height: 26,
                    background: active ? "hsl(220 90% 62% / 0.13)" : "transparent",
                  }}
                >
                  <Icon
                    className="transition-all duration-150"
                    style={{
                      width: 18, height: 18,
                      color: active ? "var(--brand-primary)" : "var(--text-muted)",
                      strokeWidth: active ? 2.5 : 1.75,
                    }}
                  />
                </div>

                <span
                  className="text-[10px] font-semibold leading-none transition-all duration-150"
                  style={{ color: active ? "var(--brand-primary)" : "var(--text-muted)" }}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
