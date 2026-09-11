import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Users, Layers, ShieldCheck, FileText, Settings2, Loader2, Building2, BookOpen,
} from "lucide-react";

import { RoleGuard } from "@/components/role-guard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { changeUserRole } from "@/lib/rbac.functions";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { INDUSTRY_GROUPS } from "@/lib/industry-taxonomy";

export const Route = createFileRoute("/_authenticated/admin")({
  component: () => (
    <RoleGuard allow={["super_admin", "admin"]} module="settings" label="Super Admin">
      <AdminHub />
    </RoleGuard>
  ),
});

const ROLES: AppRole[] = ["super_admin", "admin", "sales_manager", "sales_executive"];
const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin", admin: "Admin", sales_manager: "Sales Manager", sales_executive: "Sales Executive",
};

const CORE_MODULES = [
  "leads", "contacts", "companies", "pipeline", "proposals", "tasks", "calendar",
  "meetings", "tickets", "affiliates", "ai", "digiverify", "cms", "reports", "audit",
];

function AdminHub() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Super Admin</h1>
        <p className="text-sm text-muted-foreground">
          Users and roles, industry packs, modules and every governance surface in one place.
        </p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users &amp; roles</TabsTrigger>
          <TabsTrigger value="modules">Industries &amp; modules</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><Overview /></TabsContent>
        <TabsContent value="users"><UsersAdmin /></TabsContent>
        <TabsContent value="modules"><ModulesAdmin /></TabsContent>
      </Tabs>
    </div>
  );
}

const HUB_LINKS = [
  { to: "/settings-cms", title: "Content & SEO", desc: "Pages, blog, menus, hero slides, campaigns and global SEO.", icon: BookOpen },
  { to: "/settings", title: "Workspace settings", desc: "Profile, branding, plans, audit log and role history.", icon: Settings2 },
  { to: "/admin-packs", title: "Industry pack CMS", desc: "Edit stages, custom fields and AI agent prompts for every pack.", icon: Layers },
  { to: "/portal", title: "DigiPortal", desc: "Client, dealer and agent view of deals, documents and payments.", icon: Building2 },
  { to: "/affiliates", title: "Affiliate programme", desc: "Approve partners, set commission tiers and track payouts.", icon: Settings2 },
  { to: "/packs", title: "Industry packs", desc: "Registry-driven workspaces for every industry pack.", icon: Layers },
  { to: "/digiverify", title: "DigiVerify", desc: "PAN, Aadhaar, GST, bank and bureau verification.", icon: ShieldCheck },
  { to: "/settings-tenants", title: "Tenants", desc: "White-label tenants, branding and webhook secrets.", icon: Building2 },
  { to: "/reports", title: "Reports", desc: "Pipeline, revenue and activity analytics.", icon: FileText },
] as const;

function Overview() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {HUB_LINKS.map((l) => (
        <Card key={l.to} className="p-5 hover:border-primary/50 transition-colors">
          <Link to={l.to}>
            <l.icon className="h-5 w-5 text-primary" />
            <h3 className="font-semibold mt-3">{l.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{l.desc}</p>
          </Link>
        </Card>
      ))}
    </div>
  );
}

type Person = { id: string; email: string; full_name: string | null; created_at: string; role: string };

