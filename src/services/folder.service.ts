import path from "path";
import { prisma } from "../lib/prisma";
import { safeDirName } from "../utils/generalUtils";

// get all subfolders from path
const getSubFoldersFromParentPath = async (
  parentPath: string,
  parentFolderId: string,
) => {
  // 1. Find all subfolders whose path starts with the old folder path
  const subFolders = await prisma.folder.findMany({
    where: {
      // replace all \ by /
      path: { startsWith: parentPath.replace(/\\/g, "/") + "/" },
      id: { not: parentFolderId }, // exclude the parent itself
    },
  });
  return subFolders;
};
// create folder
export const createFolderService = async (
  folderName: string,
  parentId: string | null,
  userId: string,
) => {
  let parentFolderPath = null;
  // sanitaize the folder name
  const safeName = safeDirName(folderName);

  if (parentId) {
    const folder = await prisma.folder.findUnique({ where: { id: parentId } });
    parentFolderPath = folder?.path;
  }

  const folderPath = parentFolderPath
    ? path.join(parentFolderPath, safeName)
    : safeName;

  //   save the path from after storage to store in DB, so we can easily reconstruct the path later when needed
  const folderPathForDB = folderPath.replace(/\\/g, "/");

  const folder = await prisma.folder.create({
    data: {
      user_id: userId,
      name: safeName,
      parent_id: parentId || null,
      path: folderPathForDB,
    },
  });

  return folder;
};

// rename folder
export const renameFolderService = async (
  newFolderName: string,
  folderId: string,
  existingFolderPath: string,
) => {
  // sanitaize the folder name
  const safeName = safeDirName(newFolderName);
  const oldPath = existingFolderPath || "";
  const newPath = path.join(oldPath, safeName);

  //   save the path from after storage to store in DB, so we can easily reconstruct the path later when needed
  const folderPathForDB = newPath.replace(/\\/g, "/");

  // 1.check if there is any folder with the new name inside beside the newely renamed folder

  const duplicated = await prisma.folder.findFirst({
    where: { path: folderPathForDB, id: { not: folderId } },
  });

  if (duplicated)
    throw new Error(`A folder named "${safeName}" already exists`);
  // 2. Find all subfolders whose path starts with the old folder path

  const subFolders = await getSubFoldersFromParentPath(
    existingFolderPath,
    folderId,
  );

  // 3. Update DB — for parent and subfolders rollback if fails
  try {
    await prisma.$transaction([
      prisma.folder.update({
        where: { id: folderId },
        data: { name: safeName, path: folderPathForDB },
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
    throw new Error(`DB error: ${(dbError as Error).message}`);
  }

  return { id: folderId, name: safeName, path: newPath };
};

// move folder -> Cut and Paste
export const moveFolderService = async (
  existingFolderName: string,
  folderId: string,
  existingFolderPath: string,
  newParnetFolderId: string,
) => {
  // 1. get the path of the new parent folder -> destination

  const destinationFolder = await prisma.folder.findFirst({
    where: { id: newParnetFolderId },
  });

  if (!destinationFolder) return;

  const newPath = path.join(destinationFolder?.path, existingFolderName);

  //   save the path from after storage to store in DB, so we can easily reconstruct the path later when needed
  const folderPathForDB = newPath.replace(/\\/g, "/");

  // 2.check if there is any folder with the new name inside beside the newely renamed folder

  const duplicated = await prisma.folder.findFirst({
    where: { path: folderPathForDB, id: { not: folderId } },
  });

  if (duplicated) throw new Error(`A folder with the same name already exists`);

  // 3. prevent move to the itself

  if (folderPathForDB.startsWith(existingFolderPath + "/")) {
    throw new Error("Cannot move a folder into itself or its own subfolder");
  }
  // 4. Find all subfolders whose path starts with the old folder path

  const subFolders = await getSubFoldersFromParentPath(
    existingFolderPath,
    folderId,
  );

  // 7. Update DB — for parent and subfolders rollback if fails
  try {
    await prisma.$transaction([
      prisma.folder.update({
        where: { id: folderId },
        data: { parent_id: destinationFolder.id, path: folderPathForDB },
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
    throw new Error(`DB error: ${(dbError as Error).message}`);
  }

  return {
    id: folderId,
    name: existingFolderName,
    parent_id: destinationFolder.id,
    path: newPath,
  };
};

// delete folder with all of its content
export const deleteFolderService = async (folderId: string) => {
  // 1. Delete from DB
  try {
    await prisma.folder.delete({ where: { id: folderId } });
  } catch (dbError) {
    throw new Error(`DB error: ${(dbError as Error).message}`);
  }

  return {
    id: folderId,
  };
};
