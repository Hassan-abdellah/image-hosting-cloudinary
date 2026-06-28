import cloudinary from "../config/cloudinary";
import { getPublicIdFromUrl } from "../utils/generalUtils";

export const deleteFromCloudinary = async (imagesURls: string[]) => {
  const publicIds = imagesURls
    .map((imgUrl) => getPublicIdFromUrl(imgUrl))
    .filter(Boolean);

  if (publicIds.length) {
    const cloudinaryResult = await cloudinary.api.delete_resources(publicIds, {
      resource_type: "image",
    });

    const failed = Object.entries(cloudinaryResult.deleted).filter(
      ([, status]) => status !== "deleted",
    );

    if (failed.length) {
      console.warn("Some Cloudinary deletions failed:", failed);
    }
  }
};
