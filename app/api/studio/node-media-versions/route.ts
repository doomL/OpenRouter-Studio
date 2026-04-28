import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const nodeId = searchParams.get("nodeId");
  if (!nodeId) {
    return NextResponse.json({ error: "nodeId is required" }, { status: 400 });
  }

  const versions = await prisma.studioNodeMediaVersion.findMany({
    where: { userId, nodeId },
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      blob: { select: { id: true, mimeType: true, byteSize: true, createdAt: true } },
    },
  });

  return NextResponse.json({
    versions: dedupeVersionsByKindAndBlob(
      versions.map((v) => ({
        id: v.id,
        kind: v.kind,
        blobId: v.blobId,
        createdAt: v.createdAt.toISOString(),
        mimeType: v.blob.mimeType,
        byteSize: v.blob.byteSize,
      }))
    ),
  });
}

/** Same blob can appear twice in DB (legacy/workflow double-persist); list once, newest row wins. */
function dedupeVersionsByKindAndBlob<
  T extends { kind: string; blobId: string; createdAt: string },
>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = `${row.kind}\0${row.blobId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
