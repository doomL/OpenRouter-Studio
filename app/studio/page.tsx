"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { StudioCanvas } from "@/components/canvas/StudioCanvas";
import { NodePanel } from "@/components/canvas/NodePanel";
import { ApiKeyModal } from "@/components/ui/ApiKeyModal";
import { SaveWorkflowDialog } from "@/components/ui/SaveWorkflowDialog";
import { ExportWorkflowDialog } from "@/components/ui/ExportWorkflowDialog";
import { ExportMediaZipDialog } from "@/components/ui/ExportMediaZipDialog";
import { ImportWorkflowErrorDialog } from "@/components/ui/ImportWorkflowErrorDialog";
import { DeleteWorkflowConfirmDialog } from "@/components/ui/DeleteWorkflowConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SunIcon,
  MoonIcon,
  PlusIcon,
  SaveIcon,
  FolderOpenIcon,
  Undo2Icon,
  Redo2Icon,
  PlayIcon,
  DownloadIcon,
  FolderArchiveIcon,
  UploadIcon,
  DollarSignIcon,
  LogOutIcon,
  UserIcon,
  Trash2Icon,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { signOutAtCurrentOrigin } from "@/lib/studio-sign-out";
import { useStudioStore } from "@/lib/store";
import { getRunnableNodes, hasUpstreamOutput } from "@/lib/autorun";
import { useStudioCloudSync } from "@/components/studio/useStudioCloudSync";
import { saveStudioSettingsToServer } from "@/lib/studio-settings-api";
import { getCanvasViewportFloatingProps } from "@/lib/canvas-floating-props";
import { formatWorkflowSavedAt } from "@/lib/utils";
import { ThemedLogo } from "@/components/theme/ThemedLogo";
import { toast } from "@/lib/toast";
import { buildStudioMediaZip, type StudioMediaZipOptions } from "@/lib/studio-media-zip";

