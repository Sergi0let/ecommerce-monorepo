-- CreateTable
CREATE TABLE "ImageCleanupTask" (
    "key" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "variantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageCleanupTask_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "ImageCleanupTask_productId_idx" ON "ImageCleanupTask"("productId");

-- CreateIndex
CREATE INDEX "ImageCleanupTask_variantId_idx" ON "ImageCleanupTask"("variantId");

-- CreateIndex
CREATE INDEX "ImageCleanupTask_imageId_idx" ON "ImageCleanupTask"("imageId");

-- CreateIndex
CREATE INDEX "ImageCleanupTask_nextAttemptAt_idx" ON "ImageCleanupTask"("nextAttemptAt");
