import type { Node } from "@xyflow/react";
import { readJsonResponse } from "@/lib/read-json-response";
import { useStudioStore, type Workflow } from "@/lib/store";

/** Body shape for PUT /api/settings/studio */
export function getStudioSettingsPayload(overrides?: Partial<{ apiKey: string }>) {
  const s = useStudioStore.getState();
  return {
    apiKey: overrides?.apiKey !== undefined ? overrides.apiKey : s.apiKey,
    theme: s.theme,
    nodes: s.nodes,
    edges: s.edges,
    workflows: s.workflows,
    videoJobs: s.videoJobs,
    dynamicHandleCounts: s.dynamicHandleCounts,
  };
}

/** Persist current studio state to the server (call after important edits, e.g. API key). */
export async function saveStudioSettingsToServer(
  overrides?: Partial<{ apiKey: string }>,
  opts?: { keepalive?: boolean }
): Promise<Response> {
  try {
    const res = await fetch("/api/settings/studio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(getStudioSettingsPayload(overrides)),
      keepalive: opts?.keepalive,
    });
    if (res.status === 401 && typeof window !== "undefined") {
      const { signOutAtCurrentOrigin } = await import("@/lib/studio-sign-out");
      void signOutAtCurrentOrigin("/auth/login");
    }
    if (res.ok) {
      try {
        const body = await readJsonResponse<{
          ok?: boolean;
          nodes?: unknown;
          workflows?: unknown;
        }>(res.clone());
        if (Array.isArray(body.nodes) && Array.isArray(body.workflows)) {
          useStudioStore.getState().applyPersistedServerStudioGraph(
            body.nodes as Node[],
            body.workflows as Workflow[]
          );
        }
      } catch {
        // Malformed or non-JSON body — ignore
      }
    }
    return res;
  } catch {
    // Tab hidden, offline, or unload — fetch rejects; never surface as unhandledRejection
    return new Response(null, { status: 503, statusText: "Network Error" });
  }
}
