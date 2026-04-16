"use client";

import { memo, useCallback, useMemo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStudioStore } from "@/lib/store";
import { HandleLabel } from "@/components/canvas/HandleLabel";

function OutputNodeComponent({ id, data }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const edges = useStudioStore((s) => s.edges);
  const nodeOutputs = useStudioStore((s) => s.nodeOutputs);
  const nodeLabel = (data.label as string) || "Output";

  // Derive display values from upstream nodes only — no effect, no self-write
  const { text, imageUrl, videoUrl, audioUrl } = useMemo(() => {
    const incomingEdges = edges.filter((e) => e.target === id);
    let text: string | undefined;
    let imageUrl: string | undefined;
    let videoUrl: string | undefined;
    let audioUrl: string | undefined;

    for (const edge of incomingEdges) {
      const src = nodeOutputs[edge.source];
      if (!src) continue;
      const sh = edge.sourceHandle || "";
      const th = edge.targetHandle || "";

      if (th === "text" && (sh === "prompt" || sh === "text") && src.text) {
        text = src.text;
      }
      if (th === "image_url" && src.image_url) {
        imageUrl = src.image_url;
      }
      if (th === "video_url" && src.video_url) {
        videoUrl = src.video_url;
      }
      if (th === "audio_url" && src.audio_url) {
        audioUrl = src.audio_url;
      }
    }
    return { text, imageUrl, videoUrl, audioUrl };
  }, [id, edges, nodeOutputs]);

  const handleDownload = useCallback(
    (url: string, ext: string) => {
      const a = document.createElement("a");
      a.href = url;
      a.download = `output-${id}.${ext}`;
      a.click();
    },
    [id]
  );

  return (
    <div className="min-w-[360px] max-w-[480px] rounded-lg border border-studio-node-border bg-studio-node shadow-lg relative">
      <div className="rounded-t-lg bg-gray-600 px-3 py-1.5 text-xs font-semibold text-white flex items-center justify-between gap-2">
        <span>{nodeLabel}</span>
        <Input
          value={nodeLabel === "Output" ? "" : nodeLabel}
          onChange={(e) => updateNodeData(id, { label: e.target.value || "Output" })}
          placeholder="Label..."
          className="h-5 w-24 border-0 bg-transparent px-1 text-[10px] text-right text-gray-200 placeholder:text-gray-300/60 focus-visible:ring-0"
        />
      </div>
      <div className="p-3 space-y-2 nopan nodrag nowheel">
        {text && (
          <div className="max-h-[400px] overflow-auto rounded bg-studio-node-input p-3 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {text}
          </div>
        )}

        {imageUrl && (
          <div className="space-y-1">
            <img
              src={imageUrl}
              alt="output"
              className="w-full max-h-[360px] rounded bg-studio-node-input object-contain"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] w-full"
              onClick={() => handleDownload(imageUrl, "png")}
            >
              Download Image
            </Button>
          </div>
        )}

        {videoUrl && (
          <div className="space-y-1">
            <video
              controls
              src={videoUrl}
              className="w-full max-h-[300px] rounded bg-black"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] w-full"
              onClick={() => handleDownload(videoUrl, "mp4")}
            >
              Download Video
            </Button>
          </div>
        )}

        {audioUrl && (
          <div className="space-y-1">
            <audio controls src={audioUrl} className="w-full rounded" />
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] w-full"
              onClick={() => handleDownload(audioUrl, "wav")}
            >
              Download Audio
            </Button>
          </div>
        )}

        {!text && !imageUrl && !videoUrl && !audioUrl && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Connect a node to see output
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Left} id="text" style={{ top: "30%" }}
        className="!w-3 !h-3 !bg-purple-400 !border-2 !border-purple-600" />
      <HandleLabel label="text" side="left" top="30%" />

      <Handle type="target" position={Position.Left} id="image_url" style={{ top: "50%" }}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-green-700" />
      <HandleLabel label="image" side="left" top="50%" />

      <Handle type="target" position={Position.Left} id="video_url" style={{ top: "70%" }}
        className="!w-3 !h-3 !bg-blue-400 !border-2 !border-blue-600" />
      <HandleLabel label="video" side="left" top="70%" />

      <Handle type="target" position={Position.Left} id="audio_url" style={{ top: "85%" }}
        className="!w-3 !h-3 !bg-pink-400 !border-2 !border-pink-600" />
      <HandleLabel label="audio" side="left" top="85%" />
    </div>
  );
}

export const OutputNode = memo(OutputNodeComponent);
