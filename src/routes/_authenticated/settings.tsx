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
import { Download, Eye, Loader2, Save, Search, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { downloadCsv, objectsToCsv } from "@/lib/csv";
import { notifyPermissionDenied } from "@/components/permission-denied";
import { Checkbox } from "@/components/ui/checkbox";
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

/** Roles that can be granted through the API (super_admin is never grantable). */
const ASSIGNABLE_ROLES: Role[] = ["admin", "sales_manager", "sales_executive"];

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

/** Default strings sent to the API. Must match app/core/constants.py. */
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
  created_at?: string | null;
}

interface InviteResponse {
  user_id: number;
  email: string;
  full_name: string | null;
  role: string;
  tenant_id: number | null;
  temp_password: string | null;
  email_sent: boolean;
  email_error: string | null;
}

/** Row from GET /role-changes (RoleChangeHistory). Roles are raw backend strings. */
interface RoleChange {
  id: number;
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  actor_id: number | null;
  actor_name: string | null;
  actor_email: string | null;
  old_role: string | null;
  new_role: string | null;
  created_at: string;
}

interface RoleChangeListResponse {
  data: RoleChange[];
  total: number;
}

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

  useEffect(() => {
    if (me) {
      setFullName(me.full_name ?? "");
      setPhone(me.phone ?? "");
    }
  }, [me]);

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

  /* ---------------- Delete user (DELETE /users/{id}) ---------------- */
  const deleteUser = useMutation({
    mutationFn: async (userId: number) => {
      try {
        // Backend returns 204 No Content; some fetch wrappers throw when
        // trying to parse an empty body as JSON, so tolerate that case.
        await apiFetch<unknown>(`/api/v1/users/${userId}`, { method: "DELETE" });
      } catch (e) {
        if (e instanceof SyntaxError) return; // empty body parse error → success
        throw e;
      }
    },
    onSuccess: () => {
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["role-audit"] });
      setPendingDelete(null);
    },
    onError: (e: Error) => {
      setPendingDelete(null);
      notifyPermissionDenied(e);
    },
  });

  /* ---------------- Role change history (GET /role-changes) ---------------- */
  const { data: roleAudit, isError: auditIsError, error: auditError } = useQuery({
    queryKey: ["role-audit"],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await apiFetch<RoleChangeListResponse>("/api/v1/role-changes?limit=500");
      return res.data ?? [];
    },
  });

  const [pendingRole, setPendingRole] = useState<
    { userId: number; name: string; from: Role; to: Role } | null
  >(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; name: string } | null>(null);
  const [viewUserId, setViewUserId] = useState<number | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const myRank = Math.max(0, ...displayRoles.map((r) => ROLE_RANK[r] ?? 0));
  const isSuperAdmin = displayRoles.includes("super_admin");
  const pendingDelta = pendingRole ? diffRolePermissions(pendingRole.from, pendingRole.to) : [];

  const [auditSearch, setAuditSearch] = useState("");
  const [auditRole, setAuditRole] = useState<string>("all");

  const auditRows = useMemo(() => {
    const term = auditSearch.trim().toLowerCase();
    return (roleAudit ?? [])
      .map((r) => {
        // backend stores "manager"/"executive"; normalise to the UI role names
        const oldRole = r.old_role ? normalizeRole(r.old_role) : null;
        const newRole = r.new_role ? normalizeRole(r.new_role) : null;
        return {
          ...r,
          oldRole,
          newRole,
          targetName: r.user_name || r.user_email || `User ${r.user_id ?? ""}`,
          actorName: r.actor_name || r.actor_email || "system",
          delta: diffRolePermissions(oldRole, newRole),
        };
      })
      .filter((a) => {
        if (auditRole !== "all" && a.oldRole !== auditRole && a.newRole !== auditRole) return false;
        if (!term) return true;
        return [a.user_name, a.user_email, a.actor_name, a.actor_email, a.oldRole, a.newRole]
          .some((v) => (v ?? "").toLowerCase().includes(term));
      });
  }, [roleAudit, auditSearch, auditRole]);

  const exportAudit = () => {
    const rows = auditRows.map((a) => ({
      changed_at: new Date(a.created_at).toISOString(),
      actor: a.actor_email ?? a.actorName,
      target: a.user_email ?? a.targetName,
      old_role: a.oldRole ?? "",
      new_role: a.newRole ?? "",
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
        "changed_at", "actor", "target", "old_role", "new_role",
        "permissions_added", "permissions_removed",
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
                    {roleLabel(r)}
                  </Badge>
                ))}
              </div>
            </div>
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

      {/* ============ AUTO-FOLLOWUP ============ */}
      <AutoFollowupSection />

      {/* ============ TEAM MEMBERS ============ */}
      {isAdmin && (
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Team Members</CardTitle>
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" /> Invite user
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(teamMembers ?? []).map((m) => {
              const current = normalizeRole(m.role);
              const isSelf = m.id === me?.id;
              const targetIsSuperAdmin = current === "super_admin";
              const memberName = m.full_name || m.email || "this user";
              // always include the member's current role so it is displayed;
              // super_admin can never be granted through the API
              const options = ALL_ROLES.filter(
                (r) => (ASSIGNABLE_ROLES.includes(r) && ROLE_RANK[r] <= myRank) || r === current
              );

              return (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded border flex-wrap">
                  <Avatar className="h-9 w-9"><AvatarFallback className="text-xs bg-primary/10 text-primary">{(m.full_name || m.email || "?").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{m.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    title="View details"
                    onClick={() => setViewUserId(m.id)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>

                  <Select
                    value={current}
                    onValueChange={(v) => setPendingRole({
                      userId: m.id,
                      name: memberName,
                      from: current,
                      to: v as Role,
                    })}
                    disabled={isSelf || targetIsSuperAdmin || updateRole.isPending}
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
                          disabled={r === "super_admin" || ROLE_RANK[r] > myRank}
                        >
                          {roleLabel(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    title={
                      isSelf
                        ? "You cannot delete yourself"
                        : targetIsSuperAdmin
                        ? "The SuperAdmin cannot be deleted"
                        : "Delete user"
                    }
                    disabled={isSelf || targetIsSuperAdmin || deleteUser.isPending}
                    onClick={() => setPendingDelete({ id: m.id, name: memberName })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}

            {teamMembers?.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No team members yet.</p>}
          </CardContent>
        </Card>
      )}

      {/* Invite User Dialog */}
      <InviteUserDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        isSuperAdmin={isSuperAdmin}
        myRank={myRank}
      />

      {/* View User Dialog */}
      <ViewUserDialog userId={viewUserId} onClose={() => setViewUserId(null)} />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete user</DialogTitle>
            <DialogDescription>
              {pendingDelete && (
                <>Permanently delete <strong>{pendingDelete.name}</strong>? This cannot be undone.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteUser.isPending}
              onClick={() => pendingDelete && deleteUser.mutate(pendingDelete.id)}
            >
              {deleteUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={!!pendingRole} onOpenChange={(o) => !o && setPendingRole(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm role change</DialogTitle>
            <DialogDescription>
              {pendingRole && (
                <>Change <strong>{pendingRole.name}</strong> from{" "}
                <span className="capitalize">{roleLabel(pendingRole.from)}</span> to{" "}
                <span className="capitalize">{roleLabel(pendingRole.to)}</span>? The change is
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
              <Select value={auditRole} onValueChange={setAuditRole}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any role</SelectItem>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">{roleLabel(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {auditRows.map((a) => {
              return (
                <div key={a.id} className="rounded border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {a.targetName}:{" "}
                        <span className="capitalize">{roleLabel(a.oldRole ?? "—")}</span> →{" "}
                        <span className="capitalize">{roleLabel(a.newRole ?? "—")}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        by {a.actorName} · {new Date(a.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">Role changed</Badge>
                  </div>

                </div>
              );
            })}

            {auditIsError && (
              <p className="text-sm text-destructive text-center py-6">
                Could not load history: {(auditError as Error)?.message}
              </p>
            )}

            {!auditIsError && auditRows.length === 0 && (
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
// INVITE USER DIALOG (POST /users/invite)
// ============================================================

function InviteUserDialog({
  open,
  onClose,
  isSuperAdmin,
  myRank,
}: {
  open: boolean;
  onClose: () => void;
  isSuperAdmin: boolean;
  myRank: number;
}) {
  const qc = useQueryClient();

  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("sales_executive");
  const [tenantId, setTenantId] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [result, setResult] = useState<InviteResponse | null>(null);

  const inviteOptions = ASSIGNABLE_ROLES.filter((r) => ROLE_RANK[r] <= myRank);

  const reset = () => {
    setInviteName("");
    setInviteEmail("");
    setInviteRole("sales_executive");
    setTenantId("");
    setSendEmail(true);
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const invite = useMutation({
    mutationFn: () =>
      apiFetch<InviteResponse>("/api/v1/users/invite", {
        method: "POST",
        body: JSON.stringify({
          full_name: inviteName.trim(),
          email: inviteEmail.trim(),
          role: API_ROLE[inviteRole],
          send_welcome_email: sendEmail,
          // SuperAdmin must specify the tenant; tenant admins use their own
          ...(isSuperAdmin ? { tenant_id: Number(tenantId) } : {}),
        }),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
      if (res.email_sent) {
        toast.success(`Invitation emailed to ${res.email}`);
        handleClose();
      } else {
        // Email not sent — show the temp password so the admin can share it.
        toast.warning("User created, but the welcome email was not sent");
        setResult(res);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit =
    inviteName.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(inviteEmail.trim()) &&
    (!isSuperAdmin || Number(tenantId) > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>User created</DialogTitle>
              <DialogDescription>
                {result.email_error
                  ? `The welcome email failed: ${result.email_error}.`
                  : "The welcome email was not sent."}{" "}
                Share this temporary password with {result.full_name || result.email} manually.
                It is shown only once.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2">
              <Input value={result.temp_password ?? ""} readOnly className="font-mono text-sm" />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(result.temp_password ?? "");
                  toast.success("Password copied");
                }}
              >
                Copy
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Invite user</DialogTitle>
              <DialogDescription>
                The user gets a temporary password and must change it on first login.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {inviteOptions.map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">{roleLabel(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isSuperAdmin && (
                <div className="space-y-1.5">
                  <Label>Tenant ID</Label>
                  <Input
                    type="number"
                    min={1}
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    placeholder="Required for SuperAdmin"
                  />
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={sendEmail} onCheckedChange={(c) => setSendEmail(c === true)} />
                <span className="text-sm">Send welcome email with login details</span>
              </label>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={() => invite.mutate()} disabled={!canSubmit || invite.isPending}>
                {invite.isPending
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <UserPlus className="mr-2 h-4 w-4" />}
                Send invite
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// VIEW USER DIALOG (GET /users/{user_id})
// ============================================================

function ViewUserDialog({ userId, onClose }: { userId: number | null; onClose: () => void }) {
  const { data: user, isLoading, isError, error } = useQuery({
    queryKey: ["users", userId],
    enabled: userId !== null,
    queryFn: () => apiFetch<TeamMember>(`/api/v1/users/${userId}`),
  });

  return (
    <Dialog open={userId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>User details</DialogTitle>
          <DialogDescription>Profile information for this team member.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive py-4">
            {(error as Error)?.message ?? "Could not load user."}
          </p>
        ) : user ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {(user.full_name || user.email || "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium">{user.full_name || "—"}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
            <Separator />
            <dl className="grid grid-cols-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">ID</dt>
              <dd className="col-span-2">{user.id}</dd>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="col-span-2">
                <Badge variant="secondary" className="capitalize text-xs">
                  {roleLabel(normalizeRole(user.role))}
                </Badge>
              </dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="col-span-2 capitalize">{user.status ?? "—"}</dd>
              {user.created_at && (
                <>
                  <dt className="text-muted-foreground">Joined</dt>
                  <dd className="col-span-2">{new Date(user.created_at).toLocaleDateString()}</dd>
                </>
              )}
            </dl>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// AUTO-FOLLOWUP SECTION (unchanged — already FastAPI)
// ============================================================

function AutoFollowupSection() {
  const { roles, isAdmin } = useAuth();
  const { data: settings, isLoading } = useAutoFollowupSettings();
  const updateMutation = useUpdateAutoFollowupSettings();

  const [enabled, setEnabled] = useState(false);
  const [sequenceId, setSequenceId] = useState<number | null>(null);
  const [assigneeId, setAssigneeId] = useState<number | null>(null);

  const { data: sequences } = useQuery({
    queryKey: ["followup-sequences"],
    queryFn: () => apiFetch<any[]>("/api/v1/followups/sequences"),
  });

  // Super admin -> all users (/superadmin/users); tenant admin -> own tenant (/users).
  const isSuperAdmin = roles.some((r) => normalizeRole(r as string) === "super_admin");

  const { data: users } = useQuery({
    queryKey: ["assignee-users", isSuperAdmin],
    enabled: isAdmin || isSuperAdmin,
    queryFn: async () => {
      const res = await apiFetch<any>(
        isSuperAdmin ? "/api/v1/superadmin/users" : "/api/v1/users?limit=200"
      );
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
                      {u.full_name || u.email}
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