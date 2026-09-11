import { createFileRoute, Link, notFound, Outlet } from "@tanstack/react-router";
import { getIndustry } from "@/lib/industries";
import { IndustryGuard } from "@/components/industry-guard";
import { IndustryTabs } from "@/components/industry-tabs";
import { groupForRoute } from "@/lib/industry-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/industry/$slug")({
  loader: ({ params }) => {
    const preset = getIndustry(params.slug);
    if (!preset) throw notFound();
    return { slug: params.slug };
  },
  head: ({ params }) => {
    const preset = getIndustry(params.slug);
    return {
      meta: [
        { title: `${preset?.name ?? "Industry"} CRM — DigiCRM AI` },
        { name: "description", content: preset?.description ?? "Industry workspace" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="p-12 text-center space-y-3">
      <h2 className="text-lg font-semibold">Industry module not found</h2>
      <p className="text-sm text-muted-foreground">This industry workspace does not exist.</p>
      <Button asChild variant="outline" size="sm"><Link to="/dashboard">Back to dashboard</Link></Button>
    </div>
  ),
  errorComponent: () => (
    <div className="p-12 text-center text-sm text-muted-foreground">
      Unable to load this industry workspace. Please try again.
    </div>
  ),
  component: IndustryLayout,
});

function IndustryLayout() {
  const { slug } = Route.useParams();
  const group = groupForRoute(`/industry/${slug}`);
  const shell = <IndustryShell />;
  if (!group) return shell;
  return <IndustryGuard group={group}>{shell}</IndustryGuard>;
}

function IndustryShell() {
  const { slug } = Route.useParams();
  const preset = getIndustry(slug)!;

  return (
    <div className="space-y-5">
      <div className="rounded-xl p-6 text-white shadow-elegant" style={{ background: preset.gradient }}>
        <Badge variant="secondary" className="mb-2 bg-white/20 text-white border-0">
          {preset.live ? "Live module" : "Industry workspace"}
        </Badge>
        <h1 className="text-3xl font-bold">{preset.name}</h1>
        <p className="opacity-90 text-sm mt-1 max-w-2xl">{preset.description}</p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button asChild size="sm" variant="secondary">
            <Link to="/leads"><Plus className="mr-2 h-4 w-4" /> Add lead</Link>
          </Button>
          {preset.live && preset.liveHref && (
            <Button asChild size="sm" variant="secondary">
              <Link to={preset.liveHref}>Open full module <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          )}
        </div>
      </div>

      <IndustryTabs slug={slug} />

      <Outlet />
    </div>
  );
}
