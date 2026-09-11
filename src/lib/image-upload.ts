import { supabase } from "@/integrations/supabase/client";

const BUCKET = "cms-media";
const VARIANTS = [
  { name: "sm", width: 640 },
  { name: "md", width: 1280 },
  { name: "lg", width: 1920 },
] as const;

export interface UploadedImage {
  url: string;              // primary (md) URL
  original: string;         // original upload URL
  srcset: string;           // "url 640w, url 1280w, url 1920w"
  variants: Record<string, string>;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

async function resizeToWebp(img: HTMLImageElement, targetW: number, quality = 0.82): Promise<Blob> {
  const ratio = img.height / img.width;
  const w = Math.min(targetW, img.width);
  const h = Math.round(w * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error("toBlob failed")), "image/webp", quality);
  });
}

function publicUrl(path: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Upload an image and generate responsive webp variants (sm/md/lg).
 * Returns primary URL, srcset string, and per-variant map.
 */
export async function uploadResponsiveImage(file: File, folder = "uploads"): Promise<UploadedImage> {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const stem = `${folder}/${ts}-${rand}`;

  // Upload original as-is (retain extension)
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const originalPath = `${stem}.${ext}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(originalPath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (upErr) throw upErr;

  const variants: Record<string, string> = {};
  try {
    const img = await loadImage(file);
    for (const v of VARIANTS) {
      if (img.width < v.width && v.name !== "sm") continue; // skip upscales except smallest
      const blob = await resizeToWebp(img, v.width);
      const p = `${stem}-${v.name}.webp`;
      const { error } = await supabase.storage.from(BUCKET).upload(p, blob, {
        contentType: "image/webp",
        upsert: true,
      });
      if (!error) variants[v.name] = publicUrl(p);
    }
  } catch {
    // If image decoding fails (SVG, unsupported), fall back to original only
  }

  const originalUrl = publicUrl(originalPath);
  const primary = variants.md || variants.lg || variants.sm || originalUrl;
  const srcsetParts: string[] = [];
  if (variants.sm) srcsetParts.push(`${variants.sm} 640w`);
  if (variants.md) srcsetParts.push(`${variants.md} 1280w`);
  if (variants.lg) srcsetParts.push(`${variants.lg} 1920w`);

  return {
    url: primary,
    original: originalUrl,
    srcset: srcsetParts.join(", "),
    variants,
  };
}
