import { Request } from "express";
import multer, { FileFilterCallback } from "multer";
import path from "path";
import { getAuth } from "@clerk/express";
import { prisma } from "../lib/prisma";
import { Base_UPLOAD_DIR } from "../constants";
// get the auth user direcotry with his username
const resolveUploadDirName = async (req: Request): Promise<string> => {
  const { userId: clerkId } = getAuth(req);
  const { id: folderId } = req.params as { id: string };

  if (!clerkId) {
    throw new Error("Unauthorized: no active Clerk session");
  }
  if (!folderId) {
    throw new Error("folderId is Required");
  }
  // get username for logged in user
  const user = await prisma.user.findUnique({
    where: { clerkId: clerkId },
    select: { username: true },
  });

  if (!user) throw new Error("User not found");

  // get folder path to save to

  const folder = await prisma.folder.findUnique({
    where: { id: folderId, user_id: clerkId },
    select: { path: true },
  });

  if (!folder) throw new Error("Folder not found or access denied");

  // fallback to clerk id if username not found
  const userName = user.username ?? clerkId;
  // clean the dir name for saving
  const safeName = userName.replace(/[^a-zA-Z0-9._-]/g, "_");
  // the upload directory will be storage/loggedin user name
  // check if the folder path already inside the / username
  const userDirName = folder.path.startsWith(safeName)
    ? path.join(Base_UPLOAD_DIR, folder.path)
    : path.join(Base_UPLOAD_DIR, safeName, folder.path);
  return userDirName;
};
const storage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    try {
      const userDirectory = await resolveUploadDirName(req);
      cb(null, userDirectory);
    } catch (error) {
      cb(error as Error, "");
    }
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  const allowedExtensions = /jpeg|jpg|png/;
  const fileExtension = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.test(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${fileExtension}`));
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});
