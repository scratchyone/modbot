/*
  Warnings:

  - A unique constraint covering the columns `[uniqueId]` on the table `reminders` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "reminders" ADD COLUMN "uniqueId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "reminders_uniqueId_key" ON "reminders"("uniqueId");
