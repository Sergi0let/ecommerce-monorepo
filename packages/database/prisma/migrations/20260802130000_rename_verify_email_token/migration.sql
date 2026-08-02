ALTER TABLE "VerifyEmailToken" RENAME TO "EmailVerificationToken";

ALTER TABLE "EmailVerificationToken"
  RENAME CONSTRAINT "VerifyEmailToken_pkey" TO "EmailVerificationToken_pkey";

ALTER TABLE "EmailVerificationToken"
  RENAME CONSTRAINT "VerifyEmailToken_userId_fkey" TO "EmailVerificationToken_userId_fkey";

ALTER INDEX "VerifyEmailToken_tokenHash_key"
  RENAME TO "EmailVerificationToken_tokenHash_key";

ALTER INDEX "VerifyEmailToken_userId_idx"
  RENAME TO "EmailVerificationToken_userId_idx";

ALTER INDEX "VerifyEmailToken_expiresAt_idx"
  RENAME TO "EmailVerificationToken_expiresAt_idx";
