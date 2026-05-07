import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      "req.headers.x-csrf-token",
      "res.headers.set-cookie",
      "req.body.password",
      "req.body.token",
      "req.body.csrfToken",
      "password",
      "passwordHash",
      "SESSION_SECRET",
      "MONGODB_URI"
    ],
    censor: "[redacted]"
  }
});
