import express from "express";
import { createFolder, renameFolder } from "../controllers/folderController.js";
const router = express.Router();

// Create a new folder
router.post("/", createFolder);
// // Get all folders for the authenticated user
// router.get("/");
// // Get a specific folder by ID
// router.get("/:id");
// // Update a folder by ID
router.put("/:id/rename", renameFolder);
// // Delete a folder by ID
// router.delete("/:id");

export default router;
