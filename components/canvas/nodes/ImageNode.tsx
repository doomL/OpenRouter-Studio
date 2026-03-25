"use client";

import { memo, useCallback, useEffect, useMemo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStudioStore } from "@/lib/store";
import { getNodeInputs, getImageRefInputs } from "@/lib/execution";
import { ModelSelector } from "@/components/ui/ModelSelector";
import { HandleLabel } from "@/components/canvas/HandleLabel";
import { getCanvasSelectContentProps } from "@/lib/canvas-floating-props";

function ImageNodeComponent({ id, data }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const setNodeOutput = useStudioStore((s) => s.setNodeOutput);
  const nodeOutput = useStudioStore((s) => s.nodeOutputs[id]);
  const edges = useStudioStore((s) => s.edges);
  const nodeOutputs = useStudioStore((s) => s.nodeOutputs);
  const apiKey = useStudioStore((s) => s.apiKey);
  const dynamicCount =
    useStudioStore((s) => s.dynamicHandleCounts[id]?.image_ref) || 1;

  const model = (data.model as string) || "";
  const aspectRatio = (data.aspectRatio as string) || "1:1";
  const refWeight = (data.refWeight as number) ?? 0.5;
  const mode = (data.mode as string) || "text2img";

  // Restore output from persisted node data on mount
  useEffect(() => {
    if (data.generatedImage && !nodeOutput?.image_url) {
      setNodeOutput(id, { image_url: data.generatedImage as string, status: "done" });
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

  const connectedRefs = useMemo(() => {
    return getImageRefInputs(id, edges, nodeOutputs).filter((r) =>
      r.handle.startsWith("image_ref_")
    );
  }, [id, edges, nodeOutputs]);

  const handleCount = Math.max(dynamicCount, connectedRefs.length + 1);

  const generate = useCallback(async () => {
    if (!model || !apiKey) return;
    setNodeOutput(id, { status: "loading" });

    try {
      const inputs = getNodeInputs(id, edges, nodeOutputs);
      const imageRefs = getImageRefInputs(id, edges, nodeOutputs);
      const prompt = inputs.prompt || "";

      const body: Record<string, unknown> = {
        model,
        prompt,
        aspect_ratio: aspectRatio,
      };

      const refUrls = imageRefs
        .filter((r) => r.handle.startsWith("image_ref_"))
        .map((r) => r.url);
      if (refUrls.length > 0 && mode === "img2img") {
        body.image = refUrls[0];
      }

      const res = await fetch("/api/openrouter/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      if (result.error) throw new Error(result.error.message || JSON.stringify(result.error));

      const imageUrl = result.data?.[0]?.url;
      if (!imageUrl) throw new Error("No image in response");

      const finalUrl = imageUrl.startsWith("data:")
        ? imageUrl
        : imageUrl.length > 1000
        ? `data:image/png;base64,${imageUrl}`
        : imageUrl;

      updateNodeData(id, { generatedImage: finalUrl });
      setNodeOutput(id, { image_url: finalUrl, status: "done" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setNodeOutput(id, { status: "error", error: msg });
    }
  }, [id, model, apiKey, edges, nodeOutputs, aspectRatio, mode, setNodeOutput]);

  return (
    <div
      className={`min-w-[260px] rounded-lg border-2 ${borderColor} bg-studio-node shadow-lg relative`}
    >
      <div className="rounded-t-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white">
        Image Generation
      </div>
      <div className="space-y-2 p-3 nopan nodrag nowheel">
        <ModelSelector
          category="image"
          value={model}
          onChange={(v) => updateNodeData(id, { model: v })}
        />

        <div>
          <Label className="text-xs text-muted-foreground">Mode</Label>
          <Select
            value={mode}
            onValueChange={(v) => v && updateNodeData(id, { mode: v })}
          >
            <SelectTrigger className="h-7 text-xs bg-studio-node-input border-studio-node-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent {...getCanvasSelectContentProps()}>
              <SelectItem value="text2img">Text to Image</SelectItem>
              <SelectItem value="img2img">Image to Image</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Aspect Ratio</Label>
          <Select
            value={aspectRatio}
            onValueChange={(v) => v && updateNodeData(id, { aspectRatio: v })}
          >
            <SelectTrigger className="h-7 text-xs bg-studio-node-input border-studio-node-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent {...getCanvasSelectContentProps()}>
              <SelectItem value="1:1">1:1</SelectItem>
              <SelectItem value="16:9">16:9</SelectItem>
              <SelectItem value="9:16">9:16</SelectItem>
              <SelectItem value="4:3">4:3</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">
            Reference Weight: {refWeight.toFixed(1)}
          </Label>
          <Slider
            value={[refWeight]}
            onValueChange={(v) => updateNodeData(id, { refWeight: Array.isArray(v) ? v[0] : v })}
            min={0}
            max={1}
            step={0.1}
            className="mt-1"
          />
        </div>

        {connectedRefs.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {connectedRefs.map((ref) => (
              <img
                key={ref.handle}
                src={ref.url}
                alt={ref.handle}
                className="h-10 w-10 rounded object-cover border border-studio-node-border"
              />
            ))}
          </div>
        )}

        <Button
          size="sm"
          className="w-full"
          onClick={generate}
          disabled={status === "loading" || !model}
        >
          {status === "loading" ? "Generating..." : "Generate"}
        </Button>

        {nodeOutput?.image_url && (
          <div className="mt-2">
            <img
              src={nodeOutput.image_url}
              alt="generated"
              className="w-full max-h-[200px] rounded object-contain bg-studio-node-input"
            />
          </div>
        )}
        {nodeOutput?.error && (
          <div className="mt-2 rounded bg-red-900/30 p-2 text-xs text-red-400">
            {nodeOutput.error}
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Left} id="prompt" style={{ top: "15%" }}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-gray-600" />
      <HandleLabel label="prompt" side="left" top="15%" />

      {Array.from({ length: handleCount }).map((_, i) => (
        <span key={`ref_group_${i + 1}`}>
          <Handle type="target" position={Position.Left}
            id={`image_ref_${i + 1}`} style={{ top: `${25 + i * 10}%` }}
            className="!w-3 !h-3 !bg-green-500 !border-2 !border-green-700" />
          <HandleLabel label={`ref ${i + 1}`} side="left" top={`${25 + i * 10}%`} />
        </span>
      ))}

      <Handle type="source" position={Position.Right} id="image_url"
        className="!w-3 !h-3 !bg-orange-400 !border-2 !border-orange-600" />
      <HandleLabel label="image out" side="right" top="50%" />
    </div>
  );
}

export const ImageNode = memo(ImageNodeComponent);
