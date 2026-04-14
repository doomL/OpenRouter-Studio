"use client";

import { memo, useCallback, useEffect } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStudioStore } from "@/lib/store";
import { HandleLabel } from "@/components/canvas/HandleLabel";

function PromptNodeComponent({ id, data }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const setNodeOutput = useStudioStore((s) => s.setNodeOutput);

  const prompt = (data.prompt as string) || "";
  const systemPrompt = (data.systemPrompt as string) || "";
  const nodeLabel = (data.label as string) || "Prompt";

  // Sync output on mount (covers page refresh / workflow load)
  useEffect(() => {
    setNodeOutput(id, { text: prompt, system: systemPrompt, status: "done" });
  }, []);

  const handlePromptChange = useCallback(
    (value: string) => {
      updateNodeData(id, { prompt: value });
      setNodeOutput(id, { text: value, system: systemPrompt, status: "done" });
    },
    [id, systemPrompt, updateNodeData, setNodeOutput]
  );

  const handleSystemChange = useCallback(
    (value: string) => {
      updateNodeData(id, { systemPrompt: value });
      setNodeOutput(id, { text: prompt, system: value, status: "done" });
    },
    [id, prompt, updateNodeData, setNodeOutput]
  );

  return (
    <div
      className="min-w-[240px] w-max max-w-[min(100vw-1rem,90vw)] rounded-lg border border-studio-node-border bg-studio-node shadow-lg"
      style={{ position: "relative" }}
    >
      <div className="rounded-t-lg bg-gray-600 px-3 py-1.5 text-xs font-semibold text-white flex items-center justify-between gap-2">
        <span>{nodeLabel}</span>
        <Input
          value={nodeLabel === "Prompt" ? "" : nodeLabel}
          onChange={(e) => updateNodeData(id, { label: e.target.value || "Prompt" })}
          placeholder="Label..."
          className="h-5 w-24 border-0 bg-transparent px-1 text-[10px] text-right text-gray-200 placeholder:text-gray-300/60 focus-visible:ring-0"
        />
      </div>
      <div className="w-full min-w-[240px] space-y-2 p-3 nopan nodrag nowheel">
        <div className="w-full">
          <Label className="text-xs text-muted-foreground">System Prompt</Label>
          <Input
            value={systemPrompt}
            onChange={(e) => handleSystemChange(e.target.value)}
            placeholder="Optional system prompt..."
            className="mt-1 h-7 w-full min-w-0 text-xs bg-studio-node-input border-studio-node-border"
          />
        </div>
        <div className="w-max max-w-full">
          <Label className="text-xs text-muted-foreground">User Prompt</Label>
          <Textarea
            value={prompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            placeholder="Enter your prompt..."
            rows={5}
            cols={28}
            className="nodrag nopan nowheel mt-1 min-h-[7.5rem] min-w-[240px] w-auto max-w-[min(100vw-2rem,90vw)] text-xs bg-studio-node-input border-studio-node-border"
          />
        </div>
      </div>

      <Handle type="source" position={Position.Right} id="system" style={{ top: "30%" }}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-gray-600" />
      <HandleLabel label="system" side="right" top="30%" />

      <Handle type="source" position={Position.Right} id="prompt" style={{ top: "70%" }}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-gray-600" />
      <HandleLabel label="prompt" side="right" top="70%" />
    </div>
  );
}

export const PromptNode = memo(PromptNodeComponent);
