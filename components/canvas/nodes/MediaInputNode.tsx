"use client";

import { memo, useCallback, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadIcon } from "lucide-react";
import { useStudioStore } from "@/lib/store";
import { HandleLabel } from "@/components/canvas/HandleLabel";
import { readJsonResponse } from "@/lib/read-json-response";

type MediaType = "none" | "image" | "video";

function MediaInputNodeComponent({ id, data }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const setNodeOutput = useStudioStore((s) => s.setNodeOutput);
  const apiKey = useStudioStore((s) => s.apiKey);
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const preview = (data.preview as string) || "";
  const mediaType = (data.mediaType as MediaType) || "none";
  const nodeLabel = (data.label as string) || "Media Input";
  const urlInput = (data.urlInput as string) || "";

  const processFile = useCallback(
    async (file: File) => {
      if (file.size > 100 * 1024 * 1024) {
        alert("File too large (max 100MB)");
        return;
      }

      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isVideo && !isImage) {
        alert("Unsupported file type. Use image or video files.");
        return;
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      if (isImage) {
        const base64 = dataUrl.split(",")[1];
        updateNodeData(id, {
          preview: dataUrl,
          mediaType: "image",
          fileName: file.name,
        });
        setNodeOutput(id, {
          image_url: dataUrl,
          image_base64: base64,
          status: "done",
        });
      } else {
        // For video: create a blob URL for playback, store the data URL for transfer
        const blobUrl = URL.createObjectURL(file);
        updateNodeData(id, {
          preview: blobUrl,
          mediaType: "video",
          fileName: file.name,
          videoDataUrl: dataUrl,
        });
        setNodeOutput(id, {
          video_url: blobUrl,
          status: "done",
        });
      }
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
    // Try to detect if it's a video URL
    const isVideo = /\.(mp4|webm|mov|avi)(\?|$)/i.test(urlInput);

    if (isVideo) {
      updateNodeData(id, {
        preview: urlInput,
        mediaType: "video",
      });
      setNodeOutput(id, { video_url: urlInput, status: "done" });
    } else {
      updateNodeData(id, {
        preview: urlInput,
        mediaType: "image",
      });
      setNodeOutput(id, { image_url: urlInput, status: "done" });
    }
  }, [id, urlInput, updateNodeData, setNodeOutput]);

  const handleFetchBase64 = useCallback(async () => {
    if (!urlInput || mediaType !== "image") return;
    setLoading(true);
    try {
      const res = await fetch("/api/utils/fetch-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ url: urlInput }),
      });
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
      updateNodeData(id, { preview: dataUrl, mediaType: "image" });
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
  }, [id, urlInput, mediaType, apiKey, updateNodeData, setNodeOutput]);

  const handleClear = useCallback(() => {
    updateNodeData(id, {
      preview: "",
      mediaType: "none",
      fileName: "",
      urlInput: "",
      videoDataUrl: "",
    });
    setNodeOutput(id, { status: "idle" });
  }, [id, updateNodeData, setNodeOutput]);

  return (
    <div className="min-w-[240px] max-w-[280px] rounded-lg border border-studio-node-border bg-studio-node shadow-lg relative">
      <div className="rounded-t-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <UploadIcon className="size-3" />
          <span>{nodeLabel}</span>
        </div>
        <input
          className="bg-transparent text-right text-[10px] text-teal-200 w-20 outline-none placeholder:text-teal-300/50 nopan nodrag"
          value={nodeLabel === "Media Input" ? "" : nodeLabel}
          onChange={(e) =>
            updateNodeData(id, { label: e.target.value || "Media Input" })
          }
          placeholder="Label..."
        />
      </div>
      <div className="space-y-2 p-3 nopan nodrag nowheel">
        {/* Preview area */}
        <div
          className="flex h-[130px] w-full cursor-pointer items-center justify-center rounded border border-dashed border-muted-foreground/30 bg-studio-node-input overflow-hidden"
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          {mediaType === "image" && preview ? (
            <img src={preview} alt="preview" className="h-full w-full object-cover" />
          ) : mediaType === "video" && preview ? (
            <video
              src={preview}
              className="h-full w-full object-cover"
              muted
              playsInline
              onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
              onMouseLeave={(e) => {
                const v = e.target as HTMLVideoElement;
                v.pause();
                v.currentTime = 0;
              }}
            />
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
              <UploadIcon className="size-6 opacity-50" />
              <span className="text-xs">Drop image or video</span>
              <span className="text-[10px] opacity-60">PNG, JPG, MP4, WEBM...</span>
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* File name */}
        {data.fileName ? (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground truncate flex-1">
              {String(data.fileName)}
            </span>
            <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1 text-red-400"
              onClick={handleClear}>
              Clear
            </Button>
          </div>
        ) : null}

        {/* URL input */}
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
          {urlInput && mediaType === "image" && (
            <Button size="sm" variant="ghost" className="mt-1 h-6 text-[10px] w-full"
              onClick={handleFetchBase64} disabled={loading}>
              {loading ? "Fetching..." : "Fetch & Convert to Base64"}
            </Button>
          )}
        </div>

        {/* Media type badge */}
        {mediaType !== "none" && (
          <div className="flex items-center gap-1">
            <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium ${
              mediaType === "image" ? "bg-green-900/40 text-green-400" : "bg-blue-900/40 text-blue-400"
            }`}>
              {mediaType === "image" ? "IMAGE" : "VIDEO"}
            </span>
          </div>
        )}
      </div>

      {/* Output handles */}
      <Handle type="source" position={Position.Right} id="image_url" style={{ top: "35%" }}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-green-700" />
      <HandleLabel label="image url" side="right" top="35%" />

      <Handle type="source" position={Position.Right} id="image_base64" style={{ top: "50%" }}
        className="!w-3 !h-3 !bg-green-400 !border-2 !border-green-700" />
      <HandleLabel label="base64" side="right" top="50%" />

      <Handle type="source" position={Position.Right} id="video_url" style={{ top: "65%" }}
        className="!w-3 !h-3 !bg-blue-400 !border-2 !border-blue-600" />
      <HandleLabel label="video url" side="right" top="65%" />
    </div>
  );
}

export const MediaInputNode = memo(MediaInputNodeComponent);
