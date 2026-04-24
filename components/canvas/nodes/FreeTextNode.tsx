"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  NodeResizer,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";
import { useStudioStore } from "@/lib/store";

const FONT_MIN = 8;
const FONT_MAX = 200;

function clampFont(n: number) {
  return Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(n)));
}

/** Plain canvas text: resize handles scale font size; node snaps to content after resize. */
function FreeTextNodeComponent({ id, data, selected }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const updateNodeInternals = useUpdateNodeInternals();

  const text = (data.text as string) || "";
  const fontSize = clampFont(Number(data.fontSize) || 18);

  const editorRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef({ w: 1, h: 1, fs: fontSize });
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.textContent !== text) {
      el.textContent = text;
    }
  }, [text]);

  const readFontFromStore = useCallback(() => {
    const node = useStudioStore.getState().nodes.find((n) => n.id === id);
    const raw = (node?.data as Record<string, unknown> | undefined)?.fontSize;
    return clampFont(Number(raw) || 18);
  }, [id]);

  const onResizeStart = useCallback(
    (_: unknown, params: { width: number; height: number }) => {
      resizeStartRef.current = {
        w: Math.max(1, params.width),
        h: Math.max(1, params.height),
        fs: readFontFromStore(),
      };
    },
    [readFontFromStore]
  );

  const onResize = useCallback(
    (_: unknown, params: { width: number; height: number }) => {
      const { w, h, fs } = resizeStartRef.current;
      const scaleW = params.width / w;
      const scaleH = params.height / h;
      const scale = Math.sqrt(Math.max(0.05, scaleW * scaleH));
      updateNodeData(id, { fontSize: clampFont(fs * scale) });
    },
    [id, updateNodeData]
  );

  const onResizeEnd = useCallback(() => {
    const { nodes, setNodes } = useStudioStore.getState();
    setNodes(
      nodes.map((n) => {
        if (n.id !== id) return n;
        if (!n.style) return n;
        const nextStyle = { ...n.style };
        delete nextStyle.width;
        delete nextStyle.height;
        const style =
          Object.keys(nextStyle).length > 0 ? nextStyle : undefined;
        return { ...n, style };
      })
    );
    requestAnimationFrame(() => updateNodeInternals(id));
  }, [id, updateNodeInternals]);

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={48}
        minHeight={24}
        lineClassName="!border-primary/40"
        handleClassName="!h-2 !w-2 !rounded-sm !border !border-primary/60 !bg-background/90"
        onResizeStart={onResizeStart}
        onResize={onResize}
        onResizeEnd={onResizeEnd}
      />
      <div className="relative inline-flex max-w-[min(100vw-2rem,96vw)] bg-transparent">
        {!text && !focused && (
          <span
            className="pointer-events-none absolute inset-0 select-none text-muted-foreground/55"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: 1.35,
              fontWeight: 500,
            }}
            aria-hidden
          >
            Click to add text…
          </span>
        )}
        <div
          ref={editorRef}
          className="studio-freetext-editable nodrag nopan relative z-10 min-h-[1.2em] min-w-[2ch] max-w-full cursor-text whitespace-pre-wrap break-words text-foreground outline-none"
          contentEditable
          suppressContentEditableWarning
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: 1.35,
            fontWeight: 500,
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onInput={() => {
            const t = editorRef.current?.textContent ?? "";
            updateNodeData(id, { text: t });
            updateNodeInternals(id);
          }}
        />
      </div>
    </>
  );
}

export const FreeTextNode = memo(FreeTextNodeComponent);
