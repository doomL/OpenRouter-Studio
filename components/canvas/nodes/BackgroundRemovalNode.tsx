"use client";

import { memo, useCallback, useEffect } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStudioStore } from "@/lib/store";
import { getNodeInputs } from "@/lib/execution";
import { ModelSelector } from "@/components/ui/ModelSelector";
import { HandleLabel } from "@/components/canvas/HandleLabel";
import { readJsonResponse } from "@/lib/read-json-response";
import { fetchWithRetry, STUDIO_FETCH_MAX_ATTEMPTS } from "@/lib/fetch-with-retry";
import { modalitiesForImageRequest } from "@/lib/models";

const DEFAULT_PROMPT =
  "Place the subject on a flat solid chroma background, with sharp subject boundaries and no shadows.";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const safe = hex.trim().replace(/^#/, "");
  const full = safe.length === 3
    ? safe.split("").map((c) => `${c}${c}`).join("")
    : safe.padEnd(6, "0").slice(0, 6);
  const n = Number.parseInt(full, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load generated image"));
    img.src = src;
  });
}

async function applyChromaKey(
  sourceUrl: string,
  keyColorHex: string,
  tolerance: number,
  softness: number
): Promise<string> {
  const img = await loadImage(sourceUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  ctx.drawImage(img, 0, 0);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const key = hexToRgb(keyColorHex);
  const edge = Math.max(1, softness);
  const maxDist = Math.sqrt(255 * 255 * 3);

  for (let i = 0; i < frame.data.length; i += 4) {
    const r = frame.data[i];
    const g = frame.data[i + 1];
    const b = frame.data[i + 2];
    const dist = Math.sqrt(
      (r - key.r) * (r - key.r) +
      (g - key.g) * (g - key.g) +
      (b - key.b) * (b - key.b)
    );
    const score = (dist / maxDist) * 255;
    if (score <= tolerance) {
      frame.data[i + 3] = 0;
    } else if (score <= tolerance + edge) {
      const keep = (score - tolerance) / edge;
      frame.data[i + 3] = Math.round(frame.data[i + 3] * keep);
    }
  }

  ctx.putImageData(frame, 0, 0);
  return canvas.toDataURL("image/png");
}

function BackgroundRemovalNodeComponent({ id, data }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const setNodeOutput = useStudioStore((s) => s.setNodeOutput);
  const nodeOutput = useStudioStore((s) => s.nodeOutputs[id]);
  const edges = useStudioStore((s) => s.edges);
  const nodeOutputs = useStudioStore((s) => s.nodeOutputs);
  const apiKey = useStudioStore((s) => s.apiKey);

  const model = (data.model as string) || "";
  const nodeLabel = (data.label as string) || "Background Remove";
  const instruction = (data.instruction as string) || DEFAULT_PROMPT;
  const keyColor = (data.keyColor as string) || "#00ff00";
  const tolerance = Number(data.tolerance ?? 35);
  const softness = Number(data.softness ?? 30);
  const preKeyImage = (data.preKeyImage as string) || "";
  const autoPreview = data.autoPreview !== false;

  const status = nodeOutput?.status || "idle";
  const borderColor =
    status === "loading"
      ? "border-yellow-500 animate-pulse"
      : status === "done"
        ? "border-green-500"
        : status === "error"
          ? "border-red-500"
          : "border-studio-node-border";

  useEffect(() => {
    if (!preKeyImage || !autoPreview) return;
    let cancelled = false;
    void (async () => {
      try {
        const preview = await applyChromaKey(
          preKeyImage,
          keyColor,
          Number.isFinite(tolerance) ? tolerance : 35,
          Number.isFinite(softness) ? softness : 30
        );
        if (cancelled) return;
        updateNodeData(id, { outputImage: preview });
        setNodeOutput(id, { image_url: preview, status: "done" });
      } catch {
        // Keep last good preview if live recalculation fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    id,
    preKeyImage,
    autoPreview,
    keyColor,
    tolerance,
    softness,
    updateNodeData,
    setNodeOutput,
  ]);

  const run = useCallback(async () => {
    if (!model || !apiKey) return;
    const inputs = getNodeInputs(id, edges, nodeOutputs);
    const sourceImage = inputs.image_url;
    if (!sourceImage) {
      setNodeOutput(id, { status: "error", error: "No image input connected" });
      return;
    }

    setNodeOutput(id, {
      ...nodeOutputs[id],
      status: "loading",
      error: undefined,
    });
    try {
      const basePrompt = (inputs.prompt || instruction || DEFAULT_PROMPT).trim();
      const prompt = `${basePrompt}\nUse this exact background color: ${keyColor}.`;
      const res = await fetchWithRetry(
        "/api/openrouter/image",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            model,
            prompt,
            mode: "img2img",
            images: [sourceImage],
            modalities: modalitiesForImageRequest(),
          }),
        },
        { maxAttempts: STUDIO_FETCH_MAX_ATTEMPTS }
      );

      const result = await readJsonResponse<{
        error?: unknown;
        data?: Array<{ url?: string }>;
        message?: string;
      }>(res);

      if (!res.ok) {
        const errField = result.error;
        if (typeof errField === "string") {
          throw new Error(`${errField} (HTTP ${res.status})`);
        }
        if (errField && typeof errField === "object") {
          const o = errField as { message?: string; hint?: string };
          let msg =
            typeof o.message === "string" ? o.message : JSON.stringify(errField);
          if (typeof o.hint === "string" && o.hint.trim()) {
            msg += `\n\n${o.hint.trim()}`;
          }
          throw new Error(`${msg} (HTTP ${res.status})`);
        }
        if (typeof result.message === "string" && result.message.trim()) {
          throw new Error(`${result.message} (HTTP ${res.status})`);
        }
        throw new Error(`Background removal failed (HTTP ${res.status})`);
      }

      const imageUrl = result.data?.[0]?.url;
      if (!imageUrl) throw new Error("No output image from model");

      const generatedUrl = imageUrl.startsWith("data:")
        ? imageUrl
        : imageUrl.length > 1000
          ? `data:image/png;base64,${imageUrl}`
          : imageUrl;
      const preKeyUrl = generatedUrl;
      const finalUrl = await applyChromaKey(
        preKeyUrl,
        keyColor,
        Number.isFinite(tolerance) ? tolerance : 35,
        Number.isFinite(softness) ? softness : 30
      );

      updateNodeData(id, { preKeyImage: preKeyUrl, outputImage: finalUrl });
      setNodeOutput(id, { image_url: finalUrl, status: "done" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setNodeOutput(id, {
        ...useStudioStore.getState().nodeOutputs[id],
        status: "error",
        error: msg,
      });
    }
  }, [
    model,
    apiKey,
    id,
    edges,
    nodeOutputs,
    instruction,
    keyColor,
    tolerance,
    softness,
    setNodeOutput,
    updateNodeData,
  ]);

  return (
    <div
      className={`min-w-[260px] rounded-lg border-2 ${borderColor} bg-studio-node shadow-lg relative`}
    >
      <div className="rounded-t-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white flex items-center justify-between gap-2">
        <span>{nodeLabel}</span>
        <Input
          value={nodeLabel === "Background Remove" ? "" : nodeLabel}
          onChange={(e) =>
            updateNodeData(id, { label: e.target.value || "Background Remove" })
          }
          placeholder="Label..."
          className="h-5 w-28 border-0 bg-transparent px-1 text-[10px] text-right text-emerald-100 placeholder:text-emerald-200/60 focus-visible:ring-0"
        />
      </div>

      <div className="space-y-2 p-3 nopan nodrag nowheel">
        <ModelSelector
          category="image"
          value={model}
          onChange={(v) => updateNodeData(id, { model: v })}
        />
        <div>
          <Label className="text-xs text-muted-foreground">Instruction</Label>
          <Textarea
            value={instruction}
            onChange={(e) => updateNodeData(id, { instruction: e.target.value })}
            className="min-h-[70px] text-xs bg-studio-node-input border-studio-node-border"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            The selected key color is injected automatically into the prompt.
          </p>
        </div>
        <div className="rounded border border-studio-node-border p-2 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-muted-foreground">Auto-preview</Label>
            <input
              type="checkbox"
              checked={autoPreview}
              onChange={(e) => updateNodeData(id, { autoPreview: e.target.checked })}
              className="h-3.5 w-3.5 accent-emerald-500"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-muted-foreground">Key color</Label>
            <Input
              type="color"
              value={keyColor}
              onChange={(e) => updateNodeData(id, { keyColor: e.target.value })}
              className="h-7 w-16 p-1 bg-studio-node-input border-studio-node-border"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Tolerance</Label>
              <span className="text-[10px] text-muted-foreground">{tolerance}</span>
            </div>
            <Input
              type="range"
              min={0}
              max={120}
              value={tolerance}
              onChange={(e) =>
                updateNodeData(id, { tolerance: Number.parseInt(e.target.value, 10) || 0 })
              }
              className="h-6"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Soft edge</Label>
              <span className="text-[10px] text-muted-foreground">{softness}</span>
            </div>
            <Input
              type="range"
              min={1}
              max={120}
              value={softness}
              onChange={(e) =>
                updateNodeData(id, { softness: Number.parseInt(e.target.value, 10) || 1 })
              }
              className="h-6"
            />
          </div>
        </div>

        <Button size="sm" className="w-full" onClick={run} disabled={status === "loading" || !model}>
          {status === "loading" ? "Processing..." : "Remove Background"}
        </Button>

        {nodeOutput?.image_url && (
          <div className="mt-2">
            <img
              src={nodeOutput.image_url}
              alt="background removed"
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

      <Handle
        type="target"
        position={Position.Left}
        id="image_url"
        style={{ top: "35%" }}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-green-700"
      />
      <HandleLabel label="image in" side="left" top="35%" />

      <Handle
        type="target"
        position={Position.Left}
        id="prompt"
        style={{ top: "65%" }}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-gray-600"
      />
      <HandleLabel label="prompt (opt)" side="left" top="65%" />

      <Handle
        type="source"
        position={Position.Right}
        id="image_url"
        className="!w-3 !h-3 !bg-emerald-400 !border-2 !border-emerald-600"
      />
      <HandleLabel label="image out" side="right" top="50%" />
    </div>
  );
}

export const BackgroundRemovalNode = memo(BackgroundRemovalNodeComponent);
