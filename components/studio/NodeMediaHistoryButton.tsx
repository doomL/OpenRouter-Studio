"use client";

import { useCallback, useState } from "react";
import { HistoryIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getCanvasViewportFloatingProps } from "@/lib/canvas-floating-props";
import { readJsonResponse } from "@/lib/read-json-response";
import { cn } from "@/lib/utils";

type VersionRow = {
  id: string;
  kind: string;
  blobId: string;
  createdAt: string;
  mimeType: string;
  byteSize: number;
};

export function NodeMediaHistoryButton(props: {
  nodeId: string;
  /** If set, only show versions for this kind (e.g. `generatedImage`). */
  kindFilter?: string;
  onRestore: (blobId: string, kind: string) => void;
  /** Classes for the trigger control (theme per node header). */
  triggerClassName?: string;
}) {
  const { nodeId, kindFilter, onRestore, triggerClassName } = props;
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<VersionRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ nodeId });
      const res = await fetch(`/api/studio/node-media-versions?${q}`, {
        credentials: "include",
      });
      if (!res.ok) {
        setVersions([]);
        return;
      }
      const body = await readJsonResponse<{ versions?: VersionRow[] }>(res);
      let rows = body.versions ?? [];
      if (kindFilter) rows = rows.filter((v) => v.kind === kindFilter);
      setVersions(rows);
    } catch {
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }, [nodeId, kindFilter]);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void load();
      }}
    >
      <DropdownMenuTrigger
        type="button"
        title="Prior outputs (restore)"
        className={cn(
          // React Flow: header rows are draggable unless marked — without this, the menu never opens.
          "nodrag nopan shrink-0",
          triggerClassName ??
            "inline-flex items-center justify-center rounded-md h-6 w-6 text-white/90 hover:text-white hover:bg-white/10 outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        )}
        aria-label="Media history"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <HistoryIcon className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="max-h-[min(70vh,320px)] overflow-y-auto min-w-[220px]"
        {...getCanvasViewportFloatingProps()}
        align="end"
      >
        {loading ? (
          <div className="px-2 py-1.5 text-[11px] text-muted-foreground">Loading…</div>
        ) : !versions || versions.length === 0 ? (
          <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
            No saved versions yet. Run a sync after changing output to build history.
          </div>
        ) : (
          versions.map((v) => (
            <DropdownMenuItem
              key={v.id}
              className="text-xs flex flex-col gap-0.5 items-start cursor-pointer"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                onRestore(v.blobId, v.kind);
                setOpen(false);
              }}
            >
              <span className="font-medium">{v.kind}</span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(v.createdAt).toLocaleString()} · {(v.byteSize / 1024).toFixed(0)} KB
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
