CREATE UNIQUE INDEX "one_shift_user" ON "Shift"("userId") WHERE "endedAt" IS NULL;
CREATE UNIQUE INDEX "one_shift_desk" ON "Shift"("deskId") WHERE "endedAt" IS NULL;
CREATE UNIQUE INDEX "one_ticket_user" ON "Ticket"("userId") WHERE status IN ('CALLED','SERVING');
CREATE UNIQUE INDEX "one_ticket_desk" ON "Ticket"("deskId") WHERE status IN ('CALLED','SERVING');
CREATE UNIQUE INDEX "one_pending_transfer" ON "Transfer"("ticketId") WHERE status='PENDING';
CREATE UNIQUE INDEX "one_interval" ON "Interval"("ticketId") WHERE "endedAt" IS NULL;
CREATE UNIQUE INDEX "one_pause" ON "Pause"("shiftId") WHERE "endedAt" IS NULL;
ALTER TABLE "Branch" ADD CONSTRAINT "branch_company" FOREIGN KEY ("companyId") REFERENCES "Company"(id);
ALTER TABLE "Person" ADD CONSTRAINT "person_company" FOREIGN KEY ("companyId") REFERENCES "Company"(id);
ALTER TABLE "Registration" ADD CONSTRAINT "registration_company" FOREIGN KEY ("companyId") REFERENCES "Company"(id);
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['Device','Service','Desk','Shift','Pause','Counter','Ticket','Interval','Call','Transfer','Command','Outbox','PrintLease','ImportJob'] LOOP
 EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("companyId","branchId") REFERENCES "Branch"("companyId",id)',tab,tab||'_branch_fk');
 END LOOP;
END $$;
ALTER TABLE "Ticket" ADD CONSTRAINT "ticket_service" FOREIGN KEY ("companyId","branchId","serviceId") REFERENCES "Service"("companyId","branchId",id);
ALTER TABLE "Ticket" ADD CONSTRAINT "ticket_desk" FOREIGN KEY ("companyId","branchId","deskId") REFERENCES "Desk"("companyId","branchId",id);
ALTER TABLE "Ticket" ADD CONSTRAINT "ticket_user" FOREIGN KEY ("companyId","userId") REFERENCES "Person"("companyId",id);
ALTER TABLE "Shift" ADD CONSTRAINT "shift_desk" FOREIGN KEY ("companyId","branchId","deskId") REFERENCES "Desk"("companyId","branchId",id);
ALTER TABLE "Shift" ADD CONSTRAINT "shift_user" FOREIGN KEY ("companyId","userId") REFERENCES "Person"("companyId",id);
ALTER TABLE "Pause" ADD CONSTRAINT "pause_shift" FOREIGN KEY ("companyId","branchId","shiftId") REFERENCES "Shift"("companyId","branchId",id);
ALTER TABLE "Device" ADD CONSTRAINT "device_desk" FOREIGN KEY ("companyId","branchId","deskId") REFERENCES "Desk"("companyId","branchId",id);
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['Call','Interval','Transfer','PrintLease'] LOOP
 EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("companyId","branchId","ticketId") REFERENCES "Ticket"("companyId","branchId",id)',tab,tab||'_ticket_fk');
 END LOOP;
