/*
  Warnings:

  - You are about to drop the column `path` on the `Image` table. All the data in the column will be lost.
  - You are about to alter the column `size` on the `Image` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.

*/
-- AlterTable
ALTER TABLE "Image" DROP COLUMN "path",
ALTER COLUMN "size" SET DATA TYPE INTEGER;
