import { type Request, type Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../utils/authUtils";
import { isRequestParamsMissing, requireReqBody } from "../utils/reqUtils";
import {
  createFolderService,
  renameFolderService,
} from "../services/folder.service";
import { profile } from "console";

interface folderReqBody {
  parent_id?: string;
  name: string;
}

/** Find a folder by id and verify ownership. Returns null and sends response on failure. */
async function findOwnedFolder(
  folderId: string,
  clerkId: string,
  res: Response,
) {
  const folder = await prisma.folder.findUnique({ where: { id: folderId } });

  if (!folder) {
    res.status(404).json({ status: false, message: "Folder not found" });
    return null;
  }

  if (folder.user_id !== clerkId) {
    res.status(403).json({ status: false, message: "Forbidden" });
    return null;
  }

  return folder;
}

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
    await createFolderService(name, parent_id || null, clerkId);
    res.status(201).json({ status: true, message: "Created Successfully" });
  } catch (error) {
    console.log("error", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

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
    await renameFolderService(name, folderId, folder.path);
    res
      .status(200)
      .json({ status: true, message: "Folder renamed successfully" });
  } catch (error) {
    console.log("error", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