END $$;
ALTER TABLE "Interval" ADD CONSTRAINT "interval_user" FOREIGN KEY ("companyId","userId") REFERENCES "Person"("companyId",id);
ALTER TABLE "Interval" ADD CONSTRAINT "interval_desk" FOREIGN KEY ("companyId","branchId","deskId") REFERENCES "Desk"("companyId","branchId",id);
ALTER TABLE "Call" ADD CONSTRAINT "call_desk" FOREIGN KEY ("companyId","branchId","deskId") REFERENCES "Desk"("companyId","branchId",id);
ALTER TABLE "Transfer" ADD CONSTRAINT "transfer_from" FOREIGN KEY ("companyId","fromId") REFERENCES "Person"("companyId",id);
ALTER TABLE "Transfer" ADD CONSTRAINT "transfer_to" FOREIGN KEY ("companyId","toId") REFERENCES "Person"("companyId",id);
ALTER TABLE "Session" ADD CONSTRAINT "session_user" FOREIGN KEY ("userId") REFERENCES "Person"(id);
ALTER TABLE "Session" ADD CONSTRAINT "session_device" FOREIGN KEY ("deviceId") REFERENCES "Device"(id);
ALTER TABLE "Session" ADD CONSTRAINT "session_one_principal" CHECK (("userId" IS NULL) <> ("deviceId" IS NULL));
ALTER TABLE "Person" ADD CONSTRAINT "person_role" CHECK(role IN ('COMPANY_ADMIN','BRANCH_ADMIN','STAFF'));
ALTER TABLE "Device" ADD CONSTRAINT "device_role" CHECK(role IN ('TERMINAL','DISPLAY','WORKSTATION'));
ALTER TABLE "Ticket" ADD CONSTRAINT "ticket_status" CHECK(status IN ('WAITING','CALLED','SERVING','COMPLETED','NO_SHOW','CANCELLED'));
ALTER TABLE "Ticket" ADD CONSTRAINT "ticket_active_assignment" CHECK(status NOT IN ('CALLED','SERVING') OR ("userId" IS NOT NULL AND "deskId" IS NOT NULL));
ALTER TABLE "Transfer" ADD CONSTRAINT "transfer_status" CHECK(status IN ('PENDING','ACCEPTED','REJECTED','CANCELLED','EXPIRED'));
ALTER TABLE "Registration" ADD CONSTRAINT "registration_limit" CHECK("maxUses">0 AND uses>=0 AND uses<="maxUses");
CREATE FUNCTION check_assignments() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_TABLE_NAME='Person' THEN
  IF EXISTS(SELECT 1 FROM unnest(NEW."branchIds") x WHERE NOT EXISTS(SELECT 1 FROM "Branch" b WHERE b.id=x AND b."companyId"=NEW."companyId")) THEN RAISE EXCEPTION 'invalid_branch'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(NEW."deskIds") x WHERE NOT EXISTS(SELECT 1 FROM "Desk" d WHERE d.id=x AND d."companyId"=NEW."companyId" AND (NEW.role='COMPANY_ADMIN' OR d."branchId"=ANY(NEW."branchIds")))) THEN RAISE EXCEPTION 'invalid_desk'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(NEW."serviceIds") x WHERE NOT EXISTS(SELECT 1 FROM "Service" s WHERE s.id=x AND s."companyId"=NEW."companyId" AND (NEW.role='COMPANY_ADMIN' OR s."branchId"=ANY(NEW."branchIds")))) THEN RAISE EXCEPTION 'invalid_service'; END IF;
 ELSIF TG_TABLE_NAME='Desk' THEN
  IF EXISTS(SELECT 1 FROM unnest(NEW."serviceIds") x WHERE NOT EXISTS(SELECT 1 FROM "Service" s WHERE s.id=x AND s."companyId"=NEW."companyId" AND s."branchId"=NEW."branchId")) THEN RAISE EXCEPTION 'invalid_service'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM unnest(NEW."branchIds") x WHERE NOT EXISTS(SELECT 1 FROM "Branch" b WHERE b.id=x AND b."companyId"=NEW."companyId")) THEN RAISE EXCEPTION 'invalid_branch'; END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER "person_assignments" BEFORE INSERT OR UPDATE ON "Person" FOR EACH ROW EXECUTE FUNCTION check_assignments();
CREATE TRIGGER "desk_assignments" BEFORE INSERT OR UPDATE ON "Desk" FOR EACH ROW EXECUTE FUNCTION check_assignments();
CREATE TRIGGER "registration_assignments" BEFORE INSERT OR UPDATE ON "Registration" FOR EACH ROW EXECUTE FUNCTION check_assignments();
