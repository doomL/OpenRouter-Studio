"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  DownloadIcon,
  ImageIcon,
  LayoutDashboardIcon,
  SettingsIcon,
} from "lucide-react";
import { readJsonResponse } from "@/lib/read-json-response";
import { cn } from "@/lib/utils";
import { ThemedLogo } from "@/components/theme/ThemedLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { HomeSignOutButton } from "@/components/home/HomeSignOutButton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type StudioMediaItemDto = {
  id: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
  sourceNodeId: string | null;
  sourceNodeType: string | null;
  sourceNodeLabel: string | null;
  mediaFieldKind: string | null;
  workflows: { id: string; name: string }[];
  onLiveCanvas: boolean;
};

type MediaApiResponse = {
  items: StudioMediaItemDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function formatKb(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(bytes >= 10240 ? 0 : 1)} KB`;
}

export function MediaLibraryClient() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [type, setType] = useState("all");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState<MediaApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StudioMediaItemDto | null>(null);
  const [detailWorkflowId, setDetailWorkflowId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 350);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    setPage(1);
  }, [q, type]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        type,
        q,
      });
      const res = await fetch(`/api/studio/media?${params}`, {
        credentials: "include",
      });
      const body = await readJsonResponse<
        MediaApiResponse & { error?: string }
      >(res);
      if (!res.ok) {
        setError(
          typeof body.error === "string" ? body.error : `Request failed (${res.status})`
        );
        setData(null);
        return;
      }
      setData(body as MediaApiResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load media");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, type, q]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setDetailWorkflowId(null);
      return;
    }
    if (selected.workflows.length > 0) {
      setDetailWorkflowId(selected.workflows[0].id);
    } else {
      setDetailWorkflowId(null);
    }
  }, [selected]);

  const studioOpenHref =
    detailWorkflowId != null
      ? `/studio?workflow=${encodeURIComponent(detailWorkflowId)}`
      : "/studio";
  const downloadHref = selected
    ? `/api/studio/blobs/${encodeURIComponent(selected.id)}?download=1`
    : "#";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3 gap-3">
          <Link href="/home" className="flex items-center gap-2 min-w-0">
            <ThemedLogo className="h-7 w-7 shrink-0" />
            <span className="text-sm font-bold tracking-tight truncate">
              <span className="text-[#ff6b35]">OpenRouter</span> Studio
            </span>
          </Link>
          <nav className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            <Link
              href="/home"
              className="rounded-md px-2 py-1 hover:bg-muted hover:text-foreground transition-colors"
            >
              Home
            </Link>
            <span className="opacity-40">·</span>
            <span className="rounded-md px-2 py-1 text-foreground font-medium">Media</span>
            <span className="opacity-40">·</span>
            <Link
              href="/settings"
              className="rounded-md px-2 py-1 hover:bg-muted hover:text-foreground transition-colors"
            >
              Settings
            </Link>
            <span className="opacity-40">·</span>
            <Link
              href="/studio"
              className="rounded-md px-2 py-1 hover:bg-muted hover:text-foreground transition-colors"
            >
              Studio
            </Link>
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <Link
              href="/settings"
              className={cn(
                "hidden sm:inline-flex items-center justify-center rounded-lg border border-border",
                "bg-background px-2.5 h-7 text-[0.8rem] font-medium hover:bg-muted transition-colors"
              )}
              title="Settings"
            >
              <SettingsIcon className="size-3.5" />
            </Link>
            <Link
              href="/studio"
              className={cn(
                "hidden sm:inline-flex items-center justify-center rounded-lg border border-border",
                "bg-background px-2.5 h-7 text-[0.8rem] font-medium hover:bg-muted transition-colors"
              )}
              title="Studio"
            >
              <LayoutDashboardIcon className="size-3.5" />
            </Link>
            <HomeSignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-6">
          <div>
            <Link
              href="/home"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
            >
              <ArrowLeftIcon className="size-3" />
              Back to home
            </Link>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ImageIcon className="size-7 text-[#ea580c]" />
              Media library
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Paginated assets from cloud sync. Filter by type or search node labels.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end mb-6">
          <div className="space-y-1.5 flex-1 min-w-[200px] max-w-md">
            <Label htmlFor="media-q" className="text-xs text-muted-foreground">
              Search
            </Label>
            <Input
              id="media-q"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Node label, id, field kind, node type…"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5 w-full sm:w-44">
            <Label htmlFor="media-type" className="text-xs text-muted-foreground">
              Type
            </Label>
            <select
              id="media-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={cn(
                "h-9 w-full rounded-lg border border-border bg-background px-2 text-sm",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              <option value="all">All</option>
              <option value="image">Images</option>
              <option value="audio">Audio</option>
              <option value="video">Video</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive mb-4" role="alert">
            {error}
          </p>
        )}

        {loading && data ? (
          <p className="text-xs text-muted-foreground mb-2">Updating list…</p>
        ) : null}

        {loading && !data ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : data && data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No media matches. Sync the canvas with object storage enabled, or adjust filters.
          </p>
        ) : data ? (
          <>
            <p className="text-xs text-muted-foreground mb-3">
              Showing {(page - 1) * pageSize + 1}–
              {Math.min(page * pageSize, data.total)} of {data.total}
            </p>
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {data.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    className={cn(
                      "w-full text-left rounded-xl border border-border overflow-hidden bg-card",
                      "hover:ring-2 hover:ring-[#ff6b35]/40 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                  >
                    <div className="aspect-square bg-muted relative">
                      {item.mimeType.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/studio/blobs/${encodeURIComponent(item.id)}`}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : item.mimeType.startsWith("audio/") ? (
                        <div className="absolute inset-0 flex items-center justify-center text-2xl">
                          🎵
                        </div>
                      ) : item.mimeType.startsWith("video/") ? (
                        <div className="absolute inset-0 flex items-center justify-center text-2xl">
                          ▶
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center p-2 text-[10px] text-muted-foreground text-center break-all">
                          {item.mimeType}
                        </div>
                      )}
                    </div>
                    <div className="p-2 space-y-0.5">
                      <div className="text-[11px] font-medium line-clamp-1">
                        {item.sourceNodeLabel || "Unknown node"}
                      </div>
                      <div className="text-[10px] text-muted-foreground line-clamp-1">
                        {item.workflows.length > 0
                          ? item.workflows.map((w) => w.name).join(", ")
                          : item.onLiveCanvas
                            ? "Current canvas"
                            : "—"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatKb(item.byteSize)}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-center gap-4 mt-8">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ArrowLeftIcon className="size-3.5" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                Page {page} / {data.totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ArrowRightIcon className="size-3.5" />
              </Button>
            </div>
          </>
        ) : null}

        <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="sm:max-w-lg" showCloseButton>
            <DialogHeader>
              <DialogTitle>Media details</DialogTitle>
              <DialogDescription>
                Provenance from the last upload. Workflows list named snapshots that contain this
                node.
              </DialogDescription>
            </DialogHeader>
            {selected && (
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-muted/30 overflow-hidden max-h-[45vh] flex items-center justify-center">
                  {selected.mimeType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/studio/blobs/${encodeURIComponent(selected.id)}`}
                      alt=""
                      className="max-h-[45vh] w-full object-contain"
                    />
                  ) : selected.mimeType.startsWith("audio/") ? (
                    <audio
                      controls
                      className="w-full m-2"
                      src={`/api/studio/blobs/${encodeURIComponent(selected.id)}`}
                    />
                  ) : selected.mimeType.startsWith("video/") ? (
                    <video
                      controls
                      className="max-h-[45vh] w-full"
                      src={`/api/studio/blobs/${encodeURIComponent(selected.id)}`}
                    />
                  ) : (
                    <p className="p-4 text-xs text-muted-foreground text-center">
                      {selected.mimeType}
                    </p>
                  )}
                </div>
                <dl className="grid grid-cols-[100px_1fr] gap-x-2 gap-y-1.5 text-xs">
                  <dt className="text-muted-foreground">Node</dt>
                  <dd className="font-medium">
                    {selected.sourceNodeLabel || "—"}{" "}
                    <span className="text-muted-foreground font-normal">
                      ({selected.sourceNodeType || "?"})
                    </span>
                  </dd>
                  <dt className="text-muted-foreground">Node id</dt>
                  <dd className="font-mono text-[10px] break-all">{selected.sourceNodeId || "—"}</dd>
                  <dt className="text-muted-foreground">Field</dt>
                  <dd>{selected.mediaFieldKind || "—"}</dd>
                  <dt className="text-muted-foreground">MIME</dt>
                  <dd className="break-all">{selected.mimeType}</dd>
                  <dt className="text-muted-foreground">Size</dt>
                  <dd>{formatKb(selected.byteSize)}</dd>
                  <dt className="text-muted-foreground">Uploaded</dt>
                  <dd>{new Date(selected.createdAt).toLocaleString()}</dd>
                  <dt className="text-muted-foreground">Workflows</dt>
                  <dd>
                    {selected.workflows.length > 0
                      ? selected.workflows.map((w) => w.name).join(", ")
                      : selected.onLiveCanvas
                        ? "On current canvas only (not in a saved snapshot)"
                        : "—"}
                  </dd>
                  <dt className="text-muted-foreground">Live canvas</dt>
                  <dd>{selected.onLiveCanvas ? "Yes" : "No"}</dd>
                </dl>
              </div>
            )}
            <DialogFooter className="!border-0 !bg-transparent !p-0 !-mx-0 !-mb-0">
              <div className="flex w-full flex-col gap-2 pt-2">
                {selected && selected.workflows.length > 1 ? (
                  <div className="space-y-1">
                    <Label htmlFor="media-open-workflow" className="text-xs text-muted-foreground">
                      Open in saved workflow
                    </Label>
                    <select
                      id="media-open-workflow"
                      value={detailWorkflowId ?? ""}
                      onChange={(e) => setDetailWorkflowId(e.target.value || null)}
                      className={cn(
                        "h-9 w-full rounded-md border border-border bg-background px-2 text-sm",
                        "outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      )}
                    >
                      {selected.workflows.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="flex w-full flex-row flex-wrap items-center justify-between gap-2">
                <Link
                  href={studioOpenHref}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Open Studio
                </Link>
                <a
                  href={downloadHref}
                  className={cn(buttonVariants({ size: "sm" }), "inline-flex gap-1")}
                >
                  <DownloadIcon className="size-3.5" />
                  Download
                </a>
              </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
