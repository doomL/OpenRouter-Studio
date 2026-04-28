-- CreateTable
CREATE TABLE "StudioBlob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioBlob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioNodeMediaVersion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "blobId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudioNodeMediaVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudioBlob_s3Key_key" ON "StudioBlob"("s3Key");

-- CreateIndex
CREATE INDEX "StudioNodeMediaVersion_userId_nodeId_kind_idx" ON "StudioNodeMediaVersion"("userId", "nodeId", "kind");

-- AddForeignKey
ALTER TABLE "StudioBlob" ADD CONSTRAINT "StudioBlob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioNodeMediaVersion" ADD CONSTRAINT "StudioNodeMediaVersion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudioNodeMediaVersion" ADD CONSTRAINT "StudioNodeMediaVersion_blobId_fkey" FOREIGN KEY ("blobId") REFERENCES "StudioBlob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
