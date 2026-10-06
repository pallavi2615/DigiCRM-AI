import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle, Loader2, Download,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { usePermissions } from "@/contexts/PermissionsContext";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsPage,
});

const inr = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN");

function PaymentsPage() {
  const queryClient = useQueryClient();
  const { permissions, loading: permsLoading } = usePermissions();

  console.log("🔵 PAYMENTS PAGE DEBUG:", {
    permsLoading,
    permissions,
    paymentsKey: permissions.payments,
    canView: permissions.payments?.includes("view"),
  });

  const canView = permissions.payments?.includes("view") ?? false;
  const canCreate = permissions.payments?.includes("create") ?? false;
  const canEdit = permissions.payments?.includes("edit") ?? false;
  

  // ✅ Saare hooks pehle
  const { data: stats } = useQuery({
    queryKey: ["payments-stats"],
    queryFn: () => apiFetch("/api/v1/payments/stats"),
    enabled: canView,
  });

  const { data: entries, isLoading: entriesLoading } = useQuery({
    queryKey: ["payments-entries"],
    queryFn: () => apiFetch("/api/v1/payments/entries?limit=50"),
    enabled: canView,
  });

  const { data: bankAccounts } = useQuery({
    queryKey: ["payments-bank-accounts"],
    queryFn: () => apiFetch("/api/v1/payments/bank-accounts"),
    enabled: canView,
  });

  const [form, setForm] = useState({
    direction: "in",
    category: "service",
    amount: "",
    party: "",
    utr: "",
    memo: "",
    bank_account_id: "",
  });

  const createEntry = useMutation({
    mutationFn: (payload: any) =>
      apiFetch("/api/v1/payments/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          amount: Number(payload.amount),
          bank_account_id: payload.bank_account_id
            ? Number(payload.bank_account_id)
            : null,
        }),
      }),
    onSuccess: () => {
      toast.success("Entry posted");
      queryClient.invalidateQueries({ queryKey: ["payments-entries"] });
      queryClient.invalidateQueries({ queryKey: ["payments-stats"] });
      setForm({
        direction: "in", category: "service", amount: "",
        party: "", utr: "", memo: "", bank_account_id: "",
      });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to post entry"),
  });

  // ✅ Early returns — hooks ke BAAD
  if (permsLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="animate-spin mx-auto" size={20} />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="mx-auto text-red-500 mb-3" size={40} />
        <h2 className="text-lg font-semibold">Access Denied</h2>
        <p className="text-slate-500 text-sm">
          You don't have permission to view Payments & Ledger.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Payments & Ledger</h1>
          <p className="text-sm text-slate-500 mt-1">
            Fee payments, royalties, property payments and payouts post here automatically once marked paid.
          </p>
        </div>
        <select className="border rounded-md px-3 py-2 text-sm">
          <option>Everything I can see</option>
          <option>My entries only</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-slate-500 uppercase mb-1">Money in</div>
            <div className="text-2xl font-bold">{inr(stats?.money_in)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-slate-500 uppercase mb-1">Money out</div>
            <div className="text-2xl font-bold">{inr(stats?.money_out)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-slate-500 uppercase mb-1">Net</div>
            <div className="text-2xl font-bold">{inr(stats?.net)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-slate-500 uppercase mb-1">
              Bank balance (incl. opening)
            </div>
            <div className="text-2xl font-bold">{inr(stats?.bank_balance)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {["Ledger", "Invoices", "Bank accounts", "By category"].map((t, i) => (
          <button
            key={t}
            className={`px-4 py-2 text-sm font-medium rounded-t-md ${
              i === 0 ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Manual Entry Form */}
      {canCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Record a manual entry</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={form.direction}
                onChange={(e) => setForm({ ...form, direction: e.target.value })}
                className="border rounded-md px-3 py-2 text-sm"
              >
                <option value="in">Money in</option>
                <option value="out">Money out</option>
              </select>

              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="border rounded-md px-3 py-2 text-sm"
              >
                <option value="service">Service</option>
                <option value="retainer">Retainer</option>
                <option value="royalty">Royalty</option>
                <option value="salary">Salary</option>
                <option value="gym">Gym</option>
                <option value="salon">Salon</option>
              </select>

              <Input
                type="number"
                placeholder="Amount ₹"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-40"
              />
              <Input
                placeholder="Party"
                value={form.party}
                onChange={(e) => setForm({ ...form, party: e.target.value })}
                className="w-48"
              />
              <Input
                placeholder="UTR"
                value={form.utr}
                onChange={(e) => setForm({ ...form, utr: e.target.value })}
                className="w-36"
              />

              <select
                value={form.bank_account_id}
                onChange={(e) => setForm({ ...form, bank_account_id: e.target.value })}
                className="border rounded-md px-3 py-2 text-sm"
              >
                <option value="">Bank account</option>
                {(bankAccounts || []).map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>

              <Button
                onClick={() => createEntry.mutate(form)}
                disabled={createEntry.isPending || !form.amount || !form.party}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createEntry.isPending && <Loader2 className="animate-spin mr-2" size={16} />}
                Post
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entries Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Entries ({entries?.total || entries?.data?.length || 0})
          </CardTitle>
          {canEdit && (
            <Button size="sm" variant="outline">
              <Download size={14} className="mr-2" /> CSV
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {entriesLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="animate-spin mx-auto" size={20} />
            </div>
          ) : entries?.data?.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No entries yet</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Party</th>
                  <th className="px-4 py-3 font-medium">UTR</th>
                  <th className="px-4 py-3 font-medium">Memo</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries?.data?.map((e: any) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500">{e.entry_date}</td>
                    <td className="px-4 py-3">
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                        {e.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">{e.party}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{e.utr || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{e.memo || "—"}</td>
                    <td className={`px-4 py-3 text-right font-medium ${
                      e.direction === "in" ? "text-blue-600" : "text-red-600"
                    }`}>
                      {e.direction === "in" ? "+" : "-"}{inr(e.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}