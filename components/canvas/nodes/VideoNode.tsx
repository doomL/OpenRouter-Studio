"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStudioStore } from "@/lib/store";
import {
  getNodeInputs,
  getImageRefInputs,
  imageRefSourcesSignature,
} from "@/lib/execution";
import { resolveVideoFrameRefsFromEdges } from "@/lib/video-frame";
import { readJsonResponse } from "@/lib/read-json-response";
import { fetchWithRetry, STUDIO_FETCH_MAX_ATTEMPTS } from "@/lib/fetch-with-retry";
import { ModelSelector } from "@/components/ui/ModelSelector";
import { AlertTriangleIcon, ClockIcon, Volume2Icon, VolumeXIcon } from "lucide-react";
import { HandleLabel } from "@/components/canvas/HandleLabel";
import { getCanvasSelectContentProps } from "@/lib/canvas-floating-props";
import { StudioMultiImageRefHint } from "@/lib/studio-multi-image-ref-hint";
import {
  pickInlineOrBlobUrl,
  studioBlobFetchUrl,
} from "@/lib/studio-node-media-url";
import { NodeMediaHistoryButton } from "@/components/studio/NodeMediaHistoryButton";
import {
  deriveVideoUiParams,
  normalizeVideoModelId,
} from "@/lib/openrouter-video-models";
import { enqueueVideoPersist } from "@/lib/video-persist-queue";

function videoRefPreviewOrder(handle: string): number {
  if (handle === "first_frame") return 0;
  if (handle === "last_frame") return 1;
  if (handle === "style_ref") return 2;
  if (handle === "image_url") return 3;
  const ch = /^character_ref_(\d+)$/.exec(handle);
  if (ch) return 100 + parseInt(ch[1]!, 10);
  const ir = /^image_ref_(\d+)$/.exec(handle);
  if (ir) return 200 + parseInt(ir[1]!, 10);
  return 500;
}

function labelForVideoRefPreview(handle: string): string {
  if (handle === "first_frame") return "First";
  if (handle === "last_frame") return "Last";
  if (handle === "style_ref") return "Style";
  if (handle === "image_url") return "Image";
  const ch = /^character_ref_(\d+)$/.exec(handle);
  if (ch) return `Char ${ch[1]}`;
  const ir = /^image_ref_(\d+)$/.exec(handle);
  if (ir) return `Ref ${ir[1]}`;
  return handle;
}

