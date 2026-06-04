import "dotenv/config";
import { imagesTypes } from "../types";

export const buildImgeURL = (imageId: string) => {
  const imageURL = `${process.env.BASE_URL}/api/images/${imageId}`;
  return imageURL;
};

// build image urls
export const generateImagesWithURLs = (images: imagesTypes[]) => {
  const imageswithURLS = images.map((image) => {
    const imageURL = buildImgeURL(image.id);
    return {
      ...image,
      url: imageURL,
    };
  });
  return imageswithURLS;
};
