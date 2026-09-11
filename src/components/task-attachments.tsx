import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2, Paperclip, Upload, X } from "lucide-react";
import { toast } from "sonner";

export interface TaskAttachment {
  path: string;
  name: string;
  size: number;
  type: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = [
  "image/png", "image/jpeg", "image/webp", "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
];

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Opens a private attachment in a new tab through a short-lived signed link. */
export async function openAttachment(a: TaskAttachment) {
  const { data, error } = await supabase.storage.from("attachments").createSignedUrl(a.path, 300);
  if (error || !data?.signedUrl) return toast.error("This file could not be opened.");
  window.open(data.signedUrl, "_blank", "noopener");
}

/** Picker used on the task form: drag-and-drop or browse, with validation. */
export function AttachmentPicker({
  files,
  onChange,
}: {
  files: File[];
  onChange: (next: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const add = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!ALLOWED.includes(f.type)) { toast.error(`${f.name}: this file type is not allowed.`); continue; }
      if (f.size > MAX_BYTES) { toast.error(`${f.name}: files must be 10 MB or smaller.`); continue; }
      if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
      next.push(f);
    }
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`rounded-lg border border-dashed p-4 text-center cursor-pointer transition-colors ${over ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
      >
        <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1.5" />
        <p className="text-xs text-muted-foreground">
          Drag files here or click to browse — images and documents, up to 10 MB each.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept={ALLOWED.join(",")}
          onChange={(e) => { add(e.target.files); e.target.value = ""; }}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded border p-2">
              {f.type.startsWith("image/") ? (
                <img src={URL.createObjectURL(f)} alt={f.name} className="h-10 w-10 rounded object-cover" />
              ) : (
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center"><FileText className="h-4 w-4 text-muted-foreground" /></div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{f.name}</p>
                <p className="text-[11px] text-muted-foreground">{formatSize(f.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); onChange(files.filter((_, idx) => idx !== i)); }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Uploads picked files to the private attachments store for a task. */
export async function uploadTaskAttachments(taskId: string, files: File[]): Promise<TaskAttachment[]> {
  const out: TaskAttachment[] = [];
  for (const f of files) {
    const path = `tasks/${taskId}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error } = await supabase.storage.from("attachments").upload(path, f, {
      contentType: f.type || "application/octet-stream",
      upsert: false,
    });
    if (error) throw error;
    out.push({ path, name: f.name, size: f.size, type: f.type });
  }
  return out;
}

/** Read-only list with image previews and download links. */
export function AttachmentList({
  items,
  onRemove,
}: {
  items: TaskAttachment[];
  onRemove?: (a: TaskAttachment) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const preview = async (a: TaskAttachment) => {
    if (previews[a.path] || !a.type?.startsWith("image/")) return;
    const { data } = await supabase.storage.from("attachments").createSignedUrl(a.path, 300);
    if (data?.signedUrl) setPreviews((p) => ({ ...p, [a.path]: data.signedUrl }));
  };

  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">No files attached.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {items.map((a) => {
        void preview(a);
        return (
          <li key={a.path} className="flex items-center gap-2 rounded border p-2">
            {previews[a.path] ? (
              <img src={previews[a.path]} alt={a.name} className="h-10 w-10 rounded object-cover" />
            ) : (
              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{a.name}</p>
              <p className="text-[11px] text-muted-foreground">{formatSize(a.size)}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={async () => { setBusy(a.path); await openAttachment(a); setBusy(null); }}
            >
              {busy === a.path ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            </Button>
            {onRemove && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemove(a)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
