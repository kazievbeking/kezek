CREATE TABLE "Delegation" (
 "id" TEXT PRIMARY KEY,
 "companyId" TEXT NOT NULL REFERENCES "Company"(id),
 "ownerId" TEXT NOT NULL,
 "ownerName" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "Session" ADD COLUMN "delegationId" TEXT REFERENCES "Delegation"(id);
ALTER TABLE "Session" DROP CONSTRAINT "session_one_principal";
ALTER TABLE "Session" ADD CONSTRAINT "session_one_principal" CHECK (num_nonnulls("userId","deviceId","delegationId") = 1);
