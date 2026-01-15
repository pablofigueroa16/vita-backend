/*
  Warnings:

  - Added the required column `customerEmail` to the `reservations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `customerName` to the `reservations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "ReservationStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "customerEmail" TEXT NOT NULL,
ADD COLUMN     "customerName" TEXT NOT NULL;
