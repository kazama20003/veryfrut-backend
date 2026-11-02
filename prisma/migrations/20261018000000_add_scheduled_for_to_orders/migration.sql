ALTER TABLE "Order" ADD COLUMN "scheduledFor" DATE;
UPDATE "Order"
SET "scheduledFor" = ("createdAt" AT TIME ZONE 'America/Lima')::date;
ALTER TABLE "Order" ALTER COLUMN "scheduledFor" SET NOT NULL;
CREATE INDEX "Order_scheduledFor_idx" ON "Order"("scheduledFor");

ALTER TABLE "DeletedOrder" ADD COLUMN "scheduledFor" DATE;
UPDATE "DeletedOrder"
SET "scheduledFor" = ("originalCreatedAt" AT TIME ZONE 'America/Lima')::date;
ALTER TABLE "DeletedOrder" ALTER COLUMN "scheduledFor" SET NOT NULL;
