import "dotenv/config";
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
import { rename, unlink } from "fs/promises";

interface fetchImagesQuery {
  page?: string;
  per_page?: string;
  sort_by?: "original_name" | "createdAt" | "size";
  sort_type?: "desc" | "asc";
  folder_id?: string;
  image_id?: string;
}
// get images

export const fetchImages = async (req: Request, res: Response) => {
  //   check if the user is authenticated and get the clerkId
  const clerkId = requireAuth(req, res);
  if (!clerkId) return;

  const {
    page: paramPage,
    per_page: paramLimit,
    sort_by,
    sort_type,
    folder_id,
    image_id,
  } = req.query as fetchImagesQuery;
  // pagination and sorting params
  const page = paramPage && Number(paramPage) > 0 ? Number(paramPage) : 1;
  //get 10 images per query
  const per_page =
    paramLimit && Number(paramLimit) > 0 ? Number(paramLimit) : 10;

  const skip = (page - 1) * per_page;

  const [images, total] = await Promise.all([
    prisma.image.findMany({
      where: {
        user_id: clerkId,
        // conditional by folder if exits
        folder_id: folder_id ? folder_id : undefined,
        // conditional by id if exits
        id: image_id ? image_id : undefined,
      },
      orderBy: {
        [sort_by ?? "createdAt"]: sort_type ?? "desc",
      },
      include: { folder: { select: { path: true } } },
      skip: skip,
      take: per_page,
    }),
    prisma.image.count({
      where: {
        user_id: clerkId,
        // conditional by folder if exits
        folder_id: folder_id ? folder_id : undefined,
        // conditional by id if exits
        id: image_id ? image_id : undefined,
      },
    }),
  ]);

  const imageswithURLS = images.map((image) => {
    const imageURL = `${process.env.BASE_URL}/api/images/${image.id}`;
    return {
      ...image,
      url: imageURL,
    };
  });
  return res.status(200).json({
    status: true,
    images: imageswithURLS,
    pagination: {
      total: total,
      page: page,
      per_page: per_page,
      totalPages: Math.ceil(total / per_page),
    },
  });
};

// get image by id

export const fetchImage = async (req: Request, res: Response) => {
  //   check if the user is authenticated and get the clerkId
  const clerkId = requireAuth(req, res);
  if (!clerkId) return;

  const imageId = isRequestParamsMissing(req, res, "Image");
  if (!imageId) return;
  const image = await findOwnedImage(imageId, clerkId, res);
  if (!image) return;

  const imagePath = path.join(image.folder.path, image.file_name);
  res.sendFile(imagePath, { root: path.resolve("storage") });
};

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

// move image to another folder
export const moveImageToFolder = async (req: Request, res: Response) => {
  //   check if the user is authenticated and get the clerkId
  const clerkId = requireAuth(req, res);
  if (!clerkId) return;
  // check image id is in the url
  const imageId = isRequestParamsMissing(req, res, "Image");
  if (!imageId) return;

  const body = requireReqBody(req, res);
  if (!body) return;

  const { new_parent_id } = req.body as { new_parent_id: string };
  if (!new_parent_id) {
    return res
      .status(401)
      .json({ status: false, message: "Destination Folder Id is required" });
  }

  try {
    // 1. check if the image user wants to upload to is already there and belongs to him
    const image = await findOwnedImage(imageId, clerkId, res);

    if (!image) return;

    // prevent moving to the same folder

    if (image.folder_id === new_parent_id) {
      return res
        .status(400)
        .send({ status: false, message: "Can’t move to the same folder" });
    }
    // get the destination folder
    const destinationFolder = await findOwnedFolder(
      new_parent_id,
      clerkId,
      res,
    );
    if (!destinationFolder) return;

    const existingFolderPath = image.folder.path;
    const imageName = image.file_name;
    const destinationFolderPath = destinationFolder.path;

    // contstuct the path of the image from folder path/image name
    const oldPath = path.join(Base_UPLOAD_DIR, existingFolderPath, imageName);
    const newPath = path.join(
      Base_UPLOAD_DIR,
      destinationFolderPath,
      imageName,
    );
    // 3. update the image with the new folder id
    await prisma.image.update({
      where: { id: imageId, user_id: clerkId },
      data: {
        folder_id: new_parent_id,
      },
    });

    // 4. moving in file system
    await rename(oldPath, newPath).catch(async () => {
      // roll back DB to old values
      await prisma.image.update({
        where: { id: imageId },
        data: { folder_id: image.folder_id },
      });
      throw new Error("Failed to move file");
    });
    res
      .status(200)
      .json({ status: true, message: "Images Moved Successfully" });
  } catch (error) {
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
    res.status(200).json({
      status: true,
      message: `(${images.length}) Images Deleted Successfully`,
    });
  } catch (error) {
    console.log("error", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
