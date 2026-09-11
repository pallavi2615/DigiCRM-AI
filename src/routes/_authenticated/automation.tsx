import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Zap, ArrowRight } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/automation")({
  head: () => ({ meta: [{ title: "Automation — DigiCRM AI" }] }),
  component: AutomationPage,
});

const initial = [
  { id: 1, name: "Auto-assign new leads", trigger: "New lead created", action: "Assign to round-robin sales rep", active: true },
  { id: 2, name: "Follow-up reminder", trigger: "Lead untouched for 3 days", action: "Create task for owner", active: true },
  { id: 3, name: "Deal won notification", trigger: "Lead moved to Won", action: "Notify sales manager", active: true },
  { id: 4, name: "Cold lead nurture", trigger: "Lead in New status > 7 days", action: "Send drip email sequence", active: false },
  { id: 5, name: "Proposal follow-up", trigger: "Proposal sent + 2 days", action: "Create call task", active: false },
];

function AutomationPage() {
  const [rules, setRules] = useState(initial);

  const toggle = (id: number) => setRules(r => r.map(x => x.id === id ? { ...x, active: !x.active } : x));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Zap className="h-7 w-7 text-primary" /> Automation</h1>
        <p className="text-muted-foreground text-sm mt-1">Set up rules to run repetitive sales tasks automatically.</p>
      </div>

      <div className="grid gap-3">
        {rules.map(r => (
          <Card key={r.id} className="shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${r.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                <Zap className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold">{r.name}</h4>
                  <Badge variant={r.active ? "default" : "secondary"} className="text-[10px]">{r.active ? "Active" : "Paused"}</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-muted">{r.trigger}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="px-2 py-0.5 rounded bg-muted">{r.action}</span>
                </div>
              </div>
              <Switch checked={r.active} onCheckedChange={() => toggle(r.id)} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card border-dashed">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Custom workflow builder with conditional branches, webhooks, and multi-step actions coming next.</p>
        </CardContent>
      </Card>
    </div>
  );
}
