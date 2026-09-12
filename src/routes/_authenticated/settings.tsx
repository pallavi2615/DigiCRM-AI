// import { createFileRoute } from "@tanstack/react-router";
// import { useServerFn } from "@tanstack/react-start";
// import { changeUserRole } from "@/lib/rbac.functions";
// import { diffRolePermissions } from "@/lib/permissions";
// import { useAuth } from "@/hooks/use-auth";
// import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// import { supabase } from "@/integrations/supabase/client";
// import { useMemo, useState } from "react";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Avatar, AvatarFallback } from "@/components/ui/avatar";
// import { Badge } from "@/components/ui/badge";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Separator } from "@/components/ui/separator";
// import {
//   Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
// } from "@/components/ui/dialog";
// import {
//   Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
// } from "@/components/ui/select";
// import { Download, Layers, Loader2, Save, Search } from "lucide-react";
// import { toast } from "sonner";
// import { downloadCsv, objectsToCsv } from "@/lib/csv";
// import { notifyPermissionDenied } from "@/components/permission-denied";
// import { Checkbox } from "@/components/ui/checkbox";
// import { ACCESS_GROUPS, fetchUserIndustries, setUserIndustries } from "@/lib/industry-access";


// export const Route = createFileRoute("/_authenticated/settings")({
//   head: () => ({ meta: [{ title: "Settings — DigiCRM AI" }] }),
//   component: SettingsPage,
// });

// type Role = "super_admin" | "admin" | "sales_manager" | "sales_executive";

// /** Mirrors the server-side hierarchy: nobody may grant a role above their own. */
// const ROLE_RANK: Record<Role, number> = {
//   super_admin: 4, admin: 3, sales_manager: 2, sales_executive: 1,
// };

// function SettingsPage() {
//   const { user, roles, isAdmin } = useAuth();
//   const qc = useQueryClient();
//   const [fullName, setFullName] = useState(user?.user_metadata?.full_name ?? "");
//   const [phone, setPhone] = useState(user?.user_metadata?.phone ?? "");

//   const name = user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "User";
//   const initials = name.split(/\s+/).slice(0, 2).map((s: string) => s[0]?.toUpperCase()).join("");

//   const saveProfile = useMutation({
//     mutationFn: async () => {
//       const { error } = await supabase.from("profiles").update({ full_name: fullName, phone }).eq("id", user!.id);
//       if (error) throw error;
//       await supabase.auth.updateUser({ data: { full_name: fullName, phone } });
//     },
//     onSuccess: () => toast.success("Profile updated"),
//     onError: (e: Error) => toast.error(e.message),
//   });

//   const { data: teamMembers } = useQuery({
//     queryKey: ["team-members"],
//     enabled: isAdmin,
//     queryFn: async () => {
//       const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, avatar_url").order("full_name");
//       const { data: userRoles } = await supabase.from("user_roles").select("user_id, role");
//       return (profiles ?? []).map(p => ({
//         ...p,
//         roles: (userRoles ?? []).filter(r => r.user_id === p.id).map(r => r.role as Role),
//       }));
//     },
//   });

//   const changeRole = useServerFn(changeUserRole);

//   const updateRole = useMutation({
//     mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
//       await changeRole({ data: { userId, role } });
//     },
//     onSuccess: () => {
//       toast.success("Role updated");
//       qc.invalidateQueries({ queryKey: ["team-members"] });
//       qc.invalidateQueries({ queryKey: ["role-audit"] });
//     },
//     onError: (e: Error) => notifyPermissionDenied(e),
//   });

//   const { data: roleAudit } = useQuery({
//     queryKey: ["role-audit"],
//     enabled: isAdmin,
//     queryFn: async () => {
//       const { data, error } = await supabase
//         .from("activities")
//         .select("id, action, description, metadata, created_at")
//         .eq("entity_type", "user_roles")
//         .order("created_at", { ascending: false })
//         .limit(200);
//       if (error) throw error;
//       return data ?? [];
//     },
//   });

//   // ---- Secure role change confirmation ----------------------------------
//   const [pendingRole, setPendingRole] = useState<
//     { userId: string; name: string; from: Role; to: Role } | null
//   >(null);
//   const [industryFor, setIndustryFor] = useState<{ id: string; name: string } | null>(null);

//   const myRank = Math.max(0, ...roles.map((r) => ROLE_RANK[r as Role] ?? 0));
//   const pendingDelta = pendingRole ? diffRolePermissions(pendingRole.from, pendingRole.to) : [];

//   // ---- Audit log filters -------------------------------------------------
//   const [auditSearch, setAuditSearch] = useState("");
//   const [auditAction, setAuditAction] = useState<string>("all");
//   const [auditRole, setAuditRole] = useState<string>("all");

