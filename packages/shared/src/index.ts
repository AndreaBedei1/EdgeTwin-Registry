import { z } from "zod";

const trimmedString = (min: number, max: number, label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(min, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

const optionalTrimmedString = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer`).optional().or(z.literal(""));

const safeEdgeIdString = (label: string) =>
  trimmedString(1, 120, label).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, `${label} can contain only letters, numbers, dots, underscores, and hyphens`);

const edgeApiBaseUrlSchema = z
  .string({ required_error: "Edge API base URL is required" })
  .trim()
  .url("Enter a valid edge API base URL")
  .max(500, "Edge API base URL is too long")
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, "Edge API base URL must use HTTP or HTTPS");

export const sexOptions = ["male", "female", "prefer_not_to_say"] as const;
export const drivingExperienceLevelOptions = ["beginner", "intermediate", "experienced", "professional"] as const;
export const drivingExperienceYearsOptions = ["0_1", "2_5", "6_10", "11_20", "over_20"] as const;
export const preferredDrivingStyleOptions = ["cautious", "balanced", "dynamic", "eco"] as const;
export const vehicleTypeOptions = ["car", "motorcycle", "van", "truck", "bus", "prototype", "simulated_vehicle"] as const;
export const powertrainOptions = ["petrol", "diesel", "hybrid", "electric", "hydrogen", "unknown"] as const;
export const edgeSourceOptions = ["qr", "manual"] as const;

export const emailSchema = z
  .string({ required_error: "Email is required" })
  .trim()
  .email("Enter a valid email address")
  .max(254, "Email is too long")
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string({ required_error: "Password is required" })
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be 128 characters or fewer");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema
}).strip();

export const registerFormSchema = registerSchema
  .extend({
    confirmPassword: z.string({ required_error: "Confirm password is required" }).min(1, "Confirm password is required")
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match"
      });
    }
  });

export const loginSchema = registerSchema;

export const personalDataSchema = z.object({
  firstName: trimmedString(1, 80, "First name"),
  lastName: trimmedString(1, 80, "Last name"),
  phone: optionalTrimmedString(40, "Phone"),
  dateOfBirth: optionalTrimmedString(30, "Date of birth")
}).strict();

export const hdtDataSchema = z.object({
  name: trimmedString(1, 120, "HDT name"),
  sex: z.enum(sexOptions).optional().default("prefer_not_to_say"),
  drivingExperienceLevel: z.enum(drivingExperienceLevelOptions, {
    required_error: "Driving experience level is required"
  }),
  drivingExperienceYears: z.enum(drivingExperienceYearsOptions, {
    required_error: "Driving experience years is required"
  }),
  preferredDrivingStyle: z.enum(preferredDrivingStyleOptions, {
    required_error: "Preferred driving style is required"
  }),
  notes: optionalTrimmedString(1000, "Notes")
}).strict();

export const vdtDataSchema = z.object({
  nickname: trimmedString(1, 120, "Vehicle nickname"),
  brand: trimmedString(1, 80, "Brand"),
  model: trimmedString(1, 80, "Vehicle model"),
  vehicleType: z.enum(vehicleTypeOptions, {
    required_error: "Vehicle type is required"
  }),
  powertrain: z.enum(powertrainOptions, {
    required_error: "Powertrain is required"
  }),
  vehicleIdentifier: optionalTrimmedString(120, "Vehicle identifier")
}).strict();

export const edgeDataSchema = z.object({
  edgeId: safeEdgeIdString("Edge ID"),
  edgeName: optionalTrimmedString(160, "Edge name"),
  edgeApiBaseUrl: edgeApiBaseUrlSchema,
  source: z.enum(edgeSourceOptions, {
    required_error: "Edge source is required"
  })
}).strict();

export const edgeRegistrationQrPayloadSchema = z.object({
  type: z.literal("HDT_EDGE_REGISTRATION"),
  version: z.literal(1),
  edgeId: safeEdgeIdString("Edge ID"),
  edgeName: optionalTrimmedString(160, "Edge name"),
  edgeApiBaseUrl: edgeApiBaseUrlSchema,
  registrationToken: optionalTrimmedString(512, "Registration token")
}).strict();

export const profileCreateSchema = z.object({
  personalData: personalDataSchema,
  hdtData: hdtDataSchema,
  vdtData: vdtDataSchema,
  edgeData: edgeDataSchema
}).strict();

export const deploymentStatusSchema = z.enum(["not_started", "pending", "deploying", "running", "failed"]);

export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterFormInput = z.infer<typeof registerFormSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileCreateInput = z.infer<typeof profileCreateSchema>;
export type EdgeRegistrationQrPayload = z.infer<typeof edgeRegistrationQrPayloadSchema>;
export type EdgeSource = (typeof edgeSourceOptions)[number];
export type DeploymentStatus = z.infer<typeof deploymentStatusSchema>;

export type DeploymentResult = {
  status: DeploymentStatus;
  provider: "mock";
  image: string;
  podName: string;
  deploymentName?: string | null;
  namespace?: string | null;
  lastError?: string | null;
  updatedAt: Date;
};
