import { Request, Response } from "express";
import {
  findOwnedFolder,
  findOwnedImage,
  requireAuth,
} from "../utils/authUtils";
import { isRequestParamsMissing, requireReqBody } from "../utils/reqUtils";
import fs from "fs";
import { prisma } from "../lib/prisma";
import { ImageCreateManyInput } from "../generated/prisma/models";
import path from "path";
import { Base_UPLOAD_DIR } from "../constants";
import { unlink } from "fs/promises";

// Upload Images to folders
export const uploadImageToFolder = async (req: Request, res: Response) => {
  //   check if the user is authenticated and get the clerkId
  const clerkId = requireAuth(req, res);
  if (!clerkId) return;
  // check folder id is in the url
  const folderId = isRequestParamsMissing(req, res, "Folder");
  if (!folderId) return;

  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    res.status(400).json({ error: "At least one Image is required" });
    return;
  }

  try {
    // 1. check if the folder user wants to upload to is already  there and belongs to him
    const folder = await findOwnedFolder(folderId, clerkId, res);

    if (!folder) return;

    // 2. isnert the metadata of the images in DB

    await prisma.image.createMany({
      data: files.map((file) => ({
        file_name: file.filename,
        original_name: file.originalname,
        size: file.size,
        user_id: clerkId,
        folder_id: folderId,
      })) as ImageCreateManyInput[],
    });

    // create the folder
    res
      .status(201)
      .json({ status: true, message: "Images Uploaded Successfully" });
  } catch (error) {
    // DB failed — delete the file multer already wrote so disk and DB stay in sync
    files.forEach((file) => fs.unlink(file.path, () => {}));

    console.log("error", error);

    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Delete Image
export const deleteImage = async (req: Request, res: Response) => {
  //   check if the user is authenticated and get the clerkId
  const clerkId = requireAuth(req, res);
  if (!clerkId) return;
  // check image id is in the url
  const imageId = isRequestParamsMissing(req, res, "Image");
  if (!imageId) return;

  try {
    // 1. check if the image user wants to upload to is already there and belongs to him
    const image = await findOwnedImage(imageId, clerkId, res);

    if (!image) return;

    const folderPath = image.folder.path;
    const imageName = image.file_name;
    // contstuct the path of the image from folder path/image name
    const imagePath = path.join(Base_UPLOAD_DIR, folderPath, imageName);

    // 3. delete the metadata of the image in DB

    await prisma.image.delete({
      where: { id: imageId },
    });

    // 4. delete from the filesystem
    // catch will not throw the error if it faield
    await unlink(imagePath).catch(() => {});
    // create the folder
    res
      .status(200)
      .json({ status: true, message: "Images Deleted Successfully" });
  } catch (error) {
    console.log("error", error);

    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Delete Multi Images
export const deleteMultiImages = async (req: Request, res: Response) => {
  //   check if the user is authenticated and get the clerkId
  const clerkId = requireAuth(req, res);
  if (!clerkId) return;
  // check image id is in the url
  const body = requireReqBody(req, res);
  if (!body) return;

  const { images_ids } = req.body as { images_ids: string[] };

  if (!images_ids || !images_ids.length) {
    return res.status(400).json({ status: false, message: "No Ids found" });
  }
  try {
    // 1. get the images for this ids and belong to this user
    const images = await prisma.image.findMany({
      where: { id: { in: images_ids }, user_id: clerkId },
      include: {
        folder: { select: { path: true } },
      },
    });

    if (!images || !images.length) {
      return res
        .status(404)
        .json({ status: false, message: "No Images found" });
    }

    // 2. delete the metadata of the images in DB

    await prisma.image.deleteMany({
      where: { id: { in: images.map((item) => item.id) }, user_id: clerkId },
    });

    // 4. delete from the filesystem

    await Promise.all(
      images.map((image) => {
        const imagePath = path.join(
          Base_UPLOAD_DIR,
          image.folder.path,
          image.file_name,
        );
        unlink(imagePath).catch(() => {});
      }),
    );
    res
      .status(200)
      .json({
        status: true,
        message: `(${images.length}) Images Deleted Successfully`,
      });
  } catch (error) {
    console.log("error", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
