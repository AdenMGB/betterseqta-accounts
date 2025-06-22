/*
  Warnings:

  - You are about to drop the column `read` on the `Message` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Message` DROP COLUMN `read`,
    ADD COLUMN `readAt` DATETIME(3) NULL;
