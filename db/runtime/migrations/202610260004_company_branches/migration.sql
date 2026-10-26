CREATE TABLE "CompanyBranch" (
 id TEXT PRIMARY KEY,
 "companyId" TEXT NOT NULL REFERENCES "Company"(id),
 code TEXT NOT NULL,
 name TEXT NOT NULL,
 address TEXT NOT NULL DEFAULT '',
 active BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX "CompanyBranch_companyId_code_key" ON "CompanyBranch"("companyId",code);
CREATE UNIQUE INDEX "CompanyBranch_companyId_id_key" ON "CompanyBranch"("companyId",id);
INSERT INTO "CompanyBranch" (id,"companyId",code,name,address) SELECT id,"companyId",code,name,address FROM "Branch";
ALTER TABLE "Branch" ADD COLUMN "companyBranchId" TEXT;
UPDATE "Branch" SET "companyBranchId"=id;
ALTER TABLE "Branch" ALTER COLUMN "companyBranchId" SET NOT NULL;
ALTER TABLE "Branch" ADD CONSTRAINT "point_company_branch" FOREIGN KEY ("companyId","companyBranchId") REFERENCES "CompanyBranch"("companyId",id);
DROP INDEX "Branch_companyId_code_key";
CREATE UNIQUE INDEX "Branch_companyId_companyBranchId_code_key" ON "Branch"("companyId","companyBranchId",code);
