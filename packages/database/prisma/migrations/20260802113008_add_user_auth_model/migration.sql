-- CreateTable
CREATE TABLE "VerifyEmailToken" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerifyEmailToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VerifyEmailToken_tokenHash_key" ON "VerifyEmailToken"("tokenHash");

-- CreateIndex
CREATE INDEX "VerifyEmailToken_userId_idx" ON "VerifyEmailToken"("userId");

-- CreateIndex
CREATE INDEX "VerifyEmailToken_expiresAt_idx" ON "VerifyEmailToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "VerifyEmailToken" ADD CONSTRAINT "VerifyEmailToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
