import { prisma } from "../lib/prisma";
import {
  createFolderService,
  renameFolderService,
} from "../services/folder.service";
import { ClerkUserData } from "../types";

export async function saveUserToDB(data: ClerkUserData) {
  const user = await prisma.user.create({
    data: {
      clerkId: data.id, // store Clerk's ID as reference
      username: data.username,
      name: `${data.first_name} ${data.last_name}`,
      avatar: data.image_url,
    },
    select: {
      username: true,
    },
  });

  const dirName = user.username;

  // create a folder by username inside filesystem and DB
  await createFolderService(dirName, null, data.id);
}

export async function updateUserInDB(data: ClerkUserData) {
  // 1. find the user
  // parent folder
  const userParentFolder = await prisma.folder.findFirst({
    where: { user_id: data.id, parent_id: null },
  });
  //   2. updat the user
  const updatedUser = await prisma.user.update({
    where: { clerkId: data.id },
    data: {
      username: data.username,
      name: `${data.first_name} ${data.last_name}`,
      avatar: data.image_url,
    },
    select: {
      id: true,
      username: true,
    },
  });

  const dirName = updatedUser.username;

  //   3. update the directory with the user name by update username
  if (userParentFolder)
    await renameFolderService(
      dirName,
      userParentFolder?.id,
      userParentFolder?.path,
    );
  else await createFolderService(dirName, null, data.id);
}

export async function deleteUserFromDB(clerkId: string) {
  try {
    await prisma.user.delete({ where: { clerkId } });
  } catch (dbError) {
    throw new Error(`DB error: ${(dbError as Error).message}`);
  }
}
