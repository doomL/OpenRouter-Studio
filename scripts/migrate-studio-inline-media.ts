/**
 * One-shot migration: upload remaining inline/data-URL media in UserStudioState to S3
 * and rewrite node.data to use *BlobId fields. Requires STUDIO_S3_* env (e.g. MinIO as in Compose).
 *
 * Run: npm run migrate:studio-blobs
 */
import type { Node } from "@xyflow/react";
import type { Workflow } from "@/lib/store";
import { prisma } from "@/lib/prisma";
import { persistStudioGraphMediaToBlobs } from "@/lib/studio-persist-inline-media";
import { isStudioObjectStorageConfigured } from "@/lib/studio-s3";
import type { Prisma } from "@/lib/generated/prisma/client";

async function main() {
  if (!isStudioObjectStorageConfigured()) {
    console.error("Set STUDIO_S3_ENDPOINT, STUDIO_S3_BUCKET, STUDIO_S3_ACCESS_KEY, STUDIO_S3_SECRET_KEY first.");
    process.exit(1);
  }
  const rows = await prisma.userStudioState.findMany({
    select: { userId: true, nodes: true, workflows: true },
  });
  for (const row of rows) {
    const nodes = row.nodes as unknown as Node[];
    const workflows = row.workflows as unknown as Workflow[];
    const persisted = await persistStudioGraphMediaToBlobs(row.userId, nodes, workflows);
    await prisma.userStudioState.update({
      where: { userId: row.userId },
      data: {
        nodes: persisted.nodes as unknown as Prisma.InputJsonValue,
        workflows: persisted.workflows as unknown as Prisma.InputJsonValue,
      },
    });
    console.log("Migrated user", row.userId);
  }
  console.log("Done,", rows.length, "users.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
