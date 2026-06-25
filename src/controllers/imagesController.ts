import { Request, Response } from "express";
import {
  findOwnedFolder,
  findOwnedImage,
  requireAuth,
} from "../utils/authUtils";
import { isRequestParamsMissing, requireReqBody } from "../utils/reqUtils";
import { prisma } from "../lib/prisma";
import { ImageCreateManyInput } from "../generated/prisma/models";
import path from "path";
const IMAGE_SORT_MAP: Record<string, string> = {
  name: "file_name",
  size: "size",
  createdAt: "createdAt",
};
interface fetchImagesQuery {
  page?: string;
  per_page?: string;
  sort_by?: "name" | "createdAt" | "size";
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

  return res.status(200).json({
    status: true,
    images: images,
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

  res.status(200).json({ image });
};

export const fetchImageNeighbors = async (req: Request, res: Response) => {
  const clerkId = requireAuth(req, res);
  if (!clerkId) return;

  const imageId = isRequestParamsMissing(req, res, "Image");
  if (!imageId) return;

  const image = await findOwnedImage(imageId, clerkId, res);
  if (!image) return;
  const { sort_by, sort_type, folder_id } = req.query as fetchImagesQuery;
  const imageSortBy = IMAGE_SORT_MAP[sort_by ?? "createdAt"] ?? "createdAt";

  // Build orderBy, always appending `id` as a tiebreaker so the cursor is unambiguous
  const primarySort =
    imageSortBy && sort_type
      ? { [imageSortBy]: sort_type }
      : { createdAt: "desc" as const };

  const forwardOrder = [primarySort, { id: "desc" as const }];

  const reverseOrder = forwardOrder.map((clause) =>
    Object.fromEntries(
      Object.entries(clause).map(([k, v]) => [k, v === "asc" ? "desc" : "asc"]),
    ),
  );
  const baseWhere = {
    user_id: clerkId,
    folder_id: folder_id ?? undefined, // avoids passing `undefined` as a filter value
  };

  const [prev, next] = await Promise.all([
    // walk backward
    prisma.image.findFirst({
      where: baseWhere,
      cursor: { id: imageId },
      orderBy: reverseOrder,
      skip: 1,
      take: 1,
      select: { id: true },
    }),

    // walk forward
    prisma.image.findFirst({
      where: baseWhere,
      cursor: { id: imageId },
      orderBy: forwardOrder,
      skip: 1,
      take: 1,
      select: { id: true },
    }),
  ]);
  res.status(200).json({
    prev: prev ?? null,
    next: next ?? null,
  });
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
      data: files.map((file, index) => {
        const uniqueTime = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const uniqueFileName = `${uniqueTime}${path.extname(file.originalname)}`;
        const uniqueCreatedAt = new Date(Date.now() + index);
        return {
          file_name: uniqueFileName,
          original_name: file.originalname,
          size: file.size,
          user_id: clerkId,
          folder_id: folderId,
          url: file.path,
          createdAt: uniqueCreatedAt,
        };
      }) as ImageCreateManyInput[],
    });

    // create the folder
    res
      .status(201)
      .json({ status: true, message: "Images Uploaded Successfully" });
  } catch (error) {
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

    // 3. update the image with the new folder id
    await prisma.image.update({
      where: { id: imageId, user_id: clerkId },
      data: {
        folder_id: new_parent_id,
      },
    });

    res
      .status(200)
      .json({ status: true, message: "Images Moved Successfully" });
  } catch (error) {
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

    // 3. delete the metadata of the image in DB

    await prisma.image.delete({
      where: { id: imageId },
    });

    res
      .status(200)
      .json({ status: true, message: "Images Deleted Successfully" });
  } catch (error) {
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

    res.status(200).json({
      status: true,
      message: `(${images.length}) Images Deleted Successfully`,
    });
  } catch (error) {
    console.log("error", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
