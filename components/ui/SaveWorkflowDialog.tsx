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

interface SaveWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => void;
}

export function SaveWorkflowDialog({
  open,
  onOpenChange,
  onSave,
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
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Save workflow</DialogTitle>
            <DialogDescription>
              Add a name for this snapshot. Up to ten workflows are kept in your
              saved list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-3">
            <Label htmlFor="workflow-save-name">Name</Label>
            <Input
              id="workflow-save-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Image pipeline"
              autoComplete="off"
              autoFocus
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
