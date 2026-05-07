import session from "express-session";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";
import type { MockedFunction } from "vitest";
import { edgeRegistrationQrPayloadSchema, type ProfileCreateInput } from "@hdt/shared";

const deploymentObservations = vi.hoisted(() => [] as Array<{ profileId: string; persistedBeforeDeployment: boolean }>);

vi.mock("../src/services/deployHdt", () => ({
  deployHdtForProfile: vi.fn(async (profile: { _id: { toString: () => string }; userId: { toString: () => string }; edgeData: { edgeId: string } }) => {
    const { ProfileModel } = await import("../src/models/Profile");
    const profileId = profile._id.toString();
    const persistedProfile = await ProfileModel.exists({ _id: profileId });
    deploymentObservations.push({
      profileId,
      persistedBeforeDeployment: Boolean(persistedProfile)
    });

    return {
      status: "deploying",
      provider: "mock",
      image: process.env.HDT_DEFAULT_IMAGE ?? "nginx:latest",
      podName: `hdt-test-${profileId}`,
      deploymentName: null,
      namespace: null,
      lastError: null,
      updatedAt: new Date()
    };
  })
}));

const testEnv = {
  NODE_ENV: "test",
  PORT: "3000",
  MONGODB_DB_NAME: "hdt_platform_test",
  SESSION_SECRET: "test_session_secret_that_is_long_enough_for_local_tests",
  CORS_ORIGIN: "http://localhost:5173",
  EDGE_ID: "local-edge-01",
  EDGE_NAME: "Local Development Edge",
  EDGE_API_BASE_URL: "http://localhost:3000",
  HDT_DEFAULT_IMAGE: "nginx:latest",
  DEPLOYMENT_PROVIDER: "mock"
};

const validProfile: ProfileCreateInput = {
  personalData: { firstName: "Ada", lastName: "Lovelace", phone: "", dateOfBirth: "" },
  hdtData: {
    name: "Ada HDT",
    sex: "prefer_not_to_say",
    drivingExperienceLevel: "experienced",
    drivingExperienceYears: "over_20",
    preferredDrivingStyle: "balanced",
    notes: ""
  },
  vdtData: {
    nickname: "Test Vehicle 01",
    brand: "Tesla",
    model: "Model 3",
    vehicleType: "car",
    powertrain: "electric",
    vehicleIdentifier: "test-car-01"
  },
  edgeData: { edgeId: "edge-1", edgeName: "Lab Edge", edgeApiBaseUrl: "https://edge.example.com", source: "manual" }
};

