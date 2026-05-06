import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutGridIcon, ArrowRightIcon, ImageIcon, SettingsIcon } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { ThemedLogo } from "@/components/theme/ThemedLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { HomeSignOutButton } from "@/components/home/HomeSignOutButton";

export const dynamic = "force-dynamic";

export default async function StudioHomePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }
  const userId = session.user.id;

  const userRow = await prisma.user.findUnique({ where: { id: userId }, select: { trialEndsAt: true } });
  const trialEndsAt = userRow?.trialEndsAt ?? null;
  const trialDaysLeft = trialEndsAt ? Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000) : null;

  const row = await prisma.userStudioState.findUnique({
    where: { userId },
    select: { updatedAt: true, workflows: true, nodes: true },
  });

  const workflowsRaw = row?.workflows;
  const workflowsMeta: {
    id: string;
    name: string;
    savedAt: string;
    nodeCount: number;
    edgeCount: number;
  }[] = [];
  if (Array.isArray(workflowsRaw)) {
    for (const w of workflowsRaw) {
      if (!w || typeof w !== "object") continue;
      const o = w as Record<string, unknown>;
      workflowsMeta.push({
        id: String(o.id ?? ""),
        name: String(o.name ?? "Untitled"),
        savedAt: String(o.savedAt ?? ""),
        nodeCount: Array.isArray(o.nodes) ? o.nodes.length : 0,
        edgeCount: Array.isArray(o.edges) ? o.edges.length : 0,
      });
    }
  }

  const nodeCount = Array.isArray(row?.nodes) ? row.nodes.length : 0;
  const lastSaved = row?.updatedAt ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-3 gap-3">
          <Link href="/home" className="flex items-center gap-2 min-w-0">
            <ThemedLogo className="h-7 w-7 shrink-0" />
            <span className="text-sm font-bold tracking-tight truncate">
              <span className="text-[#ff6b35]">OpenRouter</span> Studio
            </span>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <Link
              href="/media"
              title="Media library"
              className={cn(
                "inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-border",
                "bg-background px-2 sm:px-2.5 h-7 text-[0.8rem] font-medium hover:bg-muted transition-colors"
              )}
            >
              <ImageIcon className="size-3.5" />
              <span className="hidden sm:inline">Media</span>
            </Link>
            <Link
              href="/settings"
              title="Settings"
              className={cn(
                "inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-border",
                "bg-background px-2 sm:px-2.5 h-7 text-[0.8rem] font-medium hover:bg-muted transition-colors"
              )}
            >
              <SettingsIcon className="size-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </Link>
            <Link
              href="/studio"
              className={cn(
                "inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-border",
                "bg-background px-2 sm:px-2.5 h-7 text-[0.8rem] font-medium hover:bg-muted transition-colors"
              )}
            >
              <span className="hidden sm:inline">Open canvas</span>
              <ArrowRightIcon className="size-3.5" />
            </Link>
            <HomeSignOutButton />
          </div>
        </div>
      </header>

      {trialDaysLeft !== null && trialDaysLeft >= 0 && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-600 dark:text-amber-400">
          ⏳{" "}
          {trialDaysLeft === 0
            ? "Your free trial expires today."
            : `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in your free trial.`}{" "}
          <a href="mailto:laurito.dom@gmail.com?subject=OpenRouter Studio - Beta Access Request" className="font-medium underline underline-offset-2 hover:opacity-80">
            Request full access →
          </a>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-10 space-y-10">
        <section>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back{session.user.name ? `, ${session.user.name}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hub for your canvas, saved workflows, and stored media.
          </p>

          <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Last session
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {lastSaved
                ? `Last cloud save: ${lastSaved.toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}`
                : "No cloud save yet — open Studio to create your canvas."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Current canvas: {nodeCount} node{nodeCount === 1 ? "" : "s"} (after last sync).
            </p>
            <Link
              href="/studio"
              className={cn(
                "mt-4 inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold",
                "bg-[#ff6b35] text-white hover:bg-[#e55a28] transition-colors"
              )}
            >
              Resume in Studio
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-3">
            <LayoutGridIcon className="size-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Saved workflows</h2>
          </div>
          {workflowsMeta.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No named snapshots yet. Use Save in the Studio header.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {workflowsMeta.map((w) => (
                <li
                  key={w.id}
                  className="rounded-lg border border-border bg-card p-4 text-sm"
                >
                  <div className="font-medium">{w.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {w.savedAt
                      ? new Date(w.savedAt).toLocaleString()
                      : "Unknown date"}{" "}
                    · {w.nodeCount} nodes · {w.edgeCount} edges
                  </div>
                  <Link
                    href={`/studio?workflow=${encodeURIComponent(w.id)}`}
                    className={cn(
                      "mt-3 flex w-full items-center justify-center rounded-md",
                      "bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                    )}
                  >
                    Open in Studio
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Media library</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Browse synced images, audio, and video with filters and downloads — full library on a
            dedicated page.
          </p>
          <Link
            href="/media"
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium",
              "hover:bg-muted transition-colors"
            )}
          >
            <ImageIcon className="size-4 text-[#ea580c]" />
            Open media library
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </section>
      </main>
    </div>
  );
}
