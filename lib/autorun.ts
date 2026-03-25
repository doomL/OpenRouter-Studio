import { type Node, type Edge } from "@xyflow/react";
import { type NodeOutput } from "./store";

/**
 * Topological sort nodes by dependency order.
 * Returns node IDs in execution order (sources first, sinks last).
 */
export function getExecutionOrder(nodes: Node[], edges: Edge[]): string[] {
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const neighbor of adjacency.get(id) || []) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  return order;
}

/** Node types that are executable (have a "Run" or "Generate" button) */
const EXECUTABLE_TYPES = new Set(["llm", "imageGen", "videoGen"]);

/** Filter execution order to only runnable nodes */
export function getRunnableNodes(nodes: Node[], edges: Edge[]): Node[] {
  const order = getExecutionOrder(nodes, edges);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return order
    .map((id) => nodeMap.get(id))
    .filter((n): n is Node => !!n && EXECUTABLE_TYPES.has(n.type || ""));
}

/** Check if a node's upstream dependencies are satisfied */
export function hasUpstreamOutput(
  nodeId: string,
  edges: Edge[],
  nodeOutputs: Record<string, NodeOutput>
): boolean {
  const incoming = edges.filter((e) => e.target === nodeId);
  if (incoming.length === 0) return true;
  // At least one upstream must have output
  return incoming.some((e) => {
    const out = nodeOutputs[e.source];
    return out && out.status === "done";
  });
}
