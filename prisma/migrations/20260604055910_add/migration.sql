/*
  Warnings:

  - Added the required column `original_name` to the `Image` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Image" ADD COLUMN     "original_name" TEXT NOT NULL;
