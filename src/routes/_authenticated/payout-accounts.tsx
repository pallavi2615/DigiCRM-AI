import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payout-accounts")({
  head: () => ({
    meta: [
      { title: "Payout Accounts | DigiCRM AI" },
      { name: "description", content: "Partner payout accounts with live balances and every transfer's UTR." },
      { property: "og:title", content: "Payout Accounts | DigiCRM AI" },
      { property: "og:description", content: "Create payout accounts, send money and watch balances update live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PayoutAccounts,
});

const PAYOUTS = "/api/v1/payouts"; // router prefix "/payouts" ke upar jo mount prefix hai, wo yahan match karo

type Account = {
  id: number;
  uuid: string;
  holder_name: string;
  bank_name?: string | null;
  account_number?: string | null;
  ifsc?: string | null;
  upi_id?: string | null;
  balance: number | string;
  is_demo?: boolean;
};
type Transfer = {
  id: number;
  account_id: number;
  amount: number | string;
  utr?: string | null;
  note?: string | null;
  created_at: string;
};
type Dashboard = { accounts: Account[]; transfers: Transfer[] };
type SendState = { amount: string; utr: string };

const inr = (n: any) => "₹" + Number(n || 0).toLocaleString("en-IN");
const empty = { holder_name: "", bank_name: "", account_number: "", ifsc: "", upi_id: "" };

function PayoutAccounts() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [form, setForm] = useState(empty);
  const [send, setSend] = useState<Record<number, SendState>>({});

  // Ek hi call me accounts + transfers. Polling Supabase realtime ki jagah.
  const { data } = useQuery({
    queryKey: ["payout-dashboard"],
    queryFn: () => apiFetch<Dashboard>(`${PAYOUTS}/dashboard`),
    refetchInterval: 10_000,
  });
  const accounts = data?.accounts ?? [];
  const transfers = data?.transfers ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ["payout-dashboard"] });

  const setField = (id: number, field: keyof SendState, value: string) =>
    setSend((s) => {
      const cur = s[id] ?? { amount: "", utr: "" };
      return { ...s, [id]: { ...cur, [field]: value } };
    });

  const createMut = useMutation({
    mutationFn: (body: typeof empty) =>
      apiFetch<Account>(`${PAYOUTS}/accounts`, {
        method: "POST",
        // khaali optional fields null bhejo
        body: JSON.stringify(
          Object.fromEntries(Object.entries(body).map(([k, v]) => [k, v.trim() || null]))
        ),
      }),
    onSuccess: () => {
      toast.success("Payout account created");
      setForm(empty);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMut = useMutation({
    mutationFn: (v: { account_id: number; amount: number; utr: string | null }) =>
      apiFetch<Transfer>(`${PAYOUTS}/transfers`, {
        method: "POST",
        body: JSON.stringify({ ...v, note: "Manual transfer" }),
      }),
    onSuccess: (_d, v) => {
      toast.success(`${inr(v.amount)} sent`);
      setSend((s) => ({ ...s, [v.account_id]: { amount: "", utr: "" } }));
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const create = () => {
    if (!form.holder_name.trim()) return toast.error("Enter the account holder name");
    createMut.mutate(form);
  };

  const sendMoney = (id: number) => {
    const s = send[id];
    const amt = Number(s?.amount);
    if (!amt || amt <= 0) return toast.error("Enter an amount");
    sendMut.mutate({ account_id: id, amount: amt, utr: s?.utr?.trim() || null });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Add a payout account</CardTitle>
          <CardDescription>
            Demo accounts are manual: money is recorded here with a UTR after you transfer it from your bank. Balances
            update live.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          {(["holder_name", "bank_name", "account_number", "ifsc", "upi_id"] as const).map((k) => (
            <Input
              key={k}
              placeholder={k.replace("_", " ")}
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          ))}
          <Button onClick={create} disabled={createMut.isPending}>
            Create account
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isAdmin ? "All payout accounts" : "My payout accounts"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!accounts.length && <p className="text-sm text-muted-foreground">No payout accounts yet.</p>}
          {accounts.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-2 rounded border p-3">
              <div className="min-w-48">
                <div className="font-medium">
                  {a.holder_name} {a.is_demo && <Badge variant="secondary">Demo · manual</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {a.bank_name || "—"} ·{" "}
                  {a.account_number ? "••" + String(a.account_number).slice(-4) : a.upi_id || "—"} {a.ifsc}
                </div>
              </div>
              <div className="text-lg font-semibold" data-testid="balance">
                {inr(a.balance)}
              </div>
              {isAdmin && (
                <div className="ml-auto flex gap-2">
                  <Input
                    className="h-8 w-28"
                    type="number"
                    placeholder="Amount"
                    value={send[a.id]?.amount ?? ""}
                    onChange={(e) => setField(a.id, "amount", e.target.value)}
                  />
                  <Input
                    className="h-8 w-32"
                    placeholder="UTR"
                    value={send[a.id]?.utr ?? ""}
                    onChange={(e) => setField(a.id, "utr", e.target.value)}
                  />
                  <Button size="sm" onClick={() => sendMoney(a.id)} disabled={sendMut.isPending}>
                    Send money
                  </Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transfers</CardTitle>
          <CardDescription>Marking a partner payout as paid also sends it here automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {!transfers.length && <p className="text-muted-foreground">No transfers yet.</p>}
          {transfers.map((t) => {
            const a = accounts.find((x) => x.id === t.account_id);
            return (
              <div key={t.id} className="flex justify-between border-b py-1">
                <span>
                  {a?.holder_name ?? "Account"} · {t.note}
                </span>
                <span>
                  {inr(t.amount)} · UTR {t.utr || "—"} · {new Date(t.created_at).toLocaleString("en-IN")}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}