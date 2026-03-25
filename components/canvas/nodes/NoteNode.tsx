"use client";

import { memo, useCallback } from "react";
import { type NodeProps } from "@xyflow/react";
import { Textarea } from "@/components/ui/textarea";
import { useStudioStore } from "@/lib/store";

function NoteNodeComponent({ id, data }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);

  const text = (data.text as string) || "";
  const color = (data.color as string) || "yellow";

  const colors: Record<string, { bg: string; border: string; header: string }> = {
    yellow: { bg: "bg-yellow-50 dark:bg-yellow-900/20", border: "border-yellow-300 dark:border-yellow-700", header: "bg-yellow-200 dark:bg-yellow-800" },
    blue: { bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-300 dark:border-blue-700", header: "bg-blue-200 dark:bg-blue-800" },
    green: { bg: "bg-green-50 dark:bg-green-900/20", border: "border-green-300 dark:border-green-700", header: "bg-green-200 dark:bg-green-800" },
    pink: { bg: "bg-pink-50 dark:bg-pink-900/20", border: "border-pink-300 dark:border-pink-700", header: "bg-pink-200 dark:bg-pink-800" },
  };

  const c = colors[color] || colors.yellow;

  const handleTextChange = useCallback(
    (value: string) => updateNodeData(id, { text: value }),
    [id, updateNodeData]
  );

  const cycleColor = useCallback(() => {
    const order = ["yellow", "blue", "green", "pink"];
    const idx = order.indexOf(color);
    updateNodeData(id, { color: order[(idx + 1) % order.length] });
  }, [id, color, updateNodeData]);

  return (
    <div
      className={`min-w-[200px] w-max max-w-[min(100vw-1rem,90vw)] rounded-lg border ${c.border} ${c.bg} shadow-md`}
    >
      <div
        className={`flex items-center justify-between rounded-t-lg ${c.header} px-3 py-1 cursor-pointer`}
        onClick={cycleColor}
      >
        <span className="text-[10px] font-semibold text-foreground/70">Note</span>
        <span className="text-[9px] text-foreground/50">click to change color</span>
      </div>
      <div className="w-full min-w-[200px] p-2 nopan nodrag nowheel">
        <Textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Add a note..."
          rows={4}
          cols={24}
          className="nodrag nopan nowheel min-h-[5rem] min-w-[200px] w-auto max-w-[min(100vw-2rem,90vw)] text-xs bg-transparent border-none focus-visible:ring-0 p-1"
        />
      </div>
    </div>
  );
}

export const NoteNode = memo(NoteNodeComponent);
