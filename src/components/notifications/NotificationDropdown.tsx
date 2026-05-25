"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  CheckCheck,
  Loader2,
  ExternalLink,
  MessageSquare,
  FileText,
  Users,
  Bot,
  Activity,
  CreditCard,
  UserPlus,
  Eye,
  Zap,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

const TYPE_ICONS: Record<string, React.ElementType> = {
  project_status: Activity,
  sprint_task: FileText,
  comment: MessageSquare,
  invoice: CreditCard,
  team_invite: Users,
  ai_conversation: Bot,
  client_onboarding: UserPlus,
  demo_view: Eye,
  lead_activity: Zap,
};

const TYPE_COLORS: Record<string, string> = {
  project_status: "hsl(220, 90%, 62%)",
  sprint_task: "hsl(262, 83%, 68%)",
  comment: "hsl(142, 68%, 52%)",
  invoice: "hsl(0, 80%, 65%)",
  team_invite: "hsl(187, 80%, 55%)",
  ai_conversation: "hsl(30, 90%, 55%)",
  client_onboarding: "hsl(160, 80%, 50%)",
  demo_view: "hsl(35, 90%, 58%)",
  lead_activity: "hsl(262, 83%, 68%)",
};

export function NotificationDropdown() {
  const router = useRouter();
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = api.notifications.list.useQuery(
    { limit: 10, offset: 0 },
    { refetchInterval: 30_000 },
  );
  const { data: unreadCount = 0 } = api.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 15_000,
  });

  const markRead = api.notifications.markRead.useMutation({
    onSuccess: () => {
      void utils.notifications.list.invalidate();
      void utils.notifications.unreadCount.invalidate();
    },
  });

  const markAllRead = api.notifications.markAllRead.useMutation({
    onSuccess: () => {
      void utils.notifications.list.invalidate();
      void utils.notifications.unreadCount.invalidate();
    },
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleNotificationClick = useCallback(
    async (notification: (typeof notifications)[number]) => {
      if (!notification.read) {
        await markRead.mutateAsync({ id: notification.id });
      }
      if (notification.link) {
        router.push(notification.link);
      }
      setOpen(false);
    },
    [markRead, router],
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg transition-all duration-150 hover:opacity-80"
        style={{ color: "var(--text-secondary)" }}
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center text-[9px] font-bold rounded-full px-1"
            style={{ background: "hsl(0, 80%, 60%)", color: "white" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 rounded-xl shadow-lg overflow-hidden z-50"
          style={{
            background: "var(--surface-card)",
            border: "1px solid var(--surface-border)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid var(--surface-border)" }}
          >
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="flex items-center gap-1 text-[11px] font-medium transition-opacity hover:opacity-70"
                style={{ color: "var(--brand-primary)" }}
              >
                <CheckCheck className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4">
                <BellOff className="w-8 h-8 mb-2" style={{ color: "var(--text-muted)" }} />
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  No new notifications
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] ?? Bell;
                const accentColor = TYPE_COLORS[n.type] ?? "var(--text-muted)";
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className="w-full text-left px-4 py-3 transition-colors hover:opacity-80"
                    style={{
                      borderBottom: "1px solid var(--surface-border)",
                      background: n.read ? "transparent" : "hsl(220 90% 62% / 0.05)",
                    }}
                  >
                    <div className="flex gap-3">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: `${accentColor}20` }}
                      >
                        <Icon className="w-3.5 h-3.5" style={{ color: accentColor }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className="text-xs font-medium truncate"
                          style={{ color: n.read ? "var(--text-secondary)" : "var(--text-primary)" }}
                        >
                          {n.title}
                        </div>
                        {n.message && (
                          <div
                            className="text-[11px] mt-0.5 line-clamp-2"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {n.message}
                          </div>
                        )}
                        <div className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                          {formatRelativeTime(n.createdAt)}
                        </div>
                      </div>
                      {!n.read && (
                        <div
                          className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                          style={{ background: "var(--brand-primary)" }}
                        />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
