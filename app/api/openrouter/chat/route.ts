import { NextRequest, NextResponse } from "next/server";
import { fetchFromOpenRouter } from "@/lib/openrouter";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const res = await fetchFromOpenRouter("/v1/chat/completions", apiKey, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
