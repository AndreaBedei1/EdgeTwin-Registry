import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { config } from "../config.js";
import { errorBody, sendError } from "../http/errorResponse.js";
import { logger } from "../logger.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    sendError(
      res,
      400,
      "VALIDATION_ERROR",
      "Validation failed",
      err.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }))
    );
    return;
  }

  if (err?.code === 11000) {
    sendError(res, 409, "CONFLICT", "A record with this value already exists");
    return;
  }

  logger.error({ err }, "Unhandled request error");
  const status = Number.isInteger(err.status) ? err.status : 500;
  const message = config.NODE_ENV === "production" ? "Internal server error" : err.message ?? "Internal server error";
  res.status(status).json(errorBody("INTERNAL_ERROR", message));
};
