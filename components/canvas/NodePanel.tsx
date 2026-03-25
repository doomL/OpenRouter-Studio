"use client";

import { useCallback } from "react";
import {
  PencilIcon,
  ImageIcon,
  UploadIcon,
  BotIcon,
  PaletteIcon,
  ClapperboardIcon,
  MonitorIcon,
  StickyNoteIcon,
} from "lucide-react";
import { nodeDefinitions } from "./nodes";
import { useStudioStore } from "@/lib/store";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  pencil: PencilIcon,
  image: ImageIcon,
  upload: UploadIcon,
  bot: BotIcon,
  palette: PaletteIcon,
  clapperboard: ClapperboardIcon,
  monitor: MonitorIcon,
  stickyNote: StickyNoteIcon,
};

export function NodePanel() {
  const addNode = useStudioStore((s) => s.addNode);
  const nodes = useStudioStore((s) => s.nodes);

  const onDragStart = useCallback(
    (e: React.DragEvent, nodeType: string) => {
      e.dataTransfer.setData("application/reactflow", nodeType);
      e.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const handleClick = useCallback(
    (nodeType: string) => {
      const id = `${nodeType}-${Date.now()}`;
      const offset = nodes.length * 20;
      addNode({
        id,
        type: nodeType,
        position: { x: 250 + offset, y: 150 + offset },
        data: {},
      });
    },
    [addNode, nodes.length]
  );

  return (
    <div className="w-56 flex-shrink-0 border-r border-studio-node-border bg-studio-bg p-3 overflow-y-auto">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Add Nodes
      </h3>
      <div className="space-y-2">
        {nodeDefinitions.map((def) => {
          const Icon = iconMap[def.icon];
          return (
            <div
              key={def.type}
              className="flex cursor-grab items-center gap-2 rounded-md border border-studio-node-border bg-studio-node p-2 transition-colors hover:border-muted-foreground/40 hover:bg-accent active:cursor-grabbing"
              draggable
              onDragStart={(e) => onDragStart(e, def.type)}
              onClick={() => handleClick(def.type)}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded ${def.color}`}
              >
                {Icon && <Icon className="size-4 text-white" />}
              </div>
              <div>
                <div className="text-xs font-medium text-foreground">
                  {def.label}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {def.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
