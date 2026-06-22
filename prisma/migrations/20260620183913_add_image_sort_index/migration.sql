-- CreateIndex
CREATE INDEX "Image_user_id_folder_id_createdAt_id_idx" ON "Image"("user_id", "folder_id", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Image_user_id_folder_id_file_name_id_idx" ON "Image"("user_id", "folder_id", "file_name", "id");

-- CreateIndex
CREATE INDEX "Image_user_id_folder_id_size_id_idx" ON "Image"("user_id", "folder_id", "size", "id");
