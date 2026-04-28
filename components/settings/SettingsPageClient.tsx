"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  ArrowLeftIcon,
  ImageIcon,
  LayoutDashboardIcon,
  SettingsIcon,
} from "lucide-react";
import { readJsonResponse } from "@/lib/read-json-response";
import { cn } from "@/lib/utils";
import { ThemedLogo } from "@/components/theme/ThemedLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { HomeSignOutButton } from "@/components/home/HomeSignOutButton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";

export type SettingsInitialUser = {
  name: string | null;
  email: string;
};

export function SettingsPageClient({ initialUser }: { initialUser: SettingsInitialUser }) {
  const { update } = useSession();
  const [name, setName] = useState(initialUser.name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      const body = await readJsonResponse<{ user?: { name: string | null }; error?: string }>(
        res
      );
      if (!res.ok) {
        toast.error(body.error || `Failed to save (${res.status})`);
        return;
      }
      const nextName = body.user?.name ?? "";
      setName(nextName);
      await update({ name: nextName || undefined });
      toast.success("Profile updated");
    } catch {
      toast.error("Could not save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await readJsonResponse<{ ok?: boolean; error?: string }>(res);
      if (!res.ok) {
        toast.error(body.error || `Failed (${res.status})`);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch {
      toast.error("Could not change password");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3 gap-3">
          <Link href="/home" className="flex items-center gap-2 min-w-0">
            <ThemedLogo className="h-7 w-7 shrink-0" />
            <span className="text-sm font-bold tracking-tight truncate">
              <span className="text-[#ff6b35]">OpenRouter</span> Studio
            </span>
          </Link>
          <nav className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            <Link
              href="/home"
              className="rounded-md px-2 py-1 hover:bg-muted hover:text-foreground transition-colors"
            >
              Home
            </Link>
            <span className="opacity-40">·</span>
            <Link
              href="/media"
              className="rounded-md px-2 py-1 hover:bg-muted hover:text-foreground transition-colors"
            >
              Media
            </Link>
            <span className="opacity-40">·</span>
            <span className="rounded-md px-2 py-1 text-foreground font-medium">Settings</span>
            <span className="opacity-40">·</span>
            <Link
              href="/studio"
              className="rounded-md px-2 py-1 hover:bg-muted hover:text-foreground transition-colors"
            >
              Studio
            </Link>
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <Link
              href="/media"
              className={cn(
                "hidden sm:inline-flex items-center justify-center rounded-lg border border-border",
                "bg-background px-2.5 h-7 text-[0.8rem] font-medium hover:bg-muted transition-colors"
              )}
              title="Media library"
            >
              <ImageIcon className="size-3.5" />
            </Link>
            <Link
              href="/studio"
              className={cn(
                "hidden sm:inline-flex items-center justify-center rounded-lg border border-border",
                "bg-background px-2.5 h-7 text-[0.8rem] font-medium hover:bg-muted transition-colors"
              )}
              title="Studio"
            >
              <LayoutDashboardIcon className="size-3.5" />
            </Link>
            <HomeSignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <Link
          href="/home"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeftIcon className="size-3" />
          Back to home
        </Link>

        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="size-7 text-muted-foreground" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Account details, security, and app preferences.
        </p>

        <section className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Account
          </h2>
          <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="settings-email">Email</Label>
              <Input
                id="settings-email"
                value={initialUser.email}
                disabled
                className="bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-name">Display name</Label>
              <Input
                id="settings-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
            <Button type="submit" disabled={savingProfile} className="bg-[#ff6b35] hover:bg-[#e55a28] text-white">
              {savingProfile ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </section>

        <section className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Security
          </h2>
          <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="settings-current-pw">Current password</Label>
              <Input
                id="settings-current-pw"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-new-pw">New password</Label>
              <Input
                id="settings-new-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-confirm-pw">Confirm new password</Label>
              <Input
                id="settings-confirm-pw"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" variant="secondary" disabled={savingPassword}>
              {savingPassword ? "Updating…" : "Change password"}
            </Button>
          </form>
        </section>

        <section className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Appearance
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Theme applies across the marketing pages, dashboard, and Studio.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm">Color mode</span>
            <ThemeToggle />
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            OpenRouter
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Your API key is stored encrypted with your account when you use Studio. Manage or paste
            it from the Studio toolbar (API status).
          </p>
          <Link
            href="/studio"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4 inline-flex")}
          >
            Open Studio
          </Link>
        </section>
      </main>
    </div>
  );
}
