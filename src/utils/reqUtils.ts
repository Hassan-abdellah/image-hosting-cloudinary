import { Request, Response } from "express";

export const requireReqBody = (
  req: Request,
  res: Response,
): null | undefined => {
  if (!req.body) {
    res.status(400).json({ status: false, message: "No Body Provided" });
    return null;
  }
  return req.body;
};

// check if request is missing the id param or not
export const isRequestParamsMissing = (
  req: Request,
  res: Response,
  modelName: string,
): string | null => {
  const paramId = req.params.id as string;
  if (!paramId) {
    res.status(400).json({ status: false, message: `Missing ${modelName} ID` });
    return null;
  }
  return paramId;
};
