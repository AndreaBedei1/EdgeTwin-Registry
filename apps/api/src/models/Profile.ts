import { Schema, model, Types, type InferSchemaType } from "mongoose";

const deploymentSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["not_started", "pending", "deploying", "running", "failed"],
      default: "not_started",
      required: true
    },
    provider: { type: String, enum: ["mock"], default: "mock", required: true },
    image: { type: String, default: "nginx:latest", required: true },
    podName: { type: String },
    deploymentName: { type: String, default: null },
    namespace: { type: String, default: null },
    lastError: { type: String, default: null }
  },
  { _id: false, timestamps: { createdAt: false, updatedAt: true } }
);

const profileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    personalData: {
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      phone: { type: String, trim: true, default: "" },
      dateOfBirth: { type: String, trim: true, default: "" }
    },
    hdtData: {
      name: { type: String, required: true, trim: true },
      sex: { type: String, enum: ["male", "female", "prefer_not_to_say"], default: "prefer_not_to_say" },
      drivingExperienceLevel: {
        type: String,
        enum: ["beginner", "intermediate", "experienced", "professional"],
        required: true
      },
      drivingExperienceYears: {
        type: String,
        enum: ["0_1", "2_5", "6_10", "11_20", "over_20"],
        required: true
      },
      preferredDrivingStyle: {
        type: String,
        enum: ["cautious", "balanced", "dynamic", "eco"],
        required: true
      },
      notes: { type: String, trim: true, default: "" }
    },
    vdtData: {
      nickname: { type: String, required: true, trim: true },
      brand: { type: String, required: true, trim: true },
      model: { type: String, required: true, trim: true },
      vehicleType: {
        type: String,
        enum: ["car", "motorcycle", "van", "truck", "bus", "prototype", "simulated_vehicle"],
        required: true
      },
      powertrain: {
        type: String,
        enum: ["petrol", "diesel", "hybrid", "electric", "hydrogen", "unknown"],
        required: true
      },
      vehicleIdentifier: { type: String, trim: true, default: "" }
    },
    edgeData: {
      edgeId: { type: String, required: true, trim: true },
      edgeName: { type: String, trim: true, default: "" },
      edgeApiBaseUrl: { type: String, required: true, trim: true },
      source: { type: String, enum: ["qr", "manual"], required: true }
    },
    deployment: { type: deploymentSchema, required: true, default: () => ({}) }
  },
  { timestamps: true }
);

export type ProfileDocument = InferSchemaType<typeof profileSchema> & { _id: Types.ObjectId; userId: Types.ObjectId };
export const ProfileModel = model("Profile", profileSchema);
