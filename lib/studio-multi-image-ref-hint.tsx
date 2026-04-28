"use client";

import type { PointerEvent } from "react";

const DOCS_URL =
  "https://openrouter.ai/docs/guides/overview/multimodal/images";

/** Inline help: canvas allows many refs; API limit is per model/provider. */
export function StudioMultiImageRefHint({
  className = "text-[9px] text-muted-foreground leading-snug",
}: {
  className?: string;
}) {
  return (
    <p className={className}>
      You can connect many reference images on the canvas; how many each request accepts depends
      on the{" "}
      <a
        href={DOCS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-foreground/80 underline underline-offset-2 hover:text-foreground"
        onPointerDown={(e: PointerEvent<HTMLAnchorElement>) => e.stopPropagation()}
      >
        model and provider
      </a>
      , not a single OpenRouter-wide cap. If generation fails, try fewer refs.
    </p>
  );
}
