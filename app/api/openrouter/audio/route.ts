import { NextRequest, NextResponse } from "next/server";
import { modelUsesDedicatedSpeechApi } from "@/lib/openrouter-audio-routing";

const OPENROUTER_AUDIO_URL = "https://openrouter.ai/api/v1/chat/completions";

const MIME_BY_FORMAT: Record<string, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  flac: "audio/flac",
  opus: "audio/ogg",
  pcm16: "audio/wav",
};

function extractSsePayloads(buffer: string): { events: string[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  return { events: parts, rest };
}

function eventDataToJson(eventBlock: string): Record<string, unknown> | null {
  const dataLines = eventBlock
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());

  if (dataLines.length === 0) return null;
  const payload = dataLines.join("\n");
  if (!payload || payload === "[DONE]") return null;

  try {
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function wavFromPcm16Mono(
  pcm: Uint8Array,
  sampleRate = 24000,
  channels = 1,
  bitsPerSample = 16
): Uint8Array {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, Buffer.from(pcm)]);
}

async function fetchOpenRouterAudio(body: Record<string, unknown>, apiKey: string) {
  return fetch(OPENROUTER_AUDIO_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://openrouter-studio.local",
      "X-Title": "OpenRouter Studio",
    },
    body: JSON.stringify(body),
  });
}

function shouldRetryAsPcm16(errorText: string): boolean {
  return (
    errorText.includes("audio.format") &&
    errorText.includes("stream=true") &&
    errorText.includes("pcm16")
  );
}

function extractUserTextFromMessages(messages: unknown): string {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || typeof m !== "object") continue;
    if ((m as { role?: string }).role !== "user") continue;
    const c = (m as { content?: unknown }).content;
    if (typeof c === "string") return c.trim();
    if (Array.isArray(c)) {
      const parts: string[] = [];
      for (const p of c) {
        if (p && typeof p === "object" && (p as { type?: string }).type === "text") {
          const t = (p as { text?: string }).text;
          if (typeof t === "string") parts.push(t);
        }
      }
      const joined = parts.join("\n").trim();
      if (joined) return joined;
    }
  }
  return "";
}

function speechApiFormatAndOut(requested: string): {
  response_format: string;
  formatOut: string;
  hint?: string;
} {
  const r = requested.toLowerCase();
  if (r === "pcm16") return { response_format: "pcm", formatOut: "pcm16" };
  if (r === "wav") {
    return {
      response_format: "mp3",
      formatOut: "mp3",
      hint: "OpenRouter /audio/speech returned mp3 instead of wav (endpoint limitation).",
    };
  }
  if (["mp3", "opus", "aac", "flac"].includes(r)) {
    return { response_format: r, formatOut: r };
  }
  if (r === "pcm") return { response_format: "pcm", formatOut: "pcm16" };
  return { response_format: "mp3", formatOut: "mp3" };
}

