import { NextRequest, NextResponse } from "next/server";
import { categorizeModels } from "@/lib/models";

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  try {
    const res = await fetch("https://openrouter.ai/api/frontend/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://openrouter-studio.local",
        "X-Title": "OpenRouter Studio",
      },
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`OpenRouter API error (${res.status}): ${error}`);
    }

    const json = await res.json();
    const models = json.data || json;
    const categorized = categorizeModels(Array.isArray(models) ? models : []);
    return NextResponse.json(categorized);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
