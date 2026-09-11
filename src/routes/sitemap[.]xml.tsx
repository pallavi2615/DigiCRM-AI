import { createFileRoute } from "@tanstack/react-router";
import { listPublishedPosts, listPublishedPages } from "@/lib/cms.functions";
import { INDUSTRY_GROUPS } from "@/lib/industry-taxonomy";
import { PRODUCTS } from "@/lib/products";

const BASE_URL = "https://digicrm-ai-buddy.lovable.app";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const staticPaths = [
          "/", "/features", "/pricing", "/about", "/contact", "/blog", "/affiliate", "/industries", "/products",
          ...PRODUCTS.map((p) => `/products/${p.slug}`),
          ...INDUSTRY_GROUPS.flatMap((g) => [
            `/industries/${g.slug}`,
            ...g.children.map((c) => `/industries/${g.slug}/${c.slug}`),
          ]),
        ];
        const [posts, pages] = await Promise.all([listPublishedPosts(), listPublishedPages()]);
        const urls: string[] = [];
        for (const p of staticPaths) {
          urls.push(`  <url><loc>${BASE_URL}${p}</loc><changefreq>weekly</changefreq></url>`);
        }

        for (const post of posts) {
          const lastmod = post.published_at ? new Date(post.published_at).toISOString() : "";
          urls.push(`  <url><loc>${BASE_URL}/blog/${post.slug}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>monthly</changefreq></url>`);
        }
        for (const p of pages) {
          urls.push(`  <url><loc>${BASE_URL}/${p.slug}</loc><lastmod>${p.updated_at}</lastmod><changefreq>monthly</changefreq></url>`);
        }
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