//   const auditRows = useMemo(() => {
//     const term = auditSearch.trim().toLowerCase();
//     return (roleAudit ?? [])
//       .map((a) => {
//         const meta = (a.metadata ?? {}) as Record<string, string | null>;
//         return {
//           ...a,
//           meta,
//           delta: diffRolePermissions(
//             (meta['old_role'] as Role) ?? null,
//             (meta['new_role'] as Role) ?? null,
//           ),
//         };
//       })
//       .filter((a) => {
//         if (auditAction !== "all" && a.action !== auditAction) return false;
//         if (auditRole !== "all" && a.meta['old_role'] !== auditRole && a.meta['new_role'] !== auditRole) return false;
//         if (!term) return true;
//         return [a.description, a.meta['actor_email'], a.meta['target_email'], a.meta['old_role'], a.meta['new_role']]
//           .some((v) => (v ?? "").toLowerCase().includes(term));
//       });
//   }, [roleAudit, auditSearch, auditAction, auditRole]);

//   const exportAudit = () => {
//     const rows = auditRows.map((a) => ({
//       changed_at: new Date(a.created_at).toISOString(),
//       action: a.action,
//       actor: a.meta['actor_email'] ?? "system",
//       target: a.meta['target_email'] ?? a.meta['target_user_id'] ?? "",
//       old_role: a.meta['old_role'] ?? "",
//       new_role: a.meta['new_role'] ?? "",
//       description: a.description ?? "",
//       permissions_added: a.delta
//         .filter((d) => d.gained.length)
//         .map((d) => `${d.module}: +${d.gained.join("/")}`)
//         .join(" | "),
//       permissions_removed: a.delta
//         .filter((d) => d.lost.length)
//         .map((d) => `${d.module}: -${d.lost.join("/")}`)
//         .join(" | "),
//     }));
//     downloadCsv(
//       `digicrm-role-audit-${new Date().toISOString().slice(0, 10)}.csv`,
//       objectsToCsv(rows, [
//         "changed_at", "action", "actor", "target", "old_role", "new_role",
//         "description", "permissions_added", "permissions_removed",
//       ]),
//     );
//   };




//   return (
//     <div className="space-y-6 max-w-4xl">
//       <div>
//         <h1 className="text-3xl font-bold">Settings</h1>
//         <p className="text-muted-foreground text-sm mt-1">Manage your profile and workspace preferences.</p>
//       </div>

//       <Card className="shadow-card">
//         <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
//         <CardContent className="space-y-4">
//           <div className="flex items-center gap-4">
//             <Avatar className="h-16 w-16">
//               <AvatarFallback className="text-lg gradient-primary text-primary-foreground">{initials}</AvatarFallback>
//             </Avatar>
//             <div>
//               <p className="font-medium text-lg">{name}</p>
//               <p className="text-sm text-muted-foreground">{user?.email}</p>
//               <div className="flex gap-1 mt-2">
//                 {roles.map(r => <Badge key={r} variant="secondary" className="capitalize text-xs">{r.replace("_"," ")}</Badge>)}
//               </div>
//             </div>
//           </div>
//           <Separator />
//           <div className="grid grid-cols-2 gap-4">
//             <div className="space-y-1.5"><Label>Full Name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
//             <div className="space-y-1.5"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
//           </div>
//           <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
//             {saveProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
//             Save changes
//           </Button>
//         </CardContent>
//       </Card>

//       {isAdmin && (
//         <Card className="shadow-card">
//           <CardHeader><CardTitle className="text-base">Team Members</CardTitle></CardHeader>
//           <CardContent className="space-y-2">
//             {(teamMembers ?? []).map(m => (
//               <div key={m.id} className="flex items-center gap-3 p-3 rounded border flex-wrap">
//                 <Avatar className="h-9 w-9"><AvatarFallback className="text-xs bg-primary/10 text-primary">{(m.full_name || m.email || "?").slice(0,2).toUpperCase()}</AvatarFallback></Avatar>
//                 <div className="flex-1 min-w-0">
//                   <p className="font-medium text-sm">{m.full_name || "—"}</p>
//                   <p className="text-xs text-muted-foreground truncate">{m.email}</p>
//                 </div>
//                 <Button size="sm" variant="outline" onClick={() => setIndustryFor({ id: m.id, name: m.full_name || m.email || "this user" })}>
//                   <Layers className="mr-2 h-4 w-4" /> Industries
//                 </Button>
//                 <Select
//                   value={m.roles[0] ?? "sales_executive"}
//                   onValueChange={(v) => setPendingRole({
//                     userId: m.id,
//                     name: m.full_name || m.email || "this user",
//                     from: (m.roles[0] ?? "sales_executive") as Role,
//                     to: v as Role,
//                   })}
//                   disabled={m.id === user?.id || updateRole.isPending}
//                 >
//                   <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
//                   <SelectContent>
//                     {(["super_admin","admin","sales_manager","sales_executive"] as Role[])
//                       .filter((r) => ROLE_RANK[r] <= myRank)
//                       .map(r => (
//                         <SelectItem key={r} value={r} className="capitalize">{r.replace("_"," ")}</SelectItem>
//                       ))}
//                   </SelectContent>
//                 </Select>
//               </div>
//             ))}

