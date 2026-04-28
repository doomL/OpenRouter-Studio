import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStudioObjectStorageConfigured, studioGetObjectStream } from "@/lib/studio-s3";
import { extensionForMime } from "@/lib/studio-blob-filename";

function sdkBodyToWebStream(body: unknown): ReadableStream<Uint8Array> | null {
  if (!body) return null;
  const b = body as { transformToWebStream?: () => ReadableStream<Uint8Array> };
  if (typeof b.transformToWebStream === "function") {
    return b.transformToWebStream() as unknown as ReadableStream<Uint8Array>;
  }
  if (body instanceof Readable) {
    return Readable.toWeb(body) as unknown as ReadableStream<Uint8Array>;
  }
  return null;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const download =
    searchParams.get("download") === "1" ||
    searchParams.get("download") === "true";
  const { id } = await ctx.params;
  const blob = await prisma.studioBlob.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!blob) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isStudioObjectStorageConfigured()) {
    return NextResponse.json(
      { error: "Object storage is not configured on this server." },
      { status: 503 }
    );
  }
  try {
    const obj = await studioGetObjectStream(blob.s3Key);
    const webStream = sdkBodyToWebStream(obj.Body);
    if (!webStream) {
      return NextResponse.json({ error: "Empty object" }, { status: 404 });
    }
    const headers: Record<string, string> = {
      "Content-Type": blob.mimeType,
      "Cache-Control": download ? "private, no-store" : "private, max-age=3600",
    };
    if (download) {
      const ext = extensionForMime(blob.mimeType);
      const filename = `studio-media-${blob.id.slice(0, 10)}.${ext}`;
      headers["Content-Disposition"] = `attachment; filename="${filename}"`;
    }
    return new Response(webStream, { headers });
  } catch {
    return NextResponse.json({ error: "Failed to read object" }, { status: 502 });
  }
}
