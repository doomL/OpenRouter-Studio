"use client";

import { memo, useCallback, useEffect, useMemo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { modalitiesForImageRequest } from "@/lib/models";
import { readJsonResponse } from "@/lib/read-json-response";
import { fetchWithRetry, STUDIO_FETCH_MAX_ATTEMPTS } from "@/lib/fetch-with-retry";

function ImageNodeComponent({ id, data }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const setNodeOutput = useStudioStore((s) => s.setNodeOutput);
  const nodeOutput = useStudioStore((s) => s.nodeOutputs[id]);
  const edges = useStudioStore((s) => s.edges);
  const nodes = useStudioStore((s) => s.nodes);
  const nodeOutputs = useStudioStore((s) => s.nodeOutputs);
  const apiKey = useStudioStore((s) => s.apiKey);
  const dynamicCount =
    useStudioStore((s) => s.dynamicHandleCounts[id]?.image_ref) || 1;

  const model = (data.model as string) || "";
  const nodeLabel = (data.label as string) || "Image Generation";
  const aspectRatio = (data.aspectRatio as string) || "1:1";
  const imageSize = (data.imageSize as string) || "1K";
  const mode = (data.mode as string) || "text2img";
  const font1Url = (data.font1Url as string) || "";
  const font1Text = (data.font1Text as string) || "";
  const font2Url = (data.font2Url as string) || "";
  const font2Text = (data.font2Text as string) || "";
  const superResolutionRefsText = (data.superResolutionRefsText as string) || "";

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
    return getImageRefInputs(id, edges, nodeOutputs, nodes).filter((r) =>
      r.handle.startsWith("image_ref_")
    );
  }, [id, edges, nodeOutputs, nodes]);
  const isSourcefulModel = model.startsWith("sourceful/");

  const handleCount = Math.max(dynamicCount, connectedRefs.length + 1);

  const generate = useCallback(async () => {
    if (!model || !apiKey) return;
    setNodeOutput(id, { status: "loading" });

    try {
      const inputs = getNodeInputs(id, edges, nodeOutputs);
      const imageRefs = getImageRefInputs(id, edges, nodeOutputs, nodes);
      const prompt = inputs.prompt || "";

      const body: Record<string, unknown> = {
        model,
        prompt,
        mode,
        aspect_ratio: aspectRatio,
        image_size: imageSize,
        modalities: modalitiesForImageRequest(),
      };

      const refUrls = imageRefs
        .filter((r) => r.handle.startsWith("image_ref_"))
        .sort((a, b) => {
          const na = parseInt(a.handle.replace(/^image_ref_/, ""), 10) || 0;
          const nb = parseInt(b.handle.replace(/^image_ref_/, ""), 10) || 0;
          return na - nb;
        })
        .map((r) => r.url);
      if (refUrls.length > 0) {
        body.images = refUrls;
      }

      if (isSourcefulModel) {
        const fontInputs = [
          { font_url: font1Url.trim(), text: font1Text.trim() },
          { font_url: font2Url.trim(), text: font2Text.trim() },
        ].filter((x) => x.font_url.length > 0 && x.text.length > 0);

        const superResolutionRefs = superResolutionRefsText
          .split(/\r?\n|,/)
          .map((x) => x.trim())
          .filter((x) => x.length > 0)
          .slice(0, 4);

        if (fontInputs.length > 0) body.font_inputs = fontInputs.slice(0, 2);
        if (superResolutionRefs.length > 0) {
          body.super_resolution_references = superResolutionRefs;
        }
      }

      const res = await fetchWithRetry(
        "/api/openrouter/image",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify(body),
        },
        { maxAttempts: STUDIO_FETCH_MAX_ATTEMPTS }
      );

      const result = await readJsonResponse<{
        error?: unknown;
        data?: Array<{ url?: string }>;
        message?: string;
      }>(res);

      // 502/504 from nginx often omit our `error` shape — don't mis-report as "no image".
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
        throw new Error(
          `Image request failed (HTTP ${res.status}). If this happens almost instantly, your reverse proxy may be returning 502 before the app finishes — increase proxy_read_timeout (see deploy/nginx-reverse-proxy.example.conf). Body: ${JSON.stringify(result).slice(0, 500)}`
        );
      }

      if (result.error) {
        const err = result.error as { message?: string; hint?: string };
        let msg =
          typeof err === "string"
            ? err
            : typeof err?.message === "string"
              ? err.message
              : JSON.stringify(err);
        if (typeof err?.hint === "string" && err.hint.trim()) {
          msg += `\n\n${err.hint.trim()}`;
        }
        throw new Error(msg);
      }

      const imageUrl = result.data?.[0]?.url;
      if (!imageUrl) {
        throw new Error(
          "No image URL in response (unexpected shape). Check the Network tab for /api/openrouter/image — if status is 502, fix proxy timeouts; if 200, try another image-capable model."
        );
      }

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
  }, [
    id,
    model,
    apiKey,
    edges,
    nodes,
    nodeOutputs,
    aspectRatio,
    imageSize,
    mode,
    isSourcefulModel,
    font1Url,
    font1Text,
    font2Url,
    font2Text,
    superResolutionRefsText,
    setNodeOutput,
    updateNodeData,
  ]);

  return (
    <div
      className={`min-w-[260px] rounded-lg border-2 ${borderColor} bg-studio-node shadow-lg relative`}
    >
      <div className="rounded-t-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white flex items-center justify-between gap-2">
        <span>{nodeLabel}</span>
        <Input
          value={nodeLabel === "Image Generation" ? "" : nodeLabel}
          onChange={(e) =>
            updateNodeData(id, { label: e.target.value || "Image Generation" })
          }
          placeholder="Label..."
          className="h-5 w-24 border-0 bg-transparent px-1 text-[10px] text-right text-orange-100 placeholder:text-orange-200/60 focus-visible:ring-0"
        />
      </div>
      <div className="space-y-2 p-3 nopan nodrag nowheel">
        <ModelSelector
          category="image"
          value={model}
          onChange={(v) => updateNodeData(id, { model: v })}
        />

        <div>
          <Label className="text-xs text-muted-foreground">Mode</Label>
          <p className="text-[10px] text-muted-foreground/90 leading-tight mb-1">
            Reference inputs are sent in both modes; use Image→Image when you want edit-style defaults.
          </p>
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
              <SelectItem value="2:3">2:3</SelectItem>
              <SelectItem value="3:2">3:2</SelectItem>
              <SelectItem value="3:4">3:4</SelectItem>
              <SelectItem value="16:9">16:9</SelectItem>
              <SelectItem value="9:16">9:16</SelectItem>
              <SelectItem value="4:3">4:3</SelectItem>
              <SelectItem value="4:5">4:5</SelectItem>
              <SelectItem value="5:4">5:4</SelectItem>
              <SelectItem value="21:9">21:9</SelectItem>
              <SelectItem value="1:4">1:4</SelectItem>
              <SelectItem value="4:1">4:1</SelectItem>
              <SelectItem value="1:8">1:8</SelectItem>
              <SelectItem value="8:1">8:1</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Image Size</Label>
          <Select
            value={imageSize}
            onValueChange={(v) => v && updateNodeData(id, { imageSize: v })}
          >
            <SelectTrigger className="h-7 text-xs bg-studio-node-input border-studio-node-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent {...getCanvasSelectContentProps()}>
              <SelectItem value="0.5K">0.5K</SelectItem>
              <SelectItem value="1K">1K</SelectItem>
              <SelectItem value="2K">2K</SelectItem>
              <SelectItem value="4K">4K</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isSourcefulModel && (
          <>
            <div className="rounded border border-studio-node-border p-2 space-y-2">
              <p className="text-[10px] text-muted-foreground">
                Sourceful: Font Inputs (max 2)
              </p>
              <div>
                <Label className="text-[10px] text-muted-foreground">Font 1 URL</Label>
                <Input
                  type="url"
                  value={font1Url}
                  onChange={(e) => updateNodeData(id, { font1Url: e.target.value })}
                  placeholder="https://example.com/font.ttf"
                  className="h-7 text-xs bg-studio-node-input border-studio-node-border"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Font 1 Text</Label>
                <Input
                  type="text"
                  value={font1Text}
                  onChange={(e) => updateNodeData(id, { font1Text: e.target.value })}
                  placeholder="Headline text"
                  className="h-7 text-xs bg-studio-node-input border-studio-node-border"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Font 2 URL</Label>
                <Input
                  type="url"
                  value={font2Url}
                  onChange={(e) => updateNodeData(id, { font2Url: e.target.value })}
                  placeholder="https://example.com/font2.ttf"
                  className="h-7 text-xs bg-studio-node-input border-studio-node-border"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Font 2 Text</Label>
                <Input
                  type="text"
                  value={font2Text}
                  onChange={(e) => updateNodeData(id, { font2Text: e.target.value })}
                  placeholder="Subheadline text"
                  className="h-7 text-xs bg-studio-node-input border-studio-node-border"
                />
              </div>
            </div>

            <div className="rounded border border-studio-node-border p-2 space-y-1">
              <Label className="text-[10px] text-muted-foreground">
                Sourceful: Super Resolution References (max 4, one URL per line)
              </Label>
              <Textarea
                value={superResolutionRefsText}
                onChange={(e) =>
                  updateNodeData(id, { superResolutionRefsText: e.target.value })
                }
                placeholder={"https://example.com/ref1.jpg\nhttps://example.com/ref2.jpg"}
                className="min-h-[64px] text-xs bg-studio-node-input border-studio-node-border"
              />
              {mode !== "img2img" && (
                <p className="text-[9px] text-muted-foreground">
                  Used by Sourceful in Image to Image mode.
                </p>
              )}
            </div>
          </>
        )}

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
