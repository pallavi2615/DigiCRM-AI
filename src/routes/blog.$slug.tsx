import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock } from "lucide-react";
import { getPostBySlug } from "@/lib/cms.functions";
import { buildRouteMeta, articleJsonLd, absoluteUrl, breadcrumbJsonLd } from "@/lib/seo";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const post = await getPostBySlug({ data: { slug: params.slug } });
    if (!post) throw notFound();
    return { post };
  },
  head: ({ loaderData, params }) => {
    const p = loaderData?.post;
    const path = `/blog/${params.slug}`;
    if (!p) {
      return buildRouteMeta({
        path,
        title: "Post not found — DigiCRM AI",
        description: "The blog post you're looking for isn't available.",
        noindex: true,
      });
    }
    return buildRouteMeta({
      path,
      title: p.seo_title ?? `${p.title} — DigiCRM AI Blog`,
      description: p.seo_description ?? p.excerpt ?? "DigiCRM AI blog post",
      ogImage: p.og_image ?? p.cover_image ?? null,
      ogType: "article",
      noindex: p.noindex ?? false,
      article: {
        publishedTime: p.published_at ?? undefined,
        modifiedTime: p.updated_at ?? undefined,
        author: p.author_name ?? undefined,
        tags: (p.tags as string[] | null) ?? undefined,
      },
      jsonLd: [
        articleJsonLd({
          title: p.title,
          description: p.excerpt ?? p.seo_description ?? "",
          url: absoluteUrl(path),
          image: p.cover_image ?? undefined,
          publishedTime: p.published_at ?? undefined,
          modifiedTime: p.updated_at ?? undefined,
          author: p.author_name ?? undefined,
        }),
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: p.title, path },
        ]),
      ],
    });
  },
  component: BlogPost,
  notFoundComponent: () => (
    <SiteShell>
      <div className="max-w-2xl mx-auto py-24 px-6 text-center">
        <h1 className="text-3xl font-bold">Post not found</h1>
        <Button asChild className="mt-6"><Link to="/blog">Back to blog</Link></Button>
      </div>
    </SiteShell>
  ),
});

function BlogPost() {
  const { post } = Route.useLoaderData();
  return (
    <SiteShell>
      <article className="max-w-3xl mx-auto py-16 px-6">
        <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" /> All posts
        </Link>
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {post.tags.map((t: string) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{post.title}</h1>
        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <span>{post.author_name ?? "DigiCRM Team"}</span>
          <span>·</span>
          <span>{post.published_at ? new Date(post.published_at).toLocaleDateString() : ""}</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {post.reading_minutes} min</span>
        </div>
        {post.cover_image && <img src={post.cover_image} alt={post.title} className="mt-8 rounded-xl w-full" />}
        <div className="prose prose-neutral dark:prose-invert mt-10 max-w-none whitespace-pre-wrap text-base leading-relaxed">
          {post.body}
        </div>
      </article>
    </SiteShell>
  );
}
