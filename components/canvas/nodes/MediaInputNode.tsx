"use client";

import { memo, useCallback, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LibraryIcon, UploadIcon } from "lucide-react";
import { useStudioStore } from "@/lib/store";
import { HandleLabel } from "@/components/canvas/HandleLabel";
import { readJsonResponse } from "@/lib/read-json-response";
import { fetchWithRetry, STUDIO_FETCH_MAX_ATTEMPTS } from "@/lib/fetch-with-retry";
import { NodeMediaHistoryButton } from "@/components/studio/NodeMediaHistoryButton";
import { StudioMediaPickerDialog } from "@/components/studio/StudioMediaPickerDialog";
import { pickInlineOrBlobUrl, studioBlobFetchUrl } from "@/lib/studio-node-media-url";

type MediaType = "none" | "image" | "video" | "audio";

function MediaInputNodeComponent({ id, data }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const setNodeOutput = useStudioStore((s) => s.setNodeOutput);
  const apiKey = useStudioStore((s) => s.apiKey);
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const preview =
    pickInlineOrBlobUrl(
      (data.preview as string) || undefined,
      data.previewBlobId as string | undefined
    ) || "";
  const videoDataResolved =
    pickInlineOrBlobUrl(
      (data.videoDataUrl as string) || undefined,
      data.videoDataUrlBlobId as string | undefined
    ) || "";
  const audioResolved =
    pickInlineOrBlobUrl(
      (data.audioDataUrl as string) || undefined,
      data.audioDataUrlBlobId as string | undefined
    ) || "";
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
      const isAudio = file.type.startsWith("audio/");
      if (!isVideo && !isImage && !isAudio) {
        alert("Unsupported file type. Use image, video, or audio files.");
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
          audioDataUrl: "",
          audioDataUrlBlobId: undefined,
        });
        setNodeOutput(id, {
          image_url: dataUrl,
          image_base64: base64,
          status: "done",
        });
      } else if (isAudio) {
        updateNodeData(id, {
          preview: "",
          previewBlobId: undefined,
          mediaType: "audio",
          fileName: file.name,
          videoDataUrl: "",
          videoDataUrlBlobId: undefined,
          audioDataUrl: dataUrl,
          audioDataUrlBlobId: undefined,
          urlInput: "",
        });
        setNodeOutput(id, {
          audio_url: dataUrl,
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
          audioDataUrl: "",
          audioDataUrlBlobId: undefined,
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
    const isVideo = /\.(mp4|webm|mov|avi)(\?|$)/i.test(urlInput);
    const isAudio = /\.(mp3|wav|ogg|m4a|aac|flac|opus|webm)(\?|$)/i.test(urlInput);

    if (isVideo) {
      updateNodeData(id, {
        preview: urlInput,
        mediaType: "video",
        audioDataUrl: "",
        audioDataUrlBlobId: undefined,
      });
      setNodeOutput(id, { video_url: urlInput, status: "done" });
    } else if (isAudio) {
      updateNodeData(id, {
        preview: "",
        previewBlobId: undefined,
        mediaType: "audio",
        videoDataUrl: "",
        videoDataUrlBlobId: undefined,
        audioDataUrl: "",
        audioDataUrlBlobId: undefined,
        urlInput,
      });
      setNodeOutput(id, { audio_url: urlInput, status: "done" });
    } else {
      updateNodeData(id, {
        preview: urlInput,
        mediaType: "image",
        audioDataUrl: "",
        audioDataUrlBlobId: undefined,
      });
      setNodeOutput(id, { image_url: urlInput, status: "done" });
    }
  }, [id, urlInput, updateNodeData, setNodeOutput]);

  const handleFetchBase64 = useCallback(async () => {
    if (!urlInput || mediaType !== "image") return;
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

  const handleLibraryPick = useCallback(
    (blobId: string, mimeType: string) => {
      const url = studioBlobFetchUrl(blobId);
      if (mimeType.startsWith("image/")) {
        updateNodeData(id, {
          preview: undefined,
          previewBlobId: blobId,
          mediaType: "image",
          fileName: "From library",
          urlInput: "",
          videoDataUrl: "",
          videoDataUrlBlobId: undefined,
          audioDataUrl: "",
          audioDataUrlBlobId: undefined,
        });
        setNodeOutput(id, {
          image_url: url,
          status: "done",
        });
      } else if (mimeType.startsWith("video/")) {
        updateNodeData(id, {
          preview: url,
          videoDataUrl: undefined,
          videoDataUrlBlobId: blobId,
          mediaType: "video",
          fileName: "From library",
          urlInput: "",
          previewBlobId: undefined,
          audioDataUrl: "",
          audioDataUrlBlobId: undefined,
        });
        setNodeOutput(id, {
          video_url: url,
          status: "done",
        });
      } else if (mimeType.startsWith("audio/")) {
        updateNodeData(id, {
          preview: "",
          previewBlobId: undefined,
          videoDataUrl: "",
          videoDataUrlBlobId: undefined,
          mediaType: "audio",
          fileName: "From library",
          urlInput: "",
          audioDataUrl: undefined,
          audioDataUrlBlobId: blobId,
        });
        setNodeOutput(id, {
          audio_url: url,
          status: "done",
        });
      }
    },
    [id, updateNodeData, setNodeOutput]
  );

  const handleClear = useCallback(() => {
    updateNodeData(id, {
      preview: "",
      previewBlobId: undefined,
      mediaType: "none",
      fileName: "",
      urlInput: "",
      videoDataUrl: "",
      videoDataUrlBlobId: undefined,
      audioDataUrl: "",
      audioDataUrlBlobId: undefined,
    });
    setNodeOutput(id, { status: "idle" });
  }, [id, updateNodeData, setNodeOutput]);

  return (
    <div className="min-w-[240px] max-w-[280px] rounded-lg border border-studio-node-border bg-studio-node shadow-lg relative">
      <div className="rounded-t-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <UploadIcon className="size-3" />
          <span>{nodeLabel}</span>
          <NodeMediaHistoryButton
            triggerClassName="h-6 w-6 p-0 text-teal-100 hover:text-white hover:bg-white/10"
            nodeId={id}
            onRestore={(blobId, kind) => {
              if (kind === "preview") {
                updateNodeData(id, {
                  preview: undefined,
                  previewBlobId: blobId,
                  mediaType: "image",
                });
                setNodeOutput(id, {
                  image_url: studioBlobFetchUrl(blobId),
                  status: "done",
                });
              } else if (kind === "videoDataUrl") {
                const u = studioBlobFetchUrl(blobId);
                updateNodeData(id, {
                  videoDataUrl: undefined,
                  videoDataUrlBlobId: blobId,
                  preview: u,
                  mediaType: "video",
                });
                setNodeOutput(id, {
                  video_url: u,
                  status: "done",
                });
              } else if (kind === "audioDataUrl") {
                const u = studioBlobFetchUrl(blobId);
                updateNodeData(id, {
                  audioDataUrl: undefined,
                  audioDataUrlBlobId: blobId,
                  preview: "",
                  previewBlobId: undefined,
                  videoDataUrl: "",
                  videoDataUrlBlobId: undefined,
                  mediaType: "audio",
                });
                setNodeOutput(id, {
                  audio_url: u,
                  status: "done",
                });
              }
            }}
          />
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
          ) : mediaType === "video" && (preview || videoDataResolved) ? (
            <video
              src={preview || videoDataResolved}
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
          ) : mediaType === "audio" && (audioResolved || urlInput) ? (
            <audio
              controls
              src={audioResolved || urlInput}
              className="w-full max-h-full"
            />
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
              <UploadIcon className="size-6 opacity-50" />
              <span className="text-xs">Drop, Library, or Upload</span>
              <span className="text-[10px] opacity-60">Image, video, or audio</span>
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/mp4,audio/webm,audio/ogg,audio/flac"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 flex-1 text-[10px] gap-1 px-2"
            onClick={() => setLibraryOpen(true)}
          >
            <LibraryIcon className="size-3 shrink-0" />
            Library
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 flex-1 text-[10px]"
            onClick={() => fileRef.current?.click()}
          >
            <UploadIcon className="size-3 inline mr-0.5" />
            Upload
          </Button>
        </div>

        <StudioMediaPickerDialog
          open={libraryOpen}
          onOpenChange={setLibraryOpen}
          onPick={handleLibraryPick}
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
            <span
              className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium ${
                mediaType === "image"
                  ? "bg-green-900/40 text-green-400"
                  : mediaType === "video"
                    ? "bg-blue-900/40 text-blue-400"
                    : "bg-amber-900/40 text-amber-400"
              }`}
            >
              {mediaType === "image" ? "IMAGE" : mediaType === "video" ? "VIDEO" : "AUDIO"}
            </span>
          </div>
        )}
      </div>

      {/* Output handles */}
      <Handle type="source" position={Position.Right} id="image_url" style={{ top: "28%" }}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-green-700" />
      <HandleLabel label="image url" side="right" top="28%" />

      <Handle type="source" position={Position.Right} id="image_base64" style={{ top: "40%" }}
        className="!w-3 !h-3 !bg-green-400 !border-2 !border-green-700" />
      <HandleLabel label="base64" side="right" top="40%" />

      <Handle type="source" position={Position.Right} id="video_url" style={{ top: "52%" }}
        className="!w-3 !h-3 !bg-blue-400 !border-2 !border-blue-600" />
      <HandleLabel label="video url" side="right" top="52%" />

      <Handle type="source" position={Position.Right} id="audio_url" style={{ top: "64%" }}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-amber-700" />
      <HandleLabel label="audio url" side="right" top="64%" />
    </div>
  );
}

export const MediaInputNode = memo(MediaInputNodeComponent);
