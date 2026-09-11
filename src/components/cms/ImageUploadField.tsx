import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { uploadResponsiveImage } from "@/lib/image-upload";

interface Props {
  label: string;
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  folder?: string;
  hint?: string;
}

export function ImageUploadField({ label, value, onChange, folder = "uploads", hint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Image must be under 8 MB"); return; }
    setBusy(true);
    try {
      const res = await uploadResponsiveImage(file, folder);
      onChange(res.url);
      toast.success("Uploaded — responsive variants generated");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally { setBusy(false); }
  }

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2 items-start mt-1">
        <div className="flex-1 space-y-2">
          <Input
            placeholder="https://... or upload →"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
          />
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }}
        />
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        </Button>
        {value && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {value && (
        <div className="mt-2 rounded-md border overflow-hidden bg-muted/30 max-w-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="preview" className="w-full h-32 object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
        </div>
      )}
    </div>
  );
}
