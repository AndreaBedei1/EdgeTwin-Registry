import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

export const meRouter = Router();

meRouter.get("/me", requireAuth, (_req, res) => {
  res.json({ user: res.locals.user });
});
