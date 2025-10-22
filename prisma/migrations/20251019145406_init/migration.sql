/*
  Warnings:

  - Added the required column `updatedAt` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `users` ADD COLUMN `avatarUrl` VARCHAR(2048) NULL,
    ADD COLUMN `bio` TEXT NULL,
    ADD COLUMN `fullName` VARCHAR(255) NULL,
    ADD COLUMN `location` VARCHAR(255) NULL,
    ADD COLUMN `phone` VARCHAR(20) NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    ADD COLUMN `website` VARCHAR(255) NULL;