async function handleDedicatedOpenRouterSpeech(
  body: Record<string, unknown>,
  apiKey: string,
  requestedFormat: string
): Promise<NextResponse> {
  const model = String(body.model ?? "");
  const inputText = extractUserTextFromMessages(body.messages);
  if (!inputText) {
    return NextResponse.json(
      {
        error:
          "Dedicated TTS (/audio/speech) needs non-empty user message text. Connect a prompt or upstream text.",
      },
      { status: 400 }
    );
  }
  const audioCfg = (body.audio as Record<string, unknown> | undefined) ?? {};
  const voiceRaw = audioCfg.voice;
  const voice =
    typeof voiceRaw === "string" && voiceRaw.trim() ? voiceRaw.trim() : "alloy";

  const { response_format, formatOut, hint } = speechApiFormatAndOut(requestedFormat);

  const res = await fetch("https://openrouter.ai/api/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://openrouter-studio.local",
      "X-Title": "OpenRouter Studio",
    },
    body: JSON.stringify({ model, input: inputText, voice, response_format }),
  });

  if (!res.ok) {
    const errText = await res.text();
    try {
      const j = JSON.parse(errText) as Record<string, unknown>;
      return NextResponse.json(j, { status: res.status });
    } catch {
      return NextResponse.json({ error: errText }, { status: res.status });
    }
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const ct =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "audio/mpeg";
  const audioDataUrl = `data:${ct};base64,${buf.toString("base64")}`;

  return NextResponse.json({
    audioDataUrl,
    transcript: "",
    format: formatOut,
    requestedFormat,
    warning: hint,
  });
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const requestedFormat =
      typeof body?.audio?.format === "string" && body.audio.format.trim()
        ? body.audio.format.trim().toLowerCase()
        : "wav";

    const modelStr = String(body?.model ?? "");
    if (modelStr && modelUsesDedicatedSpeechApi(modelStr)) {
      return handleDedicatedOpenRouterSpeech(body as Record<string, unknown>, apiKey, requestedFormat);
    }

    let requestBody = body as Record<string, unknown>;
    let effectiveFormat = requestedFormat;
    let warning: string | undefined;

    let res = await fetchOpenRouterAudio(requestBody, apiKey);
    if (!res.ok) {
      const errorText = await res.text();
      if (shouldRetryAsPcm16(errorText)) {
        requestBody = {
          ...requestBody,
          audio: {
            ...((requestBody.audio as Record<string, unknown> | undefined) ?? {}),
            format: "pcm16",
          },
        };
        effectiveFormat = "pcm16";
        warning =
          requestedFormat === "pcm16"
            ? undefined
            : `Provider rejected streaming format "${requestedFormat}". Retried with pcm16 and wrapped the result as WAV for playback.`;
        res = await fetchOpenRouterAudio(requestBody, apiKey);
      } else {
        return NextResponse.json({ error: errorText }, { status: res.status });
      }
    }

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ error: errorText }, { status: res.status });
    }

    if (!res.body) {
      return NextResponse.json(
        { error: "Audio stream missing from provider response" },
        { status: 502 }
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    const audioChunks: Buffer[] = [];
    const transcriptParts: string[] = [];

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      pending += decoder.decode(value, { stream: true });
      const { events, rest } = extractSsePayloads(pending);
      pending = rest;

      for (const eventBlock of events) {
        const payload = eventDataToJson(eventBlock);
        if (!payload) continue;

        const choices = Array.isArray(payload.choices) ? payload.choices : [];
        for (const choice of choices) {
          if (!choice || typeof choice !== "object") continue;
          const delta = (choice as { delta?: Record<string, unknown> }).delta;
          const message = (choice as { message?: Record<string, unknown> }).message;

          const deltaAudio =
            delta && typeof delta.audio === "object" && delta.audio
              ? (delta.audio as Record<string, unknown>)
              : null;
          if (typeof deltaAudio?.data === "string" && deltaAudio.data.length > 0) {
            audioChunks.push(Buffer.from(deltaAudio.data, "base64"));
          }
          if (
            typeof deltaAudio?.transcript === "string" &&
            deltaAudio.transcript.length > 0
          ) {
            transcriptParts.push(deltaAudio.transcript);
          }

          const messageAudio =
            message && typeof message.audio === "object" && message.audio
              ? (message.audio as Record<string, unknown>)
              : null;
          if (
            typeof messageAudio?.transcript === "string" &&
            messageAudio.transcript.length > 0
          ) {
            transcriptParts.push(messageAudio.transcript);
          }
        }
      }
    }

    const audioBytes = audioChunks.length > 0 ? Buffer.concat(audioChunks) : null;
    if (!audioBytes || audioBytes.length === 0) {
      return NextResponse.json(
        { error: "The model returned no audio data." },
        { status: 502 }
      );
    }

    let outputBytes: Uint8Array = audioBytes;
    let responseFormat = effectiveFormat;
    if (effectiveFormat === "pcm16") {
      outputBytes = wavFromPcm16Mono(audioBytes);
      responseFormat = "wav";
      if (!warning && requestedFormat === "pcm16") {
        warning = "Raw pcm16 audio was wrapped as WAV so the browser can preview and download it.";
      }
    }

    const mimeType = MIME_BY_FORMAT[responseFormat] || "audio/wav";
    const audioDataUrl = `data:${mimeType};base64,${Buffer.from(outputBytes).toString("base64")}`;

    return NextResponse.json({
      audioDataUrl,
      transcript: transcriptParts.join("").trim(),
      format: responseFormat,
      requestedFormat,
      warning,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
