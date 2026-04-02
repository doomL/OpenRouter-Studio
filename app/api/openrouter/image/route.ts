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
    const { model, prompt, image, aspect_ratio, image_size, mode } = body;

    const messages: Array<Record<string, unknown>> = [];

    // Reference image (style / img2img): include alongside text. Default copy matches mode
    // so "text to image" + ref does not imply "transform" when the prompt is empty.
    if (image) {
      const defaultWithRef =
        mode === "img2img" ? "Transform this image" : "Generate an image";
      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt || defaultWithRef },
          { type: "image_url", image_url: { url: image } },
        ],
      });
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
