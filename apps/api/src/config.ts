import "dotenv/config";
import { z } from "zod";

const mongoUriSchema = z.string().min(1, "MONGODB_URI is required").refine((value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "mongodb:" || parsed.protocol === "mongodb+srv:";
  } catch {
    return false;
  }
}, "MONGODB_URI must be a valid mongodb:// or mongodb+srv:// URI");

const corsOriginSchema = z
  .string()
  .min(1, "CORS_ORIGIN is required")
  .refine((value) => {
    const origins = value.split(",").map((origin) => origin.trim()).filter(Boolean);
    return origins.length > 0 && origins.every((origin) => {
      try {
        const parsed = new URL(origin);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    });
  }, "CORS_ORIGIN must be a comma-separated list of http(s) origins");

const edgeIdSchema = z
  .string()
  .trim()
  .min(1, "EDGE_ID is required")
  .max(120, "EDGE_ID must be 120 characters or fewer")
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "EDGE_ID can contain only letters, numbers, dots, underscores, and hyphens");

const edgeNameSchema = z.string().trim().min(1, "EDGE_NAME is required").max(160, "EDGE_NAME must be 160 characters or fewer");

const edgeApiBaseUrlSchema = z
  .string()
  .trim()
  .min(1, "EDGE_API_BASE_URL is required")
  .max(500, "EDGE_API_BASE_URL must be 500 characters or fewer")
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, "EDGE_API_BASE_URL must be a valid HTTP or HTTPS URL");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"], {
      required_error: "NODE_ENV is required"
    }),
    PORT: z.coerce.number({ required_error: "PORT is required" }).int().min(1).max(65535),
    MONGODB_URI: mongoUriSchema,
    MONGODB_DB_NAME: z.string().min(1, "MONGODB_DB_NAME is required"),
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
    CORS_ORIGIN: corsOriginSchema,
    EDGE_ID: edgeIdSchema,
    EDGE_NAME: edgeNameSchema,
    EDGE_API_BASE_URL: edgeApiBaseUrlSchema,
    HDT_DEFAULT_IMAGE: z.string().trim().min(1, "HDT_DEFAULT_IMAGE is required"),
    DEPLOYMENT_PROVIDER: z.literal("mock", {
      errorMap: () => ({ message: "DEPLOYMENT_PROVIDER must currently be mock" })
    })
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production" && value.SESSION_SECRET.length < 64) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SESSION_SECRET"],
        message: "SESSION_SECRET must be at least 64 characters in production"
      });
    }
  });

function loadConfig() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid backend environment configuration: ${details}`);
  }

  return {
    ...result.data,
    CORS_ORIGINS: result.data.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
  } as const;
}

export type AppConfig = ReturnType<typeof loadConfig>;
export const config = loadConfig();
