import express from "express";
import {
  createFolder,
  deleteFolder,
  fetchFolders,
  moveFolder,
  renameFolder,
} from "../controllers/folderController.js";
import { upload } from "../middlewares/upload.js";
import { uploadImageToFolder } from "../controllers/imagesController.js";
const router = express.Router();

// Get folder content from parent folder id
router.get("/", fetchFolders);
// Create a new folder
router.post("/", createFolder);
// upload images to certain folders
router.post("/:id/upload", upload.array("images", 10), uploadImageToFolder);
// Update a folder by ID
// rename folder
router.put("/:id/rename", renameFolder);
// Update a folder by ID
// move folder to new paren
// cut & paste
router.patch("/:id/move", moveFolder);
// Delete a folder by ID
router.delete("/:id", deleteFolder);

export default router;
