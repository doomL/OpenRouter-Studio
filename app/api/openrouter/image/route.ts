import { NextRequest, NextResponse } from "next/server";
import { fetchFromOpenRouter } from "@/lib/openrouter";
import { extractGeneratedImageUrl } from "@/lib/openrouter-image-response";

/** Platforms that honor this (e.g. Vercel) won’t kill the function mid-generation. */
export const maxDuration = 300;

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
      font_inputs,
      super_resolution_references,
      mode,
      modalities: modalitiesFromBody,
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

    let modalities: string[] = ["image", "text"];
    if (Array.isArray(modalitiesFromBody)) {
      const m = modalitiesFromBody.filter((x): x is string => typeof x === "string");
      if (m.length > 0 && m.every((x) => x === "image" || x === "text")) {
        modalities = m;
      }
    }

    const payload: Record<string, unknown> = {
      model,
      messages,
      modalities,
    };

    // Add image_config if aspect ratio or size specified
    const imageConfig: Record<string, unknown> = {};
    if (aspect_ratio) imageConfig.aspect_ratio = aspect_ratio;
    if (image_size) imageConfig.image_size = image_size;

    if (Array.isArray(font_inputs)) {
      const normalizedFonts = font_inputs
        .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
        .map((x) => ({
          font_url: typeof x.font_url === "string" ? x.font_url.trim() : "",
          text: typeof x.text === "string" ? x.text.trim() : "",
        }))
        .filter((x) => x.font_url.length > 0 && x.text.length > 0)
        .slice(0, 2);
      if (normalizedFonts.length > 0) imageConfig.font_inputs = normalizedFonts;
    }

    if (Array.isArray(super_resolution_references)) {
      const normalizedRefs = super_resolution_references
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter((x) => x.length > 0)
        .slice(0, 4);
      if (normalizedRefs.length > 0) {
        imageConfig.super_resolution_references = normalizedRefs;
      }
    }

    if (Object.keys(imageConfig).length > 0) {
      payload.image_config = imageConfig;
    }

    const res = await fetchFromOpenRouter("/v1/chat/completions", apiKey, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const raw = await res.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        {
          error: {
            message: `OpenRouter returned non-JSON (proxy or gateway issue?). First bytes: ${raw.slice(0, 180).replace(/\s+/g, " ")}`,
          },
        },
        { status: 502 }
      );
    }

    const topError = data.error;
    if (topError != null) {
      if (typeof topError === "string") {
        return NextResponse.json(
          { error: { message: topError } },
          { status: 502 }
        );
      }
      if (typeof topError === "object") {
        const msg = (topError as Record<string, unknown>).message;
        return NextResponse.json(
          {
            error: {
              message:
                typeof msg === "string"
                  ? msg
                  : "OpenRouter returned an error without a message",
            },
          },
          { status: 502 }
        );
      }
    }

    const choices = data.choices as unknown[] | undefined;
    if (!Array.isArray(choices) || choices.length === 0) {
      return NextResponse.json(
        {
          error: {
            message:
              "OpenRouter returned no choices. The model may have refused the request, or the upstream response was truncated (check proxy timeouts if this happens quickly).",
            model,
          },
        },
        { status: 502 }
      );
    }

    const choice = choices[0] as Record<string, unknown> | undefined;
    const message = choice?.message;
    const imageUrl = extractGeneratedImageUrl(message);

    if (imageUrl) {
      return NextResponse.json({ data: [{ url: imageUrl }] });
    }

    const textHint =
      message && typeof message === "object"
        ? (() => {
            const c = (message as Record<string, unknown>).content;
            if (typeof c === "string" && c.trim()) return c.slice(0, 400);
            return undefined;
          })()
        : undefined;
    const finish = choice?.finish_reason;

    return NextResponse.json(
      {
        error: {
          message:
            "The model returned no image. Try another image model, adjust the prompt, or check that the model supports image output with the current modalities.",
          hint: textHint,
          finish_reason: finish,
          model,
        },
      },
      { status: 502 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
