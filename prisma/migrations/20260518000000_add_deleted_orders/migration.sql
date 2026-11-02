-- CreateTable
CREATE TABLE "DeletedOrder" (
    "id" SERIAL NOT NULL,
    "originalOrderId" INTEGER NOT NULL,
    "areaId" INTEGER NOT NULL,
    "userId" INTEGER,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "observation" TEXT,
    "originalCreatedAt" TIMESTAMPTZ(3) NOT NULL,
    "originalUpdatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeletedOrderItem" (
    "id" SERIAL NOT NULL,
    "deletedOrderId" INTEGER NOT NULL,
    "originalItemId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "unitMeasurementId" INTEGER NOT NULL,

    CONSTRAINT "DeletedOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeletedOrder_originalOrderId_key" ON "DeletedOrder"("originalOrderId");

-- CreateIndex
CREATE INDEX "DeletedOrder_areaId_idx" ON "DeletedOrder"("areaId");

-- CreateIndex
CREATE INDEX "DeletedOrder_deletedAt_idx" ON "DeletedOrder"("deletedAt");

-- CreateIndex
CREATE INDEX "DeletedOrderItem_deletedOrderId_idx" ON "DeletedOrderItem"("deletedOrderId");

-- AddForeignKey
ALTER TABLE "DeletedOrderItem" ADD CONSTRAINT "DeletedOrderItem_deletedOrderId_fkey" FOREIGN KEY ("deletedOrderId") REFERENCES "DeletedOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
