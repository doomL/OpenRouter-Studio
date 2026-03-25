"use client";

const baseStyle: React.CSSProperties = {
  position: "absolute",
  fontSize: "9px",
  lineHeight: 1,
  color: "var(--muted-foreground)",
  pointerEvents: "none",
  userSelect: "none",
  whiteSpace: "nowrap",
  transform: "translateY(-50%)",
};

export function HandleLabel({
  label,
  side,
  top,
}: {
  label: string;
  side: "left" | "right";
  top: string;
}) {
  return (
    <span
      style={{
        ...baseStyle,
        top,
        ...(side === "left"
          ? { right: "calc(100% + 8px)", textAlign: "right" }
          : { left: "calc(100% + 8px)" }),
      }}
    >
      {label}
    </span>
  );
}
