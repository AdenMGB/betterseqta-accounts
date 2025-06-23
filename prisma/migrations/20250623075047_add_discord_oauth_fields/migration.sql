/*
  Warnings:

  - A unique constraint covering the columns `[providerId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `User` ADD COLUMN `provider` VARCHAR(191) NULL,
    ADD COLUMN `providerId` VARCHAR(191) NULL,
    MODIFY `email` VARCHAR(191) NULL,
    MODIFY `password` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_providerId_key` ON `User`(`providerId`);
