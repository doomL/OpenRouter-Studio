"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useStudioStore } from "@/lib/store";
import { saveStudioSettingsToServer } from "@/lib/studio-settings-api";

const DEBOUNCE_MS = 600;

/**
 * Load studio state from the server for the logged-in user and save changes with debounce.
 * Uses `credentials: "include"` so the session cookie is always sent.
 * Flushes on tab hide / page unload so workflows and API key are not lost on refresh.
 */
export function useStudioCloudSync(): boolean {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const skipSave = useRef(true);
  const [cloudReady, setCloudReady] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || !userId) {
      skipSave.current = true;
      setCloudReady(false);
      return;
    }

    let cancelled = false;
    skipSave.current = true;
    setCloudReady(false);

    void (async () => {
      try {
        const res = await fetch("/api/settings/studio", { credentials: "include" });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          useStudioStore.getState().hydrateFromServer(data);
        }
      } catch {
        // Offline / transient network failure — still allow local studio + debounced saves
      }
      if (cancelled) return;
      requestAnimationFrame(() => {
        skipSave.current = false;
        setCloudReady(true);
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [status, userId]);

  useEffect(() => {
    if (status !== "authenticated" || !userId) return;

    let timer: ReturnType<typeof setTimeout>;

    const save = () => {
      void saveStudioSettingsToServer();
    };

    const unsub = useStudioStore.subscribe(() => {
      if (skipSave.current) return;
      clearTimeout(timer);
      timer = setTimeout(save, DEBOUNCE_MS);
    });

    const flush = () => {
      if (skipSave.current) return;
      clearTimeout(timer);
      void saveStudioSettingsToServer(undefined, { keepalive: true });
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const onPageHide = () => flush();

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearTimeout(timer);
      unsub();
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      if (!skipSave.current) {
        void saveStudioSettingsToServer();
      }
    };
  }, [status, userId]);

  return cloudReady;
}
