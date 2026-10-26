-- Retain historical desks and references; new work is assigned directly to employees.
ALTER TABLE "Shift" ALTER COLUMN "deskId" DROP NOT NULL;
ALTER TABLE "Interval" ALTER COLUMN "deskId" DROP NOT NULL;
ALTER TABLE "Call" ALTER COLUMN "deskId" DROP NOT NULL;
ALTER TABLE "Call" ALTER COLUMN "deskNumber" DROP NOT NULL;
ALTER TABLE "Call" ADD COLUMN "userId" TEXT;
ALTER TABLE "Call" ADD COLUMN "destination" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Call" ADD CONSTRAINT "call_employee" FOREIGN KEY ("companyId","userId") REFERENCES "Person"("companyId",id);
ALTER TABLE "Ticket" DROP CONSTRAINT "ticket_active_assignment";
ALTER TABLE "Ticket" ADD CONSTRAINT "ticket_active_assignment" CHECK(status NOT IN ('CALLED','SERVING') OR "userId" IS NOT NULL);
-- Preserve the effective service choices of legacy employees who inherited desk services.
UPDATE "Person" p SET "serviceIds"=ARRAY(
 SELECT DISTINCT service FROM "Desk" d CROSS JOIN LATERAL unnest(d."serviceIds") service
 WHERE d.id=ANY(p."deskIds") AND d."companyId"=p."companyId" AND d."branchId"=ANY(p."branchIds")
) WHERE cardinality(p."serviceIds")=0;
UPDATE "Installation" SET version='1.1.0';
CREATE FUNCTION check_operational_employee_branch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."userId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "Person" p WHERE p.id=NEW."userId" AND p."companyId"=NEW."companyId"
  AND (p.role='COMPANY_ADMIN' OR NEW."branchId"=ANY(p."branchIds"))
 ) THEN RAISE EXCEPTION 'invalid_employee_branch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER shift_employee_branch BEFORE INSERT OR UPDATE OF "userId","companyId","branchId" ON "Shift" FOR EACH ROW EXECUTE FUNCTION check_operational_employee_branch();
CREATE TRIGGER interval_employee_branch BEFORE INSERT OR UPDATE OF "userId","companyId","branchId" ON "Interval" FOR EACH ROW EXECUTE FUNCTION check_operational_employee_branch();
CREATE TRIGGER call_employee_branch BEFORE INSERT OR UPDATE OF "userId","companyId","branchId" ON "Call" FOR EACH ROW EXECUTE FUNCTION check_operational_employee_branch();
CREATE TRIGGER ticket_employee_branch BEFORE INSERT OR UPDATE OF "userId","companyId","branchId" ON "Ticket" FOR EACH ROW EXECUTE FUNCTION check_operational_employee_branch();
