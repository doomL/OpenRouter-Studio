"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useStudioStore } from "@/lib/store";
import { formatPrice } from "@/lib/models";
import { getCanvasSelectContentProps } from "@/lib/canvas-floating-props";

interface ModelSelectorProps {
  category: "text" | "image" | "video";
  value: string;
  onChange: (value: string) => void;
}

export function ModelSelector({ category, value, onChange }: ModelSelectorProps) {
  const models = useStudioStore((s) => s.models);
  const setModels = useStudioStore((s) => s.setModels);
  const apiKey = useStudioStore((s) => s.apiKey);
  const [search, setSearch] = useState("");
  const [freeText, setFreeText] = useState("");
  const [showFreeText, setShowFreeText] = useState(false);

  useEffect(() => {
    if (models || !apiKey) return;
    fetch("/api/openrouter/models", {
      headers: { "x-api-key": apiKey },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setModels(data);
      })
      .catch(() => {});
  }, [apiKey, models, setModels]);

  const modelList = models?.[category] || [];
  const filtered = search
    ? modelList.filter(
        (m) =>
          (m.name || m.id).toLowerCase().includes(search.toLowerCase()) ||
          m.id.toLowerCase().includes(search.toLowerCase())
      )
    : modelList;

  const handleFreeTextSubmit = () => {
    const trimmed = freeText.trim();
    if (trimmed) {
      onChange(trimmed);
      setFreeText("");
      setShowFreeText(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">
          Model {modelList.length > 0 && <span className="opacity-60">({modelList.length})</span>}
        </Label>
        <button
          type="button"
          className="text-[9px] text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowFreeText(!showFreeText)}
        >
          {showFreeText ? "dropdown" : "custom"}
        </button>
      </div>

      {showFreeText ? (
        <div className="mt-1 flex gap-1">
          <Input
            value={freeText || value}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="vendor/model-name"
            className="h-7 text-xs bg-studio-node-input border-studio-node-border flex-1"
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") handleFreeTextSubmit();
            }}
          />
          <button
            type="button"
            className="h-7 px-2 text-[10px] rounded border border-studio-node-border bg-studio-node-input hover:bg-accent transition-colors"
            onClick={handleFreeTextSubmit}
          >
            Set
          </button>
        </div>
      ) : (
        <Select value={value ?? ""} onValueChange={(v) => v && onChange(v)}>
          <SelectTrigger className="h-7 text-xs bg-studio-node-input border-studio-node-border mt-1">
            <SelectValue placeholder="Select model..." />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]" {...getCanvasSelectContentProps()}>
            <div className="p-1 sticky top-0 bg-popover z-10">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models..."
                className="h-7 text-xs"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
            {modelList.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                {apiKey ? "No models for this category" : "Set API key first"}
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                No matching models
              </div>
            ) : (
              filtered.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  <div className="flex items-center justify-between gap-3 w-full">
                    <span className="truncate">{m.name || m.id}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {m.priceLabel || formatPrice(m.pricing?.prompt)}
                    </span>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      )}

      {value && !showFreeText && (
        <div className="mt-0.5 text-[9px] text-muted-foreground truncate opacity-70">
          {value}
        </div>
      )}
    </div>
  );
}
