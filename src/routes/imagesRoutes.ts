import express from "express";
import {
  deleteImage,
  deleteMultiImages,
} from "../controllers/imagesController";
const router = express.Router();

// delete single image
router.delete("/:id", deleteImage);
// delete multi images
router.delete("/", deleteMultiImages);
export default router;
