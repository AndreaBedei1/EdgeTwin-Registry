import { describe, expect, it, vi } from "vitest";

vi.stubEnv("NODE_ENV", "test");
vi.stubEnv("PORT", "4000");
vi.stubEnv("MONGODB_URI", "mongodb://127.0.0.1:27017");
vi.stubEnv("MONGODB_DB_NAME", "hdt_test");
vi.stubEnv("SESSION_SECRET", "test-secret-that-is-long-enough-for-session");
vi.stubEnv("CORS_ORIGIN", "http://localhost:5173");
vi.stubEnv("EDGE_ID", "local-edge-01");
vi.stubEnv("EDGE_NAME", "Local Development Edge");
vi.stubEnv("EDGE_API_BASE_URL", "http://localhost:4000");
vi.stubEnv("HDT_DEFAULT_IMAGE", "example/hdt-runtime:test");
vi.stubEnv("DEPLOYMENT_PROVIDER", "mock");

describe("deployHdtForProfile", () => {
  it("returns a mock deployment result", async () => {
    const { deployHdtForProfile } = await import("../src/services/deployHdt");
    const result = await deployHdtForProfile({
      _id: { toString: () => "profile-123" },
      userId: { toString: () => "user-456" },
      edgeData: { edgeId: "edge-1" }
    } as never);

    expect(result).toMatchObject({
      status: "deploying",
      provider: "mock",
      image: "example/hdt-runtime:test"
    });
    expect(result.podName).toContain("hdt-");
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  it("builds the future deployment request from server-controlled values", async () => {
    const { buildHdtDeploymentRequest } = await import("../src/services/deployHdt");
    const request = buildHdtDeploymentRequest({
      _id: { toString: () => "profile-123" },
      userId: { toString: () => "user-456" },
      edgeData: { edgeId: "edge-1" }
    } as never);

    expect(request).toEqual({
      profileId: "profile-123",
      userId: "user-456",
      hdtId: "profile-123",
      edgeId: "edge-1",
      image: "example/hdt-runtime:test",
      podName: "hdt-user-456-profile-123",
      environment: {
        PROFILE_ID: "profile-123",
        USER_ID: "user-456",
        HDT_ID: "profile-123",
        EDGE_ID: "edge-1"
      }
    });
  });
});