//             {teamMembers?.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No team members yet.</p>}
//           </CardContent>
//         </Card>
//       )}

//       <Dialog open={!!pendingRole} onOpenChange={(o) => !o && setPendingRole(null)}>
//         <DialogContent className="max-w-md">
//           <DialogHeader>
//             <DialogTitle>Confirm role change</DialogTitle>
//             <DialogDescription>
//               {pendingRole && (
//                 <>Change <strong>{pendingRole.name}</strong> from{" "}
//                 <span className="capitalize">{pendingRole.from.replace("_", " ")}</span> to{" "}
//                 <span className="capitalize">{pendingRole.to.replace("_", " ")}</span>? The change is
//                 verified again on the server and recorded in the audit log.</>
//               )}
//             </DialogDescription>
//           </DialogHeader>
//           {pendingDelta.length > 0 && (
//             <div className="space-y-1.5 max-h-56 overflow-y-auto">
//               {pendingDelta.map((d) => (
//                 <div key={d.module} className="text-xs flex flex-wrap gap-1 items-center">
//                   <span className="font-medium">{d.module}</span>
//                   {d.gained.length > 0 && (
//                     <span className="rounded bg-success/15 text-success px-1.5 py-0.5">+ {d.gained.join(", ")}</span>
//                   )}
//                   {d.lost.length > 0 && (
//                     <span className="rounded bg-destructive/15 text-destructive px-1.5 py-0.5">− {d.lost.join(", ")}</span>
//                   )}
//                 </div>
//               ))}
//             </div>
//           )}
//           <DialogFooter>
//             <Button variant="outline" onClick={() => setPendingRole(null)}>Cancel</Button>
//             <Button
//               disabled={updateRole.isPending}
//               onClick={() => {
//                 if (!pendingRole) return;
//                 updateRole.mutate({ userId: pendingRole.userId, role: pendingRole.to });
//                 setPendingRole(null);
//               }}
//             >
//               {updateRole.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
//               Confirm change
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>

//       <IndustryAccessDialog member={industryFor} onClose={() => setIndustryFor(null)} />

//       {isAdmin && (
//         <Card className="shadow-card">
//           <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
//             <CardTitle className="text-base">Role change history</CardTitle>
//             <Button size="sm" variant="outline" onClick={exportAudit} disabled={auditRows.length === 0}>
//               <Download className="mr-2 h-4 w-4" /> Export CSV
//             </Button>
//           </CardHeader>
//           <CardContent className="space-y-3">
//             <div className="flex flex-wrap gap-2">
//               <div className="relative flex-1 min-w-52">
//                 <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
//                 <Input
//                   className="pl-8"
//                   placeholder="Search by user, actor or role…"
//                   value={auditSearch}
//                   onChange={(e) => setAuditSearch(e.target.value)}
//                 />
//               </div>
//               <Select value={auditAction} onValueChange={setAuditAction}>
//                 <SelectTrigger className="w-44"><SelectValue placeholder="Event" /></SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="all">All events</SelectItem>
//                   <SelectItem value="role_granted">Role granted</SelectItem>
//                   <SelectItem value="role_changed">Role changed</SelectItem>
//                   <SelectItem value="role_revoked">Role revoked</SelectItem>
//                 </SelectContent>
//               </Select>
//               <Select value={auditRole} onValueChange={setAuditRole}>
//                 <SelectTrigger className="w-44"><SelectValue placeholder="Role" /></SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="all">Any role</SelectItem>
//                   {(["super_admin","admin","sales_manager","sales_executive"] as Role[]).map(r => (
//                     <SelectItem key={r} value={r} className="capitalize">{r.replace("_"," ")}</SelectItem>
//                   ))}
//                 </SelectContent>
//               </Select>
//             </div>

//             {auditRows.map((a) => {
//               const added = a.delta.filter((d) => d.gained.length);
//               const removed = a.delta.filter((d) => d.lost.length);
//               return (
//                 <div key={a.id} className="rounded border p-3">
//                   <div className="flex items-start justify-between gap-3">
//                     <div className="min-w-0">
//                       <p className="text-sm font-medium">{a.description}</p>
//                       <p className="text-xs text-muted-foreground mt-0.5">
//                         by {a.meta['actor_email'] ?? "system"} · {new Date(a.created_at).toLocaleString()}
//                       </p>
//                     </div>
//                     <Badge variant="secondary" className="text-[10px] capitalize shrink-0">
//                       {a.action.replace(/_/g, " ")}
//                     </Badge>
//                   </div>

