"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStudioStore, type Model } from "@/lib/store";
import { saveStudioSettingsToServer } from "@/lib/studio-settings-api";
import { toast } from "@/lib/toast";
import { readJsonResponse } from "@/lib/read-json-response";
import { fetchWithRetry, STUDIO_FETCH_MAX_ATTEMPTS } from "@/lib/fetch-with-retry";

interface ApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiKeyModal({ open, onOpenChange }: ApiKeyModalProps) {
  const apiKey = useStudioStore((s) => s.apiKey);
  const setApiKey = useStudioStore((s) => s.setApiKey);
  const setModels = useStudioStore((s) => s.setModels);
  const [key, setKey] = useState(apiKey);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setKey(apiKey);
  }, [open, apiKey]);

  const handleTest = async () => {
    if (!key) return;
    setTesting(true);
    setStatus("idle");
    try {
      const res = await fetchWithRetry(
        "/api/openrouter/models",
        { headers: { "x-api-key": key } },
        { maxAttempts: STUDIO_FETCH_MAX_ATTEMPTS }
      );
      const data = await readJsonResponse<{
        error?: unknown;
        text?: Model[];
        image?: Model[];
        video?: Model[];
        audio?: Model[];
      }>(res);
      if (data.error) {
        setStatus("error");
        toast.error("Connection failed");
      } else {
        setStatus("ok");
        setModels({
          text: data.text ?? [],
          image: data.image ?? [],
          video: data.video ?? [],
          audio: data.audio ?? [],
        });
        toast.success("Connection OK — models loaded");
      }
    } catch {
      setStatus("error");
      toast.error("Connection failed");
    }
    setTesting(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      setApiKey(key);
      const res = await saveStudioSettingsToServer({ apiKey: key });
      if (!res.ok) {
        setStatus("error");
        toast.error("Could not save API key");
        return;
      }
      toast.success("API key saved");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      setApiKey("");
      setKey("");
      setStatus("idle");
      await saveStudioSettingsToServer({ apiKey: "" });
      toast.success("API key removed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>OpenRouter API Key</DialogTitle>
          <DialogDescription>
            Enter your OpenRouter API key. It is saved to your account (encrypted on
            the server) and sent to OpenRouter only when you run models.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>API Key</Label>
            <Input
              type="password"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setStatus("idle");
              }}
              placeholder="sk-or-..."
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={!key || testing}
              className="flex-1"
            >
              {testing ? "Testing..." : "Test Connection"}
            </Button>
            <Button onClick={handleSave} disabled={!key || saving} className="flex-1">
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
          {status === "ok" && (
            <p className="text-xs text-green-500">
              Connection successful! Models loaded.
            </p>
          )}
          {status === "error" && (
            <p className="text-xs text-red-500">
              Invalid API key or connection error.
            </p>
          )}
          {apiKey && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className="text-xs text-red-400"
            >
              Remove API Key
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
