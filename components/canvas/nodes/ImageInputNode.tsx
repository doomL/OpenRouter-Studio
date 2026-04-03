"use client";

import { memo, useCallback, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStudioStore } from "@/lib/store";
import { HandleLabel } from "@/components/canvas/HandleLabel";
import { readJsonResponse } from "@/lib/read-json-response";
import { fetchWithRetry, STUDIO_FETCH_MAX_ATTEMPTS } from "@/lib/fetch-with-retry";

function ImageInputNodeComponent({ id, data }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const setNodeOutput = useStudioStore((s) => s.setNodeOutput);
  const apiKey = useStudioStore((s) => s.apiKey);
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const imagePreview = (data.imagePreview as string) || "";
  const nodeLabel = (data.label as string) || "Image Input";
  const urlInput = (data.urlInput as string) || "";

  const processFile = useCallback(
    async (file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        alert("File too large (max 10MB)");
        return;
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const base64 = dataUrl.split(",")[1];
      updateNodeData(id, { imageUrl: dataUrl, imagePreview: dataUrl });
      setNodeOutput(id, {
        image_url: dataUrl,
        image_base64: base64,
        status: "done",
      });
    },
    [id, updateNodeData, setNodeOutput]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleUrlSet = useCallback(() => {
    if (!urlInput) return;
    updateNodeData(id, { imageUrl: urlInput, imagePreview: urlInput });
    setNodeOutput(id, { image_url: urlInput, status: "done" });
  }, [id, urlInput, updateNodeData, setNodeOutput]);

  const handleFetchBase64 = useCallback(async () => {
    if (!urlInput) return;
    setLoading(true);
    try {
      const res = await fetchWithRetry(
        "/api/utils/fetch-image",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey },
          body: JSON.stringify({ url: urlInput }),
        },
        { maxAttempts: STUDIO_FETCH_MAX_ATTEMPTS }
      );
      const body = await readJsonResponse<{
        base64?: string;
        mimeType?: string;
        error?: string;
      }>(res);
      if (!res.ok || body.error || !body.base64 || !body.mimeType) {
        alert(body.error || `Failed to fetch image (${res.status})`);
        return;
      }
      const { base64, mimeType } = body;
      const dataUrl = `data:${mimeType};base64,${base64}`;
      updateNodeData(id, { imageUrl: dataUrl, imagePreview: dataUrl });
      setNodeOutput(id, {
        image_url: dataUrl,
        image_base64: base64,
        status: "done",
      });
    } catch {
      alert("Failed to fetch image");
    } finally {
      setLoading(false);
    }
  }, [id, urlInput, apiKey, updateNodeData, setNodeOutput]);

  return (
    <div className="min-w-[220px] max-w-[260px] rounded-lg border border-studio-node-border bg-studio-node shadow-lg relative">
      <div className="rounded-t-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white flex items-center justify-between">
        <span>{nodeLabel}</span>
        <input
          className="bg-transparent text-right text-[10px] text-green-200 w-20 outline-none placeholder:text-green-300/50 nopan nodrag"
          value={nodeLabel === "Image Input" ? "" : nodeLabel}
          onChange={(e) =>
            updateNodeData(id, { label: e.target.value || "Image Input" })
          }
          placeholder="Label..."
        />
      </div>
      <div className="space-y-2 p-3 nopan nodrag nowheel">
        <div
          className="flex h-[120px] w-full cursor-pointer items-center justify-center rounded border border-dashed border-muted-foreground/30 bg-studio-node-input overflow-hidden"
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          {imagePreview ? (
            <img src={imagePreview} alt="preview" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-muted-foreground">Drop image or click</span>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />
        <div>
          <Label className="text-xs text-muted-foreground">Or paste URL</Label>
          <div className="mt-1 flex gap-1">
            <Input
              value={urlInput}
              onChange={(e) => updateNodeData(id, { urlInput: e.target.value })}
              placeholder="https://..."
              className="h-7 text-xs bg-studio-node-input border-studio-node-border flex-1"
            />
            <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={handleUrlSet}>
              Set
            </Button>
          </div>
          {urlInput && (
            <Button size="sm" variant="ghost" className="mt-1 h-6 text-[10px] w-full"
              onClick={handleFetchBase64} disabled={loading}>
              {loading ? "Fetching..." : "Fetch & Convert to Base64"}
            </Button>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Right} id="image_url" style={{ top: "45%" }}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-green-700" />
      <HandleLabel label="image url" side="right" top="45%" />

      <Handle type="source" position={Position.Right} id="image_base64" style={{ top: "65%" }}
        className="!w-3 !h-3 !bg-green-400 !border-2 !border-green-700" />
      <HandleLabel label="base64" side="right" top="65%" />
    </div>
  );
}

export const ImageInputNode = memo(ImageInputNodeComponent);
