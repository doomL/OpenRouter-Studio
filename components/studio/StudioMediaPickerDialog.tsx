"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { readJsonResponse } from "@/lib/read-json-response";
import { cn } from "@/lib/utils";
import { MusicIcon } from "lucide-react";

type MediaItem = {
  id: string;
  mimeType: string;
  byteSize: number;
  sourceNodeLabel: string | null;
};

type ApiShape = {
  items: MediaItem[];
  error?: string;
};

export function StudioMediaPickerDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with blob id and mime type (image/*, video/*, or audio/*). */
  onPick: (blobId: string, mimeType: string) => void;
  title?: string;
}) {
  const { open, onOpenChange, onPick, title = "Choose from library" } = props;
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "48",
        type: "all",
        q: "",
      });
      const res = await fetch(`/api/studio/media?${params}`, { credentials: "include" });
      const body = await readJsonResponse<ApiShape & { items?: MediaItem[] }>(res);
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : `Failed (${res.status})`);
        setItems([]);
        return;
      }
      const raw = Array.isArray(body.items) ? body.items : [];
      const filtered = raw.filter(
        (b) =>
          typeof b.mimeType === "string" &&
          (b.mimeType.startsWith("image/") ||
            b.mimeType.startsWith("video/") ||
            b.mimeType.startsWith("audio/"))
      );
      setItems(filtered);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load media");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0" showCloseButton>
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Images, videos, and audio from your cloud-synced library. Sign in required.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-4 overflow-y-auto flex-1 min-h-0">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {!loading && !error && items.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No images, videos, or audio in your library yet. Generate or upload media on the
              canvas first.
            </p>
          )}
          {!loading && items.length > 0 && (
            <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cn(
                      "w-full rounded-lg border border-border overflow-hidden bg-card",
                      "hover:ring-2 hover:ring-primary/30 transition-shadow text-left",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                    onClick={() => {
                      onPick(item.id, item.mimeType);
                      onOpenChange(false);
                    }}
                  >
                    <div className="aspect-square bg-muted relative">
                      {item.mimeType.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/studio/blobs/${encodeURIComponent(item.id)}`}
                          alt=""
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : item.mimeType.startsWith("audio/") ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                          <MusicIcon className="size-8 opacity-70" aria-hidden />
                          <span className="text-[10px] font-medium">Audio</span>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-xl">
                          ▶
                        </div>
                      )}
                    </div>
                    <div className="p-1.5 text-[10px] text-muted-foreground line-clamp-2">
                      {item.sourceNodeLabel || item.id.slice(0, 8)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="px-6 py-3 border-t border-border shrink-0 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
