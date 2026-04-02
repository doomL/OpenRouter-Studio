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
import { getNodeInputs, getImageRefInputs } from "@/lib/execution";
import { resolveVideoFrameRefsFromEdges } from "@/lib/video-frame";
import { ModelSelector } from "@/components/ui/ModelSelector";
import { ZapIcon, AlertTriangleIcon, ClockIcon, Volume2Icon, VolumeXIcon } from "lucide-react";
import { HandleLabel } from "@/components/canvas/HandleLabel";
import { getCanvasSelectContentProps } from "@/lib/canvas-floating-props";

/** Per-model supported parameters from the docs */
const MODEL_PARAMS: Record<string, {
  durations: number[];
  resolutions: string[];
  aspectRatios: string[];
  maxRefs: number;
  audio: boolean;
}> = {
  "google/veo-3.1": {
    durations: [4, 6, 8],
    resolutions: ["720p", "1080p", "4K"],
    aspectRatios: ["16:9", "9:16"],
    maxRefs: 3,
    audio: true,
  },
  "openai/sora-2-pro": {
    durations: [4, 8, 12, 16, 20],
    resolutions: ["720p", "1080p"],
    aspectRatios: ["16:9", "9:16"],
    maxRefs: 1,
    audio: true,
  },
  "bytedance/seedance-1-5-pro": {
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    resolutions: ["480p", "720p", "1080p"],
    aspectRatios: ["16:9", "9:16", "4:3", "3:4", "1:1", "21:9"],
    maxRefs: 2,
    audio: true,
  },
};

const DEFAULT_PARAMS = {
  durations: [4, 6, 8, 12, 16, 20],
  resolutions: ["720p", "1080p"],
  aspectRatios: ["16:9", "9:16", "1:1"],
  maxRefs: 2,
  audio: true,
};

