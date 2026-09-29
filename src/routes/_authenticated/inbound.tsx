import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Webhook, Copy, Loader2, Radio } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/inbound")({
  head: () => ({
    meta: [
      { title: "Inbound Leads — DigiCRM AI" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InboundPage,
});

function InboundPage() {
  const [tenant, setTenant] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/v1/tenant/me"),
      apiFetch("/api/v1/users/me"),
    ])
      .then(([tenantData, userData]) => {
        setTenant(tenantData);
        setUser(userData);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load webhook info");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Radio className="h-6 w-6" /> Inbound Lead Channels
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Capture leads from webhooks, Google Sheets, and Facebook Lead Ads.
        </p>
      </div>

      <WebhookSection tenant={tenant} user={user} />
    </div>
  );
}

function WebhookSection({ tenant, user }: { tenant: any; user: any }) {
  const [showSecret, setShowSecret] = useState(false);

  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  const webhookUrl = tenant?.webhook_url || "";
  const secret = tenant?.api_key || "";
  const hasWebhook = !!webhookUrl;

  const copy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  if (!hasWebhook) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="h-4 w-4" /> Public Webhook
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            {isAdmin
              ? "Your workspace does not have an inbound webhook yet."
              : "Webhook details are only visible to Super Admin and Admin."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const example = isAdmin
    ? `curl -X POST '${webhookUrl}' \\
  -H 'content-type: application/json' \\
  -H 'x-webhook-secret: ${showSecret ? secret : "YOUR_SECRET"}' \\
  -d '{"name":"Jane Smith","email":"jane@example.com","phone":"+1 555-0123","source":"landing-form","message":"Interested in demo"}'`
    : "# Sign in as Super Admin or Admin to view the secret and example.";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Webhook className="h-4 w-4" /> Public Webhook
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Drop this endpoint into any website form, Zapier, Make, or custom app.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Endpoint */}
        <div>
          <Label className="text-xs">Endpoint</Label>
          <div className="flex gap-2">
            <code className="flex-1 text-xs bg-muted rounded p-2 break-all">
              {webhookUrl}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copy(webhookUrl, "URL")}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Secret */}
        <div>
          <Label className="text-xs">
            Secret (send as <code>x-webhook-secret</code> header)
          </Label>

          {isAdmin && secret ? (
            <>
              <p className="text-xs text-muted-foreground mt-1 mb-1">
                Only Super Admin / Admin can reveal this webhook secret.
              </p>
              <div className="flex gap-2">
                <code className="flex-1 text-xs bg-muted rounded p-2 truncate font-mono">
                  {showSecret ? secret : "•".repeat(32)}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSecret((v) => !v)}
                >
                  {showSecret ? "Hide" : "Show"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copy(secret, "Secret")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground italic mt-1">
              Hidden — only Super Admin / Admin can reveal this webhook secret.
            </div>
          )}
        </div>

        {/* Example */}
        <div>
          <Label className="text-xs">Example</Label>
          <pre className="text-[11px] bg-muted rounded p-3 overflow-x-auto whitespace-pre-wrap">
            {example}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}