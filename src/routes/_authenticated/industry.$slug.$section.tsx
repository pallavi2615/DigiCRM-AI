import { createFileRoute, Link } from "@tanstack/react-router";
import { getIndustry } from "@/lib/industries";
import { groupForRoute } from "@/lib/industry-access";
import { INDUSTRY_TABS } from "@/components/industry-tabs";
import { IndustryModule, type IndustryModuleKey } from "@/components/industry-module";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/industry/$slug/$section")({
  head: ({ params }) => {
    const preset = getIndustry(params.slug);
    const tab = INDUSTRY_TABS.find((t) => t.key === params.section);
    const title = `${tab?.label ?? "Section"} — ${preset?.name ?? "Industry"} CRM | DigiCRM AI`;
    return {
      meta: [
        { title },
        { name: "description", content: `${tab?.label ?? "Records"} for the ${preset?.name ?? ""} workspace.` },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  errorComponent: () => (
    <p className="p-10 text-center text-sm text-muted-foreground">Unable to load this section. Please try again.</p>
  ),
  component: IndustrySection,
});

function IndustrySection() {
  const { slug, section } = Route.useParams();
  const preset = getIndustry(slug);
  const group = groupForRoute(`/industry/${slug}`);
  const valid = INDUSTRY_TABS.some((t) => t.key === section);

  if (!preset || !valid || !group) {
    return (
      <div className="p-10 text-center space-y-3">
        <p className="text-sm text-muted-foreground">That section does not exist in this workspace.</p>
        <Button asChild size="sm" variant="outline">
          <Link to="/industry/$slug" params={{ slug }}>Back to overview</Link>
        </Button>
      </div>
    );
  }

  return <IndustryModule module={section as IndustryModuleKey} group={group} industryName={preset.name} />;
}
