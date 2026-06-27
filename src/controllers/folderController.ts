import { type Request, type Response } from "express";
import { prisma } from "../lib/prisma";
import { findOwnedFolder, requireAuth } from "../utils/authUtils";
import { isRequestParamsMissing, requireReqBody } from "../utils/reqUtils";
import {
  createFolderService,
  deleteFolderService,
  moveFolderService,
  renameFolderService,
} from "../services/folder.service";

interface folderReqBody {
  parent_id?: string;
  name: string;
}

interface fetchFoldersQuery {
  page?: string;
  per_page?: string;
  sort_by?: "name" | "createdAt" | "size";
  sort_type?: "desc" | "asc";
  parent_id?: string;
}

const FOLDER_SORT_MAP: Record<string, string> = {
  name: "name",
  createdAt: "createdAt",
};

const IMAGE_SORT_MAP: Record<string, string> = {
  name: "file_name",
  size: "size",
  createdAt: "createdAt",
};

// get the root folder of logged in user

export const fetchRootUserFolder = async (req: Request, res: Response) => {
  //   check if the user is authenticated and get the clerkId
  const clerkId = requireAuth(req, res);
  if (!clerkId) return;

  const folder = await prisma.folder.findFirst({
    where: {
      user_id: clerkId,
      parent_id: null,
    },
  });

  return res.status(200).json({
    status: true,
    folder: folder,
  });
};

// get Folder content based on parent folder id

export const fetchFolders = async (req: Request, res: Response) => {
  //   check if the user is authenticated and get the clerkId
  const clerkId = requireAuth(req, res);
  if (!clerkId) return;

  const {
    page: paramPage,
    per_page: paramLimit,
    sort_by,
    sort_type,
    parent_id,
  } = req.query as fetchFoldersQuery;

  if (!parent_id) {
    return res
      .status(400)
      .json({ status: false, message: "Parent Folder Id is Required" });
  }
  // pagination and sorting params
  const page = paramPage && Number(paramPage) > 0 ? Number(paramPage) : 1;
  //get 10 images per query
  const per_page =
    paramLimit && Number(paramLimit) > 0 ? Number(paramLimit) : 100;

  const skip = (page - 1) * per_page;

  const folderSortBy = FOLDER_SORT_MAP[sort_by ?? "createdAt"] ?? "createdAt";
  const imageSortBy = IMAGE_SORT_MAP[sort_by ?? "createdAt"] ?? "createdAt";

  const [folder, folders, total, folderImages, totalImages, parentChain] =
    await Promise.all([
      // folder with id
      prisma.folder.findUnique({
        where: {
          user_id: clerkId,
          id: parent_id,
        },
      }),

      // folders
      prisma.folder.findMany({
        where: {
          user_id: clerkId,
          parent_id: parent_id,
        },
        orderBy: {
          [folderSortBy]: sort_type ?? "desc",
        },

        skip: skip,
        take: per_page,
      }),
      // folders count
      prisma.folder.count({
        where: {
          user_id: clerkId,
          parent_id: parent_id,
        },
      }),
      // get the images for this folder
      prisma.image.findMany({
        where: {
          folder_id: parent_id,
          user_id: clerkId,
        },
        orderBy: {
          [imageSortBy]: sort_type ?? "desc",
        },

        skip: skip,
        take: per_page,
      }),

      // get the images count
      prisma.image.count({
        where: {
          folder_id: parent_id,
          user_id: clerkId,
        },
      }),
      // get the folder full chain of parents

      // Full parent chain (root → current folder)
      prisma.$queryRaw<
        { id: string; name: string; parent_id: string | null }[]
      >`
       WITH RECURSIVE folder_chain AS (
      SELECT id, name, parent_id, 0 AS depth
      FROM "Folder"
      WHERE id = ${parent_id} AND user_id = ${clerkId}

      UNION ALL

      SELECT f.id, f.name, f.parent_id, fc.depth + 1
      FROM "Folder" f
      INNER JOIN folder_chain fc ON f.id = fc.parent_id
    )
    SELECT id, name, parent_id FROM folder_chain
    ORDER BY depth DESC;
  `,
    ]);

  return res.status(200).json({
    status: true,
    folder: folder,
    folders: {
      folders: folders,
      pagination: {
        total: total,
        page: page,
        per_page: per_page,
        totalPages: Math.ceil(total / per_page),
      },
    },
    images: {
      images: folderImages,
      pagination: {
        total: totalImages,
        page: page,
        per_page: per_page,
        totalPages: Math.ceil(totalImages / per_page),
      },
    },
  });
};

