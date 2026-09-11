import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRight, Clock } from "lucide-react";
import { listPublishedPosts } from "@/lib/cms.functions";
import { absoluteUrl, breadcrumbJsonLd, buildRouteMeta } from "@/lib/seo";

export const Route = createFileRoute("/blog/")({
  // Server-rendered so search engines see the full post list on first paint.
  loader: async () => ({ posts: await listPublishedPosts() }),
  head: ({ loaderData }) => {
    const posts = loaderData?.posts ?? [];
    return buildRouteMeta({
      path: "/blog",
      title: "Blog — Sales playbooks & CRM insight | DigiCRM AI",
      description: "Product updates, sales playbooks, and engineering deep-dives from the DigiCRM AI team.",
      ogImage: posts[0]?.cover_image ?? null,
      jsonLd: [
        breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }]),
        {
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "DigiCRM AI Blog",
          url: absoluteUrl("/blog"),
          blogPost: posts.slice(0, 20).map((p) => ({
            "@type": "BlogPosting",
            headline: p.title,
            url: absoluteUrl(`/blog/${p.slug}`),
            datePublished: p.published_at ?? undefined,
            author: { "@type": "Person", name: p.author_name ?? "DigiCRM Team" },
            image: p.cover_image ?? undefined,
          })),
        },
      ],
    });
  },
  component: BlogIndex,
  errorComponent: () => (
    <SiteShell>
      <div className="max-w-2xl mx-auto py-24 px-6 text-center">
        <h1 className="text-3xl font-bold">Blog unavailable</h1>
        <p className="mt-2 text-muted-foreground">We could not load posts right now. Please try again.</p>
      </div>
    </SiteShell>
  ),
});

function BlogIndex() {
  const { posts: initialPosts } = Route.useLoaderData();
  const fetchPosts = useServerFn(listPublishedPosts);
  const { data: posts = initialPosts, isLoading } = useQuery({
    queryKey: ["blog-posts"],
    queryFn: () => fetchPosts(),
    initialData: initialPosts,
  });

  return (
    <SiteShell>
      <section className="py-20 px-6 border-b border-border/40 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="outline" className="mb-4">Blog</Badge>
          <h1 className="text-5xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            Sales insight, product updates & playbooks.
          </h1>
        </div>
      </section>
      <section className="py-16 px-6 max-w-6xl mx-auto">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">No posts yet.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((p) => (
              <Link key={p.id} to="/blog/$slug" params={{ slug: p.slug }}
                className="group rounded-xl border border-border/60 bg-card overflow-hidden hover:border-primary/40 hover:shadow-elegant transition-all">
                {p.cover_image ? (
                  <img src={p.cover_image} alt={p.title} className="w-full h-40 object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-40 gradient-primary" />
                )}
                <div className="p-5">
                  <div className="flex gap-1.5 mb-2 flex-wrap">
                    {p.tags.slice(0, 2).map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                  </div>
                  <h2 className="font-semibold text-lg leading-tight group-hover:text-primary transition-colors" style={{ fontFamily: "var(--font-display)" }}>{p.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{p.excerpt}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {p.reading_minutes} min read</span>
                    <span className="flex items-center gap-1 text-primary">Read <ArrowRight className="h-3 w-3" /></span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </SiteShell>
  );
}
