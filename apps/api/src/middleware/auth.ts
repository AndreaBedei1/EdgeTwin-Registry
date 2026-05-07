import type { NextFunction, Request, Response } from "express";
import { sendError } from "../http/errorResponse.js";
import { UserModel } from "../models/User.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.session.userId) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }

    const user = await UserModel.findById(req.session.userId).select("-passwordHash");
    if (!user) {
      req.session.destroy(() => undefined);
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }

    res.locals.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
