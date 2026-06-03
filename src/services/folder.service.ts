import path from "path";
import { cwd } from "process";
import { prisma } from "../lib/prisma";
import { cp, mkdir, rm } from "fs/promises";
const BASE_DIR = path.join(cwd(), "storage");

// create folder
export const createFolderService = async (
  folderName: string,
  parentId: string | null,
  userId: string,
) => {
  let parentFolderPath = null;

  if (parentId) {
    const folder = await prisma.folder.findUnique({ where: { id: parentId } });
    parentFolderPath = folder?.path;
  }

  const folderPath = parentFolderPath
    ? path.join(BASE_DIR, parentFolderPath, folderName)
    : path.join(BASE_DIR, folderName);

  //   save the path from after storage to store in DB, so we can easily reconstruct the path later when needed
  const folderPathForDB = path
    .relative(BASE_DIR, folderPath)
    .replace(/\\/g, "/");

  // 1. Save to DB first (inside a transaction)

  const folder = await prisma.$transaction(async (tx) => {
    const createdFolder = await tx.folder.create({
      data: {
        user_id: userId,
        name: folderName,
        parent_id: parentId || null,
        path: folderPathForDB,
      },
    });

    // 2. Create the physical folder
    try {
      await mkdir(folderPath, { recursive: true });
    } catch (fsError) {
      // 3. Throw to trigger Prisma transaction rollback
      throw new Error(`File System Error: ${(fsError as Error).message}`);
    }

    return createdFolder;
  });

  return folder;
};

// rename folder
export const renameFolderService = async (
  newFolderName: string,
  folderId: string,
  existingFolderPath: string,
) => {
  const oldPath = path.join(BASE_DIR, existingFolderPath || "");
  const newPath = path.join(path.dirname(oldPath), newFolderName);

  //   save the path from after storage to store in DB, so we can easily reconstruct the path later when needed
  const folderPathForDB = path.relative(BASE_DIR, newPath).replace(/\\/g, "/");

  // 1. Find all subfolders whose path starts with the old folder path
  const subFolders = await prisma.folder.findMany({
    where: {
      path: { startsWith: existingFolderPath.replace(/\\/g, "/") + "/" },
      id: { not: folderId }, // exclude the parent itself
    },
  });

  // 2. Copy the folder to the new path with all contents
  try {
    await cp(oldPath, newPath, { recursive: true });
  } catch (fsError) {
    // 3. Throw to trigger Prisma transaction rollback
    throw new Error(`File System Error: ${(fsError as Error).message}`);
  }

  // 3. Update DB — for parent and subfolders rollback if fails
  try {
    await prisma.$transaction([
      prisma.folder.update({
        where: { id: folderId },
        data: { name: newFolderName, path: folderPathForDB },
      }),
      ...subFolders.map((subfolder) => {
        // replace old text to new text
        const newSubfolderPath = subfolder.path.replace(
          existingFolderPath,
          folderPathForDB,
        );
        return prisma.folder.update({
          where: { id: subfolder.id },
          data: { path: newSubfolderPath },
        });
      }),
    ]);
  } catch (dbError) {
    // Undo copy if DB fails
    await rm(newPath, { recursive: true, force: true }).catch(() => null);
    throw new Error(`DB error: ${(dbError as Error).message}`);
  }

  // 3. Delete old folder last — after both cp and DB succeed
  await rm(oldPath, { recursive: true, force: true }).catch(() => null);

  return { id: folderId, name: newFolderName, path: newPath };
};
