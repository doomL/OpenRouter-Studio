"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useStudioStore } from "@/lib/store";
import { getNodeInputs, getImageRefInputs } from "@/lib/execution";
import { ModelSelector } from "@/components/ui/ModelSelector";
import { HandleLabel } from "@/components/canvas/HandleLabel";

function LLMNodeComponent({ id, data }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const setNodeOutput = useStudioStore((s) => s.setNodeOutput);
  const nodeOutput = useStudioStore((s) => s.nodeOutputs[id]);
  const edges = useStudioStore((s) => s.edges);
  const nodes = useStudioStore((s) => s.nodes);
  const nodeOutputs = useStudioStore((s) => s.nodeOutputs);
  const apiKey = useStudioStore((s) => s.apiKey);

  const addCost = useStudioStore((s) => s.addCost);

  const model = (data.model as string) || "";
  const temperature = (data.temperature as number) ?? 0.7;
  const maxTokens = (data.maxTokens as number) ?? 1024;

  // Restore output from persisted node data on mount
  useEffect(() => {
    if (data.generatedText && !nodeOutput?.text) {
      setNodeOutput(id, { text: data.generatedText as string, status: "done" });
    }
  }, []);

  const status = nodeOutput?.status || "idle";

  const borderColor =
    status === "loading"
      ? "border-yellow-500 animate-pulse"
      : status === "done"
      ? "border-green-500"
      : status === "error"
      ? "border-red-500"
      : "border-studio-node-border";

  const run = useCallback(async () => {
    if (!model || !apiKey) return;
    setNodeOutput(id, { status: "loading" });

    try {
      const inputs = getNodeInputs(id, edges, nodeOutputs);
      const imageRefs = getImageRefInputs(id, edges, nodeOutputs, nodes);

      const prompt = inputs.prompt || inputs.text || "";
      const system = inputs.system || "";

      // Build messages
      const messages: Array<Record<string, unknown>> = [];
      if (system) {
        messages.push({ role: "system", content: system });
      }

      // Check if we have an image for vision
      const imageUrl = imageRefs.find(
        (r) => r.handle === "image_url"
      )?.url;

      if (imageUrl) {
        messages.push({
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        });
      } else {
        messages.push({ role: "user", content: prompt });
      }

      const res = await fetch("/api/openrouter/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
      });

      const result = await res.json();
      if (result.error) throw new Error(result.error.message || result.error);

      const text =
        result.choices?.[0]?.message?.content || "No response";
      // Track cost from usage
      if (result.usage) {
        const promptTokens = result.usage.prompt_tokens || 0;
        const completionTokens = result.usage.completion_tokens || 0;
        // Get model pricing from store
        const models = useStudioStore.getState().models;
        const modelInfo = models?.text.find((m) => m.id === model);
        if (modelInfo?.pricing) {
          const cost =
            promptTokens * parseFloat(modelInfo.pricing.prompt || "0") +
            completionTokens * parseFloat(modelInfo.pricing.completion || "0");
          if (cost > 0) addCost(cost);
        }
      }
      updateNodeData(id, { generatedText: text });
      setNodeOutput(id, { text, status: "done" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setNodeOutput(id, { status: "error", error: msg });
    }
  }, [
    id,
    model,
    apiKey,
    edges,
    nodes,
    nodeOutputs,
    temperature,
    maxTokens,
    setNodeOutput,
    updateNodeData,
    addCost,
  ]);

  return (
    <div
      className={`min-w-[260px] rounded-lg border-2 ${borderColor} bg-studio-node shadow-lg relative`}
    >
      <div className="rounded-t-lg bg-purple-700 px-3 py-1.5 text-xs font-semibold text-white">
        LLM Chat
      </div>
      <div className="space-y-2 p-3 nopan nodrag nowheel">
        <ModelSelector
          category="text"
          value={model}
          onChange={(v) => updateNodeData(id, { model: v })}
        />

        <div>
          <Label className="text-xs text-muted-foreground">
            Temperature: {temperature.toFixed(1)}
          </Label>
          <Slider
            value={[temperature]}
            onValueChange={(v) => updateNodeData(id, { temperature: Array.isArray(v) ? v[0] : v })}
            min={0}
            max={2}
            step={0.1}
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">
            Max Tokens: {maxTokens}
          </Label>
          <Slider
            value={[maxTokens]}
            onValueChange={(v) => updateNodeData(id, { maxTokens: Array.isArray(v) ? v[0] : v })}
            min={64}
            max={16384}
            step={64}
            className="mt-1"
          />
        </div>

        <Button
          size="sm"
          className="w-full"
          onClick={run}
          disabled={status === "loading" || !model}
        >
          {status === "loading" ? "Running..." : "Run"}
        </Button>

        {/* Output preview */}
        {nodeOutput?.text && (
          <div className="mt-2 max-h-[200px] overflow-auto rounded bg-studio-node-input p-2 text-xs text-muted-foreground whitespace-pre-wrap">
            {nodeOutput.text}
          </div>
        )}
        {nodeOutput?.error && (
          <div className="mt-2 rounded bg-red-900/30 p-2 text-xs text-red-400">
            {nodeOutput.error}
          </div>
        )}
      </div>

      {/* Input handles */}
      <Handle type="target" position={Position.Left} id="prompt" style={{ top: "30%" }}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-gray-600" />
      <HandleLabel label="prompt" side="left" top="30%" />

      <Handle type="target" position={Position.Left} id="system" style={{ top: "45%" }}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-gray-600" />
      <HandleLabel label="system" side="left" top="45%" />

      <Handle type="target" position={Position.Left} id="image_url" style={{ top: "60%" }}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-green-700" />
      <HandleLabel label="image (vision)" side="left" top="60%" />

      {/* Output handle */}
      <Handle type="source" position={Position.Right} id="text"
        className="!w-3 !h-3 !bg-purple-400 !border-2 !border-purple-600" />
      <HandleLabel label="text out" side="right" top="50%" />
    </div>
  );
}

export const LLMNode = memo(LLMNodeComponent);
