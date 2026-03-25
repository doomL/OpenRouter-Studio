import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Accept API key from header or query param (needed for <video src="..."> tags)
  const apiKey =
    req.headers.get("x-api-key") ||
    req.nextUrl.searchParams.get("key");
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  const jobId = req.nextUrl.searchParams.get("jobId");
  const index = req.nextUrl.searchParams.get("index") || "0";
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  try {
    const url = `https://openrouter.ai/api/alpha/videos/${encodeURIComponent(jobId)}/content?index=${index}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const blob = await res.blob();
    return new NextResponse(blob, {
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "video/mp4",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
