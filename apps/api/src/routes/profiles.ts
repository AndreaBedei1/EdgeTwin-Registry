import { Router } from "express";
import { Types } from "mongoose";
import { profileCreateSchema } from "@hdt/shared";
import { requireAuth } from "../middleware/auth.js";
import { config } from "../config.js";
import { sendError } from "../http/errorResponse.js";
import { requireCsrf } from "../middleware/csrf.js";
import { validateBody } from "../middleware/validate.js";
import { ProfileModel } from "../models/Profile.js";
import { deployHdtForProfile } from "../services/deployHdt.js";

export const profilesRouter = Router();

profilesRouter.post("/profiles", requireAuth, requireCsrf, validateBody(profileCreateSchema), async (req, res, next) => {
  try {
    const profile = await ProfileModel.create({
      userId: res.locals.user._id,
      ...req.body,
      deployment: {
        status: "pending",
        provider: "mock",
        image: config.HDT_DEFAULT_IMAGE,
        lastError: null,
        updatedAt: new Date()
      }
    });

    const deployment = await deployHdtForProfile(profile);
    profile.deployment = deployment;
    await profile.save();

    res.status(201).json({ profile });
  } catch (err) {
    next(err);
  }
});

profilesRouter.get("/profiles/me", requireAuth, async (_req, res, next) => {
  try {
    const profiles = await ProfileModel.find({ userId: res.locals.user._id }).sort({ createdAt: -1 });
    res.json({ profiles });
  } catch (err) {
    next(err);
  }
});

profilesRouter.put("/profiles/:profileId", requireAuth, requireCsrf, validateBody(profileCreateSchema), async (req, res, next) => {
  try {
    const { profileId } = req.params;
    if (!profileId || !Types.ObjectId.isValid(profileId)) {
      sendError(res, 400, "BAD_REQUEST", "Invalid profile ID");
      return;
    }

    const profile = await ProfileModel.findOne({ _id: profileId, userId: res.locals.user._id });
    if (!profile) {
      sendError(res, 404, "NOT_FOUND", "Profile not found");
      return;
    }

    profile.set(req.body);
    await profile.save();

    res.json({ profile });
  } catch (err) {
    next(err);
  }
});
