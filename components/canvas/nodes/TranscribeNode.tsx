"use client";

import { memo, useCallback, useEffect, useRef } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStudioStore } from "@/lib/store";
import { getNodeInputs } from "@/lib/execution";
import { ModelSelector } from "@/components/ui/ModelSelector";
import { HandleLabel } from "@/components/canvas/HandleLabel";
import { readJsonResponse } from "@/lib/read-json-response";
import { fetchWithRetry, STUDIO_FETCH_MAX_ATTEMPTS } from "@/lib/fetch-with-retry";

const MAX_UPLOAD_BYTES = 24 * 1024 * 1024;

const DEFAULT_NODE_LABEL = "Speech to text";

function TranscribeNodeComponent({ id, data }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const setNodeOutput = useStudioStore((s) => s.setNodeOutput);
  const nodeOutput = useStudioStore((s) => s.nodeOutputs[id]);
  const edges = useStudioStore((s) => s.edges);
  const nodes = useStudioStore((s) => s.nodes);
  const nodeOutputs = useStudioStore((s) => s.nodeOutputs);
  const apiKey = useStudioStore((s) => s.apiKey);
  const addCost = useStudioStore((s) => s.addCost);
  const fileRef = useRef<HTMLInputElement>(null);

  const model = (data.model as string) || "";
  const nodeLabel = (data.label as string) || DEFAULT_NODE_LABEL;
  const instruction =
    (data.instruction as string) ||
    "Transcribe the audio in the language it is spoken.";
  const uploadedAudioDataUrl = (data.uploadedAudioDataUrl as string) || "";

  const persistedText = data.transcript as string | undefined;
  useEffect(() => {
    if (
      persistedText &&
      !nodeOutput?.text &&
      nodeOutput?.status !== "loading"
    ) {
      setNodeOutput(id, { text: persistedText, status: "done" });
    }
  }, [id, persistedText, nodeOutput?.text, nodeOutput?.status, setNodeOutput]);

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
    const inputs = getNodeInputs(id, edges, nodeOutputs, nodes);
    const audioUrl = inputs.audio_url || uploadedAudioDataUrl;
    if (!audioUrl?.trim()) {
      setNodeOutput(id, {
        ...useStudioStore.getState().nodeOutputs[id],
        status: "error",
        error:
          "Add audio: connect the Audio output from Audio Gen or choose a file below.",
      });
      return;
    }

    setNodeOutput(id, {
      ...nodeOutputs[id],
      status: "loading",
      error: undefined,
    });

    const instruct =
      (inputs.prompt || inputs.text || "").trim() || instruction.trim();

    try {
      const res = await fetchWithRetry(
        "/api/openrouter/transcribe",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            model,
            audioUrl: audioUrl.trim(),
            instruction: instruct,
          }),
        },
        { maxAttempts: STUDIO_FETCH_MAX_ATTEMPTS }
      );

      const result = await readJsonResponse<{
        error?: unknown;
        text?: string;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      }>(res);

      if (!res.ok) {
        const msg =
          typeof result.error === "string"
            ? result.error
            : result.error && typeof result.error === "object" && "message" in result.error
              ? String((result.error as { message?: string }).message)
              : JSON.stringify(result.error) ||
                `Transcription failed (HTTP ${res.status}).`;
        throw new Error(msg);
      }

      const text = result.text ?? "";
      if (result.usage) {
        const models = useStudioStore.getState().models;
        const modelInfo =
          models?.transcribe.find((m) => m.id === model) ||
          models?.text.find((m) => m.id === model);
        if (modelInfo?.pricing) {
          const cost =
            (result.usage.prompt_tokens || 0) *
              parseFloat(modelInfo.pricing.prompt || "0") +
            (result.usage.completion_tokens || 0) *
              parseFloat(modelInfo.pricing.completion || "0");
          if (cost > 0) addCost(cost);
        }
      }

      updateNodeData(id, { transcript: text });
      setNodeOutput(id, { text, status: "done" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error.";
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
    instruction,
    uploadedAudioDataUrl,
    setNodeOutput,
    updateNodeData,
    addCost,
  ]);

  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      if (file.size > MAX_UPLOAD_BYTES) {
        setNodeOutput(id, {
          ...useStudioStore.getState().nodeOutputs[id],
          status: "error",
          error: `File too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB).`,
        });
        return;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      updateNodeData(id, { uploadedAudioDataUrl: dataUrl });
    },
    [id, setNodeOutput, updateNodeData]
  );

  return (
    <div
      className={`min-w-[280px] rounded-lg border-2 ${borderColor} bg-studio-node shadow-lg relative`}
    >
      <div className="rounded-t-lg bg-cyan-800 px-3 py-1.5 text-xs font-semibold text-white flex items-center justify-between gap-2">
        <span className="min-w-0 truncate">{nodeLabel}</span>
        <Input
          value={nodeLabel === DEFAULT_NODE_LABEL ? "" : nodeLabel}
          onChange={(e) =>
            updateNodeData(id, { label: e.target.value || DEFAULT_NODE_LABEL })
          }
          placeholder="Label…"
          className="h-5 w-24 border-0 bg-transparent px-1 text-[10px] text-right text-cyan-100 placeholder:text-cyan-200/60 focus-visible:ring-0"
        />
      </div>

      <div className="space-y-2 p-3 nopan nodrag nowheel">
        <ModelSelector
          category="transcribe"
          value={model}
          onChange={(v) => updateNodeData(id, { model: v })}
        />

        <div>
          <Label className="text-xs text-muted-foreground">Instructions</Label>
          <Input
            value={instruction}
            onChange={(e) => updateNodeData(id, { instruction: e.target.value })}
            placeholder="e.g. word-for-word, add speaker labels, language…"
            className="h-7 text-xs bg-studio-node-input border-studio-node-border mt-1"
          />
          <p className="text-[9px] text-muted-foreground mt-0.5 leading-snug">
            Optional if you connect text from another node (gray Instructions handle).
          </p>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Or upload an audio file</Label>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full h-7 text-xs mt-1"
            onClick={() => fileRef.current?.click()}
          >
            Choose file…
          </Button>
          {uploadedAudioDataUrl ? (
            <p className="text-[9px] text-muted-foreground mt-1 truncate">
              File selected — ready to run
            </p>
          ) : null}
        </div>

        <p className="text-[10px] text-muted-foreground leading-snug">
          <strong>Input:</strong> upload a file here, or connect the pink <strong>Audio</strong>{" "}
          handle from an Audio Gen node. <strong>Output:</strong> transcript appears below and on
          the purple <strong>Text</strong> handle on the right.
        </p>

        <Button
          size="sm"
          className="w-full"
          onClick={run}
          disabled={status === "loading" || !model}
        >
          {status === "loading" ? "Transcribing…" : "Transcribe"}
        </Button>

        {nodeOutput?.text ? (
          <div className="max-h-[200px] overflow-auto rounded bg-studio-node-input p-2 text-xs text-muted-foreground whitespace-pre-wrap">
            {nodeOutput.text}
          </div>
        ) : null}

        {nodeOutput?.error ? (
          <div className="rounded bg-red-900/30 p-2 text-xs text-red-400">
            {nodeOutput.error}
          </div>
        ) : null}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        id="audio_url"
        style={{ top: "32%" }}
        className="!w-3 !h-3 !bg-pink-400 !border-2 !border-pink-600"
      />
      <HandleLabel label="Audio" side="left" top="32%" />

      <Handle
        type="target"
        position={Position.Left}
        id="prompt"
        style={{ top: "52%" }}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-gray-600"
      />
      <HandleLabel label="Instructions" side="left" top="52%" />

      <Handle
        type="source"
        position={Position.Right}
        id="text"
        style={{ top: "50%" }}
        className="!w-3 !h-3 !bg-purple-400 !border-2 !border-purple-600"
      />
      <HandleLabel label="Text" side="right" top="50%" />
    </div>
  );
}

export const TranscribeNode = memo(TranscribeNodeComponent);
