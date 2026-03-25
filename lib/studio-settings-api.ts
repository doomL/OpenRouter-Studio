import { useStudioStore } from "@/lib/store";

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
    return await fetch("/api/settings/studio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(getStudioSettingsPayload(overrides)),
      keepalive: opts?.keepalive,
    });
  } catch {
    // Tab hidden, offline, or unload — fetch rejects; never surface as unhandledRejection
    return new Response(null, { status: 503, statusText: "Network Error" });
  }
}