// create Folder
export const createFolder = async (req: Request, res: Response) => {
  //   check if the user is authenticated and get the clerkId
  const clerkId = requireAuth(req, res);
  if (!clerkId) return;
  //  check if the request body is provided and get the body
  const body = requireReqBody(req, res);
  if (!body) return;

  try {
    // destructure the body to get the name and parent_id
    const { name, parent_id } = body as folderReqBody;
    // validate the name field
    if (!name) {
      return res
        .status(400)
        .json({ status: false, message: "Name is required" });
    }

    // 1. check if  there is already a folder with the same name in the same parent folder for the user, if yes throw an error
    const existingFolder = await prisma.folder.findFirst({
      where: {
        name: name,
        parent_id: parent_id || null,
        user_id: clerkId,
      },
    });

    if (existingFolder) {
      return res
        .status(400)
        .json({ status: false, message: "Folder already exists" });
    }

    // create the folder
    const folder = await createFolderService(name, parent_id || null, clerkId);
    res
      .status(201)
      .json({ status: true, message: "Created Successfully", folder });
  } catch (error) {
    console.log("error", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// rename Folder
export const renameFolder = async (req: Request, res: Response) => {
  //   check if the user is authenticated and get the clerkId
  const clerkId = requireAuth(req, res);
  if (!clerkId) return;

  // check if the Id is Presented in the URL params or not
  const folderId = isRequestParamsMissing(req, res, "Folder");
  if (!folderId) return;

  //  check if the request body is provided and get the body
  const body = requireReqBody(req, res);
  if (!body) return;

  try {
    // destructure the body to get the name and parent_id
    const { name } = body as folderReqBody;
    // validate the name field
    if (!name) {
      return res
        .status(400)
        .json({ status: false, message: "Name is required" });
    }

    // check if the folder existed or not

    const folder = await findOwnedFolder(folderId, clerkId, res);
    if (!folder) return;
    // rename the folder
    await renameFolderService(name, folderId, folder.path, folder.parent?.path);
    res
      .status(200)
      .json({ status: true, message: "Folder renamed successfully" });
  } catch (error) {
    console.log("error", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
// move folder
export const moveFolder = async (req: Request, res: Response) => {
  //   check if the user is authenticated and get the clerkId
  const clerkId = requireAuth(req, res);
  if (!clerkId) return;

  // check if the Id is Presented in the URL params or not
  const folderId = isRequestParamsMissing(req, res, "Folder");
  if (!folderId) return;

  //  check if the request body is provided and get the body
  const body = requireReqBody(req, res);
  if (!body) return;

  try {
    // destructure the body to get the name and parent_id
    const { new_parent_id } = body as { new_parent_id: string };
    // validate the name field
    if (!new_parent_id) {
      return res
        .status(400)
        .json({ status: false, message: "New Parent is required" });
    }

    // check if the folder existed or not

    const folder = await findOwnedFolder(folderId, clerkId, res);
    if (!folder) return;
    // move the folder
    await moveFolderService(folder.name, folderId, folder.path, new_parent_id);
    res
      .status(200)
      .json({ status: true, message: "Folder Moved successfully" });
  } catch (error) {
    console.log("error", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// delete folder
export const deleteFolder = async (req: Request, res: Response) => {
  //   check if the user is authenticated and get the clerkId
  const clerkId = requireAuth(req, res);
  if (!clerkId) return;

  // check if the Id is Presented in the URL params or not
  const folderId = isRequestParamsMissing(req, res, "Folder");
  if (!folderId) return;

  try {
    // check if the folder existed or not
    const folder = await findOwnedFolder(folderId, clerkId, res);
    if (!folder) return;
    // delete the folder
    await deleteFolderService(folderId);
    res
      .status(200)
      .json({ status: true, message: "Folder Deleted successfully" });
  } catch (error) {
    console.log("error", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
