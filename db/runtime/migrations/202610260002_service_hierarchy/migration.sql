ALTER TABLE "Service" ADD COLUMN "parentId" TEXT;
CREATE INDEX "Service_companyId_branchId_parentId_idx" ON "Service"("companyId","branchId","parentId");
ALTER TABLE "Service" ADD CONSTRAINT "service_parent_scope" FOREIGN KEY ("companyId","branchId","parentId") REFERENCES "Service"("companyId","branchId",id) ON DELETE RESTRICT;
ALTER TABLE "Service" ADD CONSTRAINT "service_not_own_parent" CHECK ("parentId" IS NULL OR "parentId" <> id);
CREATE FUNCTION check_service_hierarchy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW."companyId",0));
 IF NEW."parentId" IS NOT NULL AND EXISTS (
  WITH RECURSIVE ancestors AS (
   SELECT id,"parentId" FROM "Service" WHERE id=NEW."parentId" AND "companyId"=NEW."companyId" AND "branchId"=NEW."branchId"
   UNION
   SELECT s.id,s."parentId" FROM "Service" s JOIN ancestors a ON s.id=a."parentId"
  ) SELECT 1 FROM ancestors WHERE id=NEW.id
 ) THEN RAISE EXCEPTION 'service_cycle'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER service_hierarchy_guard BEFORE INSERT OR UPDATE OF "parentId","companyId","branchId" ON "Service" FOR EACH ROW EXECUTE FUNCTION check_service_hierarchy();
