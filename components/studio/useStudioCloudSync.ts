"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { signOutAtCurrentOrigin } from "@/lib/studio-sign-out";
import { useStudioStore, type StudioServerSnapshot } from "@/lib/store";
import { saveStudioSettingsToServer } from "@/lib/studio-settings-api";
import { readJsonResponse } from "@/lib/read-json-response";
import { toast } from "@/lib/toast";

const DEBOUNCE_MS = 600;
const LS_BACKUP_KEY = "or-studio-backup";

/** Save lightweight state snapshot to localStorage as crash-recovery backup. */
function saveLocalBackup() {
  try {
    const s = useStudioStore.getState();
    const backup = {
      nodes: s.nodes,
      edges: s.edges,
      workflows: s.workflows,
      dynamicHandleCounts: s.dynamicHandleCounts,
      savedAt: Date.now(),
    };
    localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(backup));
  } catch {
    // QuotaExceededError or storage not available — ignore silently
  }
}

/** Clear the local backup after it has been applied or dismissed. */
function clearLocalBackup() {
  try {
    localStorage.removeItem(LS_BACKUP_KEY);
  } catch {
    // ignore
  }
}

/**
 * Load studio state from the server for the logged-in user and save changes with debounce.
 * Uses `credentials: "include"` so the session cookie is always sent.
 * Flushes on tab hide / page unload so workflows and API key are not lost on refresh.
 * Also keeps a localStorage backup for crash recovery (e.g. OOM container restarts).
 */
export function useStudioCloudSync(): boolean {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const skipSave = useRef(true);
  const [cloudReady, setCloudReady] = useState(false);

  // Load server state and offer localStorage crash-recovery if applicable.
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
      let serverData: StudioServerSnapshot | null = null;
      try {
        const res = await fetch("/api/settings/studio", { credentials: "include" });
        if (cancelled) return;
        if (res.status === 401) {
          void signOutAtCurrentOrigin("/auth/login");
          return;
        }
        if (res.ok) {
          serverData = await readJsonResponse<StudioServerSnapshot>(res);
          useStudioStore.getState().hydrateFromServer(serverData);
        }
      } catch {
        // Offline / transient network failure — still allow local studio + debounced saves
      }

      // Check for a localStorage backup that might have more data than what the server returned.
      // This happens when the server crashed (OOM) before the debounced cloud save completed.
      if (!cancelled) {
        try {
          const backupStr = localStorage.getItem(LS_BACKUP_KEY);
          if (backupStr) {
            const backup = JSON.parse(backupStr) as {
              nodes: unknown[];
              edges: unknown[];
              workflows: unknown[];
              dynamicHandleCounts: unknown;
              savedAt: number;
            };
            const serverNodeCount = (serverData?.nodes ?? []).length;
            const backupNodeCount = backup.nodes?.length ?? 0;
            const isRecent = backup.savedAt > Date.now() - 24 * 60 * 60 * 1000; // within 24h

            if (isRecent && backupNodeCount > serverNodeCount) {
              toast("Unsaved work detected", {
                description:
                  "The app may have restarted before your last changes were synced. Restore them?",
                duration: Infinity,
                action: {
                  label: "Restore",
                  onClick: () => {
                    useStudioStore.getState().hydrateFromServer({
                      nodes: backup.nodes as StudioServerSnapshot["nodes"],
                      edges: backup.edges as StudioServerSnapshot["edges"],
                      workflows: backup.workflows as StudioServerSnapshot["workflows"],
                      dynamicHandleCounts:
                        backup.dynamicHandleCounts as StudioServerSnapshot["dynamicHandleCounts"],
                    });
                    clearLocalBackup();
                  },
                },
                cancel: {
                  label: "Dismiss",
                  onClick: clearLocalBackup,
                },
              });
            } else if (!isRecent) {
              // Stale backup — clear it
              clearLocalBackup();
            }
          }
        } catch {
          // Corrupt backup or localStorage unavailable — clear and continue
          clearLocalBackup();
        }
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

  // Debounced cloud save + immediate localStorage backup on every state change.
  useEffect(() => {
    if (status !== "authenticated" || !userId) return;

    let timer: ReturnType<typeof setTimeout>;

    const save = () => {
      saveLocalBackup();
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
      saveLocalBackup();
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