describe("auth and profile integration", () => {
  let mongo: MongoMemoryServer;
  let app: Express;
  let connectDatabase: () => Promise<void>;
  let disconnectDatabase: () => Promise<void>;
  let UserModel: typeof import("../src/models/User").UserModel;
  let ProfileModel: typeof import("../src/models/Profile").ProfileModel;
  let deployHdtForProfileMock: MockedFunction<typeof import("../src/services/deployHdt").deployHdtForProfile>;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    vi.stubEnv("MONGODB_URI", mongo.getUri());
    for (const [key, value] of Object.entries(testEnv)) {
      vi.stubEnv(key, value);
    }

    ({ connectDatabase, disconnectDatabase } = await import("../src/db"));
    ({ UserModel } = await import("../src/models/User"));
    ({ ProfileModel } = await import("../src/models/Profile"));
    ({ deployHdtForProfile: deployHdtForProfileMock } = await import("../src/services/deployHdt"));
    const { createApp } = await import("../src/app");

    await connectDatabase();
    app = createApp({ sessionStore: new session.MemoryStore(), skipRequestLogging: true });
  }, 120000);

  beforeEach(() => {
    deployHdtForProfileMock.mockClear();
    deploymentObservations.length = 0;
  });

  afterEach(async () => {
    await UserModel.deleteMany({});
    await ProfileModel.deleteMany({});
  });

  afterAll(async () => {
    await disconnectDatabase();
    await mongo.stop();
  });

  async function registerUser(email = "user@example.com", password = "very-secure-password") {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ email, password }).expect(201);
    return agent;
  }

  async function csrfToken(agent: request.SuperAgentTest) {
    const response = await agent.get("/api/csrf-token").expect(200);
    return response.body.csrfToken as string;
  }

  it("returns the public edge registration payload", async () => {
    const response = await request(app).get("/api/edge/registration-payload").expect(200);

    expect(response.body).toEqual({
      type: "HDT_EDGE_REGISTRATION",
      version: 1,
      edgeId: "local-edge-01",
      edgeName: "Local Development Edge",
      edgeApiBaseUrl: "http://localhost:3000"
    });
    expect(edgeRegistrationQrPayloadSchema.safeParse(response.body).success).toBe(true);
    expect(response.body).not.toHaveProperty("registrationToken");
  });

  it("registers a user", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ email: "new-user@example.com", password: "very-secure-password" })
      .expect(201);

    expect(response.body.user.email).toBe("new-user@example.com");
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it("ignores confirmPassword if it is accidentally sent to the backend", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        email: "confirm-is-ignored@example.com",
        password: "very-secure-password",
        confirmPassword: "different-password"
      })
      .expect(201);

    expect(response.body.user.confirmPassword).toBeUndefined();
    const stored = await UserModel.findOne({ email: "confirm-is-ignored@example.com" }).lean();
    expect(stored).not.toHaveProperty("confirmPassword");
  });

  it("rejects duplicate email registration", async () => {
    await registerUser("dupe@example.com");

    const response = await request(app)
      .post("/api/auth/register")
      .send({ email: "dupe@example.com", password: "very-secure-password" })
      .expect(409);

    expect(response.body.error).toMatchObject({ code: "CONFLICT" });
  });

  it("logs in with the correct password", async () => {
    await registerUser("login@example.com");

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "login@example.com", password: "very-secure-password" })
      .expect(200);

    expect(response.body.user.email).toBe("login@example.com");
  });

  it("rejects login with the wrong password", async () => {
    await registerUser("wrong-password@example.com");

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "wrong-password@example.com", password: "incorrect-password" })
      .expect(401);

    expect(response.body.error).toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("rejects unauthenticated profile creation", async () => {
    const response = await request(app).post("/api/profiles").send(validProfile).expect(401);

    expect(response.body.error).toMatchObject({ code: "AUTHENTICATION_REQUIRED" });
  });

  it("returns field-level validation errors", async () => {
    const agent = await registerUser("validation@example.com");
    const token = await csrfToken(agent);

    const response = await agent
      .post("/api/profiles")
      .set("X-CSRF-Token", token)
      .send({ ...validProfile, edgeData: { ...validProfile.edgeData, edgeApiBaseUrl: "not-a-url" } })
      .expect(400);

    expect(response.body.error).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(response.body.error.details).toContainEqual({
      field: "edgeData.edgeApiBaseUrl",
      message: "Enter a valid edge API base URL"
    });
    expect(deployHdtForProfileMock).not.toHaveBeenCalled();
    expect(await ProfileModel.countDocuments({})).toBe(0);
  });

  it("creates an authenticated profile and stores the mock deployment result", async () => {
    const agent = await registerUser("profile@example.com");
    const token = await csrfToken(agent);

    const response = await agent
      .post("/api/profiles")
      .set("X-CSRF-Token", token)
      .send(validProfile)
      .expect(201);

    expect(response.body.profile.deployment).toMatchObject({
      status: "deploying",
      provider: "mock",
      image: "nginx:latest"
    });
    expect(response.body.profile.deployment.podName).toContain("hdt-");
    expect(response.body.profile.edgeData.source).toBe("manual");
    expect(deployHdtForProfileMock).toHaveBeenCalledTimes(1);
    expect(deploymentObservations).toEqual([
      {
        profileId: response.body.profile._id,
        persistedBeforeDeployment: true
      }
    ]);

    const stored = await ProfileModel.findById(response.body.profile._id).lean();
    expect(stored?.deployment.status).toBe("deploying");
    expect(stored?.deployment.podName).toBe(response.body.profile.deployment.podName);
    expect(stored?.edgeData.source).toBe("manual");
  });

  it("requires CSRF for authenticated profile creation", async () => {
    const agent = await registerUser("csrf@example.com");

    const response = await agent.post("/api/profiles").send(validProfile).expect(403);

    expect(response.body.error).toMatchObject({ code: "CSRF_TOKEN_INVALID" });
  });

  it("creates a profile with QR-derived edge data", async () => {
    const agent = await registerUser("qr-profile@example.com");
    const token = await csrfToken(agent);
    const qrPayload = edgeRegistrationQrPayloadSchema.parse({
      type: "HDT_EDGE_REGISTRATION",
      version: 1,
      edgeId: "local-edge-01",
      edgeName: "Local Development Edge",
      edgeApiBaseUrl: "http://localhost:3000"
    });

    const response = await agent
      .post("/api/profiles")
      .set("X-CSRF-Token", token)
      .send({
        ...validProfile,
        edgeData: {
          edgeId: qrPayload.edgeId,
          edgeName: qrPayload.edgeName,
          edgeApiBaseUrl: qrPayload.edgeApiBaseUrl,
          source: "qr"
        }
      })
      .expect(201);

    expect(response.body.profile.edgeData).toMatchObject({
      edgeId: "local-edge-01",
      edgeName: "Local Development Edge",
      edgeApiBaseUrl: "http://localhost:3000",
      source: "qr"
    });
    expect(response.body.profile).not.toHaveProperty("registrationToken");
  });

  it("rejects removed sensitive profile fields and does not persist them", async () => {
    const agent = await registerUser("sensitive-fields@example.com");
    const token = await csrfToken(agent);

    const response = await agent
      .post("/api/profiles")
      .set("X-CSRF-Token", token)
      .send({
        ...validProfile,
        hdtData: {
          ...validProfile.hdtData,
          medicalConditions: "sensitive data that must not be accepted"
        }
      })
      .expect(400);

    expect(response.body.error).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await ProfileModel.countDocuments({})).toBe(0);
    expect(deployHdtForProfileMock).not.toHaveBeenCalled();
  });

  it("rejects user-provided deployment image fields and does not deploy", async () => {
    const agent = await registerUser("user-image@example.com");
    const token = await csrfToken(agent);

    const response = await agent
      .post("/api/profiles")
      .set("X-CSRF-Token", token)
      .send({
        ...validProfile,
        deployment: {
          image: "attacker-controlled:latest"
        }
      })
      .expect(400);

    expect(response.body.error).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await ProfileModel.countDocuments({})).toBe(0);
    expect(deployHdtForProfileMock).not.toHaveBeenCalled();
  });

  it("updates profile data without triggering another deployment", async () => {
    const agent = await registerUser("update-profile@example.com");
    const token = await csrfToken(agent);
    const created = await agent.post("/api/profiles").set("X-CSRF-Token", token).send(validProfile).expect(201);
    deployHdtForProfileMock.mockClear();
    deploymentObservations.length = 0;

    const response = await agent
      .put(`/api/profiles/${created.body.profile._id}`)
      .set("X-CSRF-Token", token)
      .send({
        ...validProfile,
        hdtData: {
          ...validProfile.hdtData,
          name: "Updated Ada HDT"
        }
      })
      .expect(200);

    expect(response.body.profile.hdtData.name).toBe("Updated Ada HDT");
    expect(response.body.profile.deployment.podName).toBe(created.body.profile.deployment.podName);
    expect(deployHdtForProfileMock).not.toHaveBeenCalled();
    expect(deploymentObservations).toEqual([]);
  });
});
