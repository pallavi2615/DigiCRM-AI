import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { apiUpload } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";

export type CsvImportEntity = "leads" | "contacts" | "companies";

interface FieldSpec {
  key: string;
  aliases: string[];
  required?: boolean;
  type?: "number" | "date" | "string";
}

const specs: Record<CsvImportEntity, { fields: FieldSpec[]; template: string; invalidateKeys: string[] }> = {
  leads: {
    invalidateKeys: ["leads", "kpi"],
    template: "company_name,contact_person,email,phone,industry,source,status,priority,estimated_value,expected_close_date\nAcme Corp,Jane Doe,jane@acme.com,+1-555-0100,SaaS,Website,new,high,25000,2026-08-01\n",
    fields: [
      { key: "company_name", aliases: ["company_name", "company", "account"], required: true },
      { key: "contact_person", aliases: ["contact_person", "contact", "name"] },
      { key: "email", aliases: ["email", "e-mail"] },
      { key: "phone", aliases: ["phone", "mobile"] },
      { key: "industry", aliases: ["industry", "sector"] },
      { key: "source", aliases: ["source", "lead_source"] },
      { key: "status", aliases: ["status"] },
      { key: "priority", aliases: ["priority"] },
      { key: "estimated_value", aliases: ["estimated_value", "value", "amount"], type: "number" },
      { key: "expected_close_date", aliases: ["expected_close_date", "close_date"], type: "date" },
    ],
  },
  contacts: {
    invalidateKeys: ["contacts"],
    template: "first_name,last_name,email,phone,designation\nJohn,Smith,john@example.com,+1-555-0101,VP Sales\n",
    fields: [
      { key: "first_name", aliases: ["first_name", "firstname", "given_name"], required: true },
      { key: "last_name", aliases: ["last_name", "lastname", "surname"] },
      { key: "email", aliases: ["email"] },
      { key: "phone", aliases: ["phone"] },
      { key: "designation", aliases: ["designation", "title", "role"] },
    ],
  },
  companies: {
    invalidateKeys: ["companies", "companies-lite"],
    template: "name,industry,website,phone,email,employee_count,annual_revenue,city,country\nAcme Corp,SaaS,https://acme.com,+1-555-0100,hello@acme.com,120,5000000,San Francisco,USA\n",
    fields: [
      { key: "name", aliases: ["name", "company", "company_name"], required: true },
      { key: "industry", aliases: ["industry"] },
      { key: "website", aliases: ["website", "url"] },
      { key: "phone", aliases: ["phone"] },
      { key: "email", aliases: ["email"] },
      { key: "employee_count", aliases: ["employee_count", "employees"], type: "number" },
      { key: "annual_revenue", aliases: ["annual_revenue", "revenue"], type: "number" },
      { key: "city", aliases: ["city"] },
      { key: "country", aliases: ["country"] },
    ],
  },
};

interface Props {
  entity: CsvImportEntity;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CsvImportDialog({ entity, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number; errors: string[] } | null>(null);
  const spec = specs[entity];

  const reset = () => { setFile(null); setResult(null); };

  const downloadTemplate = () => {
    const blob = new Blob([spec.template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entity}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runImport = async () => {
    if (!file) return toast.error("Choose a CSV file");
    setBusy(true);
    setResult(null);
    try {
      const importEndpoint =
        entity === "leads" ? "/api/v1/leads/import"
        : entity === "contacts" ? "/api/v1/contacts/import"
        : "/api/v1/companies/import";

      const formData = new FormData();
      formData.append("file", file);

      const res = await apiUpload<{
        total_rows: number;
        imported: number;
        failed: number;
        errors: string[];
      }>(importEndpoint, formData);

      setResult({
        inserted: res.imported ?? 0,
        skipped: res.failed ?? 0,
        errors: res.errors ?? [],
      });

      spec.invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

      if ((res.imported ?? 0) > 0) {
        toast.success(`Imported ${res.imported} ${entity}`);
      } else {
        toast.warning("No rows imported. Check errors.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="capitalize">Import {entity} from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file. Download the template to see the expected columns and formatting.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" /> Download template
          </Button>

          <div className="space-y-2">
            <Label>CSV File</Label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:cursor-pointer"
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} — {(file.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>

          <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
            <p className="font-medium mb-1">Accepted columns</p>
            <p className="leading-relaxed">
              {spec.fields.map((f) => f.key + (f.required ? " *" : "")).join(", ")}
            </p>
          </div>

          {result && (
            <div className="rounded-md border p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" /> {result.inserted} rows imported
              </div>
              {result.skipped > 0 && (
                <div className="flex items-center gap-2 text-warning">
                  <AlertCircle className="h-4 w-4" /> {result.skipped} rows skipped
                </div>
              )}
              {result.errors.length > 0 && (
                <ul className="text-xs text-destructive list-disc pl-5 max-h-32 overflow-auto">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                  {result.errors.length > 10 && (
                    <li>+{result.errors.length - 10} more…</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={runImport} disabled={busy || !file}>
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}