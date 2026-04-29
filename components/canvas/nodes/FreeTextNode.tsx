"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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

function readStyleDim(
  style: CSSProperties | undefined,
  key: "width" | "height"
): number | undefined {
  if (!style) return undefined;
  const v = style[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/px$/i, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** Plain canvas text: resize handles scale font size; node snaps to content after resize. */
function FreeTextNodeComponent({ id, data, selected }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const setNodes = useStudioStore((s) => s.setNodes);
  const updateNodeInternals = useUpdateNodeInternals();

  const text = (data.text as string) || "";
  const fontSize = clampFont(Number(data.fontSize) || 18);

  const editorRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef(false);
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

  /** Sync React Flow node bounds to the content box (not the RF wrapper), so the outline/hit area matches visible text. */
  const syncNodeSizeToContent = useCallback(() => {
    if (resizingRef.current) return;
    const editor = editorRef.current;
    if (!editor) return;
    // scrollWidth/scrollHeight reflect full content even when the RF parent still has stale width/height.
    const pad = 2;
    const nextW = Math.max(48, Math.ceil(editor.scrollWidth + pad));
    const nextH = Math.max(24, Math.ceil(editor.scrollHeight + pad));

    const { nodes } = useStudioStore.getState();
    const node = nodes.find((n) => n.id === id);
    if (!node) return;

    const prevW = readStyleDim(node.style, "width");
    const prevH = readStyleDim(node.style, "height");
    const same =
      prevW !== undefined &&
      prevH !== undefined &&
      Math.abs(prevW - nextW) < 1 &&
      Math.abs(prevH - nextH) < 1;
    if (same) return;

    setNodes(
      nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              style: {
                ...n.style,
                width: nextW,
                height: nextH,
              },
            }
          : n
      )
    );
    updateNodeInternals(id);
  }, [id, setNodes, updateNodeInternals]);

  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      syncNodeSizeToContent();
    });
    ro.observe(el);
    syncNodeSizeToContent();
    return () => ro.disconnect();
  }, [syncNodeSizeToContent]);

  useLayoutEffect(() => {
    syncNodeSizeToContent();
  }, [fontSize, text, syncNodeSizeToContent]);

  const readFontFromStore = useCallback(() => {
    const node = useStudioStore.getState().nodes.find((n) => n.id === id);
    const raw = (node?.data as Record<string, unknown> | undefined)?.fontSize;
    return clampFont(Number(raw) || 18);
  }, [id]);

  const onResizeStart = useCallback(
    (_: unknown, params: { width: number; height: number }) => {
      resizingRef.current = true;
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
    resizingRef.current = false;
    requestAnimationFrame(() => {
      updateNodeInternals(id);
      syncNodeSizeToContent();
    });
  }, [id, syncNodeSizeToContent, updateNodeInternals]);

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
      <div
        ref={shellRef}
        className="relative inline-flex max-w-[min(100vw-2rem,96vw)] bg-transparent"
      >
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
          className="studio-freetext-editable nodrag nopan relative z-10 inline-block min-h-[1.2em] min-w-[2ch] max-w-[min(100vw-2rem,96vw)] cursor-text whitespace-pre-wrap align-top break-words text-foreground outline-none"
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