function VideoNodeComponent({ id, data }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const setNodeOutput = useStudioStore((s) => s.setNodeOutput);
  const nodeOutput = useStudioStore((s) => s.nodeOutputs[id]);
  const edges = useStudioStore((s) => s.edges);
  const nodes = useStudioStore((s) => s.nodes);
  const nodeOutputs = useStudioStore((s) => s.nodeOutputs);
  const apiKey = useStudioStore((s) => s.apiKey);
  const videoJob = useStudioStore((s) => s.videoJobs[id]);
  const setVideoJob = useStudioStore((s) => s.setVideoJob);
  const addCost = useStudioStore((s) => s.addCost);
  const dynamicCount =
    useStudioStore((s) => s.dynamicHandleCounts[id]?.character_ref) || 1;

  const model = (data.model as string) || "";
  const duration = (data.duration as number) || 4;
  const aspectRatio = (data.aspectRatio as string) || "16:9";
  const resolution = (data.resolution as string) || "";
  const generateAudio = (data.generateAudio as boolean) ?? true;
  const seed = (data.seed as string) || "";

  // Get model-specific params
  const params = MODEL_PARAMS[model] || DEFAULT_PARAMS;

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Restore output from persisted videoJob on mount
  useEffect(() => {
    if (videoJob?.status === "completed" && videoJob.jobId && !nodeOutput?.video_url) {
      const proxyUrl = `/api/openrouter/video/download?jobId=${videoJob.jobId}&index=0&key=${encodeURIComponent(apiKey)}`;
      setNodeOutput(id, { video_url: proxyUrl, status: "done" });
      if (videoJob.videoUrl?.startsWith("http")) {
        setVideoJob(id, { ...videoJob, videoUrl: proxyUrl });
      }
    }
  }, []);

  const jobStatus = videoJob?.status || "idle";
  const isPolling = jobStatus === "pending" || jobStatus === "in_progress";

  const borderColor = isPolling
    ? "border-yellow-500 animate-pulse"
    : jobStatus === "completed"
    ? "border-green-500"
    : jobStatus === "failed"
    ? "border-red-500"
    : "border-studio-node-border";

  const connectedCharRefs = useMemo(() => {
    return getImageRefInputs(id, edges, nodeOutputs, nodes).filter((r) =>
      r.handle.startsWith("character_ref_")
    );
  }, [id, edges, nodeOutputs, nodes]);

  const charHandleCount = Math.max(
    dynamicCount,
    connectedCharRefs.length + 1
  );

  useEffect(() => {
    if (!isPolling || !videoJob?.jobId) return;

    const startTime = videoJob.startedAt;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/openrouter/video?jobId=${videoJob.jobId}`,
          { headers: { "x-api-key": apiKey } }
        );
        const result = await res.json();

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
    setNodeOutput(id, { status: "loading" });

    try {
      const inputs = getNodeInputs(id, edges, nodeOutputs);
      const imageRefs = getImageRefInputs(id, edges, nodeOutputs, nodes);
      let videoFrameRefs: Array<{ handle: string; url: string }> = [];
      try {
        videoFrameRefs = await resolveVideoFrameRefsFromEdges(id, edges, nodeOutputs);
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Could not extract video frame";
        setNodeOutput(id, { status: "error", error: msg });
        return;
      }
      const imageRefsMerged = [...imageRefs, ...videoFrameRefs];
      const prompt = inputs.prompt || "";

      const body: Record<string, unknown> = {
        model,
        prompt,
        duration,
        aspect_ratio: aspectRatio,
      };

      // Resolution (optional, cannot combine with size)
      if (resolution) {
        body.resolution = resolution;
      }

      // Audio generation
      if (params.audio) {
        body.generate_audio = generateAudio;
      }

      // Seed for reproducibility
      if (seed) {
        const seedNum = parseInt(seed);
        if (!isNaN(seedNum)) body.seed = seedNum;
      }

      const inputRefs: Array<{
        type: string;
        image_url: { url: string };
      }> = [];

      const firstFrame = imageRefsMerged.find((r) => r.handle === "first_frame");
      if (firstFrame) {
        inputRefs.push({ type: "image_url", image_url: { url: firstFrame.url } });
      }

      const lastFrame = imageRefsMerged.find((r) => r.handle === "last_frame");
      if (lastFrame) {
        inputRefs.push({ type: "image_url", image_url: { url: lastFrame.url } });
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

      const res = await fetch("/api/openrouter/video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      if (result.error) throw new Error(result.error.message || result.error);

      const jobId = result.id;
      if (!jobId) throw new Error("No job ID in response");

      setVideoJob(id, {
        jobId,
        nodeId: id,
        status: "pending",
        startedAt: Date.now(),
      });
      setNodeOutput(id, { status: "loading" });
      setElapsed(0);
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
    duration,
    aspectRatio,
    resolution,
    generateAudio,
    seed,
    params.audio,
    setNodeOutput,
    setVideoJob,
  ]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const handleDownload = useCallback(() => {
    if (!videoJob?.videoUrl) return;
    const url = `/api/openrouter/video/download?jobId=${videoJob.jobId}&index=0&key=${encodeURIComponent(apiKey)}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${videoJob.jobId}.mp4`;
    a.click();
  }, [videoJob, apiKey]);

  return (
    <div
      className={`min-w-[280px] rounded-lg border-2 ${borderColor} bg-studio-node shadow-lg relative`}
    >
      <div className="rounded-t-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white flex items-center gap-2">
        Video Generation
        <Badge
          variant="outline"
          className="text-[9px] h-4 border-yellow-500 text-yellow-300 gap-0.5"
        >
          <ZapIcon className="size-2.5" />
          Alpha
        </Badge>
      </div>
      <div className="space-y-2 p-3 nopan nodrag nowheel">
        <ModelSelector
          category="video"
          value={model}
          onChange={(v) => updateNodeData(id, { model: v })}
        />

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

        {/* Audio toggle */}
        {params.audio && (
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
        )}

        {/* Seed */}
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

        {connectedCharRefs.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {connectedCharRefs.map((ref) => (
              <img
                key={ref.handle}
                src={ref.url}
                alt={ref.handle}
                className="h-10 w-10 rounded object-cover border border-studio-node-border"
              />
            ))}
          </div>
        )}

        <p className="text-[9px] text-muted-foreground leading-snug border-t border-studio-node-border pt-2">
          Connect another node&apos;s <span className="text-foreground/90">video out</span> to{" "}
          <span className="text-foreground/90">first frame</span> or{" "}
          <span className="text-foreground/90">last frame</span> to extend the clip (frames are
          captured in your browser).
        </p>

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

        {videoJob?.status === "completed" && videoJob.videoUrl && (
          <div className="mt-2 space-y-1">
            <video
              controls
              src={videoJob.videoUrl}
              className="w-full max-h-[200px] rounded bg-black"
            />
            <div className="flex items-center justify-between">
              <Badge
                variant="outline"
                className="text-[9px] border-orange-500 text-orange-400 gap-0.5"
              >
                <AlertTriangleIcon className="size-2.5" />
                URL expires ~24h
              </Badge>
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
        )}

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
