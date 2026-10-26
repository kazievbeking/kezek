-- Employee records belong exclusively to Runtime. Keep device and update metadata.
UPDATE "Installation" SET "telemetry" = "telemetry" - 'employees'
WHERE "telemetry" ? 'employees';
