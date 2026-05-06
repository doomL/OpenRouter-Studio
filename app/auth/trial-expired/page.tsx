"use client";

import Link from "next/link";
import { ThemedLogo } from "@/components/theme/ThemedLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { signOut } from "next-auth/react";

export default function TrialExpiredPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <ThemedLogo className="h-10 w-10" />
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-[#ff6b35]">OpenRouter</span>{" "}
            <span className="text-foreground">Studio</span>
          </h1>
        </div>

        <div className="rounded-lg border border-studio-node-border bg-studio-node p-6 space-y-4 text-left">
          <h2 className="text-lg font-semibold text-foreground">Your beta trial has ended</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your 3-day free trial has expired. OpenRouter Studio is currently in private beta.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            To request full access, send an email to:
          </p>
          <a
            href="mailto:laurito.dom@gmail.com?subject=OpenRouter Studio - Beta Access Request"
            className="block rounded-md border border-[#ff6b35]/40 bg-[#ff6b35]/10 px-4 py-3 text-sm font-medium text-[#ff6b35] hover:bg-[#ff6b35]/20 transition-colors text-center"
          >
            laurito.dom@gmail.com
          </a>
          <p className="text-xs text-muted-foreground">
            Once approved, log out and log back in to gain full access.
          </p>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
