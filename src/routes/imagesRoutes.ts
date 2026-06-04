import express from "express";
import {
  deleteImage,
  deleteMultiImages,
  fetchImage,
  fetchImages,
  moveImageToFolder,
} from "../controllers/imagesController";
const router = express.Router();

// get images
router.get("/", fetchImages);

// get image by id
router.get("/:id", fetchImage);

// move image to another folder
router.put("/:id/move", moveImageToFolder);
// delete single image
router.delete("/:id", deleteImage);
// delete multi images
router.delete("/", deleteMultiImages);
export default router;
