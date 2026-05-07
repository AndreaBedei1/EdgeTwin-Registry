import { Router } from "express";
import rateLimit from "express-rate-limit";
import { loginSchema, registerSchema } from "@hdt/shared";
import { config } from "../config.js";
import { UserModel } from "../models/User.js";
import { sendError } from "../http/errorResponse.js";
import { requireCsrf } from "../middleware/csrf.js";
import { validateBody } from "../middleware/validate.js";
import { hashPassword, verifyPassword } from "../services/password.js";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many authentication attempts. Try again later.",
      details: []
    }
  }
});

authRouter.post("/register", authLimiter, validateBody(registerSchema), async (req, res, next) => {
  try {
    const existing = await UserModel.exists({ email: req.body.email });
    if (existing) {
      sendError(res, 409, "CONFLICT", "Email is already registered");
      return;
    }

    const user = await UserModel.create({
      email: req.body.email,
      passwordHash: await hashPassword(req.body.password)
    });

    req.session.regenerate((err) => {
      if (err) {
        next(err);
        return;
      }
      req.session.userId = user._id.toString();
      res.status(201).json({ user: user.toJSON() });
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", authLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const user = await UserModel.findOne({ email: req.body.email });
    if (!user || !(await verifyPassword(req.body.password, user.passwordHash))) {
      sendError(res, 401, "INVALID_CREDENTIALS", "Invalid email or password");
      return;
    }

    req.session.regenerate((err) => {
      if (err) {
        next(err);
        return;
      }
      req.session.userId = user._id.toString();
      res.json({ user: user.toJSON() });
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", requireCsrf, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      next(err);
      return;
    }
    res.clearCookie("hdt.sid", {
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: config.NODE_ENV === "production" ? "none" : "lax"
    });
    res.status(204).send();
  });
});
