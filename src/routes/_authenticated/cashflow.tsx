import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, Clock, TrendingUp, Loader2, Plus,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { usePermissions } from "@/contexts/PermissionsContext";

export const Route = createFileRoute("/_authenticated/cashflow")({
  component: CashflowPage,
});

function CashflowPage() {
  const { permissions, loading: permsLoading } = usePermissions();

  const canView = permissions.cashflow?.includes("view") ?? false;
  const canCreate = permissions.cashflow?.includes("create") ?? false;
  const canEdit = permissions.cashflow?.includes("edit") ?? false;

  // ✅ SAARE HOOKS PEHLE — koi condition nahi
  const { data: stats } = useQuery({
    queryKey: ["cashflow-stats"],
    queryFn: () => apiFetch("/api/v1/cashflow/stats"),
    enabled: canView,
  });

  const { data: alerts } = useQuery({
    queryKey: ["cashflow-alerts"],
    queryFn: () => apiFetch("/api/v1/cashflow/alerts"),
    enabled: canView,
  });

  const { data: entries, isLoading: entriesLoading } = useQuery({
    queryKey: ["cashflow-list"],
    queryFn: () => apiFetch("/api/v1/cashflow?limit=50"),
    enabled: canView,
  });

  const inr = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN");

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
          You don't have permission to view Cash Flow Tracker.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Cash Flow Tracker</h1>
          <p className="text-sm text-slate-500 mt-1">
            Everything owed to you across education, franchise, real estate and creator deals.
          </p>
        </div>
        {canCreate && (
          <Button>
            <Plus size={16} className="mr-2" />
            New Entry
          </Button>
        )}
      </div>

      {alerts?.alerts?.map((a: any, i: number) => (
        <div
          key={i}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg border ${
            a.level === "danger"
              ? "bg-red-50 border-red-200 text-red-700"
              : a.level === "warning"
              ? "bg-amber-50 border-amber-200 text-amber-700"
              : "bg-blue-50 border-blue-200 text-blue-700"
          }`}
        >
          <AlertTriangle size={16} />
          <span className="text-sm font-medium">{a.message}</span>
        </div>
      ))}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500 uppercase">Pending fees</span>
              <Clock size={16} className="text-slate-400" />
            </div>
            <div className="text-2xl font-bold">{inr(stats?.pending_fees)}</div>
            <div className="text-xs text-slate-500 mt-1">
              {stats?.pending_count || 0} open
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500 uppercase">Due in 30 days</span>
              <TrendingUp size={16} className="text-slate-400" />
            </div>
            <div className="text-2xl font-bold">{inr(stats?.due_30_days)}</div>
            <div className="text-xs text-slate-500 mt-1">
              {stats?.due_30_days_count || 0} payments
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500 uppercase">Overdue royalties</span>
              <AlertTriangle size={16} className="text-red-500" />
            </div>
            <div className="text-2xl font-bold">{inr(stats?.overdue_royalties)}</div>
            <div className="text-xs text-slate-500 mt-1">
              {stats?.overdue_royalties_count || 0} branches
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500 uppercase">All overdue</span>
              <AlertTriangle size={16} className="text-red-500" />
            </div>
            <div className="text-2xl font-bold">{inr(stats?.all_overdue)}</div>
            <div className="text-xs text-slate-500 mt-1">
              {stats?.all_overdue_count || 0} items
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Pending fees ({entries?.total || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {entriesLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="animate-spin mx-auto" size={20} />
            </div>
          ) : entries?.data?.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No pending fees yet
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Party</th>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Due</th>
                  <th className="px-4 py-3 font-medium text-right">Balance</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries?.data?.map((e: any) => {
                  const balance = Number(e.amount) - Number(e.paid_amount || 0);
                  const daysLate = e.due_date
                    ? Math.floor(
                        (new Date().getTime() - new Date(e.due_date).getTime()) / 86400000
                      )
                    : 0;
                  return (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-xs">
                          {e.type.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">{e.party_name}</td>
                      <td className="px-4 py-3">{e.item}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {e.due_date}
                        {daysLate > 0 && (
                          <span className="text-red-600 text-xs ml-1">
                            ({daysLate}d late)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {inr(balance)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canEdit && (
                          <>
                            <Button size="sm" className="mr-2">
                              Record payment
                            </Button>
                            <Button size="sm" variant="outline">
                              Follow up
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}