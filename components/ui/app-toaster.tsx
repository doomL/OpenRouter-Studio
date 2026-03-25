"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { useStudioStore } from "@/lib/store";

/**
 * Global toasts — z-index above dialogs (see components/ui/dialog.tsx).
 */
export function AppToaster() {
  const theme = useStudioStore((s) => s.theme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Toaster
      theme={theme === "dark" ? "dark" : "light"}
      position="bottom-center"
      closeButton
      richColors
      offset="1rem"
      style={{ zIndex: 10200 }}
      toastOptions={{
        duration: 4000,
        classNames: {
          toast:
            "border border-foreground/10 bg-popover text-popover-foreground shadow-lg",
        },
      }}
    />
  );
}
