"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FolderKanban, Users } from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/clients", label: "Clients", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="w-56 min-h-screen flex flex-col shrink-0"
      style={{
        background: "var(--surface-card)",
        borderRight: "1px solid var(--surface-border)",
      }}
    >
      {/* Logo */}
      <div
        className="h-14 flex items-center px-5 shrink-0"
        style={{ borderBottom: "1px solid var(--surface-border)" }}
      >
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
            <div className="text-sm font-semibold leading-none" style={{ color: "var(--text-primary)" }}>
              NexoFlow
            </div>
            <div className="text-[10px] leading-none mt-0.5 font-medium tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
              OS
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2.5 space-y-0.5">
        <div className="px-2 py-1.5 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Workspace
          </span>
        </div>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "text-white"
                  : "hover:text-[var(--text-primary)]",
              )}
              style={active ? {
                background: "hsl(220 90% 62% / 0.15)",
                color: "var(--brand-primary)",
                boxShadow: "inset 0 0 0 1px hsl(220 90% 62% / 0.2)",
              } : {
                color: "var(--text-secondary)",
              }}
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={active ? 2 : 1.75} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className="p-4"
        style={{ borderTop: "1px solid var(--surface-border)" }}
      >
        <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          NexoFlow OS · v1.0
        </div>
      </div>
    </aside>
  );
}
