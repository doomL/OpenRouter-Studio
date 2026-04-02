import { NextRequest, NextResponse } from "next/server";
import { fetchFromOpenRouter } from "@/lib/openrouter";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // OpenRouter image generation uses /v1/chat/completions with modalities
    // NOT /v1/images/generations (that endpoint doesn't exist)
    const {
      model,
      prompt,
      image,
      images: imagesFromBody,
      aspect_ratio,
      image_size,
      mode,
    } = body;

    const refUrls: string[] = [];
    if (Array.isArray(imagesFromBody)) {
      for (const u of imagesFromBody) {
        if (typeof u === "string" && u.length > 0) refUrls.push(u);
      }
    } else if (typeof image === "string" && image.length > 0) {
      refUrls.push(image);
    }

    const messages: Array<Record<string, unknown>> = [];

    // Reference image(s): text first, then each image (OpenRouter multimodal guidance).
    if (refUrls.length > 0) {
      const defaultWithRef =
        mode === "img2img" ? "Transform this image" : "Generate an image";
      const content: Array<Record<string, unknown>> = [
        { type: "text", text: prompt || defaultWithRef },
      ];
      for (const url of refUrls) {
        content.push({ type: "image_url", image_url: { url } });
      }
      messages.push({ role: "user", content });
    } else {
      messages.push({
        role: "user",
        content: prompt || "Generate an image",
      });
    }

    const payload: Record<string, unknown> = {
      model,
      messages,
      modalities: ["image", "text"],
    };

    // Add image_config if aspect ratio or size specified
    const imageConfig: Record<string, unknown> = {};
    if (aspect_ratio) imageConfig.aspect_ratio = aspect_ratio;
    if (image_size) imageConfig.image_size = image_size;
    if (Object.keys(imageConfig).length > 0) {
      payload.image_config = imageConfig;
    }

    const res = await fetchFromOpenRouter("/v1/chat/completions", apiKey, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    // Extract image from the chat completions response format
    // Response: { choices: [{ message: { images: [{ image_url: { url: "data:..." } }] } }] }
    const message = data.choices?.[0]?.message;
    const images = message?.images;

    if (images && images.length > 0) {
      const imageUrl = images[0].image_url?.url;
      return NextResponse.json({
        data: [{ url: imageUrl }],
      });
    }

    // Fallback: return raw response for debugging
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
