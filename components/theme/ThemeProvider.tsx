"use client";

import { useEffect, useState } from "react";
import { useStudioStore } from "@/lib/store";

/**
 * Keeps `document.documentElement` in sync with persisted `theme` from the studio store
 * so the landing page, auth pages, and /studio share one light/dark preference.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useStudioStore((s) => s.theme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme, mounted]);

  return <>{children}</>;
}
