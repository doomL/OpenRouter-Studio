import { NextRequest, NextResponse } from "next/server";
import { fetchFromOpenRouter } from "@/lib/openrouter";

// POST — submit video generation job
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const res = await fetchFromOpenRouter("/v1/videos", apiKey, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: 202 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET — poll video job status
export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  try {
    const url = `https://openrouter.ai/api/v1/videos/${encodeURIComponent(jobId)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://openrouter-studio.local",
        "X-Title": "OpenRouter Studio",
      },
    });

    let data: Record<string, unknown>;
    try {
      data = await res.json();
    } catch {
      // Non-JSON — job not ready yet
      return NextResponse.json({ status: "pending" });
    }

    // OpenRouter returns 404 "Job not found" for ~10s after creation,
    // and occasionally 500s during processing. Treat both as "pending".
    if (res.status === 404 || res.status >= 500) {
      return NextResponse.json({ status: "pending" });
    }

    return NextResponse.json(data);
  } catch {
    // Network error — tell client to keep polling
    return NextResponse.json({ status: "pending" });
  }
}
