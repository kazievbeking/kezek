CREATE UNIQUE INDEX "Installation_bridgeHash_key" ON "Installation"("bridgeHash");
ALTER TABLE "Branch" ADD CONSTRAINT "branch_company" FOREIGN KEY ("companyId") REFERENCES "Company"(id);
ALTER TABLE "Registration" ADD CONSTRAINT "registration_company" FOREIGN KEY ("companyId") REFERENCES "Company"(id);
ALTER TABLE "Registration" ADD CONSTRAINT "registration_installation" FOREIGN KEY ("installationId") REFERENCES "Installation"(id);
ALTER TABLE "RemoteCommand" ADD CONSTRAINT "command_installation" FOREIGN KEY ("installationId") REFERENCES "Installation"(id);
ALTER TABLE "Session" ADD CONSTRAINT "session_owner" FOREIGN KEY ("ownerId") REFERENCES "Owner"(id);
