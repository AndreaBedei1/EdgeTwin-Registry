import { describe, expect, it } from "vitest";
import {
  edgeRegistrationQrPayloadSchema,
  profileCreateSchema,
  registerFormSchema,
  registerSchema
} from "../src/index";

describe("shared validation", () => {
  it("normalizes and validates registration data", () => {
    const parsed = registerSchema.parse({ email: "USER@Example.COM ", password: "very-secure-password" });

    expect(parsed.email).toBe("user@example.com");
  });

  it("rejects weak passwords", () => {
    expect(() => registerSchema.parse({ email: "user@example.com", password: "short" })).toThrow();
  });

  it("validates password confirmation in registration forms", () => {
    expect(() =>
      registerFormSchema.parse({
        email: "user@example.com",
        password: "very-secure-password",
        confirmPassword: "different-password"
      })
    ).toThrow();
  });

  it("validates profile creation payloads", () => {
    const parsed = profileCreateSchema.parse({
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
    });

    expect(parsed.edgeData.edgeId).toBe("edge-1");
    expect(parsed.edgeData.source).toBe("manual");
  });

  it("accepts valid HDT select values", () => {
    const parsed = profileCreateSchema.shape.hdtData.parse({
      name: "Andrea HDT",
      sex: "male",
      drivingExperienceLevel: "professional",
      drivingExperienceYears: "11_20",
      preferredDrivingStyle: "eco",
      notes: ""
    });

    expect(parsed.drivingExperienceLevel).toBe("professional");
  });

  it("rejects invalid HDT driving experience levels", () => {
    expect(() =>
      profileCreateSchema.shape.hdtData.parse({
        name: "Andrea HDT",
        sex: "male",
        drivingExperienceLevel: "expert-ish",
        drivingExperienceYears: "11_20",
        preferredDrivingStyle: "eco",
        notes: ""
      })
    ).toThrow();
  });

  it("rejects invalid VDT vehicle types", () => {
    expect(() =>
      profileCreateSchema.shape.vdtData.parse({
        nickname: "Test Vehicle 01",
        brand: "Tesla",
        model: "Model 3",
        vehicleType: "spaceship",
        powertrain: "electric",
        vehicleIdentifier: ""
      })
    ).toThrow();
  });

  it("accepts valid VDT select values without vehicle year or VIN", () => {
    const parsed = profileCreateSchema.shape.vdtData.parse({
      nickname: "Test Vehicle 01",
      brand: "Toyota",
      model: "Yaris",
      vehicleType: "car",
      powertrain: "hybrid",
      vehicleIdentifier: ""
    });

    expect(parsed.vehicleType).toBe("car");
    expect(parsed).not.toHaveProperty("year");
    expect(parsed).not.toHaveProperty("vin");
  });

  it("rejects removed VDT fields such as vehicle year and VIN", () => {
    expect(() =>
      profileCreateSchema.shape.vdtData.parse({
        nickname: "Test Vehicle 01",
        brand: "Toyota",
        model: "Yaris",
        vehicleType: "car",
        powertrain: "hybrid",
        vehicleIdentifier: "",
        year: 2024,
        vin: "not-required"
      })
    ).toThrow();
  });

  it("rejects malformed edge URLs", () => {
    expect(() =>
      profileCreateSchema.shape.edgeData.parse({
        edgeId: "edge-1",
        edgeName: "",
        edgeApiBaseUrl: "not-a-url",
        source: "manual"
      })
    ).toThrow();
  });

  it("rejects unsafe edge IDs and invalid edge sources", () => {
    expect(() =>
      profileCreateSchema.shape.edgeData.parse({
        edgeId: "edge 1",
        edgeName: "",
        edgeApiBaseUrl: "https://edge.example.com",
        source: "manual"
      })
    ).toThrow();

    expect(() =>
      profileCreateSchema.shape.edgeData.parse({
        edgeId: "edge-1",
        edgeName: "",
        edgeApiBaseUrl: "https://edge.example.com",
        source: "imported"
      })
    ).toThrow();
  });

  it("validates QR payloads and rejects invalid type/version", () => {
    const parsed = edgeRegistrationQrPayloadSchema.parse({
      type: "HDT_EDGE_REGISTRATION",
      version: 1,
      edgeId: "local-edge-01",
      edgeName: "Local Development Edge",
      edgeApiBaseUrl: "http://localhost:3000"
    });

    expect(parsed.edgeId).toBe("local-edge-01");
    expect(parsed.registrationToken).toBeUndefined();
    expect(() => edgeRegistrationQrPayloadSchema.parse({ ...parsed, type: "OTHER" })).toThrow();
    expect(() => edgeRegistrationQrPayloadSchema.parse({ ...parsed, version: 2 })).toThrow();
  });
});
