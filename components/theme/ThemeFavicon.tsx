"use client";

import { useLayoutEffect } from "react";
import { useStudioStore } from "@/lib/store";

function setFaviconHref(href: string) {
  const selectors = ['link[rel="icon"]', 'link[rel="shortcut icon"]'];
  let found = false;
  for (const sel of selectors) {
    document.querySelectorAll<HTMLLinkElement>(sel).forEach((link) => {
      link.href = href;
      found = true;
    });
  }
  if (!found) {
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = href;
    document.head.appendChild(link);
  }
}

/**
 * Keeps the document favicon in sync with the persisted studio theme.
 */
export function ThemeFavicon() {
  const theme = useStudioStore((s) => s.theme);

  useLayoutEffect(() => {
    const href = theme === "dark" ? "/favicon_dark.svg" : "/favicon.svg";
    setFaviconHref(href);
  }, [theme]);

  return null;
}
