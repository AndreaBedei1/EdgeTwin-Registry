import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { sendError } from "../http/errorResponse.js";

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Validation failed",
        result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message
        }))
      );
      return;
    }

    req.body = result.data;
    next();
  };
}
