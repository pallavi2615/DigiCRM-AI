/**
 * Centralized SEO helper. Every public route calls buildRouteMeta() to
 * produce a TanStack `head()` return object with title, description,
 * canonical (leaf-only), Open Graph, Twitter, and (optional) JSON-LD.
 *
 * CMS-driven defaults (site name, default OG image, twitter handle)
 * can be merged in at build time from cms_seo_settings, but this helper
 * is intentionally synchronous & pure so it runs safely inside head().
 */

export const SITE_URL = "https://digicrm-ai-buddy.lovable.app";
export const SITE_NAME = "DigiCRM AI";
export const DEFAULT_OG_IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6da8d55c-f26e-4ecb-9b52-9ac0d0abbe42/id-preview-d6ddb45f--bde2e929-0783-4c23-95b6-5c26a1e32821.lovable.app-1783671913581.png";
export const TWITTER_HANDLE = "@digicrmai";

export type SeoInput = {
  /** Path starting with "/", e.g. "/features" or "/blog/my-post" */
  path: string;
  title: string;
  description: string;
  ogImage?: string | null;
  ogType?: "website" | "article" | "product";
  /** For blog posts */
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
    tags?: string[];
  };
  /** Additional JSON-LD schemas to embed */
  jsonLd?: Array<Record<string, unknown>>;
  noindex?: boolean;
};

export function absoluteUrl(path: string) {
  if (!path) return SITE_URL;
  if (path.startsWith("http")) return path;
  return SITE_URL + (path.startsWith("/") ? path : "/" + path);
}

export function buildRouteMeta(input: SeoInput) {
  const url = absoluteUrl(input.path);
  const image = input.ogImage ? absoluteUrl(input.ogImage) : DEFAULT_OG_IMAGE;
  const title = input.title;
  const description = input.description;
  const type = input.ogType ?? "website";

  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: type },
    { property: "og:url", content: url },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:image", content: image },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:site", content: TWITTER_HANDLE },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
  ];

  if (input.noindex) {
    meta.push({ name: "robots", content: "noindex, nofollow" });
  }

  if (input.article) {
    const a = input.article;
    if (a.publishedTime) meta.push({ property: "article:published_time", content: a.publishedTime });
    if (a.modifiedTime) meta.push({ property: "article:modified_time", content: a.modifiedTime });
    if (a.author) meta.push({ property: "article:author", content: a.author });
    for (const tag of a.tags ?? []) meta.push({ property: "article:tag", content: tag });
  }

  const links = [{ rel: "canonical", href: url }];

  const scripts: Array<{ type: string; children: string }> = [];
  for (const ld of input.jsonLd ?? []) {
    scripts.push({ type: "application/ld+json", children: JSON.stringify(ld) });
  }

  return { meta, links, scripts };
}

export function articleJsonLd(opts: {
  title: string;
  description: string;
  url: string;
  image?: string;
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.title,
    description: opts.description,
    image: opts.image ? [absoluteUrl(opts.image)] : undefined,
    datePublished: opts.publishedTime,
    dateModified: opts.modifiedTime ?? opts.publishedTime,
    author: opts.author ? { "@type": "Person", name: opts.author } : { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME },
    mainEntityOfPage: opts.url,
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