//                   {a.delta.length > 0 && (
//                     <div className="mt-2 space-y-1.5">
//                       <p className="text-xs text-muted-foreground">
//                         Impact: {added.length} module{added.length === 1 ? "" : "s"} gained access,{" "}
//                         {removed.length} module{removed.length === 1 ? "" : "s"} lost access.
//                       </p>
//                       <div className="flex flex-wrap gap-1">
//                         {added.map((d) => (
//                           <span key={`+${d.module}`} className="rounded bg-success/15 text-success px-1.5 py-0.5 text-[10px]">
//                             + {d.module}: {d.gained.join(", ")}
//                           </span>
//                         ))}
//                         {removed.map((d) => (
//                           <span key={`-${d.module}`} className="rounded bg-destructive/15 text-destructive px-1.5 py-0.5 text-[10px]">
//                             − {d.module}: {d.lost.join(", ")}
//                           </span>
//                         ))}
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               );
//             })}

//             {auditRows.length === 0 && (
//               <p className="text-sm text-muted-foreground text-center py-6">
//                 {(roleAudit ?? []).length === 0
//                   ? "No role changes recorded yet."
//                   : "No events match these filters."}
//               </p>
//             )}
//           </CardContent>
//         </Card>
//       )}
//     </div>
//   );
// }


// /** Lets an administrator choose which industry CRMs a team member can open. */
// function IndustryAccessDialog({ member, onClose }: { member: { id: string; name: string } | null; onClose: () => void }) {
//   const qc = useQueryClient();
//   const [selected, setSelected] = useState<string[] | null>(null);

//   const { data: current, isLoading } = useQuery({
//     queryKey: ["industry-access", member?.id],
//     enabled: !!member?.id,
//     queryFn: () => fetchUserIndustries(member!.id),
//   });

//   const value = selected ?? current ?? [];

//   const save = useMutation({
//     mutationFn: () => setUserIndustries(member!.id, value),
//     onSuccess: () => {
//       toast.success("Industry access updated");
//       qc.invalidateQueries({ queryKey: ["industry-access"] });
//       setSelected(null);
//       onClose();
//     },
//     onError: (e: Error) => notifyPermissionDenied(e),
//   });

//   const toggle = (slug: string) =>
//     setSelected(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug]);

//   return (
//     <Dialog open={!!member} onOpenChange={(o) => { if (!o) { setSelected(null); onClose(); } }}>
//       <DialogContent className="max-w-md">
//         <DialogHeader>
//           <DialogTitle>Industry access</DialogTitle>
//           <DialogDescription>
//             Choose which industry CRMs {member?.name} can open. Leave everything unticked to give access to all
//             industries. Administrators always see every industry.
//           </DialogDescription>
//         </DialogHeader>
//         {isLoading ? (
//           <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
//         ) : (
//           <div className="space-y-2 max-h-72 overflow-y-auto">
//             {ACCESS_GROUPS.map((g) => (
//               <label key={g.slug} className="flex items-center gap-3 rounded border p-2.5 cursor-pointer">
//                 <Checkbox checked={value.includes(g.slug)} onCheckedChange={() => toggle(g.slug)} />
//                 <span className="text-sm">{g.name}</span>
//               </label>
//             ))}
//           </div>
//         )}
//         <DialogFooter>
//           <Button variant="outline" onClick={() => { setSelected(null); onClose(); }}>Cancel</Button>
//           <Button onClick={() => save.mutate()} disabled={save.isPending || isLoading}>
//             {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
//             Save access
//           </Button>
//         </DialogFooter>
//       </DialogContent>
//     </Dialog>
//   );
// }


import { createFileRoute } from "@tanstack/react-router";
import { useUser } from "@/hooks/use-user";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — DigiCRM AI" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useUser();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setPhone((user as any).phone || "");
    }
  }, [user]);

  const name = user?.full_name || user?.email?.split("@")[0] || "User";
  const initials = name
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s: string) => s[0]?.toUpperCase())
    .join("");
  const roleLabel = user?.role?.replace(/_/g, " ") ?? "user";

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("access_token");
      await fetch("http://127.0.0.1:8000/api/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ full_name: fullName, phone }),
      });

      const updatedUser = { ...user, full_name: fullName, phone };
      localStorage.setItem("user", JSON.stringify(updatedUser));

      toast.success("Profile updated");
      window.location.reload();
    } catch (e) {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your profile and workspace preferences.
        </p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg gradient-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-lg">{name}</p>
              {/* <p className="text-sm text-muted-foreground">{user?.email}</p> */}
              <Badge variant="secondary" className="capitalize text-xs mt-2">
                {roleLabel}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user?.email || ""} disabled className="bg-muted" />
          </div>

          <Button onClick={handleSaveProfile} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save changes
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}