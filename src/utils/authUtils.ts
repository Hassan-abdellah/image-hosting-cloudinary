import { getAuth } from "@clerk/express";
import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const requireAuth = (req: Request, res: Response): string | null => {
  const { userId: clerkId } = getAuth(req);

  if (!clerkId) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  return clerkId;
};

/** Find a folder by id and verify ownership. Returns null and sends response on failure. */
export async function findOwnedFolder(
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
/** Find a image by id and verify ownership. Returns null and sends response on failure. */
export async function findOwnedImage(
  imageId: string,
  clerkId: string,
  res: Response,
) {
  const image = await prisma.image.findUnique({
    where: { id: imageId },
    include: {
      folder: { select: { path: true } },
    },
  });

  if (!image) {
    res.status(404).json({ status: false, message: "Image not found" });
    return null;
  }

  if (image.user_id !== clerkId) {
    res.status(403).json({ status: false, message: "Forbidden" });
    return null;
  }

  return image;
}
