/*
  Warnings:

  - You are about to drop the column `amount` on the `Sale` table. All the data in the column will be lost.
  - You are about to drop the column `serviceId` on the `Sale` table. All the data in the column will be lost.
  - You are about to drop the column `staffId` on the `Sale` table. All the data in the column will be lost.
  - You are about to drop the column `commissionPercentage` on the `Staff` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[salonId,invoiceNo]` on the table `Sale` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `invoiceNo` to the `Sale` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paymentMode` to the `Sale` table without a default value. This is not possible if the table is not empty.
  - Added the required column `subtotal` to the `Sale` table without a default value. This is not possible if the table is not empty.
  - Added the required column `taxAmount` to the `Sale` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalAmount` to the `Sale` table without a default value. This is not possible if the table is not empty.
  - Added the required column `commissionType` to the `Staff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `commissionValue` to the `Staff` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "Sale" DROP CONSTRAINT "Sale_staffId_fkey";

-- AlterTable
ALTER TABLE "Sale" DROP COLUMN "amount",
DROP COLUMN "serviceId",
DROP COLUMN "staffId",
ADD COLUMN     "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "invoiceNo" TEXT NOT NULL,
ADD COLUMN     "paymentMode" TEXT NOT NULL,
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'paid',
ADD COLUMN     "subtotal" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "taxAmount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "totalAmount" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "costPrice" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Staff" DROP COLUMN "commissionPercentage",
ADD COLUMN     "baseSalary" DOUBLE PRECISION,
ADD COLUMN     "commissionType" TEXT NOT NULL,
ADD COLUMN     "commissionValue" DOUBLE PRECISION NOT NULL;

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "commission" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "totalServices" INTEGER NOT NULL,
    "totalRevenue" DOUBLE PRECISION NOT NULL,
    "totalCommission" DOUBLE PRECISION NOT NULL,
    "baseSalary" DOUBLE PRECISION NOT NULL,
    "bonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalPayable" DOUBLE PRECISION NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_staffId_idx" ON "SaleItem"("staffId");

-- CreateIndex
CREATE INDEX "Payroll_salonId_idx" ON "Payroll"("salonId");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_salonId_staffId_month_year_key" ON "Payroll"("salonId", "staffId", "month", "year");

-- CreateIndex
CREATE INDEX "Sale_salonId_idx" ON "Sale"("salonId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_salonId_invoiceNo_key" ON "Sale"("salonId", "invoiceNo");

-- CreateIndex
CREATE INDEX "Service_salonId_idx" ON "Service"("salonId");

-- CreateIndex
CREATE INDEX "Staff_salonId_idx" ON "Staff"("salonId");

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
