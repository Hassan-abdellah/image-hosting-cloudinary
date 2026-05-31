/*
  Warnings:

  - You are about to drop the column `name` on the `Image` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Folder" ALTER COLUMN "name" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Image" DROP COLUMN "name",
ALTER COLUMN "file_name" SET DATA TYPE TEXT,
ALTER COLUMN "path" SET DATA TYPE TEXT,
ALTER COLUMN "size" SET DATA TYPE BIGINT;
