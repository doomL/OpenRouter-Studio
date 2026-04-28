import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchFromOpenRouter } from "@/lib/openrouter";
import {
  bodyMessagesReferenceStudioBlobs,
  normalizeVisionImageUrlsInBody,
} from "@/lib/openrouter-normalize-vision-urls";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const session = await auth();
    const userId = session?.user?.id;

    if (bodyMessagesReferenceStudioBlobs(body) && !userId) {
      return NextResponse.json(
        {
          error: {
            message:
              "Sign in is required when sending Studio blob image URLs to the model; the provider cannot fetch private /api/studio/blobs URLs.",
          },
        },
        { status: 401 }
      );
    }

    try {
      await normalizeVisionImageUrlsInBody(body, userId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to resolve vision image URLs";
      return NextResponse.json({ error: { message: msg } }, { status: 400 });
    }

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
