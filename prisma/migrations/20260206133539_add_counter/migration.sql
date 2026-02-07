-- CreateTable
CREATE TABLE "Counter" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "saleCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Counter_salonId_key" ON "Counter"("salonId");

-- AddForeignKey
ALTER TABLE "Counter" ADD CONSTRAINT "Counter_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
