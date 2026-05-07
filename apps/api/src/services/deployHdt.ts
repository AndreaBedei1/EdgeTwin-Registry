import type { DeploymentResult } from "@hdt/shared";
import type { ProfileDocument } from "../models/Profile.js";
import { config } from "../config.js";
import { logger } from "../logger.js";

/**
 * Future Kubernetes or YAML-based orchestrator adapters should consume this
 * server-built request shape. The current mock provider does not send it
 * outside this process and does not create Kubernetes resources.
 */
export type HdtDeploymentRequest = {
  profileId: string;
  userId: string;
  hdtId: string;
  edgeId: string;
  image: string;
  podName: string;
  environment: {
    PROFILE_ID: string;
    USER_ID: string;
    HDT_ID: string;
    EDGE_ID: string;
  };
};

export type HdtDeploymentProvider = {
  provider: "mock";
  deploy(request: HdtDeploymentRequest): Promise<DeploymentResult>;
};

function slugPart(value: string, fallback: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);

  return slug || fallback;
}

function buildPodName(userId: string, profileId: string) {
  return `hdt-${slugPart(userId, "user")}-${slugPart(profileId, "profile")}`.slice(0, 63).replace(/-$/g, "");
}

export function buildHdtDeploymentRequest(profile: ProfileDocument): HdtDeploymentRequest {
  const profileId = profile._id.toString();
  const userId = profile.userId.toString();
  const hdtId = profileId;
  const edgeId = profile.edgeData?.edgeId;
  if (!edgeId) {
    throw new Error("Cannot build HDT deployment request without a saved edge ID");
  }
  const podName = buildPodName(userId, profileId);

  return {
    profileId,
    userId,
    hdtId,
    edgeId,
    image: config.HDT_DEFAULT_IMAGE,
    podName,
    environment: {
      PROFILE_ID: profileId,
      USER_ID: userId,
      HDT_ID: hdtId,
      EDGE_ID: edgeId
    }
  };
}

const mockDeploymentProvider: HdtDeploymentProvider = {
  provider: "mock",
  async deploy(request) {
    logger.info(
      {
        provider: this.provider,
        image: request.image,
        podName: request.podName,
        profileId: request.profileId,
        userId: request.userId,
        hdtId: request.hdtId,
        edgeId: request.edgeId
      },
      "Mock HDT deployment requested"
    );

    return {
      status: "deploying",
      provider: "mock",
      image: request.image,
      podName: request.podName,
      deploymentName: null,
      namespace: null,
      lastError: null,
      updatedAt: new Date()
    };
  }
};

export async function deployHdtForProfile(profile: ProfileDocument): Promise<DeploymentResult> {
  const request = buildHdtDeploymentRequest(profile);

  if (config.DEPLOYMENT_PROVIDER !== "mock") {
    throw new Error("Only the mock deployment provider is currently supported");
  }

  return mockDeploymentProvider.deploy(request);
}
