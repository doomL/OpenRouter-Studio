"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { StudioMediaZipOptions } from "@/lib/studio-media-zip";

interface ExportMediaZipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (options: StudioMediaZipOptions) => void;
  isExporting?: boolean;
}

const DEFAULT_OPTIONS: StudioMediaZipOptions = {
  includeInputNodes: true,
  includeImageGenNodes: true,
  includeVideoGenNodes: true,
  includeOutputNodes: true,
};

export function ExportMediaZipDialog({
  open,
  onOpenChange,
  onExport,
  isExporting = false,
}: ExportMediaZipDialogProps) {
  const [options, setOptions] = useState<StudioMediaZipOptions>(DEFAULT_OPTIONS);

  useEffect(() => {
    if (open) {
      setOptions(DEFAULT_OPTIONS);
    }
  }, [open]);

  const selectedCount = useMemo(
    () => Object.values(options).filter(Boolean).length,
    [options]
  );

  const optionRows: Array<{
    key: keyof StudioMediaZipOptions;
    title: string;
    description: string;
  }> = [
    {
      key: "includeInputNodes",
      title: "Input nodes",
      description: "Export images and videos coming from Image Input and Media Input nodes.",
    },
    {
      key: "includeImageGenNodes",
      title: "Image generation nodes",
      description: "Export generated images from Image Gen nodes.",
    },
    {
      key: "includeVideoGenNodes",
      title: "Video generation nodes",
      description: "Export generated videos from Video Gen nodes.",
    },
    {
      key: "includeOutputNodes",
      title: "Output nodes",
      description: "Export the media currently exposed through Output nodes.",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Download media ZIP</DialogTitle>
          <DialogDescription>
            Choose which node categories should be included in the exported archive.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1">
          {optionRows.map((row) => {
            const inputId = `media-zip-${row.key}`;
            return (
              <label
                key={row.key}
                htmlFor={inputId}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-studio-node-border bg-studio-node-input/30 px-3 py-2 transition-colors hover:bg-studio-node-input/50"
              >
                <input
                  id={inputId}
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-studio-node-border accent-[#ff6b35]"
                  checked={options[row.key]}
                  onChange={(e) =>
                    setOptions((prev) => ({ ...prev, [row.key]: e.target.checked }))
                  }
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium text-foreground">
                    {row.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {row.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          {selectedCount === 0
            ? "Select at least one category to build the ZIP."
            : `${selectedCount} categor${selectedCount === 1 ? "y" : "ies"} selected.`}
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isExporting || selectedCount === 0}
            onClick={() => {
              onExport(options);
              onOpenChange(false);
            }}
          >
            {isExporting ? "Building ZIP..." : "Download ZIP"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
