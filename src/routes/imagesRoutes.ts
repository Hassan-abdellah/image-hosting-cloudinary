import express from "express";
import {
  deleteImage,
  deleteMultiImages,
  fetchImages,
  moveImageToFolder,
} from "../controllers/imagesController";
const router = express.Router();

// get images
router.get("/", fetchImages);
// move image to another folder
router.put("/:id/move", moveImageToFolder);
// delete single image
router.delete("/:id", deleteImage);
// delete multi images
router.delete("/", deleteMultiImages);
export default router;