export default function StudioPage() {
  const cloudSyncReady = useStudioCloudSync();
  const { data: session, status: sessionStatus } = useSession();
  const apiKey = useStudioStore((s) => s.apiKey);
  const theme = useStudioStore((s) => s.theme);
  const toggleTheme = useStudioStore((s) => s.toggleTheme);
  const workflows = useStudioStore((s) => s.workflows);
  const saveWorkflow = useStudioStore((s) => s.saveWorkflow);
  const loadWorkflow = useStudioStore((s) => s.loadWorkflow);
  const deleteWorkflow = useStudioStore((s) => s.deleteWorkflow);
  const newWorkflow = useStudioStore((s) => s.newWorkflow);
  const exportWorkflow = useStudioStore((s) => s.exportWorkflow);
  const importWorkflow = useStudioStore((s) => s.importWorkflow);
  const undo = useStudioStore((s) => s.undo);
  const redo = useStudioStore((s) => s.redo);
  const sessionCost = useStudioStore((s) => s.sessionCost);
  const resetCost = useStudioStore((s) => s.resetCost);
  const nodes = useStudioStore((s) => s.nodes);
  const edges = useStudioStore((s) => s.edges);

  const [showApiKey, setShowApiKey] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportMediaZipDialogOpen, setExportMediaZipDialogOpen] = useState(false);
  const [importErrorOpen, setImportErrorOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [isDownloadingMediaZip, setIsDownloadingMediaZip] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (apiKey) setShowApiKey(false);
  }, [apiKey]);

  useEffect(() => {
    if (
      mounted &&
      cloudSyncReady &&
      sessionStatus === "authenticated" &&
      !apiKey
    ) {
      setShowApiKey(true);
    }
  }, [mounted, cloudSyncReady, apiKey, sessionStatus]);

  const handleSave = useCallback(() => {
    setSaveDialogOpen(true);
  }, []);

  const handleConfirmSaveWorkflow = useCallback(
    (name: string) => {
      saveWorkflow(name);
      void saveStudioSettingsToServer();
      toast.success(`Saved “${name}”`);
    },
    [saveWorkflow]
  );

  const handleExport = useCallback(() => {
    setExportDialogOpen(true);
  }, []);

  const handleConfirmExport = useCallback(
    (filename: string) => {
      const json = exportWorkflow();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Workflow exported");
    },
    [exportWorkflow]
  );

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDownloadAllMedia = useCallback(() => {
    setExportMediaZipDialogOpen(true);
  }, []);

  const handleConfirmDownloadAllMedia = useCallback(async (options: StudioMediaZipOptions) => {
    if (isDownloadingMediaZip) return;
    setIsDownloadingMediaZip(true);
    const key = useStudioStore.getState().apiKey ?? "";
    const t = toast.loading("Building media archive…");
    try {
      const { blob, fileCount } = await buildStudioMediaZip(
        useStudioStore.getState().nodes,
        useStudioStore.getState().edges,
        useStudioStore.getState().nodeOutputs,
        useStudioStore.getState().videoJobs,
        key,
        options
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `studio-media-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.dismiss(t);
      toast.success(`Downloaded ZIP with ${fileCount} file${fileCount === 1 ? "" : "s"}`);
    } catch (e) {
      toast.dismiss(t);
      toast.error(e instanceof Error ? e.message : "Could not build media ZIP");
    } finally {
      setIsDownloadingMediaZip(false);
    }
  }, [isDownloadingMediaZip]);

  const handleFileImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        if (!importWorkflow(text)) {
          setImportErrorOpen(true);
          toast.error("Invalid workflow file");
        } else {
          toast.success("Workflow imported");
        }
      };
      reader.readAsText(file);
      // Reset input so same file can be imported again
      e.target.value = "";
    },
    [importWorkflow]
  );

  // Run All: execute nodes in topological order
  const handleRunAll = useCallback(async () => {
    if (isRunningAll) return;
    setIsRunningAll(true);

    const runnableNodes = getRunnableNodes(nodes, edges);
    if (runnableNodes.length === 0) {
      toast.info("No runnable nodes on the canvas");
      setIsRunningAll(false);
      return;
    }

    const runToast = toast.loading("Running all nodes…");

    try {
      for (const node of runnableNodes) {
        // Wait for upstream to be ready
        const maxWait = 600000; // 10 min max per node
        const start = Date.now();
        while (!hasUpstreamOutput(node.id, edges, useStudioStore.getState().nodeOutputs)) {
          if (Date.now() - start > maxWait) break;
          await new Promise((r) => setTimeout(r, 1000));
        }

        // Find the node's run button and click it
        const nodeEl = document.querySelector(`[data-id="${node.id}"]`);
        if (nodeEl) {
          const btn = nodeEl.querySelector("button:not([disabled])") as HTMLButtonElement;
          // Find the Run/Generate button specifically
          const buttons = nodeEl.querySelectorAll("button");
          for (const b of buttons) {
            const text = b.textContent?.toLowerCase() || "";
            if ((text.includes("run") || text.includes("generate")) && !b.disabled) {
              b.click();
              // Wait for completion
              await waitForNodeDone(node.id);
              break;
            }
          }
        }
      }
      toast.success("Finished running all nodes", { id: runToast });
    } catch {
      toast.error("Run all failed", { id: runToast });
    } finally {
      setIsRunningAll(false);
    }
  }, [nodes, edges, isRunningAll]);

  if (!mounted) return null;

  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col bg-studio-bg text-foreground">
        {/* Header */}
        <header className="flex h-12 flex-shrink-0 items-center justify-between border-b border-studio-node-border bg-studio-bg px-4">
          <div className="flex items-center gap-2.5">
            <ThemedLogo className="h-6 w-6" />
            <span className="text-sm font-bold tracking-tight">
              <span className="text-[#ff6b35]">OpenRouter</span>{" "}
              <span className="text-foreground">Studio</span>
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Undo / Redo */}
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={undo} title="Undo (Ctrl+Z)">
              <Undo2Icon className="size-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={redo} title="Redo (Ctrl+Shift+Z)">
              <Redo2Icon className="size-3.5" />
            </Button>

            <div className="mx-1 h-4 w-px bg-studio-node-border" />

            {/* Run All */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleRunAll}
              disabled={isRunningAll || nodes.length === 0}
              title="Run all nodes in order"
            >
              <PlayIcon className="size-3.5" />
              {isRunningAll ? "Running..." : "Run All"}
            </Button>

            <div className="mx-1 h-4 w-px bg-studio-node-border" />

            {/* Cost tracker */}
            {sessionCost > 0 && (
              <button
                onClick={() => {
                  resetCost();
                  toast.success("Session cost cleared");
                }}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors"
                title="Session cost (click to reset)"
              >
                <DollarSignIcon className="size-3" />
                <span>${sessionCost.toFixed(4)}</span>
              </button>
            )}

            {/* API status */}
            <button
              onClick={() => setShowApiKey(true)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-accent transition-colors"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  apiKey ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-muted-foreground">
                {apiKey ? "API Connected" : "No API Key"}
              </span>
            </button>

            <div className="mx-1 h-4 w-px bg-studio-node-border" />

            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={toggleTheme}>
              {theme === "dark" ? <SunIcon className="size-3.5" /> : <MoonIcon className="size-3.5" />}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => {
                newWorkflow();
                toast.success("New canvas");
              }}
            >
              <PlusIcon className="size-3.5" />
              New
            </Button>

            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleSave}>
              <SaveIcon className="size-3.5" />
              Save
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex h-7 items-center justify-center gap-1 rounded-md px-3 text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <FolderOpenIcon className="size-3.5" />
                Load
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-[260px] max-w-[min(100vw-1.5rem,360px)]"
                {...getCanvasViewportFloatingProps()}
              >
                {workflows.length === 0 ? (
                  <DropdownMenuItem disabled className="text-xs">
                    No saved workflows
                  </DropdownMenuItem>
                ) : (
                  workflows.map((w) => (
                    <DropdownMenuItem
                      key={w.id}
                      className="text-xs cursor-pointer flex flex-col gap-0.5 items-stretch py-2"
                      onClick={() => {
                        loadWorkflow(w.id);
                        toast.success(`Loaded “${w.name}”`);
                      }}
                    >
                      <div className="flex justify-between gap-2 items-start w-full">
                        <span className="font-medium truncate text-left">{w.name}</span>
                        <button
                          type="button"
                          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            // Open after menu closes so the dialog isn’t dismissed by the same pointer event
                            queueMicrotask(() => {
                              setWorkflowToDelete({ id: w.id, name: w.name });
                            });
                          }}
                          aria-label={`Delete ${w.name}`}
                        >
                          <Trash2Icon className="size-3.5" />
                        </button>
                      </div>
                      <div className="text-[10px] text-muted-foreground text-left leading-snug">
                        {formatWorkflowSavedAt(w.savedAt)}
                        <span className="mx-1 opacity-50">·</span>
                        {w.nodes.length} node{w.nodes.length === 1 ? "" : "s"}
                        <span className="mx-1 opacity-50">·</span>
                        {w.edges.length} edge{w.edges.length === 1 ? "" : "s"}
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export / Import */}
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleExport} title="Export workflow as JSON">
              <DownloadIcon className="size-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleImport} title="Import workflow from JSON">
              <UploadIcon className="size-3.5" />
            </Button>

            <div className="mx-1 h-4 w-px bg-studio-node-border" />

            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleDownloadAllMedia}
              disabled={isDownloadingMediaZip}
              title="Download all images and videos as ZIP"
            >
              <FolderArchiveIcon className="size-3.5" />
              {isDownloadingMediaZip ? "Zipping..." : "Media ZIP"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileImport}
            />

            {/* User menu */}
            {session?.user && (
              <>
                <div className="mx-1 h-4 w-px bg-studio-node-border" />
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                  >
                    <UserIcon className="size-3.5" />
                    <span className="max-w-[80px] truncate text-muted-foreground">
                      {session.user.name || session.user.email}
                    </span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
                      {session.user.email}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-xs text-red-400 gap-1.5"
                      onClick={() => {
                        useStudioStore.getState().clearStudioForLogout();
                        void signOutAtCurrentOrigin("/");
                      }}
                    >
                      <LogOutIcon className="size-3" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </header>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          <NodePanel />
          <StudioCanvas />
        </div>

        <ApiKeyModal open={showApiKey} onOpenChange={setShowApiKey} />
        <SaveWorkflowDialog
          open={saveDialogOpen}
          onOpenChange={setSaveDialogOpen}
          onSave={handleConfirmSaveWorkflow}
        />
        <ExportWorkflowDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          onExport={handleConfirmExport}
        />
        <ImportWorkflowErrorDialog
          open={importErrorOpen}
          onOpenChange={setImportErrorOpen}
        />
        <DeleteWorkflowConfirmDialog
          open={workflowToDelete !== null}
          onOpenChange={(open) => {
            if (!open) setWorkflowToDelete(null);
          }}
          workflowName={workflowToDelete?.name ?? ""}
          onConfirm={() => {
            if (workflowToDelete) {
              const name = workflowToDelete.name;
              deleteWorkflow(workflowToDelete.id);
              void saveStudioSettingsToServer();
              toast.success(`Deleted “${name}”`);
            }
          }}
        />
        <ExportMediaZipDialog
          open={exportMediaZipDialogOpen}
          onOpenChange={setExportMediaZipDialogOpen}
          onExport={(options) => {
            void handleConfirmDownloadAllMedia(options);
          }}
          isExporting={isDownloadingMediaZip}
        />
      </div>
    </ReactFlowProvider>
  );
}

/** Wait for a node to finish executing (status === "done" or "error") */
function waitForNodeDone(nodeId: string, timeout = 600000): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const output = useStudioStore.getState().nodeOutputs[nodeId];
      if (output?.status === "done" || output?.status === "error" || Date.now() - start > timeout) {
        resolve();
        return;
      }
      setTimeout(check, 1000);
    };
    // Give the click a moment to register
    setTimeout(check, 500);
  });
}
