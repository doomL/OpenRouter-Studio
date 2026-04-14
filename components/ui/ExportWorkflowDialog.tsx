"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ExportWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (filename: string) => void;
}

export function ExportWorkflowDialog({
  open,
  onOpenChange,
  onExport,
}: ExportWorkflowDialogProps) {
  const [name, setName] = useState("workflow");

  useEffect(() => {
    if (open) setName("workflow");
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim() || "workflow";
    onExport(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Export workflow</DialogTitle>
            <DialogDescription>
              Choose a filename for the exported JSON file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-3">
            <Label htmlFor="export-workflow-name">Filename</Label>
            <div className="flex items-center gap-1.5">
              <Input
                id="export-workflow-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="workflow"
                autoComplete="off"
                autoFocus
              />
              <span className="shrink-0 text-sm text-muted-foreground">.json</span>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Export</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
