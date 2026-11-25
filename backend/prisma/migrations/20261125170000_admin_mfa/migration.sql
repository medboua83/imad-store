-- Opt-in per account. Existing accounts and merchant records are unchanged.
CREATE TABLE "admin_mfa" (
 "userId" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "secretCiphertext" TEXT,
 "enabledAt" TIMESTAMP(3),
 "pendingCiphertext" TEXT,
 "pendingExpiresAt" TIMESTAMP(3),
 "setupId" TEXT,
 "recoveryHashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "pendingRecoveryHashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "lastUsedStep" BIGINT,
 "failedAttempts" INTEGER NOT NULL DEFAULT 0 CHECK ("failedAttempts" >= 0),
 "lockedUntil" TIMESTAMP(3),
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "admin_mfa_enabled_secret" CHECK (("enabledAt" IS NULL) = ("secretCiphertext" IS NULL))
);
