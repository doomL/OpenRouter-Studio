-- AlterTable
ALTER TABLE "StudioBlob" ADD COLUMN "sourceNodeId" TEXT,
ADD COLUMN "sourceNodeType" TEXT,
ADD COLUMN "sourceNodeLabel" TEXT,
ADD COLUMN "mediaFieldKind" TEXT;

-- CreateIndex
CREATE INDEX "StudioBlob_userId_createdAt_idx" ON "StudioBlob"("userId", "createdAt");
