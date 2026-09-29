import { RoleGuard, ADMINS } from "@/components/role-guard";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Building2, Plus, Copy, Loader2, ShieldAlert, Mail, Search,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

// ============================================================
// TYPES (match app/schemas/tenant.py)
// ============================================================

type TenantListItem = {
  id: number;
  name: string;
  subdomain: string | null;
  status: string;
  created_at?: string;
  // Optional — shown only if your TenantListItem schema returns them
  lead_count?: number;
  proposal_count?: number;
  user_count?: number;
};

type IndustryTemplates = Record<string, { label: string; industries: string[] }>;

type CreatePayload = {
  name: string;
  slug: string;
  admin_email: string;
  admin_full_name: string;
  plan: string;
  industry_template: string;
  tagline?: string;
  primary_color?: string;
  accent_color?: string;
  logo_url?: string;
  custom_domain?: string;
};

type CreateResponse = {
  tenant_id: number;
  tenant_name: string;
  tenant_slug: string;
  admin_user_id: number;
  admin_email: string;
  admin_full_name: string;
  temp_password: string;
  email_sent: boolean;
  email_error: string | null;
  industries_assigned: string[];
};

type ResendResponse = {
  success: boolean;
  email_sent: boolean;
  email_error: string | null;
  temp_password: string;
  admin_email: string;
};

// ============================================================
// API HELPERS
// ============================================================

const TENANT_LIST_KEY = ["tenant", "all"];

const api = {
  list: (search: string, status: string) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status && status !== "all") params.set("status", status);
    params.set("limit", "500");
    return apiFetch<TenantListItem[]>(`/api/v1/tenant/all?${params.toString()}`);
  },
  templates: () => apiFetch<IndustryTemplates>("/api/v1/tenant/templates"),
  create: (payload: CreatePayload) =>
    apiFetch<CreateResponse>("/api/v1/tenant/with-admin", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  resendWelcome: (id: number) =>
    apiFetch<ResendResponse>(`/api/v1/tenant/${id}/resend-welcome`, {
      method: "POST",
    }),
};

// ============================================================
// SMALL COMPONENTS
// ============================================================

function CopyField({ value }: { value: string }) {
  return (
    <div className="flex gap-2 items-center">
      <code className="text-[11px] bg-background rounded p-2 flex-1 truncate border">
        {value}
      </code>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          navigator.clipboard.writeText(value);
          toast.success("Copied");
        }}
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}

function slugify(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
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
  const { roles } = useAuth();
  // All tenant-management endpoints are SuperAdmin-only on the backend
  const isSuperAdmin = roles.includes("super_admin");
  const qc = useQueryClient();

  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState<TenantListItem | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: [...TENANT_LIST_KEY, search, status],
    queryFn: () => api.list(search, status),
    enabled: isSuperAdmin,
  });

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <ShieldAlert className="h-10 w-10 text-destructive mx-auto mb-3" />
          <h2 className="font-semibold">Super Admin access required</h2>
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
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Tenant
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name or subdomain…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
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
                      <Badge variant={t.status === "active" ? "default" : "outline"}>
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{t.lead_count ?? "—"}</TableCell>
                    <TableCell className="text-sm">{t.proposal_count ?? "—"}</TableCell>
                    <TableCell className="text-sm">{t.user_count ?? "—"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setManaging(t)}>
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {tenants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      <p className="text-sm text-muted-foreground">No tenants found.</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {creating && (
        <CreateTenantDialog
          onClose={() => setCreating(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: TENANT_LIST_KEY })}
        />
      )}
      {managing && (
        <ManageTenantDialog tenant={managing} onClose={() => setManaging(null)} />
      )}
    </div>
  );
}

// ============================================================
// CREATE TENANT DIALOG  →  POST /tenant/with-admin
// ============================================================

function CreateTenantDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CreatePayload>({
    name: "",
    slug: "",
    admin_email: "",
    admin_full_name: "",
    plan: "starter",
    industry_template: "",
    tagline: "",
    primary_color: "#2563eb",
    accent_color: "#f59e0b",
    logo_url: "",
    custom_domain: "",
  });
  const [result, setResult] = useState<CreateResponse | null>(null);

  const { data: templates } = useQuery({
    queryKey: ["tenant", "templates"],
    queryFn: api.templates,
  });

  const set = <K extends keyof CreatePayload>(k: K, v: CreatePayload[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: () => {
      // Strip empty optional strings so backend gets null/undefined
      const payload: Record<string, unknown> = {};
      Object.entries(form).forEach(([k, v]) => {
        if (v !== "") payload[k] = v;
      });
      return api.create(payload as CreatePayload);
    },
    onSuccess: (res) => {
      toast.success("Tenant created");
      setResult(res);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid =
    form.name && form.slug && form.admin_email && form.admin_full_name && form.industry_template;

  // ---- Success screen ----
  if (result) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tenant created: {result.tenant_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <Label className="text-xs">Admin</Label>
              <div>
                {result.admin_full_name} ({result.admin_email})
              </div>
            </div>
            <div>
              <Label className="text-xs">Temporary password (shown once)</Label>
              <CopyField value={result.temp_password} />
            </div>
            <div className="text-xs">
              Industries: {result.industries_assigned.join(", ") || "—"}
            </div>
            {result.email_sent ? (
              <Badge>Welcome email sent</Badge>
            ) : (
              <div className="text-xs text-destructive">
                Email not sent{result.email_error ? `: ${result.email_error}` : ""}. Share the
                password manually.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={onClose}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ---- Form ----
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Tenant</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Company name *</Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  set("name", e.target.value);
                  set("slug", slugify(e.target.value));
                }}
              />
            </div>
            <div>
              <Label>Slug / Subdomain *</Label>
              <Input value={form.slug} onChange={(e) => set("slug", slugify(e.target.value))} />
            </div>
            <div>
              <Label>Admin full name *</Label>
              <Input
                value={form.admin_full_name}
                onChange={(e) => set("admin_full_name", e.target.value)}
              />
            </div>
            <div>
              <Label>Admin email *</Label>
              <Input
                type="email"
                value={form.admin_email}
                onChange={(e) => set("admin_email", e.target.value)}
              />
            </div>
            <div>
              <Label>Industry template *</Label>
              <Select value={form.industry_template} onValueChange={(v) => set("industry_template", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(templates ?? {}).map(([key, t]) => (
                    <SelectItem key={key} value={key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plan</Label>
              <Select value={form.plan} onValueChange={(v) => set("plan", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Adjust to the plan values your backend accepts */}
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Branding (optional)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Tagline</Label>
                <Input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
              </div>
              <div>
                <Label>Primary color</Label>
                <Input
                  type="color"
                  value={form.primary_color}
                  onChange={(e) => set("primary_color", e.target.value)}
                />
              </div>
              <div>
                <Label>Accent color</Label>
                <Input
                  type="color"
                  value={form.accent_color}
                  onChange={(e) => set("accent_color", e.target.value)}
                />
              </div>
              <div>
                <Label>Logo URL</Label>
                <Input value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} />
              </div>
              <div>
                <Label>Custom domain</Label>
                <Input
                  placeholder="crm.example.com"
                  value={form.custom_domain}
                  onChange={(e) => set("custom_domain", e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !valid}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Tenant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// MANAGE TENANT DIALOG  →  POST /tenant/{id}/resend-welcome
// ============================================================

function ManageTenantDialog({
  tenant,
  onClose,
}: {
  tenant: TenantListItem;
  onClose: () => void;
}) {
  const [resent, setResent] = useState<ResendResponse | null>(null);

  const resend = useMutation({
    mutationFn: () => api.resendWelcome(tenant.id),
    onSuccess: (res) => {
      setResent(res);
      toast.success(res.email_sent ? "Welcome email sent" : "Password reset (email failed)");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage {tenant.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Subdomain</Label>
              <div>{tenant.subdomain ? `/${tenant.subdomain}` : "—"}</div>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <div>
                <Badge variant={tenant.status === "active" ? "default" : "outline"}>
                  {tenant.status}
                </Badge>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
            <div className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" /> Admin credentials
            </div>
            <p className="text-xs text-muted-foreground">
              Generates a new temporary password for this tenant's admin, forces a password
              change on next login, and re-sends the welcome email.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => resend.mutate()}
              disabled={resend.isPending}
            >
              {resend.isPending && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
              Reset password & resend welcome
            </Button>

            {resent && (
              <div className="space-y-2 pt-2">
                <div className="text-xs">Admin: {resent.admin_email}</div>
                <CopyField value={resent.temp_password} />
                {!resent.email_sent && (
                  <div className="text-xs text-destructive">
                    Email failed{resent.email_error ? `: ${resent.email_error}` : ""}. Share the
                    password manually.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}