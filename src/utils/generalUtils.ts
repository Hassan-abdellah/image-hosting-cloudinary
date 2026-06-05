export const safeDirName = (name: string): string => {
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safeName;
};
