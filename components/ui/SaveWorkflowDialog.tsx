"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCwIcon } from "lucide-react";

interface Workflow {
  id: string;
  name: string;
  savedAt: string;
  nodes: unknown[];
  edges: unknown[];
}

interface SaveWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => void;
  onUpdate: (id: string, name: string) => void;
  workflows: Workflow[];
}

export function SaveWorkflowDialog({
  open,
  onOpenChange,
  onSave,
  onUpdate,
  workflows,
}: SaveWorkflowDialogProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save workflow</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="workflow-save-name">Save as new</Label>
            <div className="flex gap-2">
              <Input
                id="workflow-save-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Image pipeline"
                autoComplete="off"
                autoFocus
              />
              <Button type="submit" disabled={!name.trim()}>
                Save
              </Button>
            </div>
          </div>
        </form>

        {workflows.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Overwrite existing</Label>
            <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
              {workflows.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors text-left"
                  onClick={() => { onUpdate(w.id, w.name); onOpenChange(false); }}
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{w.name}</div>
                    <div className="text-muted-foreground text-[10px]">
                      {new Date(w.savedAt).toLocaleString()} · {w.nodes.length} nodes
                    </div>
                  </div>
                  <RefreshCwIcon className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
