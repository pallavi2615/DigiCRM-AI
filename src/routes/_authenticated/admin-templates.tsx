import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Eye, Pencil, Plus, Trash2, Upload, Undo2, Save, Lock } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { WORKSPACE_TEMPLATES, type WorkspaceTemplate } from "@/lib/workspace-templates";
import { useLibraryRows, normalise, type LibraryRow } from "@/lib/template-library";
import { TemplatePreview } from "@/components/template-preview";

export const Route = createFileRoute("/_authenticated/admin-templates")({
  head: () => ({
    meta: [
      { title: "Industry Template Builder | DigiCRM AI Admin" },
      { name: "description", content: "Create, edit, duplicate and publish industry workspace templates without code." },
      { property: "og:title", content: "Industry Template Builder | DigiCRM AI" },
      { property: "og:description", content: "No-code builder for industry CRM templates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminTemplates,
});

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

const FIELD_TYPES = ["text", "number", "date", "select", "textarea"] as const;

function AdminTemplates() {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const rows = useLibraryRows().data ?? [];
  const [edit, setEdit] = useState<{
    row?: LibraryRow;
    def: WorkspaceTemplate;
    slug: string;
    based_on: string | null;
  } | null>(null);
  const [peek, setPeek] = useState<WorkspaceTemplate | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["template-library"] });

  if (!hasRole("super_admin")) {
    return (
      <Card className="max-w-lg mx-auto mt-12">
        <CardContent className="p-8 text-center space-y-2">
          <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
          <h2 className="font-semibold">Super admins only</h2>
          <p className="text-sm text-muted-foreground">
            Only super admins can build and publish industry templates.
          </p>
        </CardContent>
      </Card>
    );
  }

  const builtInSlugs = new Set(WORKSPACE_TEMPLATES.map((t) => t.slug));
  const list = [
    ...WORKSPACE_TEMPLATES.map((t) => ({
      slug: t.slug,
      name: t.name,
      builtIn: true,
      row: rows.find((r) => r.slug === t.slug),
      def: t,
    })),
    ...rows
      .filter((r) => !builtInSlugs.has(r.slug))
      .map((r) => ({
        slug: r.slug,
        name: r.definition.name,
        builtIn: false,
        row: r,
        def: r.definition,
      })),
  ];

  const openEdit = (slug: string, def: WorkspaceTemplate, row?: LibraryRow) =>
    setEdit({
      row,
      def: normalise(structuredClone(row?.definition ?? def)),
      slug,
      based_on: row?.based_on ?? (builtInSlugs.has(slug) ? slug : null),
    });

  const duplicate = (def: WorkspaceTemplate) => {
    const base = slugify(`${def.slug}-copy`);
    let slug = base,
      n = 2;
    while (list.some((x) => x.slug === slug)) slug = `${base}-${n++}`;
    setEdit({
      def: normalise({ ...structuredClone(def), slug, name: `${def.name} (copy)` }),
      slug,
      based_on: def.slug,
    });
  };

  const newTemplate = () =>
    setEdit({
      def: normalise({
        slug: "new-industry",
        name: "New Industry CRM",
        stages: ["New", "Contacted", "Qualified", "Won", "Lost"],
        wonStages: ["Won"],
        lostStages: ["Lost"],
      }),
      slug: "new-industry",
      based_on: null,
    });

  const save = async (publish: boolean) => {
    if (!edit) return;
    const slug = slugify(edit.slug);
    if (!slug) return toast.error("Give the template a short web name");
    if (
      !edit.row &&
      list.some(
        (x) => x.slug === slug && !(x.builtIn && x.slug === edit.based_on && !x.row),
      )
    )
      return toast.error("That web name is already used");

    const def = normalise({
      ...edit.def,
      slug,
      stages: edit.def.stages.map((s) => s.trim()).filter(Boolean),
    });
    if (def.stages.length < 2) return toast.error("A template needs at least two stages");

    const dupKey = def.fields.map((f) => f.key).find((k, i, a) => a.indexOf(k) !== i);
    if (dupKey) return toast.error(`Two fields share the key "${dupKey}"`);

    const patch: any = {
      definition: def,
      based_on: edit.based_on,
    };

    if (publish) {
      patch.status = "published";
      patch.published_at = new Date().toISOString();
    }

    try {
      if (edit.row) {
        await apiFetch(`/api/v1/workspace-templates/${edit.row.id}`, {
          method: "PUT",
          body: JSON.stringify(patch),
        });
      } else {
        await apiFetch("/api/v1/workspace-templates", {
          method: "POST",
          body: JSON.stringify({
            ...patch,
            slug,
            status: publish ? "published" : "draft",
          }),
        });
      }
      toast.success(publish ? "Published — new workspaces can use it now" : "Draft saved");
      setEdit(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    }
  };

  const setStatus = async (row: LibraryRow, status: "draft" | "published") => {
    try {
      await apiFetch(`/api/v1/workspace-templates/${row.id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      toast.success(status === "published" ? "Published" : "Unpublished");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update status");
    }
  };

  const remove = async (row: LibraryRow, builtIn: boolean) => {
    if (
      !window.confirm(
        builtIn
          ? "Discard your changes and go back to the original built-in template?"
          : "Delete this template? Existing workspaces keep their copy.",
      )
    )
      return;
    try {
      await apiFetch(`/api/v1/workspace-templates/${row.id}`, { method: "DELETE" });
      toast.success(builtIn ? "Reverted to original" : "Deleted");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Industry Template Builder
          </h1>
          <p className="text-sm text-muted-foreground">
            Edit, duplicate and publish the templates people pick in the workspace setup. Drafts are only visible to super admins.
          </p>
        </div>
        <Button className="ml-auto" onClick={newTemplate}>
          <Plus className="h-4 w-4 mr-1" />
          New template
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {list.map((x) => {
          const shown = x.row?.status === "published" ? x.row.definition : x.def;
          return (
            <Card key={x.slug}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {x.row?.definition.name ?? x.name}
                </CardTitle>
                <CardDescription className="flex flex-wrap gap-1">
                  {x.builtIn ? (
                    <Badge variant="secondary">Built-in</Badge>
                  ) : (
                    <Badge variant="secondary">Custom</Badge>
                  )}
                  {x.row ? (
                    <Badge variant={x.row.status === "published" ? "default" : "outline"}>
                      {x.row.status === "published"
                        ? `Published v${x.row.version}`
                        : x.builtIn
                          ? "Unpublished edits"
                          : "Draft"}
                    </Badge>
                  ) : (
                    <Badge>Live (original)</Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {shown.stages.length} stages · {shown.fields.length} fields ·{" "}
                  {shown.workflows.length} automations · {shown.agents.length} AI agents
                </p>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPeek(normalise(x.row?.definition ?? x.def))}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Preview
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(x.slug, x.def, x.row)}>
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => duplicate(normalise(x.row?.definition ?? x.def))}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Duplicate
                  </Button>
                  {x.row && x.row.status === "draft" && (
                    <Button size="sm" onClick={() => setStatus(x.row!, "published")}>
                      <Upload className="h-3 w-3 mr-1" />
                      Publish
                    </Button>
                  )}
                  {x.row && x.row.status === "published" && (
                    <Button size="sm" variant="ghost" onClick={() => setStatus(x.row!, "draft")}>
                      Unpublish
                    </Button>
                  )}
                  {x.row && (
                    <Button size="sm" variant="ghost" onClick={() => remove(x.row!, x.builtIn)}>
                      {x.builtIn ? (
                        <>
                          <Undo2 className="h-3 w-3 mr-1" />
                          Revert
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Preview dialog */}
      <Dialog open={!!peek} onOpenChange={(o) => !o && setPeek(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{peek?.name}</DialogTitle>
          </DialogHeader>
          {peek && <TemplatePreview t={peek} />}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {edit?.row || edit?.based_on === edit?.slug ? "Edit" : "Create"} template
            </DialogTitle>
          </DialogHeader>
          {edit && (
            <Editor
              edit={edit}
              setEdit={setEdit}
              locked={!!edit.row || (builtInSlugs.has(edit.slug) && edit.based_on === edit.slug)}
            />
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => save(false)}>
              <Save className="h-4 w-4 mr-1" />
              Save draft
            </Button>
            <Button onClick={() => save(true)}>
              <Upload className="h-4 w-4 mr-1" />
              Save & publish
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Editor({
  edit,
  setEdit,
  locked,
}: {
  edit: { def: WorkspaceTemplate; slug: string; based_on: string | null; row?: LibraryRow };
  setEdit: (v: any) => void;
  locked: boolean;
}) {
  const d = edit.def;
  const up = (p: Partial<WorkspaceTemplate>) => setEdit({ ...edit, def: { ...d, ...p } });

  const list = (
    label: string,
    k: "subtypes" | "sources" | "modules" | "roles" | "integrations",
  ) => (
    <div className="space-y-1">
      <Label className="text-xs">{label} (one per line)</Label>
      <Textarea
        rows={4}
        value={d[k].join("\n")}
        onChange={(e) => up({ [k]: e.target.value.split("\n") } as any)}
        onBlur={() =>
          up({ [k]: d[k].map((x) => x.trim()).filter(Boolean) } as any)
        }
      />
    </div>
  );

  const [jsonErr, setJsonErr] = useState<Record<string, string>>({});
  const json = (k: "workflows" | "whatsapp" | "dashboard" | "reports", help: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{help}</Label>
      <Textarea
        rows={12}
        className="font-mono text-xs"
        defaultValue={JSON.stringify(d[k], null, 2)}
        onChange={(e) => {
          try {
            const v = JSON.parse(e.target.value);
            if (!Array.isArray(v)) throw new Error("Must be a list");
            up({ [k]: v } as any);
            setJsonErr({ ...jsonErr, [k]: "" });
          } catch (er: any) {
            setJsonErr({ ...jsonErr, [k]: er.message });
          }
        }}
      />
      {jsonErr[k] && (
        <p className="text-xs text-destructive">Not saved yet: {jsonErr[k]}</p>
      )}
    </div>
  );

  return (
    <Tabs defaultValue="basics">
      <TabsList className="flex flex-wrap h-auto">
        {["basics", "pipeline", "fields", "modules", "agents", "automations", "dashboard", "preview"].map(
          (t) => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t}
            </TabsTrigger>
          ),
        )}
      </TabsList>

      {/* Basics */}
      <TabsContent value="basics" className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Name</Label>
          <Input value={d.name} onChange={(e) => up({ name: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Web name {locked && "(fixed)"}</Label>
          <Input
            value={edit.slug}
            disabled={locked}
            onChange={(e) => setEdit({ ...edit, slug: slugify(e.target.value) })}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Positioning</Label>
          <Input value={d.positioning} onChange={(e) => up({ positioning: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Industry group</Label>
          <Input value={d.group} onChange={(e) => up({ group: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Shown under</Label>
          <Select value={String(d.wave)} onValueChange={(v) => up({ wave: v === "1" ? 1 : 2 })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Core templates</SelectItem>
              <SelectItem value="2">More templates</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(["recordLabel", "recordLabelPlural", "partyLabel", "valueLabel"] as const).map((k) => (
          <div key={k} className="space-y-1">
            <Label className="text-xs">
              {
                {
                  recordLabel: "Record name (e.g. Guest)",
                  recordLabelPlural: "Plural (Guests)",
                  partyLabel: "Customer word",
                  valueLabel: "Value word",
                }[k]
              }
            </Label>
            <Input value={d[k]} onChange={(e) => up({ [k]: e.target.value } as any)} />
          </div>
        ))}
        {list("Business types", "subtypes")}
        {list("Lead sources", "sources")}
      </TabsContent>

      {/* Pipeline */}
      <TabsContent value="pipeline" className="space-y-2">
        {d.stages.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              className="max-w-xs"
              value={s}
              onChange={(e) => {
                const old = d.stages[i];
                const v = e.target.value;
                up({
                  stages: d.stages.map((x, j) => (j === i ? v : x)),
                  wonStages: d.wonStages.map((x) => (x === old ? v : x)),
                  lostStages: d.lostStages.map((x) => (x === old ? v : x)),
                });
              }}
            />
            <Select
              value={d.wonStages.includes(s) ? "won" : d.lostStages.includes(s) ? "lost" : "open"}
              onValueChange={(v) =>
                up({
                  wonStages:
                    v === "won"
                      ? [...d.wonStages.filter((x) => x !== s), s]
                      : d.wonStages.filter((x) => x !== s),
                  lostStages:
                    v === "lost"
                      ? [...d.lostStages.filter((x) => x !== s), s]
                      : d.lostStages.filter((x) => x !== s),
                })
              }
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="icon"
              variant="ghost"
              onClick={() =>
                up({
                  stages: d.stages.filter((_, j) => j !== i),
                  wonStages: d.wonStages.filter((x) => x !== s),
                  lostStages: d.lostStages.filter((x) => x !== s),
                })
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={() => up({ stages: [...d.stages, `Stage ${d.stages.length + 1}`] })}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add stage
        </Button>
      </TabsContent>

      {/* Fields */}
      <TabsContent value="fields" className="space-y-2">
        {d.fields.map((f, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <Input
              className="col-span-3"
              placeholder="Label"
              value={f.label}
              onChange={(e) =>
                up({
                  fields: d.fields.map((x, j) =>
                    j === i
                      ? {
                          ...x,
                          label: e.target.value,
                          key: x.key || slugify(e.target.value).replace(/-/g, "_"),
                        }
                      : x,
                  ),
                })
              }
            />
            <Input
              className="col-span-2"
              placeholder="key"
              value={f.key}
              onChange={(e) =>
                up({
                  fields: d.fields.map((x, j) =>
                    j === i
                      ? { ...x, key: e.target.value.replace(/[^a-z0-9_]/gi, "_").toLowerCase() }
                      : x,
                  ),
                })
              }
            />
            <Select
              value={f.type}
              onValueChange={(v) =>
                up({
                  fields: d.fields.map((x, j) => (j === i ? { ...x, type: v as any } : x)),
                })
              }
            >
              <SelectTrigger className="col-span-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="col-span-4"
              placeholder="Options, comma separated (for select)"
              disabled={f.type !== "select"}
              value={(f.options ?? []).join(", ")}
              onChange={(e) =>
                up({
                  fields: d.fields.map((x, j) =>
                    j === i
                      ? {
                          ...x,
                          options: e.target.value
                            .split(",")
                            .map((o) => o.trim())
                            .filter(Boolean),
                        }
                      : x,
                  ),
                })
              }
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => up({ fields: d.fields.filter((_, j) => j !== i) })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            up({
              fields: [
                ...d.fields,
                { key: `field_${d.fields.length + 1}`, label: "New field", type: "text" },
              ],
            })
          }
        >
          <Plus className="h-3 w-3 mr-1" />
          Add field
        </Button>
      </TabsContent>

      {/* Modules */}
      <TabsContent value="modules" className="grid gap-3 sm:grid-cols-3">
        {list("Industry modules", "modules")}
        {list("Roles", "roles")}
        {list("Integrations", "integrations")}
      </TabsContent>

      {/* Agents */}
      <TabsContent value="agents" className="space-y-3">
        {d.agents.map((a, i) => (
          <div key={i} className="rounded-md border p-2 space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Agent name"
                value={a.label}
                onChange={(e) =>
                  up({
                    agents: d.agents.map((x, j) =>
                      j === i ? { ...x, label: e.target.value } : x,
                    ),
                  })
                }
              />
              <Input
                placeholder="key"
                className="w-40"
                value={a.key}
                onChange={(e) =>
                  up({
                    agents: d.agents.map((x, j) =>
                      j === i ? { ...x, key: e.target.value } : x,
                    ),
                  })
                }
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => up({ agents: d.agents.filter((_, j) => j !== i) })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Input
              placeholder="What it does"
              value={a.description}
              onChange={(e) =>
                up({
                  agents: d.agents.map((x, j) =>
                    j === i ? { ...x, description: e.target.value } : x,
                  ),
                })
              }
            />
            <Textarea
              rows={3}
              placeholder="Instructions (prompt)"
              value={a.instruction}
              onChange={(e) =>
                up({
                  agents: d.agents.map((x, j) =>
                    j === i ? { ...x, instruction: e.target.value } : x,
                  ),
                })
              }
            />
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            up({
              agents: [
                ...d.agents,
                {
                  key: `agent_${d.agents.length + 1}`,
                  label: "New AI agent",
                  description: "",
                  instruction: "",
                },
              ],
            })
          }
        >
          <Plus className="h-3 w-3 mr-1" />
          Add agent
        </Button>
      </TabsContent>

      {/* Automations */}
      <TabsContent value="automations" className="grid gap-3 md:grid-cols-2">
        {json(
          "workflows",
          "Automations — trigger: inactive | in_stage | date_soon | new_record",
        )}
        {json(
          "whatsapp",
          "WhatsApp templates — use {name}, {business} and field keys like {party_size}",
        )}
      </TabsContent>

      {/* Dashboard */}
      <TabsContent value="dashboard" className="grid gap-3 md:grid-cols-2">
        {json(
          "dashboard",
          "KPI cards — metric: count, new_7d, open, won, won_value, conversion, avg_value, stale, stage:<Stage>, sum:<field>",
        )}
        {json(
          "reports",
          "Reports — by: stage, source, location, month, field:<key>",
        )}
      </TabsContent>

      {/* Preview */}
      <TabsContent value="preview">
        <TemplatePreview t={normalise(d)} />
      </TabsContent>
    </Tabs>
  );
}