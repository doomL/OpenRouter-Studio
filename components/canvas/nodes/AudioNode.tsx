"use client";

import { memo, useCallback, useEffect } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Button } from "@/components/ui/button";
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
import { getNodeInputs } from "@/lib/execution";
import { ModelSelector } from "@/components/ui/ModelSelector";
import { HandleLabel } from "@/components/canvas/HandleLabel";
import { getCanvasSelectContentProps } from "@/lib/canvas-floating-props";
import { readJsonResponse } from "@/lib/read-json-response";
import { fetchWithRetry, STUDIO_FETCH_MAX_ATTEMPTS } from "@/lib/fetch-with-retry";

const AUDIO_FORMATS = ["wav", "mp3", "flac", "opus", "pcm16"] as const;
/** Common OpenAI-style voices — not every audio model supports these. */
const OPENAI_STYLE_VOICE_HINTS = [
  "alloy",
  "echo",
  "fable",
  "onyx",
  "nova",
  "shimmer",
] as const;

function AudioNodeComponent({ id, data }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const setNodeOutput = useStudioStore((s) => s.setNodeOutput);
  const nodeOutput = useStudioStore((s) => s.nodeOutputs[id]);
  const edges = useStudioStore((s) => s.edges);
  const nodeOutputs = useStudioStore((s) => s.nodeOutputs);
  const apiKey = useStudioStore((s) => s.apiKey);

  const model = (data.model as string) || "";
  const nodeLabel = (data.label as string) || "Audio Generation";
  const voice = (data.voice as string) || "";
  const format = (data.format as string) || "wav";

  useEffect(() => {
    if ((data.generatedAudio || data.generatedTranscript) && !nodeOutput?.audio_url) {
      setNodeOutput(id, {
        audio_url: (data.generatedAudio as string) || undefined,
        text: (data.generatedTranscript as string) || undefined,
        status: "done",
      });
    }
  }, [
    data.generatedAudio,
    data.generatedTranscript,
    id,
    nodeOutput?.audio_url,
    setNodeOutput,
  ]);

  const status = nodeOutput?.status || "idle";
  const borderColor =
    status === "loading"
      ? "border-yellow-500 animate-pulse"
      : status === "done"
      ? "border-green-500"
      : status === "error"
      ? "border-red-500"
      : "border-studio-node-border";

  const generate = useCallback(async () => {
    if (!model || !apiKey) return;
    setNodeOutput(id, { status: "loading" });

    try {
      const inputs = getNodeInputs(id, edges, nodeOutputs);
      const prompt = inputs.prompt || inputs.text || "";
      const system = inputs.system || "";

      const messages: Array<Record<string, unknown>> = [];
      if (system) {
        messages.push({ role: "system", content: system });
      }
      messages.push({ role: "user", content: prompt });

      const audioPayload: Record<string, string> = { format };
      const v = voice.trim();
      if (v) {
        audioPayload.voice = v;
      }

      const res = await fetchWithRetry(
        "/api/openrouter/audio",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            model,
            messages,
            modalities: ["text", "audio"],
            audio: audioPayload,
            stream: true,
          }),
        },
        { maxAttempts: STUDIO_FETCH_MAX_ATTEMPTS }
      );

      const result = await readJsonResponse<{
        error?: unknown;
        audioDataUrl?: string;
        transcript?: string;
        format?: string;
        warning?: string;
      }>(res);

      if (!res.ok) {
        const msg =
          typeof result.error === "string"
            ? result.error
            : result.error
            ? JSON.stringify(result.error)
            : `Audio request failed (HTTP ${res.status})`;
        throw new Error(msg);
      }

      if (!result.audioDataUrl) {
        throw new Error("No audio returned by the model.");
      }

      updateNodeData(id, {
        generatedAudio: result.audioDataUrl,
        generatedTranscript: result.transcript || "",
        format: result.format || format,
        audioWarning: result.warning || "",
      });
      setNodeOutput(id, {
        audio_url: result.audioDataUrl,
        text: result.transcript || "",
        status: "done",
        error: result.warning || undefined,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setNodeOutput(id, { status: "error", error: msg });
    }
  }, [id, model, apiKey, edges, nodeOutputs, voice, format, setNodeOutput, updateNodeData]);

  const handleDownload = useCallback(() => {
    if (!nodeOutput?.audio_url) return;
    const a = document.createElement("a");
    a.href = nodeOutput.audio_url;
    a.download = `${id}.${format}`;
    a.click();
  }, [id, format, nodeOutput?.audio_url]);

  return (
    <div
      className={`min-w-[280px] rounded-lg border-2 ${borderColor} bg-studio-node shadow-lg relative`}
    >
      <div className="rounded-t-lg bg-pink-700 px-3 py-1.5 text-xs font-semibold text-white flex items-center justify-between gap-2">
        <span>{nodeLabel}</span>
        <Input
          value={nodeLabel === "Audio Generation" ? "" : nodeLabel}
          onChange={(e) =>
            updateNodeData(id, { label: e.target.value || "Audio Generation" })
          }
          placeholder="Label..."
          className="h-5 w-24 border-0 bg-transparent px-1 text-[10px] text-right text-pink-100 placeholder:text-pink-200/60 focus-visible:ring-0"
        />
      </div>

      <div className="space-y-2 p-3 nopan nodrag nowheel">
        <ModelSelector
          category="audio"
          value={model}
          onChange={(v) => updateNodeData(id, { model: v })}
        />

        <div>
          <Label className="text-xs text-muted-foreground">
            Voice <span className="font-normal opacity-70">(optional)</span>
          </Label>
          <p className="text-[9px] text-muted-foreground/90 leading-snug mb-1">
            Only some models use this (often OpenAI-style audio). Leave empty if unsure.
          </p>
          <Input
            value={voice}
            onChange={(e) => updateNodeData(id, { voice: e.target.value })}
            list={`openrouter-audio-voice-hints-${id}`}
            placeholder="e.g. alloy, or provider-specific id"
            className="h-7 text-xs bg-studio-node-input border-studio-node-border"
          />
          <datalist id={`openrouter-audio-voice-hints-${id}`}>
            {OPENAI_STYLE_VOICE_HINTS.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Format</Label>
          <Select
            value={format}
            onValueChange={(v) => v && updateNodeData(id, { format: v })}
          >
            <SelectTrigger className="h-7 text-xs bg-studio-node-input border-studio-node-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent {...getCanvasSelectContentProps()}>
              {AUDIO_FORMATS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-[10px] text-muted-foreground leading-snug">
          Connect a prompt or LLM text output to generate spoken audio. Models that support
          music or song generation can also be used here via the custom model picker.
        </p>
        <p className="text-[10px] text-muted-foreground/80 leading-snug">
          Some providers only allow streaming audio as <code>pcm16</code>. When that
          happens, Studio retries automatically and wraps the result as WAV for playback.
        </p>

        <Button
          size="sm"
          className="w-full"
          onClick={generate}
          disabled={status === "loading" || !model}
        >
          {status === "loading" ? "Generating..." : "Generate"}
        </Button>

        {nodeOutput?.audio_url && (
          <div className="space-y-1">
            <audio controls src={nodeOutput.audio_url} className="w-full" />
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] w-full"
              onClick={handleDownload}
            >
              Download Audio
            </Button>
          </div>
        )}

        {nodeOutput?.text && (
          <div className="max-h-[140px] overflow-auto rounded bg-studio-node-input p-2 text-xs text-muted-foreground whitespace-pre-wrap">
            {nodeOutput.text}
          </div>
        )}

        {nodeOutput?.error && (
          <div
            className={`rounded p-2 text-xs ${
              status === "done"
                ? "bg-yellow-900/20 text-yellow-300"
                : "bg-red-900/30 text-red-400"
            }`}
          >
            {nodeOutput.error}
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Left} id="prompt" style={{ top: "35%" }}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-gray-600" />
      <HandleLabel label="prompt" side="left" top="35%" />

      <Handle type="target" position={Position.Left} id="system" style={{ top: "50%" }}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-gray-600" />
      <HandleLabel label="system" side="left" top="50%" />

      <Handle type="source" position={Position.Right} id="audio_url" style={{ top: "40%" }}
        className="!w-3 !h-3 !bg-pink-400 !border-2 !border-pink-600" />
      <HandleLabel label="audio out" side="right" top="40%" />

      <Handle type="source" position={Position.Right} id="text" style={{ top: "62%" }}
        className="!w-3 !h-3 !bg-purple-400 !border-2 !border-purple-600" />
      <HandleLabel label="transcript" side="right" top="62%" />
    </div>
  );
}

export const AudioNode = memo(AudioNodeComponent);
