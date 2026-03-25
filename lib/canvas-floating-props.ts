const CANVAS_COLLISION = {
  side: "shift" as const,
  align: "shift" as const,
  fallbackAxisSide: "none" as const,
};

/**
 * Floating UI props for anchors inside transformed surfaces (e.g. React Flow).
 * Uses the viewport as the collision boundary instead of clipping ancestors,
 * which otherwise produce unstable / "random" popup positions.
 */
export function getCanvasViewportFloatingProps() {
  return {
    collisionBoundary:
      typeof globalThis !== "undefined" && "document" in globalThis
        ? globalThis.document.documentElement
        : undefined,
    collisionPadding: 12,
    collisionAvoidance: CANVAS_COLLISION,
  };
}

/** Base UI Select positioner defaults for model/dropdowns on the canvas. */
export function getCanvasSelectContentProps() {
  return {
    ...getCanvasViewportFloatingProps(),
    alignItemWithTrigger: false as const,
    align: "start" as const,
    side: "bottom" as const,
    sideOffset: 6,
  };
}
