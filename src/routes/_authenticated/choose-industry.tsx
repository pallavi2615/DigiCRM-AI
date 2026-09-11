import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { claimIndustry, useIndustryAccess } from "@/lib/industry-access";
import { setActiveIndustry } from "@/lib/active-industry";
import { INDUSTRY_GROUPS } from "@/lib/industry-taxonomy";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/choose-industry")({
  head: () => ({
    meta: [
      { title: "Choose your industry | DigiCRM AI" },
      { name: "description", content: "Pick the industry you work in — your dashboard, menu and records are set up for it." },
      { property: "og:title", content: "Choose your industry | DigiCRM AI" },
      { property: "og:description", content: "Pick the industry you work in to set up your workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ChooseIndustry,
});

function ChooseIndustry() {
  const { user } = useAuth();
  const access = useIndustryAccess();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [picked, setPicked] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please sign in again.");
      if (!picked) throw new Error("Pick the industry you work in.");
      await claimIndustry(user.id, picked);
    },
    onSuccess: async () => {
      setActiveIndustry(picked);
      await qc.invalidateQueries({ queryKey: ["industry-access"] });
      toast.success("Your industry is set");
      navigate({ to: "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const already = access.groups.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Which industry do you work in?</h1>
        <p className="text-sm text-muted-foreground">
          Your menu, dashboard and records are set up for this industry only. An administrator can change it later.
        </p>
      </div>

      {already && (
        <Card>
          <CardContent className="p-4 text-sm">
            You are already set up for{" "}
            <strong>
              {access.groups
                .map((g) => INDUSTRY_GROUPS.find((x) => x.slug === g)?.name ?? g)
                .join(", ")}
            </strong>
            . Ask an administrator if this needs to change.
          </CardContent>
        </Card>
      )}

      {!already && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {INDUSTRY_GROUPS.map((g) => (
              <button
                key={g.slug}
                onClick={() => setPicked(g.slug)}
                className={`rounded-lg border p-4 text-left transition-colors ${picked === g.slug ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">{g.name}</p>
                  {picked === g.slug && <Check className="h-4 w-4 text-primary" />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{g.tagline}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {g.children.slice(0, 3).map((c) => (
                    <Badge key={c.slug} variant="outline" className="text-[10px]">{c.name}</Badge>
                  ))}
                </div>
              </button>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ready?</CardTitle>
              <CardDescription>You can only choose once, so pick the one you sell in every day.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button disabled={!picked || save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Set up my workspace
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
