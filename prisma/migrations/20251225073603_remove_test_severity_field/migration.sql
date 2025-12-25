/*
  Warnings:

  - You are about to drop the column `severity` on the `service_diagnostics` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `service_diagnostics` DROP COLUMN `severity`;
