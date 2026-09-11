import { createFileRoute, notFound, Link } from "@tanstack/react-router";

import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getPageBySlug } from "@/lib/cms.functions";
import { buildRouteMeta } from "@/lib/seo";

import type { CmsPageBlock as Block } from "@/lib/cms.functions";

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    const page = await getPageBySlug({ data: { slug: params.slug } });
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) =>
    loaderData && "slug" in loaderData
      ? buildRouteMeta({
          path: `/p/${loaderData.slug}`,
          title: `${loaderData.title} — DigiCRM AI`,
          description:
            loaderData.meta_description ??
            `${loaderData.title} — DigiCRM AI, the AI-native CRM for modern sales teams.`,
          ogImage: loaderData.og_image,
          noindex: loaderData.noindex,
        })
      : {},
  component: CmsPage,
  errorComponent: () => (
    <SiteShell>
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h1 className="text-2xl font-bold">This page could not be loaded</h1>
        <Button asChild className="mt-6"><Link to="/">Go home</Link></Button>
      </div>
    </SiteShell>
  ),
  notFoundComponent: () => (
    <SiteShell>
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This page may be unpublished or the link is out of date.</p>
        <Button asChild className="mt-6"><Link to="/">Go home</Link></Button>
      </div>
    </SiteShell>
  ),
});

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return <h2 className="text-2xl font-bold mt-10 mb-3" style={{ fontFamily: "var(--font-display)" }}>{block.text}</h2>;
    case "text":
      return <p className="text-muted-foreground leading-relaxed">{block.text}</p>;
    case "image":
      return block.image ? <img src={block.image} alt={block.text ?? ""} className="rounded-2xl border w-full my-6" loading="lazy" /> : null;
    case "features":
      return (
        <div className="grid gap-4 sm:grid-cols-2 my-6">
          {(block.items ?? []).map((it, i) => (
            <Card key={i} className="p-5">
              <h3 className="font-semibold">{it.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{it.text}</p>
            </Card>
          ))}
        </div>
      );
    case "faq":
      return (
        <div className="my-6 divide-y border rounded-2xl">
          {(block.items ?? []).map((it, i) => (
            <details key={i} className="p-4">
              <summary className="cursor-pointer font-medium">{it.q}</summary>
              <p className="text-sm text-muted-foreground mt-2">{it.a}</p>
            </details>
          ))}
        </div>
      );
    case "cta":
      return (
        <Card className="p-6 my-10 flex flex-wrap items-center justify-between gap-4 bg-muted/30">
          <p className="font-medium">{block.text}</p>
          {block.url && block.label && (
            <Button asChild>
              {block.url.startsWith("http")
                ? <a href={block.url}>{block.label}</a>
                : <Link to={block.url}>{block.label}</Link>}
            </Button>
          )}
        </Card>
      );
    default:
      return null;
  }
}

function CmsPage() {
  const page = Route.useLoaderData() as NonNullable<Awaited<ReturnType<typeof getPageBySlug>>>;
  const hero = page.hero ?? {};
  const blocks = (page.body ?? []) as Block[];

  return (
    <SiteShell>
      <article className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          {hero["headline"] ?? page.title}
        </h1>
        {hero["subhead"] && <p className="mt-3 text-lg text-muted-foreground">{hero["subhead"]}</p>}
        {hero["image"] && <img src={hero["image"]} alt="" className="rounded-2xl border w-full mt-8" loading="lazy" />}
        <div className="mt-8 space-y-3">
          {blocks.map((b, i) => <BlockView key={i} block={b} />)}
        </div>
      </article>
    </SiteShell>
  );
}
