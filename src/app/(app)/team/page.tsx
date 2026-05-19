"use client";

import { useState } from "react";
import { api } from "@/lib/trpc/client";
import { formatDate } from "@/lib/utils";
import {
  Users, Mail, Shield, Plus, Loader2, X, Check, UserPlus,
  Settings, Crown, UserCog, UserCheck, User,
  LogOut,
} from "lucide-react";

const ROLE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  owner:     { label: "Owner",     icon: Crown,    color: "hsl(39, 100%, 55%)",  bg: "hsl(39, 100%, 55%, 0.12)" },
  admin:     { label: "Admin",     icon: UserCog,  color: "hsl(220, 90%, 62%)",  bg: "hsl(220, 90%, 62%, 0.12)" },
  pm:        { label: "PM",        icon: UserCheck,color: "hsl(262, 83%, 68%)",  bg: "hsl(262, 83%, 68%, 0.12)" },
  developer: { label: "Developer", icon: User,     color: "hsl(142, 68%, 52%)",  bg: "hsl(142, 68%, 52%, 0.12)" },
  viewer:    { label: "Viewer",    icon: User,     color: "hsl(220, 10%, 50%)",  bg: "hsl(220, 10%, 50%, 0.10)" },
};

const ALL_ROLES = ["owner", "admin", "pm", "developer", "viewer"] as const;

function RoleBadge({ role, size = "sm" }: { role: string; size?: "sm" | "md" }) {
  const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.viewer;
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full ${size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2.5 py-1"}`}
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <Icon className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {cfg.label}
    </span>
  );
}

export default function TeamPage() {
  const { data: teams, refetch: refetchTeams, isLoading: teamsLoading } = api.team.list.useQuery();
  const { data: users, refetch: refetchUsers } = api.team.listUsers.useQuery();
  const { data: defaultTeam } = api.team.get.useQuery({ id: "default" }, { enabled: false });

  const addMember = api.team.addMember.useMutation({ onSuccess: () => void refetchTeams() });
  const removeMember = api.team.removeMember.useMutation({ onSuccess: () => void refetchTeams() });
  const updateMemberRole = api.team.updateMemberRole.useMutation({ onSuccess: () => void refetchTeams() });
  const invite = api.team.invite.useMutation({ onSuccess: () => void refetchTeams() });
  const updateUserRole = api.team.updateUserRole.useMutation({ onSuccess: () => void refetchUsers() });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("developer");
  const [showManageUsers, setShowManageUsers] = useState(false);

  // Use the first team, or create a virtual one
  const team = teams?.[0];
  const members = team?.members ?? [];
  const pendingInvites = team?.invitations?.filter((i) => i.status === "pending") ?? [];

  const isAdminOrOwner = (role: string) => role === "owner" || role === "admin";

  if (teamsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-5 rounded-full" style={{ background: "var(--brand-gradient)" }} />
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Team</h1>
          </div>
          <p className="text-sm pl-3.5" style={{ color: "var(--text-secondary)" }}>
            {members.length} member{members.length !== 1 ? "s" : ""}
            {pendingInvites.length > 0 && ` · ${pendingInvites.length} pending invite${pendingInvites.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => setShowManageUsers(!showManageUsers)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
          style={{ background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }}
        >
          <Settings className="w-3.5 h-3.5" />
          {showManageUsers ? "Hide User Management" : "Manage Users"}
        </button>
      </div>

      {/* User Management (admin/owner only) */}
      {showManageUsers && (
        <div
          className="rounded-2xl p-6 space-y-4"
          style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
        >
          <div className="flex items-center gap-2 pb-2" style={{ borderBottom: "1px solid var(--surface-border)" }}>
            <Shield className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>User Role Management</h2>
          </div>
          <div className="space-y-2">
            {users?.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border-subtle)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: "var(--brand-gradient)", color: "white" }}
                  >
                    {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{user.name ?? "Unnamed"}</div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>{user.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <RoleBadge role={user.role ?? "viewer"} size="md" />
                  <select
                    value={user.role ?? "viewer"}
                    onChange={(e) => updateUserRole.mutate({ userId: user.id, role: e.target.value })}
                    className="text-xs px-2 py-1 rounded-lg border bg-transparent"
                    style={{ color: "var(--text-secondary)", borderColor: "var(--surface-border)" }}
                    disabled={updateUserRole.isPending}
                  >
                    {ALL_ROLES.map((r) => (
                      <option key={r} value={r}>{ROLE_CONFIG[r]?.label ?? r}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            {(!users || users.length === 0) && (
              <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>No users found.</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Team Members */}
        <div className="col-span-2 space-y-4">
          <div
            className="rounded-2xl p-6"
            style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
              Team Members
            </h2>
            {members.length === 0 ? (
              <div className="text-center py-10">
                <Users className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>No team members yet</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Invite team members to collaborate.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => {
                  const user = member.user;
                  if (!user) return null;
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between px-4 py-3 rounded-xl"
                      style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border-subtle)" }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                          style={{ background: "var(--brand-gradient)", color: "white" }}
                        >
                          {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {user.name ?? "Unnamed User"}
                          </div>
                          <div className="text-xs" style={{ color: "var(--text-muted)" }}>{user.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <RoleBadge role={member.role} size="md" />
                        {member.role !== "owner" && (
                          <button
                            onClick={() => removeMember.mutate({ memberId: member.id })}
                            disabled={removeMember.isPending}
                            className="p-1.5 rounded-lg transition-colors hover:opacity-70"
                            style={{ color: "var(--text-muted)" }}
                            title="Remove member"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending Invitations */}
          {pendingInvites.length > 0 && (
            <div
              className="rounded-2xl p-6"
              style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
            >
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
                Pending Invitations ({pendingInvites.length})
              </h2>
              <div className="space-y-2">
                {pendingInvites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between px-4 py-3 rounded-xl"
                    style={{ background: "var(--surface-elevated)", border: "1px solid var(--surface-border-subtle)" }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "hsl(207 70% 60% / 0.12)" }}>
                        <Mail className="w-4 h-4" style={{ color: "hsl(207, 70%, 60%)" }} />
                      </div>
                      <div>
                        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{inv.email}</div>
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                          Expires {formatDate(inv.expiresAt)} · Invited by {inv.invitedBy?.name ?? "system"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <RoleBadge role={inv.role} size="md" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Invite Form */}
        <div className="space-y-4">
          <div
            className="rounded-2xl p-6"
            style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
          >
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
              Invite Member
            </h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="nf-input w-full"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>Role</label>
                <div className="space-y-1.5">
                  {ALL_ROLES.map((role) => {
                    const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.viewer;
                    const Icon = cfg.icon;
                    const selected = inviteRole === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setInviteRole(role)}
                        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-left transition-all"
                        style={
                          selected
                            ? { background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }
                            : { background: "var(--surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--surface-border)" }
                        }
                      >
                        {selected ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!inviteEmail || !team) return;
                  invite.mutate({ teamId: team.id, email: inviteEmail, role: inviteRole as any });
                  setInviteEmail("");
                }}
                disabled={invite.isPending || !inviteEmail || !team}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: "var(--brand-gradient)" }}
              >
                {invite.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                Send Invitation
              </button>
            </div>
          </div>

          {/* Quick Info */}
          {team && (
            <div
              className="rounded-2xl p-5"
              style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}
            >
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                Team Info
              </h2>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <Users className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                  <span style={{ color: "var(--text-secondary)" }}>{members.length} members</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Mail className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                  <span style={{ color: "var(--text-secondary)" }}>{pendingInvites.length} pending invites</span>
                </div>
                <div className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
                  Created {formatDate(team.createdAt)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
