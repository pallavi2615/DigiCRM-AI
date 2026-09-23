import { RoleGuard, ADMINS } from "@/components/role-guard";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Building2, Plus, ExternalLink, Copy, Loader2, ShieldAlert,
  Crown, Globe, Webhook, Palette,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { INDUSTRY_TEMPLATES } from "@/lib/industry-templates";

// ============================================================
// TYPES
// ============================================================

type Tenant = {
  id: number;
  name: string;
  subdomain: string | null;
  webhook_id: string | null;
  webhook_url: string | null;
  api_key: string | null;
  status: string;
  created_at: string;
  // Enriched fields (from /superadmin/clients)
  lead_count?: number;
  proposal_count?: number;
  user_count?: number;
};

// ============================================================
// WEBHOOK SECRET REVEAL
// ============================================================

function TenantWebhookSecretReveal({ secret }: { secret: string | null }) {
  if (!secret) {
    return (
      <div className="text-[11px] text-muted-foreground italic">
        Hidden — only Super Admin / Admin can view this secret.
      </div>
    );
  }
  return (
    <div className="flex gap-2 items-center">
      <code className="text-[11px] bg-background rounded p-2 flex-1 truncate">
        {secret}
      </code>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          navigator.clipboard.writeText(secret);
          toast.success("Copied");
        }}
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ============================================================
// ROUTE
// ============================================================

export const Route = createFileRoute("/_authenticated/settings-tenants")({
  head: () => ({
    meta: [
      { title: "Tenants — DigiCRM AI" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RoleGuard allow={ADMINS} module="settings-tenants" label="Settings Tenants">
      <SettingsTenants />
    </RoleGuard>
  ),
});

// ============================================================
// MAIN COMPONENT
// ============================================================

function SettingsTenants() {
  const { roles, isAdmin } = useAuth();
  const canManage = isAdmin || roles.includes("super_admin");
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);

  // ⭐ Fetch all tenants from FastAPI SuperAdmin endpoint
  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["superadmin", "clients"],
    queryFn: async () => {
      const res = await apiFetch<Tenant[] | { items: Tenant[] }>(
        "/api/v1/superadmin/clients"
      );
      return Array.isArray(res) ? res : res.items ?? [];
    },
  });

  if (!canManage) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <ShieldAlert className="h-10 w-10 text-destructive mx-auto mb-3" />
          <h2 className="font-semibold">Admin access required</h2>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Building2 className="h-6 w-6" /> Tenants & White-Labeling
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Multi-tenant workspaces, plans and branded portals.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Tenant
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-5 w-5 animate-spin inline" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>Proposals</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-medium">{t.name}</div>
                      {t.subdomain && (
                        <div className="text-xs text-muted-foreground">
                          /{t.subdomain}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={t.status === "active" ? "default" : "outline"}
                      >
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.lead_count ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.proposal_count ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.user_count ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(t)}
                      >
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {tenants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      <p className="text-sm text-muted-foreground">
                        No tenants found.
                      </p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {creating && (
        <TenantForm
          onClose={() => setCreating(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["superadmin", "clients"] })}
        />
      )}
      {editing && (
        <TenantForm
          tenant={editing}
          onClose={() => setEditing(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["superadmin", "clients"] })}
        />
      )}
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================

function slugify(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

// ============================================================
// TENANT FORM
// ============================================================

function TenantForm({
  tenant,
  onClose,
  onSaved,
}: {
  tenant?: Tenant;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!tenant;
  const [form, setForm] = useState<Partial<Tenant>>({
    name: tenant?.name ?? "",
    subdomain: tenant?.subdomain ?? "",
    status: tenant?.status ?? "active",
  });

  const save = useMutation({
    mutationFn: async () => {
      // ⚠️ NOTE: FastAPI doesn't have a POST /superadmin/clients endpoint yet.
      // If you need tenant creation, add it on the backend first.
      if (isEdit && tenant) {
        // For now, only the status can be updated via existing endpoints.
        // Replace with a proper PUT /api/v1/superadmin/clients/{id} when ready.
        toast.error("Tenant update endpoint not yet implemented on the backend.");
        return;
      } else {
        toast.error("Tenant creation via API not yet implemented.");
        return;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Tenant updated" : "Tenant created");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Manage ${tenant?.name}` : "New Tenant"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                    subdomain: isEdit
                      ? form.subdomain
                      : slugify(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label>Subdomain</Label>
              <Input
                value={form.subdomain ?? ""}
                onChange={(e) =>
                  setForm({ ...form, subdomain: slugify(e.target.value) })
                }
              />
            </div>
          </div>

          <div>
            <Label>Status</Label>
            <Select
              value={form.status ?? "active"}
              onValueChange={(v) => setForm({ ...form, status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isEdit && tenant && (
            <>
              <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
                <div className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
                  <Webhook className="h-3 w-3" /> Inbound Lead Webhook
                </div>
                <div className="text-xs">POST leads to:</div>
                <code className="block text-[11px] bg-background rounded p-2 break-all">
                  {tenant.webhook_url || "Not available"}
                </code>
                <div className="text-xs">
                  API key (admin-only):
                </div>
                <TenantWebhookSecretReveal secret={tenant.api_key} />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.name}
          >
            {save.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}