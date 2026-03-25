"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteWorkflowConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowName: string;
  onConfirm: () => void;
}

export function DeleteWorkflowConfirmDialog({
  open,
  onOpenChange,
  workflowName,
  onConfirm,
}: DeleteWorkflowConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete saved workflow?</DialogTitle>
          <DialogDescription>
            <span className="block">
              This removes{" "}
              <span className="font-medium text-foreground">&quot;{workflowName}&quot;</span>{" "}
              from your saved list. This cannot be undone.
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
