import express from "express";
import {
  createFolder,
  deleteFolder,
  moveFolder,
  renameFolder,
} from "../controllers/folderController.js";
const router = express.Router();

// Create a new folder
router.post("/", createFolder);
// // Get all folders for the authenticated user
// router.get("/");
// // Get a specific folder by ID
// router.get("/:id");

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