function UsersAdmin() {
  const qc = useQueryClient();
  const { user, hasRole } = useAuth();
  const canChange = hasRole("super_admin");
  const doChange = useServerFn(changeUserRole);
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<{ person: Person; role: AppRole } | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: people = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name, created_at").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (error) throw error;
      const map = new Map((roles ?? []).map((r) => [r.user_id, r.role as string]));
      return (profiles ?? []).map((p) => ({ ...p, role: map.get(p.id) ?? "sales_executive" })) as Person[];
    },
  });

  const filtered = people.filter(
    (p) => !q || p.email.toLowerCase().includes(q.toLowerCase()) || (p.full_name ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  async function confirmChange() {
    if (!pending) return;
    setSaving(true);
    try {
      await doChange({ data: { userId: pending.person.id, role: pending.role } });
      toast.success(`${pending.person.email} is now ${ROLE_LABEL[pending.role]}`);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setPending(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change the role");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Users className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <h2 className="text-lg font-semibold">All users</h2>
          <p className="text-xs text-muted-foreground">
            {canChange ? "Role changes are written to the audit log." : "Only a Super Admin can change roles."}
          </p>
        </div>
        <Input className="max-w-xs" placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : (
        <div className="divide-y border rounded-lg">
          {filtered.map((p) => (
            <div key={p.id} className="p-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <p className="font-medium">{p.full_name || p.email}</p>
                <p className="text-xs text-muted-foreground">{p.email}</p>
              </div>
              <Badge variant="secondary">{ROLE_LABEL[p.role] ?? p.role}</Badge>
              {p.id === user?.id && <Badge variant="outline">You</Badge>}
              <Select
                value={p.role}
                disabled={!canChange || p.id === user?.id}
                onValueChange={(v) => setPending({ person: p, role: v as AppRole })}
              >
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
          {filtered.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">No users match that search.</p>}
        </div>
      )}

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change role?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending && (
                <>
                  {pending.person.email} moves from <strong>{ROLE_LABEL[pending.person.role]}</strong> to{" "}
                  <strong>{ROLE_LABEL[pending.role]}</strong>. This takes effect immediately and is recorded in the audit log.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={(e) => { e.preventDefault(); void confirmChange(); }}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

type ModuleRow = { id?: string; module_key: string; kind: string; label: string | null; enabled: boolean };

function ModulesAdmin() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const canEdit = hasRole("super_admin");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["module-settings"],
    queryFn: async () => {
      const { data, error } = await (supabase as never as { from: typeof supabase.from }).from("module_settings" as never).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as ModuleRow[];
    },
  });

  const state = new Map(rows.map((r) => [r.module_key, r]));

  async function toggle(key: string, kind: string, label: string, enabled: boolean) {
    const existing = state.get(key);
    const payload = { module_key: key, kind, label, enabled, tenant_id: null };
    const client = supabase as never as { from: (t: string) => any };
    const { error } = existing?.id
      ? await client.from("module_settings").update({ enabled }).eq("id", existing.id)
      : await client.from("module_settings").insert(payload);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["module-settings"] });
  }

  function Row({ k, kind, label, hint }: { k: string; kind: string; label: string; hint?: string }) {
    const enabled = state.get(k)?.enabled ?? true;
    return (
      <div className="flex items-center gap-3 py-2 border-b last:border-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{label}</p>
          {hint && <p className="text-xs text-muted-foreground truncate">{hint}</p>}
        </div>
        <Switch checked={enabled} disabled={!canEdit} onCheckedChange={(v) => toggle(k, kind, label, v)} />
      </div>
    );
  }

  if (isLoading) return <Card className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></Card>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-1">Core modules</h2>
        <p className="text-xs text-muted-foreground mb-3">
          {canEdit ? "Turn platform modules on or off for this workspace." : "Read-only — Super Admin access required."}
        </p>
        {CORE_MODULES.map((m) => <Row key={m} k={`module:${m}`} kind="module" label={m.charAt(0).toUpperCase() + m.slice(1)} />)}
      </Card>

      <Card className="p-6 max-h-[70vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-1">Industry packs</h2>
        <p className="text-xs text-muted-foreground mb-3">8 groups, {INDUSTRY_GROUPS.reduce((n, g) => n + g.children.length, 0)} packs.</p>
        {INDUSTRY_GROUPS.map((g) => (
          <div key={g.slug} className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">{g.name}</h3>
            </div>
            <Row k={`group:${g.slug}`} kind="industry_group" label={`All of ${g.name}`} />
            {g.children.map((c) => (
              <Row key={c.slug} k={`pack:${g.slug}/${c.slug}`} kind="industry_pack" label={c.name} hint={`${g.slug}/${c.slug}`} />
            ))}
          </div>
        ))}
      </Card>
    </div>
  );
}