function VideoNodeComponent({ id, data }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const setNodeOutput = useStudioStore((s) => s.setNodeOutput);
  const nodeOutput = useStudioStore((s) => s.nodeOutputs[id]);
  const edges = useStudioStore((s) => s.edges);
  const nodes = useStudioStore((s) => s.nodes);
  const nodeOutputs = useStudioStore((s) => s.nodeOutputs);
  const apiKey = useStudioStore((s) => s.apiKey);
  const videoModels = useStudioStore((s) => s.models?.video);
  const upstreamVisualSig = useStudioStore((s) =>
    imageRefSourcesSignature(id, s.edges, s.nodeOutputs, s.nodes)
  );
  const videoJob = useStudioStore((s) => s.videoJobs[id]);
  const setVideoJob = useStudioStore((s) => s.setVideoJob);
  const addCost = useStudioStore((s) => s.addCost);
  const dynamicCount =
    useStudioStore((s) => s.dynamicHandleCounts[id]?.character_ref) || 1;

  const model = (data.model as string) || "";
  const nodeLabel = (data.label as string) || "Video Generation";
  const duration = (data.duration as number) || 4;
  const aspectRatio = (data.aspectRatio as string) || "16:9";
  const resolution = (data.resolution as string) || "";
  const size = (data.size as string) || "";
  const generateAudio = (data.generateAudio as boolean) ?? true;
  const seed = (data.seed as string) || "";

  const persistedVideoUrl = pickInlineOrBlobUrl(
    data.outputVideoDataUrl as string | undefined,
    data.outputVideoDataUrlBlobId as string | undefined
  );
  const outputVideoBlobId = data.outputVideoDataUrlBlobId as string | undefined;
  const hasPendingInlineOutput =
    typeof data.outputVideoDataUrl === "string" &&
    data.outputVideoDataUrl.startsWith("data:");

  const modelMeta = useMemo(() => {
    if (!model || !videoModels?.length) return undefined;
    const t = normalizeVideoModelId(model);
    return videoModels.find(
      (m) => m.id === model || normalizeVideoModelId(m.id) === t
    );
  }, [videoModels, model]);

  const params = useMemo(
    () => deriveVideoUiParams(modelMeta?.video_generation),
    [modelMeta?.video_generation]
  );

  useEffect(() => {
    if (!model) return;
    const patch: Record<string, unknown> = {};
    if (!params.aspectRatios.includes(aspectRatio)) {
      patch.aspectRatio = params.aspectRatios[0];
    }
    if (!params.durations.includes(duration)) {
      patch.duration = params.durations[0];
    }
    if (resolution && params.resolutions.length > 0 && !params.resolutions.includes(resolution)) {
      patch.resolution = "";
    }
    if (size && params.sizes.length > 0 && !params.sizes.includes(size)) {
      patch.size = "";
    }
    if (!params.audioCapability && generateAudio) {
      patch.generateAudio = false;
    }
    if (Object.keys(patch).length > 0) updateNodeData(id, patch);
  }, [
    model,
    aspectRatio,
    duration,
    resolution,
    size,
    generateAudio,
    params.aspectRatios,
    params.durations,
    params.resolutions,
    params.sizes,
    params.audioCapability,
    id,
    updateNodeData,
  ]);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Restore output from persisted videoJob when job / outputs change (not only first mount)
  useEffect(() => {
    if (
      videoJob?.status === "completed" &&
      videoJob.jobId &&
      !nodeOutput?.video_url &&
      nodeOutput?.status !== "loading"
    ) {
      const proxyUrl = `/api/openrouter/video/download?jobId=${videoJob.jobId}&index=0&key=${encodeURIComponent(apiKey)}`;
      setNodeOutput(id, { video_url: proxyUrl, status: "done" });
      if (videoJob.videoUrl?.startsWith("http")) {
        setVideoJob(id, { ...videoJob, videoUrl: proxyUrl });
      }
    }
  }, [apiKey, id, nodeOutput?.video_url, nodeOutput?.status, setNodeOutput, setVideoJob, videoJob]);

  useEffect(() => {
    if (!persistedVideoUrl || nodeOutput?.video_url) return;
    setNodeOutput(id, {
      ...useStudioStore.getState().nodeOutputs[id],
      video_url: persistedVideoUrl,
      status: "done",
    });
  }, [id, nodeOutput?.video_url, persistedVideoUrl, setNodeOutput]);

  /** After a job completes, fetch the MP4 once and stash a data URL on the node so cloud sync can upload it to object storage (MinIO/S3). Queued globally so only one video is fetched at a time. */
  useEffect(() => {
    if (videoJob?.status !== "completed" || !videoJob.jobId) return;
    if (outputVideoBlobId || hasPendingInlineOutput) return;
    const proxyUrl = `/api/openrouter/video/download?jobId=${videoJob.jobId}&index=0&key=${encodeURIComponent(apiKey)}`;
    const cancelQueue = enqueueVideoPersist(async () => {
      try {
        const res = await fetch(proxyUrl);
        if (!res.ok) return;
        const fresh = useStudioStore.getState().nodes.find((n) => n.id === id)?.data as
          | Record<string, unknown>
          | undefined;
        if (fresh?.outputVideoDataUrlBlobId) return;
        if (
          typeof fresh?.outputVideoDataUrl === "string" &&
          fresh.outputVideoDataUrl.startsWith("data:")
        )
          return;
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(new Error("read"));
          r.readAsDataURL(blob);
        });
        updateNodeData(id, { outputVideoDataUrl: dataUrl });
      } catch {
        // Non-fatal; user can still use the time-limited proxy URL.
      }
    });
    return cancelQueue;
  }, [
    apiKey,
    hasPendingInlineOutput,
    id,
    outputVideoBlobId,
    updateNodeData,
    videoJob?.jobId,
    videoJob?.status,
  ]);

  const jobStatus = videoJob?.status || "idle";
  const isPolling = jobStatus === "pending" || jobStatus === "in_progress";
  const showGenerating = isPolling || nodeOutput?.status === "loading";

  const borderColor = showGenerating
    ? "border-yellow-500 animate-pulse"
    : nodeOutput?.status === "error" || jobStatus === "failed"
    ? "border-red-500"
    : jobStatus === "completed"
    ? "border-green-500"
    : "border-studio-node-border";

  const connectedCharRefs = useMemo(() => {
    return getImageRefInputs(id, edges, nodeOutputs, nodes).filter((r) =>
      r.handle.startsWith("character_ref_")
    );
  }, [id, edges, nodeOutputs, nodes]);

  const connectedVisualRefs = useMemo(() => {
    const { edges, nodes, nodeOutputs } = useStudioStore.getState();
    return getImageRefInputs(id, edges, nodeOutputs, nodes)
      .filter((r) => Boolean(r.url))
      .sort((a, b) => videoRefPreviewOrder(a.handle) - videoRefPreviewOrder(b.handle));
  }, [id, upstreamVisualSig]);

  const charHandleCount = Math.min(
    Math.max(dynamicCount, connectedCharRefs.length + 1, 1),
    params.maxRefs
  );

  useEffect(() => {
    if (!isPolling || !videoJob?.jobId) return;

    const startTime = videoJob.startedAt;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetchWithRetry(
          `/api/openrouter/video?jobId=${videoJob.jobId}`,
          { headers: { "x-api-key": apiKey } },
          { maxAttempts: STUDIO_FETCH_MAX_ATTEMPTS, baseDelayMs: 500 }
        );
        const result = await readJsonResponse<{
          status?: string;
          error?: string;
          usage?: { cost?: number };
        }>(res);

        if (result.status === "completed") {
          const proxyUrl = `/api/openrouter/video/download?jobId=${videoJob.jobId}&index=0&key=${encodeURIComponent(apiKey)}`;
          setVideoJob(id, { ...videoJob, status: "completed", videoUrl: proxyUrl });
          setNodeOutput(id, { video_url: proxyUrl, status: "done" });
          // Track actual cost from usage
          if (result.usage?.cost) {
            addCost(result.usage.cost);
          }
        } else if (result.status === "failed") {
          setVideoJob(id, {
            ...videoJob,
            status: "failed",
            error: result.error || "Generation failed",
          });
          setNodeOutput(id, {
            ...useStudioStore.getState().nodeOutputs[id],
            status: "error",
            error: result.error || "Generation failed",
          });
        } else {
          const newStatus = result.status === "in_progress" ? "in_progress" : "pending";
          setVideoJob(id, { ...videoJob, status: newStatus });
        }
      } catch {
        // Keep polling on network errors
      }
    }, 10000);

    return () => {
      clearInterval(timer);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isPolling, videoJob?.jobId]);

  const generate = useCallback(async () => {
    if (!model || !apiKey) return;
    // Drop stale persisted bytes so a new run cannot be shadowed by an old data: / blob ref in `data`.
    updateNodeData(id, {
      outputVideoDataUrl: undefined,
      outputVideoDataUrlBlobId: undefined,
    });
    setNodeOutput(id, {
      ...nodeOutputs[id],
      status: "loading",
      error: undefined,
    });

    try {
      const inputs = getNodeInputs(id, edges, nodeOutputs, nodes);
      const imageRefs = getImageRefInputs(id, edges, nodeOutputs, nodes);
      let videoFrameRefs: Array<{ handle: string; url: string }> = [];
      try {
        videoFrameRefs = await resolveVideoFrameRefsFromEdges(id, edges, nodeOutputs, nodes);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Could not extract video frame";
        setNodeOutput(id, {
          ...useStudioStore.getState().nodeOutputs[id],
          status: "error",
          error: msg,
        });
        return;
      }
      const imageRefsMerged = [...imageRefs, ...videoFrameRefs];
      const prompt = inputs.prompt || "";

      const body: Record<string, unknown> = {
        model,
        prompt,
        duration,
      };

      // Size (WIDTHxHEIGHT) takes precedence — interchangeable with resolution + aspect_ratio
      if (size) {
        body.size = size;
      } else {
        body.aspect_ratio = aspectRatio;
        if (resolution) {
          body.resolution = resolution;
        }
      }

      // Audio generation (only if the provider supports it)
      if (params.audioCapability) {
        body.generate_audio = generateAudio;
      }

      // Seed for reproducibility
      if (params.seedSupported && seed) {
        const seedNum = parseInt(seed, 10);
        if (!isNaN(seedNum)) body.seed = seedNum;
      }

      const inputRefs: Array<{
        type: string;
        image_url: { url: string };
      }> = [];

      /** First/last frame must use `frame_images` + `frame_type` (OpenRouter); `input_references` is for style/refs only. */
      const frameImages: Array<{
        type: string;
        image_url: { url: string };
        frame_type: string;
      }> = [];

      const firstFrame = imageRefsMerged.find((r) => r.handle === "first_frame");
      if (firstFrame) {
        frameImages.push({
          type: "image_url",
          image_url: { url: firstFrame.url },
          frame_type: "first_frame",
        });
      }

      const lastFrame = imageRefsMerged.find((r) => r.handle === "last_frame");
      if (lastFrame) {
        frameImages.push({
          type: "image_url",
          image_url: { url: lastFrame.url },
          frame_type: "last_frame",
        });
      }

      if (frameImages.length > 0) {
        body.frame_images = frameImages;
      }

      const charRefs = imageRefsMerged.filter((r) =>
        r.handle.startsWith("character_ref_")
      );
      for (const ref of charRefs) {
        inputRefs.push({ type: "image_url", image_url: { url: ref.url } });
      }

      const styleRef = imageRefsMerged.find((r) => r.handle === "style_ref");
      if (styleRef) {
        inputRefs.push({ type: "image_url", image_url: { url: styleRef.url } });
      }

      if (inputRefs.length > 0) {
        body.input_references = inputRefs;
      }

      const res = await fetchWithRetry(
        "/api/openrouter/video",
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
        error?: { message?: string } | string;
        id?: string;
      }>(res);
      if (result.error)
        throw new Error(
          typeof result.error === "object" && result.error?.message
            ? result.error.message
            : String(result.error)
        );

      const jobId = result.id;
      if (!jobId) throw new Error("No job ID in response");

      setVideoJob(id, {
        jobId,
        nodeId: id,
        status: "pending",
        startedAt: Date.now(),
      });
      setNodeOutput(id, {
        ...useStudioStore.getState().nodeOutputs[id],
        status: "loading",
      });
      setElapsed(0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setNodeOutput(id, {
        ...useStudioStore.getState().nodeOutputs[id],
        status: "error",
        error: msg,
      });
    }
  }, [
    id,
    model,
    apiKey,
    edges,
    nodes,
    nodeOutputs,
    duration,
    aspectRatio,
    resolution,
    size,
    generateAudio,
    seed,
    params,
    setNodeOutput,
    setVideoJob,
    updateNodeData,
  ]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  /** Prefer live output URL (newest generation); fall back like image node — avoids stale persisted data: URLs shadowing a fresh job. */
  const previewVideoUrl =
    nodeOutput?.video_url ||
    persistedVideoUrl ||
    (videoJob?.status === "completed" ? videoJob.videoUrl : undefined);

  const handleDownload = useCallback(() => {
    const src =
      nodeOutput?.video_url ||
      persistedVideoUrl ||
      (videoJob?.status === "completed" ? videoJob.videoUrl : undefined);
    if (!src) return;
    let url = src;
    if (
      videoJob?.jobId &&
      !persistedVideoUrl &&
      !nodeOutput?.video_url &&
      videoJob?.status === "completed"
    ) {
      url = `/api/openrouter/video/download?jobId=${videoJob.jobId}&index=0&key=${encodeURIComponent(apiKey)}`;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = `${videoJob?.jobId ?? "video"}.mp4`;
    a.click();
  }, [
    apiKey,
    persistedVideoUrl,
    videoJob?.jobId,
    videoJob?.status,
    videoJob?.videoUrl,
    nodeOutput?.video_url,
  ]);

  return (
    <div
      className={`min-w-[280px] rounded-lg border-2 ${borderColor} bg-studio-node shadow-lg relative`}
    >
      <div className="rounded-t-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 min-w-0">
          {nodeLabel}
          <NodeMediaHistoryButton
            nodeId={id}
            kindFilter="outputVideoDataUrl"
            onRestore={(blobId) => {
              updateNodeData(id, {
                outputVideoDataUrl: undefined,
                outputVideoDataUrlBlobId: blobId,
              });
              setNodeOutput(id, {
                video_url: studioBlobFetchUrl(blobId),
                status: "done",
              });
            }}
          />
        </span>
        <Input
          value={nodeLabel === "Video Generation" ? "" : nodeLabel}
          onChange={(e) =>
            updateNodeData(id, { label: e.target.value || "Video Generation" })
          }
          placeholder="Label..."
          className="h-5 w-24 border-0 bg-transparent px-1 text-[10px] text-right text-blue-100 placeholder:text-blue-200/60 focus-visible:ring-0"
        />
      </div>
      <div className="space-y-2 p-3 nopan nodrag nowheel">
        <ModelSelector
          category="video"
          value={model}
          onChange={(v) => updateNodeData(id, { model: v })}
        />
        {model && !params.fromApi ? (
          <p className="text-[9px] text-muted-foreground leading-snug">
            Model not in the video catalog yet — using generic controls. For a custom model id, match
            OpenRouter docs or pick from the list after models refresh.
          </p>
        ) : null}

        {/* Duration — model-specific options */}
        <div>
          <Label className="text-xs text-muted-foreground">Duration (s)</Label>
          <Select
            value={String(duration)}
            onValueChange={(v) => v && updateNodeData(id, { duration: parseInt(v) })}
          >
            <SelectTrigger className="h-7 text-xs bg-studio-node-input border-studio-node-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent {...getCanvasSelectContentProps()}>
              {params.durations.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d}s
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Resolution */}
        <div>
          <Label className="text-xs text-muted-foreground">Resolution</Label>
          <Select
            value={resolution || "default"}
            onValueChange={(v) => v && updateNodeData(id, { resolution: v === "default" ? "" : v })}
          >
            <SelectTrigger className="h-7 text-xs bg-studio-node-input border-studio-node-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent {...getCanvasSelectContentProps()}>
              <SelectItem value="default">Default</SelectItem>
              {params.resolutions.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Aspect Ratio — model-specific options */}
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
              {params.aspectRatios.map((ar) => (
                <SelectItem key={ar} value={ar}>
                  {ar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Size (WIDTHxHEIGHT) — overrides resolution + aspect_ratio */}
        <div>
          <Label className="text-xs text-muted-foreground">
            Size <span className="text-[9px] opacity-60">(WxH, e.g. 1280x720)</span>
          </Label>
          <Input
            type="text"
            value={size}
            onChange={(e) => updateNodeData(id, { size: e.target.value })}
            placeholder="Auto (use resolution + ratio)"
            className="h-7 text-xs bg-studio-node-input border-studio-node-border"
          />
          {params.sizes.length > 0 ? (
            <p className="text-[9px] text-muted-foreground mt-0.5">
              Allowed: {params.sizes.slice(0, 6).join(", ")}
              {params.sizes.length > 6 ? "…" : ""}
            </p>
          ) : null}
          {size ? (
            <p className="text-[9px] text-muted-foreground mt-0.5">
              Overrides resolution &amp; aspect ratio
            </p>
          ) : null}
        </div>

        {/* Audio toggle */}
        {params.audioCapability ? (
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => updateNodeData(id, { generateAudio: !generateAudio })}
          >
            {generateAudio ? (
              <Volume2Icon className="size-3.5 text-green-500" />
            ) : (
              <VolumeXIcon className="size-3.5 text-muted-foreground" />
            )}
            Audio: {generateAudio ? "On" : "Off"}
          </button>
        ) : null}

        {/* Seed */}
        {params.seedSupported ? (
          <div>
            <Label className="text-xs text-muted-foreground">Seed (optional)</Label>
            <Input
              type="number"
              value={seed}
              onChange={(e) => updateNodeData(id, { seed: e.target.value })}
              placeholder="Random"
              className="h-7 text-xs bg-studio-node-input border-studio-node-border"
            />
          </div>
        ) : null}

        {connectedVisualRefs.length > 0 ? (
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Reference previews</Label>
            <div className="flex gap-1.5 flex-wrap">
              {connectedVisualRefs.map((ref) => (
                <div key={ref.handle} className="flex flex-col items-center gap-0.5 max-w-[52px]">
                  <img
                    src={ref.url}
                    alt={ref.handle}
                    title={ref.handle}
                    className="h-10 w-10 rounded object-cover border border-studio-node-border bg-muted/40"
                  />
                  <span className="text-[8px] text-muted-foreground text-center leading-tight truncate w-full">
                    {labelForVideoRefPreview(ref.handle)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5 border-t border-studio-node-border pt-2">
          <StudioMultiImageRefHint className="text-[9px] text-muted-foreground leading-snug" />
          <p className="text-[9px] text-muted-foreground leading-snug">
            Connect another node&apos;s <span className="text-foreground/90">video out</span> to{" "}
            <span className="text-foreground/90">first frame</span> or{" "}
            <span className="text-foreground/90">last frame</span> to extend the clip (frames are
            captured in your browser).
          </p>
        </div>

        <Button
          size="sm"
          className="w-full"
          onClick={generate}
          disabled={isPolling || nodeOutput?.status === "loading" || !model}
        >
          {isPolling ? (
            <span className="flex items-center gap-1.5">
              <ClockIcon className="size-3 animate-spin" />
              {formatTime(elapsed)} / ~2-5 min
            </span>
          ) : nodeOutput?.status === "loading" ? (
            "Submitting..."
          ) : (
            "Generate"
          )}
        </Button>

        {previewVideoUrl ? (
          <div className="mt-2 space-y-1">
            <video
              key={previewVideoUrl}
              controls
              src={previewVideoUrl}
              className="w-full max-h-[200px] rounded bg-black"
            />
            <div className="flex items-center justify-between">
              {!persistedVideoUrl ? (
                <Badge
                  variant="outline"
                  className="text-[9px] border-orange-500 text-orange-400 gap-0.5"
                >
                  <AlertTriangleIcon className="size-2.5" />
                  URL expires ~24h
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[9px] border-green-600 text-green-400 gap-0.5">
                  Stored in your library
                </Badge>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[10px]"
                onClick={handleDownload}
              >
                Download
              </Button>
            </div>
          </div>
        ) : null}

        {(videoJob?.status === "failed" || nodeOutput?.error) && (
          <div className="mt-2 rounded bg-red-900/30 p-2 text-xs text-red-400">
            {videoJob?.error || nodeOutput?.error}
          </div>
        )}

        {(videoJob?.status === "expired" || videoJob?.status === "cancelled") && (
          <div className="mt-2 rounded bg-muted p-2 text-xs text-muted-foreground">
            Video generation {videoJob.status}
          </div>
        )}
      </div>

      {/* Input handles with labels */}
      <Handle type="target" position={Position.Left} id="prompt" style={{ top: "8%" }}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-gray-600" />
      <HandleLabel label="prompt" side="left" top="8%" />

      <Handle type="target" position={Position.Left} id="first_frame" style={{ top: "16%" }}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-green-700" />
      <HandleLabel label="first frame" side="left" top="16%" />

      <Handle type="target" position={Position.Left} id="last_frame" style={{ top: "24%" }}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-green-700" />
      <HandleLabel label="last frame" side="left" top="24%" />

      {Array.from({ length: charHandleCount }).map((_, i) => (
        <span key={`char_group_${i + 1}`}>
          <Handle type="target" position={Position.Left}
            id={`character_ref_${i + 1}`} style={{ top: `${32 + i * 7}%` }}
            className="!w-3 !h-3 !bg-blue-400 !border-2 !border-blue-600" />
          <HandleLabel label={`char ${i + 1}`} side="left" top={`${32 + i * 7}%`} />
        </span>
      ))}

      <Handle type="target" position={Position.Left} id="style_ref" style={{ top: "56%" }}
        className="!w-3 !h-3 !bg-pink-400 !border-2 !border-pink-600" />
      <HandleLabel label="style ref" side="left" top="56%" />

      {/* Output handle */}
      <Handle type="source" position={Position.Right} id="video_url"
        className="!w-3 !h-3 !bg-blue-400 !border-2 !border-blue-600" />
      <HandleLabel label="video out" side="right" top="50%" />
    </div>
  );
}

export const VideoNode = memo(VideoNodeComponent);
