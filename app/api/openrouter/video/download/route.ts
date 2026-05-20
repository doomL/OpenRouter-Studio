import { NextRequest, NextResponse } from "next/server";

// Stream video directly from OpenRouter — no buffering in memory.
// Supports Range requests so the browser can seek without re-downloading.
export const dynamic = "force-dynamic";

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

  const upstreamUrl = `https://openrouter.ai/api/v1/videos/${encodeURIComponent(jobId)}/content?index=${index}`;

  const upstreamHeaders: HeadersInit = {
    Authorization: `Bearer ${apiKey}`,
  };

  // Forward Range header if the browser is seeking
  const rangeHeader = req.headers.get("range");
  if (rangeHeader) {
    upstreamHeaders["Range"] = rangeHeader;
  }

  try {
    // Pass the client's AbortSignal so upstream fetch cancels cleanly when the
    // client disconnects — prevents "Controller is already closed" errors.
    const res = await fetch(upstreamUrl, {
      headers: upstreamHeaders,
      signal: req.signal,
    });

    if (!res.ok && res.status !== 206) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const responseHeaders: HeadersInit = {
      "Content-Type": res.headers.get("Content-Type") || "video/mp4",
      "Cache-Control": "private, max-age=3600",
      "Accept-Ranges": "bytes",
    };

    // Forward Content-Length and Content-Range so browser can track progress and seek
    const contentLength = res.headers.get("Content-Length");
    if (contentLength) responseHeaders["Content-Length"] = contentLength;

    const contentRange = res.headers.get("Content-Range");
    if (contentRange) responseHeaders["Content-Range"] = contentRange;

    // Stream body directly — never buffer
    return new NextResponse(res.body, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (e) {
    // Client disconnected — not a real error, suppress it
    if (e instanceof Error && e.name === "AbortError") return new NextResponse(null, { status: 499 });
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
