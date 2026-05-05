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
    const payload = getStudioSettingsPayload(overrides);
    // Snapshot node data at send time so we can detect in-flight edits in the response handler.
    const snapshotById = new Map(
      payload.nodes.map((n) => [n.id, JSON.stringify(n.data)])
    );

    const res = await fetch("/api/settings/studio", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
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
          // Merge server response with current local state to avoid clobbering in-flight edits.
          //
          // Strategy: use currentNodes as the authoritative list (preserves deletions and
          // additions made while the PUT was in-flight). For each current node we apply any
          // server-side data transformations (e.g. base64 → blob ID) on fields the user has
          // NOT changed since the snapshot was captured.
          const currentNodes = useStudioStore.getState().nodes;
          const serverById = new Map((body.nodes as Node[]).map((n) => [n.id, n]));
          const mergedNodes = currentNodes.map((currentNode) => {
            const serverNode = serverById.get(currentNode.id);
            const snapshotDataJson = snapshotById.get(currentNode.id);
            // Node added after snapshot was sent, or server didn't return it → keep as-is.
            if (!serverNode || snapshotDataJson === undefined) return currentNode;
            const snapshotData = JSON.parse(snapshotDataJson) as Record<string, unknown>;
            // Start from server data (may have blob-transformed fields), then restore any
            // field the user changed in-flight.
            const mergedData = { ...serverNode.data } as Record<string, unknown>;
            for (const key of Object.keys(currentNode.data as Record<string, unknown>)) {
              const currentVal = JSON.stringify((currentNode.data as Record<string, unknown>)[key]);
              const snapshotVal = JSON.stringify(snapshotData[key]);
              // User changed this field while save was in-flight — keep local value.
              if (currentVal !== snapshotVal) {
                mergedData[key] = (currentNode.data as Record<string, unknown>)[key];
              }
            }
            return { ...serverNode, data: mergedData };
          });
          useStudioStore.getState().applyPersistedServerStudioGraph(
            mergedNodes,
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
