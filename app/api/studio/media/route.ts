import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  isNodeOnLiveCanvas,
  listWorkflowsContainingNode,
} from "@/lib/studio-blob-workflow-refs";

const ALLOWED_TYPES = new Set(["all", "image", "audio", "video", "other"]);

function buildWhere(
  userId: string,
  type: string,
  q: string
): Prisma.StudioBlobWhereInput {
  const andParts: Prisma.StudioBlobWhereInput[] = [{ userId }];

  if (type === "image") {
    andParts.push({ mimeType: { startsWith: "image/" } });
  } else if (type === "audio") {
    andParts.push({ mimeType: { startsWith: "audio/" } });
  } else if (type === "video") {
    andParts.push({ mimeType: { startsWith: "video/" } });
  } else if (type === "other") {
    andParts.push({ NOT: { mimeType: { startsWith: "image/" } } });
    andParts.push({ NOT: { mimeType: { startsWith: "audio/" } } });
    andParts.push({ NOT: { mimeType: { startsWith: "video/" } } });
  }

  if (q.length > 0) {
    andParts.push({
      OR: [
        { sourceNodeLabel: { contains: q, mode: "insensitive" } },
        { sourceNodeId: { contains: q } },
        { mediaFieldKind: { contains: q, mode: "insensitive" } },
        { sourceNodeType: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  return { AND: andParts };
}

/** Paginated media index with node/workflow context. Thumbnails: `/api/studio/blobs/:id`. */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { searchParams } = new URL(req.url);

  const pageRaw = Number(searchParams.get("page"));
  const pageSizeRaw = Number(searchParams.get("pageSize"));
  const page = Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1);
  const pageSize = Math.min(
    48,
    Math.max(1, Number.isFinite(pageSizeRaw) ? pageSizeRaw : 20)
  );
  const skip = (page - 1) * pageSize;

  let type = searchParams.get("type") ?? "all";
  if (!ALLOWED_TYPES.has(type)) type = "all";

  const q = (searchParams.get("q") ?? "").trim().slice(0, 200);

  const where = buildWhere(userId, type, q);

  const studioRow = await prisma.userStudioState.findUnique({
    where: { userId },
    select: { workflows: true, nodes: true },
  });

  const [rows, total] = await Promise.all([
    prisma.studioBlob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        mimeType: true,
        byteSize: true,
        createdAt: true,
        sourceNodeId: true,
        sourceNodeType: true,
        sourceNodeLabel: true,
        mediaFieldKind: true,
      },
    }),
    prisma.studioBlob.count({ where }),
  ]);

  const workflowsJson = studioRow?.workflows;
  const nodesJson = studioRow?.nodes;

  const items = rows.map((b) => ({
    id: b.id,
    mimeType: b.mimeType,
    byteSize: b.byteSize,
    createdAt: b.createdAt.toISOString(),
    sourceNodeId: b.sourceNodeId,
    sourceNodeType: b.sourceNodeType,
    sourceNodeLabel: b.sourceNodeLabel,
    mediaFieldKind: b.mediaFieldKind,
    workflows: listWorkflowsContainingNode(workflowsJson, b.sourceNodeId),
    onLiveCanvas: isNodeOnLiveCanvas(nodesJson, b.sourceNodeId),
  }));

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages,
  });
}
