import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, Download, FileDown, Minus, ShieldCheck } from "lucide-react";
import { MODULES, ROLES, type Action } from "@/lib/permissions";
import { useAuth } from "@/hooks/use-auth";
import type { AppRole } from "@/hooks/use-auth";
import { downloadCsv, objectsToCsv } from "@/lib/csv";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/feature-matrix")({
  head: () => ({
    meta: [
      { title: "Feature & Permission Matrix — DigiCRM AI" },
      { name: "description", content: "The modules you can reach and your view, create, edit and delete rights in DigiCRM AI." },
    ],
  }),
  component: FeatureMatrixPage,
});

const ACTIONS: Action[] = ["view", "create", "edit", "delete"];

function FeatureMatrixPage() {
  const { user, isAdmin } = useAuth();

  // Build matrix client-side from MODULES constant
  const data = useMemo(() => {
    const myRoles: AppRole[] = user?.roles ?? [];
    const isSuperAdmin = myRoles.includes("super_admin");

    return {
      full: isSuperAdmin || isAdmin,
      roles: ROLES,
      myRoles,
      rows: MODULES.map((m) => ({
        key: m.key,
        label: m.label,
        panel: m.panel,
        route: m.route,
        description: m.description,
        perms: m.perms,
      })),
    };
  }, [user, isAdmin]);

  const downloadPdf = (role: AppRole) => {
    // PDF export not yet implemented — show message
    toast.info(`PDF export for "${role}" coming soon`);
  };

  const exportCsv = () => {
    const rows = data.rows.flatMap((m) =>
      data.roles.map((r) => ({
        panel: m.panel,
        module: m.label,
        route: m.route ?? "",
        role: r.label,
        view: (m.perms[r.key] ?? []).includes("view") ? "yes" : "no",
        create: (m.perms[r.key] ?? []).includes("create") ? "yes" : "no",
        edit: (m.perms[r.key] ?? []).includes("edit") ? "yes" : "no",
        delete: (m.perms[r.key] ?? []).includes("delete") ? "yes" : "no",
      })),
    );
    downloadCsv(
      "digicrm-permission-matrix.csv",
      objectsToCsv(rows, ["panel", "module", "route", "role", "view", "create", "edit", "delete"]),
    );
  };

  const panels = [...new Set(data.rows.map((r) => r.panel))];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" /> {data.full ? "Feature & Permission Matrix" : "My Access"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {data.full
              ? "Every module, panel by panel, with view / create / edit / delete rights per role."
              : "The modules you can open, and what you may do in each one."}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className={`grid gap-3 ${data.roles.length > 1 ? "sm:grid-cols-2 lg:grid-cols-4" : "max-w-md"}`}>
        {data.roles.map((r) => (
          <Card key={r.key} className={`shadow-card ${data.myRoles.includes(r.key) ? "border-primary" : ""}`}>
            <CardContent className="p-4 flex flex-col h-full">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">{r.label}</p>
                {data.myRoles.includes(r.key) && <Badge variant="secondary" className="text-[10px]">You</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex-1">{r.blurb}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full"
                onClick={() => downloadPdf(r.key)}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {panels.map((panel) => (
        <Card key={panel} className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">{panel}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-56">Module</TableHead>
                  {data.roles.map((r) => (
                    <TableHead key={r.key} className="text-center min-w-40">{r.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.filter((m) => m.panel === panel).map((m) => (
                  <TableRow key={m.key}>
                    <TableCell className="align-top">
                      <div className="font-medium text-sm">
                        {m.route ? <Link to={m.route} className="hover:underline">{m.label}</Link> : m.label}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-md">{m.description}</p>
                    </TableCell>
                    {data.roles.map((r) => {
                      const perms = m.perms[r.key] ?? [];
                      return (
                        <TableCell key={r.key} className="text-center align-top">
                          {perms.length === 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Minus className="h-3 w-3" /> No access
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1 justify-center">
                              {ACTIONS.map((a) => (
                                <span
                                  key={a}
                                  className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] capitalize ${
                                    perms.includes(a)
                                      ? "bg-success/15 text-success"
                                      : "bg-muted text-muted-foreground line-through"
                                  }`}
                                >
                                  {perms.includes(a) && <Check className="h-2.5 w-2.5" />}
                                  {a}
                                </span>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <p className="text-xs text-muted-foreground">
        This list is built from the permission matrix in the app, and database rules enforce the same limits.
      </p>
    </div>
  );
}