import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptApiKey, encryptApiKey } from "@/lib/studio-crypto";
import type { Prisma } from "@/lib/generated/prisma/client";

function emptyPayload() {
  return {
    apiKey: "",
    theme: "dark" as const,
    nodes: [],
    edges: [],
    workflows: [],
    videoJobs: {} as Record<string, unknown>,
    dynamicHandleCounts: {} as Record<string, unknown>,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // Single query: verify user exists AND fetch studio state in one round-trip.
  // JWT can outlive the DB (e.g. fresh Docker volume), so we check the User row exists.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, studioState: true },
  });
  if (!user) {
    return NextResponse.json(
      { error: "Invalid session; sign in again." },
      { status: 401 }
    );
  }
  const row = user.studioState;
  if (!row) {
    return NextResponse.json(emptyPayload());
  }
  let apiKey = "";
  try {
    if (row.encryptedApiKey && row.encryptedApiKey.length > 0) {
      apiKey = decryptApiKey(row.encryptedApiKey);
    }
  } catch {
    apiKey = "";
  }
  return NextResponse.json({
    apiKey,
    theme: row.theme === "light" ? "light" : "dark",
    nodes: row.nodes,
    edges: row.edges,
    workflows: row.workflows,
    videoJobs: row.videoJobs,
    dynamicHandleCounts: row.dynamicHandleCounts,
  });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  // Verify the user row still exists (JWT can outlive a fresh Docker volume).
  const userExists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!userExists) {
    return NextResponse.json(
      { error: "Invalid session; sign in again." },
      { status: 401 }
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const apiKey = typeof b.apiKey === "string" ? b.apiKey : "";
  let encryptedApiKey: string | null = null;
  try {
    encryptedApiKey = apiKey.length > 0 ? encryptApiKey(apiKey) : null;
  } catch {
    return NextResponse.json(
      { error: "Server cannot encrypt API key (check AUTH_SECRET)" },
      { status: 500 }
    );
  }
  const theme = b.theme === "light" ? "light" : "dark";

  const nodes = jsonField(b.nodes, []);
  const edges = jsonField(b.edges, []);
  const workflows = jsonField(b.workflows, []);
  const videoJobs = jsonField(b.videoJobs, {});
  const dynamicHandleCounts = jsonField(b.dynamicHandleCounts, {});

  await prisma.userStudioState.upsert({
    where: { userId },
    create: {
      userId,
      encryptedApiKey,
      nodes: nodes as Prisma.InputJsonValue,
      edges: edges as Prisma.InputJsonValue,
      workflows: workflows as Prisma.InputJsonValue,
      videoJobs: videoJobs as Prisma.InputJsonValue,
      dynamicHandleCounts: dynamicHandleCounts as Prisma.InputJsonValue,
      theme,
    },
    update: {
      encryptedApiKey,
      nodes: nodes as Prisma.InputJsonValue,
      edges: edges as Prisma.InputJsonValue,
      workflows: workflows as Prisma.InputJsonValue,
      videoJobs: videoJobs as Prisma.InputJsonValue,
      dynamicHandleCounts: dynamicHandleCounts as Prisma.InputJsonValue,
      theme,
    },
  });
  return NextResponse.json({ ok: true });
}

function jsonField(value: unknown, fallback: unknown): unknown {
  if (value === undefined) return fallback;
  return value;
}
