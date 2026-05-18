"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Zap,
  ChevronRight,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/clients", label: "Clients", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-[var(--surface-border)] flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-[var(--surface-border)]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--brand-primary)] flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-semibold text-[var(--text-primary)] tracking-tight">
            NexoFlow OS
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-[hsl(220,90%,56%,0.08)] text-[var(--brand-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-bg)] hover:text-[var(--text-primary)]",
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--surface-border)]">
        <div className="text-xs text-[var(--text-muted)]">NexoFlow OS v0.1</div>
      </div>
    </aside>
  );
}
