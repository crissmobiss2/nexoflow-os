"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, FolderKanban, Users, Plus, Zap,
  BookOpen, Brain, Sparkles, LogOut, BarChart2,
  Key, Search, LayoutTemplate, ScrollText, Database,
  Target, Star, Link2, Clock, TrendingUp, CheckSquare,
  FileText, Handshake, Menu, X, ChevronRight,
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
      { href: "/clients",    label: "Clients",     icon: Users,       badge: null },
      { href: "/onboarding", label: "Onboarding",  icon: CheckSquare, badge: null },
      { href: "/invoices",   label: "Invoices",    icon: Handshake,   badge: null },
      { href: "/revenue",    label: "Revenue",     icon: TrendingUp,  badge: "New" as const },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/",               label: "Dashboard",     icon: LayoutDashboard, badge: null },
      { href: "/team-standup",   label: "Team Standup",  icon: Zap,             badge: null },
      { href: "/time-tracking",  label: "Time Tracking", icon: Clock,           badge: null },
      { href: "/projects",       label: "Projects",      icon: FolderKanban,    badge: null },
      { href: "/analytics",      label: "Analytics",     icon: BarChart2,       badge: null },
      { href: "/search",         label: "Search",        icon: Search,          badge: null },
      { href: "/templates",      label: "Templates",     icon: LayoutTemplate,  badge: null },
    ],
  },
];

const BOTTOM_NAV = [
  { href: "/",              label: "Home",      icon: LayoutDashboard },
  { href: "/clients",       label: "Clients",   icon: Users },
  { href: "/ai",            label: "AI",        icon: Brain },
  { href: "/projects",      label: "Projects",  icon: FolderKanban },
  { href: "/revenue",       label: "Revenue",   icon: TrendingUp },
];

export function Sidebar({ session }: { session: Session | null }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Prevent body scroll when drawer open
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
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--brand-gradient)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold leading-none" style={{ color: "var(--text-primary)" }}>NexoFlow</div>
            <div className="text-[10px] leading-none mt-0.5 font-medium tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>OS</div>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-1 rounded-lg"
          style={{ color: "var(--text-muted)" }}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Primary CTAs */}
      <div className="p-3 space-y-1.5" style={{ borderBottom: "1px solid var(--surface-border)" }}>
        <Link
          href="/clients/new"
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--brand-gradient)" }}
        >
          <Plus className="w-3.5 h-3.5" /> Onboard Client
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/ai"
            className="flex items-center gap-2 flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold transition-opacity hover:opacity-90"
            style={{ background: "hsl(262 83% 68% / 0.15)", color: "hsl(262, 83%, 68%)" }}
          >
            <Brain className="w-3.5 h-3.5" /> Ask AI Studio
          </Link>
          <NotificationDropdown />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2.5 space-y-4 overflow-y-auto">
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
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                      active ? "text-[var(--brand-primary)]" : "hover:text-[var(--text-primary)]",
                    )}
                    style={active
                      ? { background: "hsl(220 90% 62% / 0.15)", boxShadow: "inset 0 0 0 1px hsl(220 90% 62% / 0.2)" }
                      : { color: "var(--text-secondary)" }
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" strokeWidth={active ? 2 : 1.75} />
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
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all hover:text-[var(--text-primary)]"
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
            { href: "/settings/api-keys", label: "API Keys", icon: Key },
            { href: "/settings/audit-log", label: "Audit Log", icon: ScrollText },
            { href: "/settings/data", label: "Data Export", icon: Database },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
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
                {(session.user as any).role ?? "admin"}
              </div>
            </div>
            <button onClick={() => signOut()} className="p-1.5 rounded-lg hover:opacity-80 shrink-0" style={{ color: "var(--text-muted)" }} title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* ── Mobile top header ─────────────────────────────────────────── */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 flex items-center px-4 gap-3"
        style={{ background: "var(--surface-card)", borderBottom: "1px solid var(--surface-border)" }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg -ml-1"
          style={{ color: "var(--text-secondary)" }}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: "var(--brand-gradient)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>NexoFlow</span>
        </div>
        <NotificationDropdown />
      </header>

      {/* ── Mobile overlay backdrop ────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar — desktop always visible, mobile drawer ───────────── */}
      <aside
        className={cn(
          "fixed md:sticky top-0 inset-y-0 left-0 z-50 w-60 min-h-screen flex flex-col shrink-0 transition-transform duration-300 ease-in-out",
          "md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ background: "var(--surface-card)", borderRight: "1px solid var(--surface-border)" }}
      >
        {sidebarContent}
      </aside>

      {/* ── Mobile bottom nav ──────────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 grid"
        style={{
          gridTemplateColumns: `repeat(${BOTTOM_NAV.length}, 1fr)`,
          background: "var(--surface-card)",
          borderTop: "1px solid var(--surface-border)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-1 transition-opacity"
              style={{ color: active ? "var(--brand-primary)" : "var(--text-muted)" }}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.25 : 1.75} />
              <span className="text-[10px] font-semibold">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
