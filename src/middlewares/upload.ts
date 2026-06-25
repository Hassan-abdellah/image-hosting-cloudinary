import { Request } from "express";
import multer, { FileFilterCallback } from "multer";
import path from "path";
import { getAuth } from "@clerk/express";
import { prisma } from "../lib/prisma";
import { safeDirName } from "../utils/generalUtils";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary";

// get the auth user direcotry with his username
const resolveUploadDirName = async (req: Request): Promise<string> => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) {
    throw new Error("Unauthorized: no active Clerk session");
  }
  // get username for logged in user
  const user = await prisma.user.findUnique({
    where: { clerkId: clerkId },
    select: { username: true },
  });
  if (!user) throw new Error("User not found");
  // fallback to clerk id if username not found
  const userName = user.username ?? clerkId;
  // clean the dir name for saving
  const safeName = safeDirName(userName);

  return safeName;
};

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

const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req: any, file: any) => {
    const loggedInUsername = await resolveUploadDirName(req);
    return {
      folder: `image-hosting-app/${loggedInUsername}`,
      allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
      transformation: [{ width: 1000, crop: "limit" }],
    };
  },
});

export const upload = multer({
  storage: imageStorage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});
