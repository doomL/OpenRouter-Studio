"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { useStudioStore } from "@/lib/store";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const theme = useStudioStore((s) => s.theme);
  const toggleTheme = useStudioStore((s) => s.toggleTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-foreground shrink-0"
      onClick={() => toggleTheme()}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {mounted ? (
        theme === "dark" ? (
          <SunIcon className="size-[18px]" />
        ) : (
          <MoonIcon className="size-[18px]" />
        )
      ) : (
        <span className="size-[18px] inline-block" aria-hidden />
      )}
    </Button>
  );
}
