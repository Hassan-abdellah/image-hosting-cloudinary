import { Request, Response } from "express";
import { findOwnedFolder, requireAuth } from "../utils/authUtils";
import { isRequestParamsMissing } from "../utils/reqUtils";
import fs from "fs";
import { prisma } from "../lib/prisma";
import { ImageCreateManyInput } from "../generated/prisma/models";

// create Folder
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
