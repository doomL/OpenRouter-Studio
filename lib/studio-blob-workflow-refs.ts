export type WorkflowRef = { id: string; name: string };

/** Named saved workflows whose snapshot contains this node id. */
export function listWorkflowsContainingNode(
  workflowsJson: unknown,
  nodeId: string | null | undefined
): WorkflowRef[] {
  if (!nodeId || !Array.isArray(workflowsJson)) return [];
  const out: WorkflowRef[] = [];
  for (const w of workflowsJson) {
    if (!w || typeof w !== "object") continue;
    const o = w as Record<string, unknown>;
    const nodes = o.nodes;
    if (!Array.isArray(nodes)) continue;
    if (
      nodes.some(
        (n) =>
          n &&
          typeof n === "object" &&
          (n as { id?: string }).id === nodeId
      )
    ) {
      out.push({
        id: String(o.id ?? ""),
        name: String(o.name ?? "Untitled"),
      });
    }
  }
  return out;
}

/** Current cloud-synced canvas includes this node id. */
export function isNodeOnLiveCanvas(
  nodesJson: unknown,
  nodeId: string | null | undefined
): boolean {
  if (!nodeId || !Array.isArray(nodesJson)) return false;
  return nodesJson.some(
    (n) =>
      n && typeof n === "object" && (n as { id?: string }).id === nodeId
  );
}
