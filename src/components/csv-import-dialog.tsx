import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { csvToObjects } from "@/lib/csv";

export type CsvImportEntity = "leads" | "contacts" | "companies";

interface FieldSpec {
  key: string;         // db column
  aliases: string[];   // accepted csv headers (lowercased, underscored)
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
    const a = document.createElement("a"); a.href = url; a.download = `${entity}-template.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const runImport = async () => {
    if (!file) return toast.error("Choose a CSV file");
    setBusy(true); setResult(null);
    try {
      const text = await file.text();
      const rows = csvToObjects(text);
      if (rows.length === 0) throw new Error("CSV is empty or has no data rows");
      if (rows.length > 1000) throw new Error("Please limit imports to 1,000 rows at a time");

      const errors: string[] = [];
      const payload: Record<string, unknown>[] = [];

      rows.forEach((raw, idx) => {
        const record: Record<string, unknown> = { created_by: user?.id };
        for (const field of spec.fields) {
          const val = field.aliases.map(a => raw[a]).find(v => v !== undefined && v !== "");
          if (val === undefined || val === "") {
            if (field.required) errors.push(`Row ${idx + 2}: missing ${field.key}`);
            continue;
          }
          if (field.type === "number") {
            const n = Number(String(val).replace(/[,$\s]/g, ""));
            record[field.key] = Number.isFinite(n) ? n : null;
          } else if (field.type === "date") {
            const d = new Date(val);
            record[field.key] = isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
          } else {
            record[field.key] = String(val);
          }
        }
        if (spec.fields.filter(f => f.required).every(f => record[f.key])) {
          payload.push(record);
        }
      });

      if (payload.length === 0) throw new Error("No valid rows to import. " + (errors[0] ?? ""));

      // Insert in chunks of 100
      let inserted = 0;
      for (let i = 0; i < payload.length; i += 100) {
        const chunk = payload.slice(i, i + 100);
        const { error, count } = await supabase.from(entity).insert(chunk as never, { count: "exact" });
        if (error) { errors.push(error.message); break; }
        inserted += count ?? chunk.length;
      }

      setResult({ inserted, skipped: rows.length - inserted, errors });
      spec.invalidateKeys.forEach(k => qc.invalidateQueries({ queryKey: [k] }));
      if (inserted > 0) toast.success(`Imported ${inserted} ${entity}`);
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
            {file && <p className="text-xs text-muted-foreground">{file.name} — {(file.size / 1024).toFixed(1)} KB</p>}
          </div>

          <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
            <p className="font-medium mb-1">Accepted columns</p>
            <p className="leading-relaxed">{spec.fields.map(f => f.key + (f.required ? " *" : "")).join(", ")}</p>
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
                  {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                  {result.errors.length > 10 && <li>+{result.errors.length - 10} more…</li>}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={runImport} disabled={busy || !file}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
