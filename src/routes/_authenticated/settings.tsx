import { createFileRoute } from "@tanstack/react-router";
import { diffRolePermissions } from "@/lib/permissions";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download, Layers, Loader2, Save, Search, Webhook } from "lucide-react";
import { toast } from "sonner";
import { downloadCsv, objectsToCsv } from "@/lib/csv";
import { notifyPermissionDenied } from "@/components/permission-denied";
import { Checkbox } from "@/components/ui/checkbox";
import { ACCESS_GROUPS, fetchUserIndustries, setUserIndustries } from "@/lib/industry-access";
import { useAutoFollowupSettings, useUpdateAutoFollowupSettings } from "@/lib/queries/tenants";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — DigiCRM AI" }] }),
  component: SettingsPage,
});

type Role = "super_admin" | "admin" | "sales_manager" | "sales_executive";

/** Mirrors the server-side hierarchy: nobody may grant a role above their own. */
const ROLE_RANK: Record<Role, number> = {
  super_admin: 4, admin: 3, sales_manager: 2, sales_executive: 1,
};

const ALL_ROLES: Role[] = ["super_admin", "admin", "sales_manager", "sales_executive"];

/**
 * Backend role strings can differ from the frontend ones
 * (e.g. "manager" vs "sales_manager"). Normalise anything we receive.
 */
