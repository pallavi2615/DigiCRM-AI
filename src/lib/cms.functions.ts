import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function pubClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const listPublishedPosts = createServerFn({ method: "GET" }).handler(async () => {
  const c = pubClient();
  const { data } = await c
    .from("cms_posts" as never)
    .select("id, slug, title, excerpt, cover_image, tags, reading_minutes, published_at, author_name")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(50);
  return (data ?? []) as Array<{
    id: string; slug: string; title: string; excerpt: string | null;
    cover_image: string | null; tags: string[]; reading_minutes: number;
    published_at: string | null; author_name: string | null;
  }>;
});

export const getPostBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => {
    const x = d as { slug: string };
    if (!x?.slug) throw new Error("slug required");
    return x;
  })
  .handler(async ({ data }) => {
    const c = pubClient();
    const { data: row } = await c
      .from("cms_posts" as never)
      .select("*")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    return row as null | {
      id: string; slug: string; title: string; excerpt: string | null;
      body: string; cover_image: string | null; tags: string[]; reading_minutes: number;
      published_at: string | null; author_name: string | null;
      seo_title: string | null; seo_description: string | null; og_image: string | null;
      updated_at: string | null; canonical_url: string | null; noindex: boolean | null;
    };
  });

export const listHomeSlides = createServerFn({ method: "GET" }).handler(async () => {
  const c = pubClient();
  const { data } = await c
    .from("cms_home_slides" as never)
    .select("id, headline, subhead, image_url, cta_label, cta_url, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as Array<{
    id: string; headline: string; subhead: string | null;
    image_url: string | null; cta_label: string | null; cta_url: string | null; sort_order: number;
  }>;
});

export const listMenuItems = createServerFn({ method: "GET" }).handler(async () => {
  const c = pubClient();
  const { data } = await c
    .from("cms_menu_items" as never)
    .select("id, location, label, url, sort_order, group_label")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as Array<{
    id: string; location: "header" | "footer"; label: string; url: string;
    sort_order: number; group_label: string | null;
  }>;
});

export const getSeoSettings = createServerFn({ method: "GET" }).handler(async () => {
  const c = pubClient();
  const { data } = await c
    .from("cms_seo_settings" as never)
    .select("*")
    .eq("id", "global")
    .maybeSingle();
  return data as null | {
    site_name: string; default_title: string; default_description: string;
    default_og_image: string | null; twitter_handle: string | null;
    ga_id: string | null; gtm_id: string | null; meta_pixel_id: string | null;
    robots_default: string;
  };
});

export const getCampaignBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => {
    const x = d as { slug: string };
    if (!x?.slug) throw new Error("slug required");
    return x;
  })
  .handler(async ({ data }) => {
    const c = pubClient();
    const { data: row } = await c
      .from("cms_campaigns" as never)
      .select("*")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    return row as null | {
      id: string; slug: string; headline: string; subhead: string | null;
      hero_image: string | null; benefits: string[]; cta_label: string;
      form_fields: string[]; thank_you_message: string; theme: string;
    };
  });

export const submitContact = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const x = d as { name: string; email: string; company?: string; phone?: string; message?: string; source?: string; ref?: string; utm?: Record<string, string> };
    if (!x?.name || !x?.email) throw new Error("name and email required");
    if (x.name.length > 200 || x.email.length > 200) throw new Error("input too long");
    if (x.message && x.message.length > 5000) throw new Error("message too long");
    return x;
  })
  .handler(async ({ data }) => {
    const c = pubClient();
    const { error } = await c.from("contact_submissions" as never).insert([{
      name: data.name, email: data.email, company: data.company ?? null,
      phone: data.phone ?? null, message: data.message ?? null,
      source: data.source ?? "contact",
      utm: { ...(data.utm ?? {}), ...(data.ref ? { ref: String(data.ref).slice(0, 32) } : {}) },
    }] as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitAffiliate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const x = d as { name: string; email: string; company?: string; audience?: string; channels?: string; payout_method?: string };
    if (!x?.name || !x?.email) throw new Error("name and email required");
    return x;
  })
  .handler(async ({ data }) => {
    const c = pubClient();
    const code = "AF" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const { data: settings } = await c
      .from("affiliate_settings" as never)
      .select("default_commission_pct")
      .eq("id", "default")
      .maybeSingle();
    const pct = (settings as { default_commission_pct?: number } | null)?.default_commission_pct ?? 20;
    const { error } = await c.from("affiliates" as never).insert([{
      name: data.name, email: data.email, company: data.company ?? null,
      audience: data.audience ?? null, channels: data.channels ?? null,
      payout_method: data.payout_method ?? null, referral_code: code,
      commission_pct: pct,
    }] as never);
    if (error) throw new Error(error.message);
    return { ok: true, referral_code: code };
  });

export const listPublishedPages = createServerFn({ method: "GET" }).handler(async () => {
  const c = pubClient();
  const { data } = await c
    .from("cms_pages" as never)
    .select("slug, updated_at")
    .eq("status", "published");
  return (data ?? []) as Array<{ slug: string; updated_at: string }>;
});

export type CmsPageBlock = {
  type: string;
  text?: string;
  label?: string;
  url?: string;
  image?: string;
  items?: Array<{ title?: string; text?: string; q?: string; a?: string }>;
};

export type CmsPage = {
  id: string;
  slug: string;
  title: string;
  meta_description: string | null;
  seo_keywords: string | null;
  og_image: string | null;
  canonical_override: string | null;
  noindex: boolean;
  hero: { headline?: string; subhead?: string; image?: string } | null;
  body: CmsPageBlock[] | null;
  published_at: string | null;
  updated_at: string;
};

export const getPageBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => {
    const x = d as { slug: string };
    if (!x?.slug) throw new Error("slug required");
    return x;
  })
  .handler(async ({ data }): Promise<CmsPage | null> => {
    const c = pubClient();
    const { data: row } = await c
      .from("cms_pages" as never)
      .select("*")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    return (row ?? null) as CmsPage | null;

  });
