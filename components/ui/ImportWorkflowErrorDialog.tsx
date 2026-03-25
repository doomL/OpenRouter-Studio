"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ImportWorkflowErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportWorkflowErrorDialog({
  open,
  onOpenChange,
}: ImportWorkflowErrorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Could not import</DialogTitle>
          <DialogDescription>
            The file does not look like a valid OpenRouter Studio workflow JSON.
            Export a workflow from this app and try again.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end pt-2">
          <Button type="button" onClick={() => onOpenChange(false)}>
            OK
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