function normalizeRole(raw: string | null | undefined): Role {
  const v = (raw ?? "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (v === "super_admin" || v === "superadmin") return "super_admin";
  if (v === "admin") return "admin";
  if (v === "sales_manager" || v === "manager") return "sales_manager";
  return "sales_executive"; // "sales_executive" | "executive" | fallback
}

/** Default strings sent to PATCH /users/{id}/role. Must match app/core/constants.py. */
const API_ROLE: Record<Role, string> = {
  super_admin: "super_admin",
  admin: "admin",
  sales_manager: "manager",
  sales_executive: "executive",
};

const roleLabel = (r: string) => r.replace(/_/g, " ");

/* ------------------------------------------------------------------ */
/* API types (match app/schemas/user.py — adjust if names differ)      */
/* ------------------------------------------------------------------ */

interface Me {
  id: number;
  email: string;
  full_name: string | null;
  phone?: string | null;
  role: string;
}

interface TeamMember {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  status?: string | null;
}

interface AuditLog {
  id: number;
  user_id: number | null;
  user_name: string | null;
  table_name: string;
  row_id: string | null;
  action: string;
  description: string | null;
  changes: Record<string, unknown> | null;
  created_at: string;
}

interface AuditLogsResponse {
  data: AuditLog[];
  total: number;
}

// Table name the backend uses for user/role changes in the audit log.
// Change this if your audit rows use a different table_name.
const ROLE_AUDIT_TABLE = "users";

function SettingsPage() {
  const { roles, isAdmin } = useAuth();
  const qc = useQueryClient();

  /* ---------------- Profile (GET/PUT /users/me) ---------------- */
  const { data: me } = useQuery({
    queryKey: ["users", "me"],
    queryFn: () => apiFetch<Me>("/api/v1/users/me"),
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  useEffect(() => {
    if (me) {
      setFullName(me.full_name ?? "");
      setPhone(me.phone ?? "");
    }
  }, [me]);

  useEffect(() => {
    const storedTenant = sessionStorage.getItem("signup_tenant");
    if (storedTenant) {
      try {
        const tenant = JSON.parse(storedTenant);
        setWebhookUrl(tenant.webhook_url ?? "");
      } catch (error) {
        console.error("Failed to parse tenant:", error);
      }
    }
  }, []);

  const name = me?.full_name ?? me?.email?.split("@")[0] ?? "User";
  const initials = name.split(/\s+/).slice(0, 2).map((s: string) => s[0]?.toUpperCase()).join("");
  const displayRoles: Role[] = (roles.length ? roles : me?.role ? [me.role] : []).map((r) =>
    normalizeRole(r as string)
  );

  const saveProfile = useMutation({
    mutationFn: () =>
      apiFetch<Me>("/api/v1/users/me", {
        method: "PUT",
        body: JSON.stringify({ full_name: fullName, phone }),
      }),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["users", "me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ---------------- Team members (GET /users) ---------------- */
  const { data: teamMembers } = useQuery({
    queryKey: ["team-members"],
    enabled: isAdmin,
    queryFn: () => apiFetch<TeamMember[]>("/api/v1/users?limit=200"),
  });

  /* ---------------- Change role (PATCH /users/{id}/role) ---------------- */
  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: Role }) => {
      // prefer the exact string the backend already uses for that role
      const apiRole = teamMembers?.find((m) => normalizeRole(m.role) === role)?.role ?? API_ROLE[role];
      return apiFetch<TeamMember>(`/api/v1/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: apiRole }),
      });
    },
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["role-audit"] });
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  /* ---------------- Role audit (GET /audit-logs) ---------------- */
  const { data: roleAudit } = useQuery({
    queryKey: ["role-audit"],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await apiFetch<AuditLogsResponse>(
        `/api/v1/audit-logs?table=${ROLE_AUDIT_TABLE}&limit=200`
      );
      // keep only entries that actually changed a role
      return (res.data ?? []).filter((a) => {
        const c = a.changes as Record<string, unknown> | null;
        return !!c && "role" in c;
      });
    },
  });

  const [pendingRole, setPendingRole] = useState<
    { userId: number; name: string; from: Role; to: Role } | null
  >(null);
  const [industryFor, setIndustryFor] = useState<{ id: string; name: string } | null>(null);

  const myRank = Math.max(0, ...displayRoles.map((r) => ROLE_RANK[r] ?? 0));
  const pendingDelta = pendingRole ? diffRolePermissions(pendingRole.from, pendingRole.to) : [];

  const [auditSearch, setAuditSearch] = useState("");
  const [auditAction, setAuditAction] = useState<string>("all");
  const [auditRole, setAuditRole] = useState<string>("all");

  const auditRows = useMemo(() => {
    const term = auditSearch.trim().toLowerCase();
    return (roleAudit ?? [])
      .map((a) => {
        const roleChange = (a.changes?.["role"] ?? {}) as { from?: string | null; to?: string | null };
        const meta: Record<string, string | null> = {
          actor_email: a.user_name,
          target_email: a.description,
          old_role: roleChange.from ?? null,
          new_role: roleChange.to ?? null,
        };
        return {
          ...a,
          meta,
          delta: diffRolePermissions(
            (meta["old_role"] as Role) ?? null,
            (meta["new_role"] as Role) ?? null,
          ),
        };
      })
      .filter((a) => {
        if (auditAction !== "all" && a.action !== auditAction) return false;
        if (auditRole !== "all" && a.meta["old_role"] !== auditRole && a.meta["new_role"] !== auditRole) return false;
        if (!term) return true;
        return [a.description, a.meta["actor_email"], a.meta["target_email"], a.meta["old_role"], a.meta["new_role"]]
          .some((v) => (v ?? "").toLowerCase().includes(term));
      });
  }, [roleAudit, auditSearch, auditAction, auditRole]);

  const exportAudit = () => {
    const rows = auditRows.map((a) => ({
      changed_at: new Date(a.created_at).toISOString(),
      action: a.action,
      actor: a.meta["actor_email"] ?? "system",
      target: a.meta["target_email"] ?? a.row_id ?? "",
      old_role: a.meta["old_role"] ?? "",
      new_role: a.meta["new_role"] ?? "",
      description: a.description ?? "",
      permissions_added: a.delta
        .filter((d) => d.gained.length)
        .map((d) => `${d.module}: +${d.gained.join("/")}`)
        .join(" | "),
      permissions_removed: a.delta
        .filter((d) => d.lost.length)
        .map((d) => `${d.module}: -${d.lost.join("/")}`)
        .join(" | "),
    }));
    downloadCsv(
      `digicrm-role-audit-${new Date().toISOString().slice(0, 10)}.csv`,
      objectsToCsv(rows, [
        "changed_at", "action", "actor", "target", "old_role", "new_role",
        "description", "permissions_added", "permissions_removed",
      ]),
    );
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your profile and workspace preferences.</p>
      </div>

      {/* ============ PROFILE CARD ============ */}
      <Card className="shadow-card">
        <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg gradient-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div>
                <p className="font-medium text-lg">{name}</p>
                <p className="text-sm text-muted-foreground">{me?.email}</p>

                <div className="flex gap-1 mt-2">
                  {displayRoles.map((r) => (
                    <Badge key={r} variant="secondary" className="capitalize text-xs">
                      {r.replace("_", " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Session-storage Webhook URL */}
            {webhookUrl && (
              <div className="w-full md:w-105 rounded-lg border p-4">
                <p className="text-sm font-medium">Webhook URL (Signup)</p>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  Received during signup.
                </p>
                <div className="flex gap-2">
                  <Input value={webhookUrl} readOnly className="text-xs" />
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl);
                      toast.success("Webhook URL copied!");
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            )}
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Full Name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          </div>
          <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
            {saveProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save changes
          </Button>
        </CardContent>
      </Card>

      {/* ============ API WEBHOOK URL ============ */}
      <ApiWebhookSection />

      {/* ============ AUTO-FOLLOWUP ============ */}
      <AutoFollowupSection />

      {/* ============ TEAM MEMBERS ============ */}
      {isAdmin && (
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Team Members</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(teamMembers ?? []).map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded border flex-wrap">
                <Avatar className="h-9 w-9"><AvatarFallback className="text-xs bg-primary/10 text-primary">{(m.full_name || m.email || "?").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{m.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setIndustryFor({ id: String(m.id), name: m.full_name || m.email || "this user" })}>
                  <Layers className="mr-2 h-4 w-4" /> Industries
                </Button>
                {(() => {
                  const current = normalizeRole(m.role);
                  // always include the member's current role so it is displayed
                  const options = ALL_ROLES.filter((r) => ROLE_RANK[r] <= myRank || r === current);
                  return (
                    <Select
                      value={current}
                      onValueChange={(v) => setPendingRole({
                        userId: m.id,
                        name: m.full_name || m.email || "this user",
                        from: current,
                        to: v as Role,
                      })}
                      disabled={m.id === me?.id || updateRole.isPending}
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue>
                          <span className="capitalize">{roleLabel(current)}</span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((r) => (
                          <SelectItem
                            key={r}
                            value={r}
                            className="capitalize"
                            disabled={ROLE_RANK[r] > myRank}
                          >
                            {roleLabel(r)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                })()}
              </div>
            ))}

            {teamMembers?.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No team members yet.</p>}
          </CardContent>
        </Card>
      )}

      {/* Role Change Dialog */}
      <Dialog open={!!pendingRole} onOpenChange={(o) => !o && setPendingRole(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm role change</DialogTitle>
            <DialogDescription>
              {pendingRole && (
                <>Change <strong>{pendingRole.name}</strong> from{" "}
                <span className="capitalize">{pendingRole.from.replace("_", " ")}</span> to{" "}
                <span className="capitalize">{pendingRole.to.replace("_", " ")}</span>? The change is
                verified again on the server and recorded in the audit log.</>
              )}
            </DialogDescription>
          </DialogHeader>
          {pendingDelta.length > 0 && (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {pendingDelta.map((d) => (
                <div key={d.module} className="text-xs flex flex-wrap gap-1 items-center">
                  <span className="font-medium">{d.module}</span>
                  {d.gained.length > 0 && (
                    <span className="rounded bg-success/15 text-success px-1.5 py-0.5">+ {d.gained.join(", ")}</span>
                  )}
                  {d.lost.length > 0 && (
                    <span className="rounded bg-destructive/15 text-destructive px-1.5 py-0.5">− {d.lost.join(", ")}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRole(null)}>Cancel</Button>
            <Button
              disabled={updateRole.isPending}
              onClick={() => {
                if (!pendingRole) return;
                updateRole.mutate({ userId: pendingRole.userId, role: pendingRole.to });
                setPendingRole(null);
              }}
            >
              {updateRole.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <IndustryAccessDialog member={industryFor} onClose={() => setIndustryFor(null)} />

      {/* Role Audit Log */}
      {isAdmin && (
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Role change history</CardTitle>
            <Button size="sm" variant="outline" onClick={exportAudit} disabled={auditRows.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-52">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search by user, actor or role…"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                />
              </div>
              <Select value={auditAction} onValueChange={setAuditAction}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Event" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All events</SelectItem>
                  <SelectItem value="updated">Updated</SelectItem>
                  <SelectItem value="role_granted">Role granted</SelectItem>
                  <SelectItem value="role_changed">Role changed</SelectItem>
                  <SelectItem value="role_revoked">Role revoked</SelectItem>
                </SelectContent>
              </Select>
              <Select value={auditRole} onValueChange={setAuditRole}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any role</SelectItem>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {auditRows.map((a) => {
              const added = a.delta.filter((d) => d.gained.length);
              const removed = a.delta.filter((d) => d.lost.length);
              return (
                <div key={a.id} className="rounded border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{a.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        by {a.meta["actor_email"] ?? "system"} · {new Date(a.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] capitalize shrink-0">
                      {a.action.replace(/_/g, " ")}
                    </Badge>
                  </div>

                  {a.delta.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      <p className="text-xs text-muted-foreground">
                        Impact: {added.length} module{added.length === 1 ? "" : "s"} gained access,{" "}
                        {removed.length} module{removed.length === 1 ? "" : "s"} lost access.
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {added.map((d) => (
                          <span key={`+${d.module}`} className="rounded bg-success/15 text-success px-1.5 py-0.5 text-[10px]">
                            + {d.module}: {d.gained.join(", ")}
                          </span>
                        ))}
                        {removed.map((d) => (
                          <span key={`-${d.module}`} className="rounded bg-destructive/15 text-destructive px-1.5 py-0.5 text-[10px]">
                            − {d.module}: {d.lost.join(", ")}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {auditRows.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                {(roleAudit ?? []).length === 0
                  ? "No role changes recorded yet."
                  : "No events match these filters."}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// API WEBHOOK SECTION (unchanged — already FastAPI)
// ============================================================

function ApiWebhookSection() {
  const { data: tenant, isLoading } = useQuery({
    queryKey: ["tenant", "me"],
    queryFn: () => apiFetch<any>("/api/v1/tenant/me"),
  });

  if (isLoading || !tenant?.webhook_url) return null;

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Webhook className="h-4 w-4" /> Webhook URL (API)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Use this URL to receive lead events from external systems.
        </p>

        <div className="flex gap-2">
          <Input
            value={tenant.webhook_url}
            readOnly
            className="text-xs font-mono"
          />
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(tenant.webhook_url);
              toast.success("Copied!");
            }}
          >
            Copy
          </Button>
        </div>

        {tenant.api_key && (
          <>
            <Separator />
            <div>
              <Label className="text-xs">API Key</Label>
              <Input
                value={tenant.api_key}
                readOnly
                type="password"
                className="text-xs font-mono mt-1"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// AUTO-FOLLOWUP SECTION (unchanged — already FastAPI)
// ============================================================

function AutoFollowupSection() {
  const { data: settings, isLoading } = useAutoFollowupSettings();
  const updateMutation = useUpdateAutoFollowupSettings();

  const [enabled, setEnabled] = useState(false);
  const [sequenceId, setSequenceId] = useState<number | null>(null);
  const [assigneeId, setAssigneeId] = useState<number | null>(null);

  const { data: sequences } = useQuery({
    queryKey: ["followup-sequences"],
    queryFn: () => apiFetch<any[]>("/api/v1/followups/sequences"),
  });

  const { data: users } = useQuery({
    queryKey: ["superadmin", "users"],
    queryFn: async () => {
      const res = await apiFetch<any>("/api/v1/superadmin/users");
      return Array.isArray(res) ? res : res.items ?? [];
    },
  });

  useEffect(() => {
    if (settings) {
      setEnabled(settings.auto_followup_enabled);
      setSequenceId(settings.default_followup_sequence_id);
      setAssigneeId(settings.default_assignee_id);
    }
  }, [settings]);

  const handleSave = () => {
    updateMutation.mutate({
      auto_followup_enabled: enabled,
      default_followup_sequence_id: sequenceId,
      default_assignee_id: assigneeId,
    });
  };

  if (isLoading) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-6 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-base">Auto Follow-up Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Enable Auto Follow-up</p>
            <p className="text-sm text-muted-foreground">
              Automatically attach a follow-up sequence when a new lead arrives
            </p>
          </div>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-5 h-5 cursor-pointer"
          />
        </div>

        {enabled && (
          <>
            <div className="space-y-1.5">
              <Label>Default Sequence</Label>
              <Select
                value={sequenceId ? String(sequenceId) : ""}
                onValueChange={(v) => setSequenceId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sequence..." />
                </SelectTrigger>
                <SelectContent>
                  {(sequences ?? []).length === 0 && (
                    <SelectItem value="none" disabled>
                      No sequences yet — create one first
                    </SelectItem>
                  )}
                  {(sequences ?? []).map((seq: any) => (
                    <SelectItem key={seq.id} value={String(seq.id)}>
                      {seq.name} ({seq.total_steps} steps)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Default Assignee</Label>
              <Select
                value={assigneeId ? String(assigneeId) : ""}
                onValueChange={(v) => setAssigneeId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user..." />
                </SelectTrigger>
                <SelectContent>
                  {(users ?? []).map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================
// INDUSTRY ACCESS DIALOG
// NOTE: still relies on "@/lib/industry-access" (fetchUserIndustries /
// setUserIndustries), which likely uses Supabase. No FastAPI route was
// provided for it, so it is left as-is.
// ============================================================

function IndustryAccessDialog({ member, onClose }: { member: { id: string; name: string } | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[] | null>(null);

  const { data: current, isLoading } = useQuery({
    queryKey: ["industry-access", member?.id],
    enabled: !!member?.id,
    queryFn: () => fetchUserIndustries(member!.id),
  });

  const value = selected ?? current ?? [];

  const save = useMutation({
    mutationFn: () => setUserIndustries(member!.id, value),
    onSuccess: () => {
      toast.success("Industry access updated");
      qc.invalidateQueries({ queryKey: ["industry-access"] });
      setSelected(null);
      onClose();
    },
    onError: (e: Error) => notifyPermissionDenied(e),
  });

  const toggle = (slug: string) =>
    setSelected(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug]);

  return (
    <Dialog open={!!member} onOpenChange={(o) => { if (!o) { setSelected(null); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Industry access</DialogTitle>
          <DialogDescription>
            Choose which industry CRMs {member?.name} can open. Leave everything unticked to give access to all
            industries. Administrators always see every industry.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {ACCESS_GROUPS.map((g) => (
              <label key={g.slug} className="flex items-center gap-3 rounded border p-2.5 cursor-pointer">
                <Checkbox checked={value.includes(g.slug)} onCheckedChange={() => toggle(g.slug)} />
                <span className="text-sm">{g.name}</span>
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => { setSelected(null); onClose(); }}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || isLoading}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save access
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}