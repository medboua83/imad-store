ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'STAFF';
ALTER TABLE "users" ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
 ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "mustSetPassword" BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" (lower("email"));
CREATE TABLE "password_resets" (
 "tokenHash" TEXT PRIMARY KEY, "userId" TEXT NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
 "authVersion" INTEGER NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
 "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "mailCiphertext" TEXT, "mailState" TEXT NOT NULL DEFAULT 'PENDING', "claimedAt" TIMESTAMP(3), "kind" TEXT NOT NULL DEFAULT 'RESET'
);
CREATE TABLE "gmail_config" (
 "id" TEXT PRIMARY KEY DEFAULT 'gmail', "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
 "gmailUser" TEXT NOT NULL, "port" INTEGER NOT NULL DEFAULT 465,
 "passwordCiphertext" TEXT, "revision" INTEGER NOT NULL DEFAULT 1, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "gmail_port" CHECK ("port" IN (465,587))
);
CREATE TABLE "access_events" (
 "id" TEXT PRIMARY KEY DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
 "actorId" TEXT NOT NULL, "targetId" TEXT, "action" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
