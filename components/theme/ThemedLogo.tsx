"use client";

import { cn } from "@/lib/utils";
import { useStudioStore } from "@/lib/store";

type ThemedLogoProps = {
  className?: string;
};

/**
 * Logo mark — follows persisted studio `theme` (same source as ThemeToggle / ThemeProvider).
 */
export function ThemedLogo({ className }: ThemedLogoProps) {
  const theme = useStudioStore((s) => s.theme);
  const src = theme === "dark" ? "/favicon_dark.svg" : "/favicon.svg";

  return <img src={src} alt="Logo" className={cn(className)} />;
}
