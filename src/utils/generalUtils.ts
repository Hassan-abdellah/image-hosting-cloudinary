export const safeDirName = (name: string): string => {
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safeName;
};

// Extract public_id from Cloudinary URL
// e.g. "folder/my-image" from ".../upload/v123/folder/my-image.jpg"
export const getPublicIdFromUrl = (url: string): string => {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z]+$/);
  return match ? match[1] : "";
};
