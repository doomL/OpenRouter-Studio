import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  parseStudioBlobIdFromRef,
  resolveImageUrlForOpenRouter,
} from "@/lib/studio-blob-for-openrouter";
import { parseDataUrlToBuffer } from "@/lib/studio-media-blob-fields";

function mimeTypeToOpenRouterAudioFormat(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("wav")) return "wav";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("flac")) return "flac";
  if (m.includes("m4a") || m.includes("mp4")) return "m4a";
  if (m.includes("aac")) return "aac";
  if (m.includes("aiff")) return "aiff";
  if (m.includes("pcm")) return "pcm16";
  return "wav";
}

function dataUrlToInputAudio(dataUrl: string): { data: string; format: string } {
  const parsed = parseDataUrlToBuffer(dataUrl);
  if (!parsed) throw new Error("Invalid base64 audio data URL.");
  return {
    data: parsed.buffer.toString("base64"),
    format: mimeTypeToOpenRouterAudioFormat(parsed.mimeType),
  };
}

async function httpsUrlToInputAudio(url: string): Promise<{ data: string; format: string }> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Failed to download audio (HTTP ${res.status}).`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type") || "application/octet-stream";
  return {
    data: buf.toString("base64"),
    format: mimeTypeToOpenRouterAudioFormat(ct),
  };
}

async function resolveAudioUrlToInputAudio(
  audioUrl: string,
  userId: string | undefined
): Promise<{ data: string; format: string }> {
  const resolved = await resolveImageUrlForOpenRouter(audioUrl.trim(), userId);
  if (resolved.startsWith("data:")) {
    return dataUrlToInputAudio(resolved);
  }
  if (resolved.startsWith("http://") || resolved.startsWith("https://")) {
    return httpsUrlToInputAudio(resolved);
  }
  throw new Error("Resolved audio URL must be data: or http(s).");
}

function messageContentToString(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const p of content) {
    if (p && typeof p === "object" && (p as { type?: string }).type === "text") {
      const t = (p as { text?: string }).text;
      if (typeof t === "string") parts.push(t);
    }
  }
  return parts.join("");
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const model = typeof body.model === "string" ? body.model.trim() : "";
    const audioUrl = typeof body.audioUrl === "string" ? body.audioUrl.trim() : "";
    const instruction =
      typeof body.instruction === "string" && body.instruction.trim().length > 0
        ? body.instruction.trim()
        : "Transcribe this audio.";

    if (!model) {
      return NextResponse.json({ error: { message: "model is required" } }, { status: 400 });
    }
    if (!audioUrl) {
      return NextResponse.json({ error: { message: "audioUrl is required" } }, { status: 400 });
    }

    const session = await auth();
    const userId = session?.user?.id;
    if (parseStudioBlobIdFromRef(audioUrl) != null && !userId) {
      return NextResponse.json(
        {
          error: {
            message:
              "Sign in is required to transcribe Studio blob audio URLs (private /api/studio/blobs).",
          },
        },
        { status: 401 }
      );
    }

    let inputAudio: { data: string; format: string };
    try {
      inputAudio = await resolveAudioUrlToInputAudio(audioUrl, userId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load audio.";
      return NextResponse.json({ error: { message: msg } }, { status: 400 });
    }

    const messages: Array<Record<string, unknown>> = [
      {
        role: "user",
        content: [
          { type: "text", text: instruction },
          { type: "input_audio", input_audio: inputAudio },
        ],
      },
    ];

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://openrouter-studio.local",
        "X-Title": "OpenRouter Studio",
      },
      body: JSON.stringify({ model, messages, stream: false }),
    });

    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    const choices = data.choices as Array<Record<string, unknown>> | undefined;
    const message = choices?.[0]?.message as Record<string, unknown> | undefined;
    const text = messageContentToString(message?.content).trim() || "No transcript in response.";

    return NextResponse.json({ text, usage: data.usage });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
