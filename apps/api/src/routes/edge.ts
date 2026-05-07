import { Router } from "express";
import { edgeRegistrationQrPayloadSchema } from "@hdt/shared";
import { config } from "../config.js";

export const edgeRouter = Router();

edgeRouter.get("/edge/registration-payload", (_req, res) => {
  const payload = edgeRegistrationQrPayloadSchema.parse({
    type: "HDT_EDGE_REGISTRATION",
    version: 1,
    edgeId: config.EDGE_ID,
    edgeName: config.EDGE_NAME,
    edgeApiBaseUrl: config.EDGE_API_BASE_URL
  });

  res.json(payload);
});
