-- CreateTable
CREATE TABLE "UserStudioState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "encryptedApiKey" TEXT,
    "nodes" JSONB NOT NULL,
    "edges" JSONB NOT NULL,
    "workflows" JSONB NOT NULL,
    "videoJobs" JSONB NOT NULL,
    "dynamicHandleCounts" JSONB NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserStudioState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UserStudioState_userId_key" ON "UserStudioState"("userId");
