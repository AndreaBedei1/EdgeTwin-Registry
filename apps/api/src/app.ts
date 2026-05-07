import express from "express";
import cors from "cors";
import helmet from "helmet";
import session, { type Store } from "express-session";
import MongoStore from "connect-mongo";
import { pinoHttp } from "pino-http";
import mongoose from "mongoose";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { authRouter } from "./routes/auth.js";
import { edgeRouter } from "./routes/edge.js";
import { meRouter } from "./routes/me.js";
import { profilesRouter } from "./routes/profiles.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { csrfTokenRoute } from "./middleware/csrf.js";
import { sendError } from "./http/errorResponse.js";

type CreateAppOptions = {
  sessionStore?: Store;
  skipRequestLogging?: boolean;
};

function createSessionStore() {
  return MongoStore.create({
    mongoUrl: config.MONGODB_URI,
    dbName: config.MONGODB_DB_NAME,
    collectionName: "sessions",
    stringify: false
  });
}

function databaseStatus() {
  switch (mongoose.connection.readyState) {
    case 1:
      return "connected";
    case 2:
      return "connecting";
    case 3:
      return "disconnecting";
    default:
      return "disconnected";
  }
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.CORS_ORIGINS.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Origin is not allowed by CORS"));
      },
      credentials: true
    })
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));
  if (!options.skipRequestLogging) {
    app.use(pinoHttp({ logger }));
  }
  app.use(
    session({
      name: "hdt.sid",
      secret: config.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: options.sessionStore ?? createSessionStore(),
      cookie: {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        sameSite: config.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 1000 * 60 * 60 * 8
      }
    })
  );

  app.get("/health", (_req, res) => res.json({ status: "ok", database: databaseStatus() }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok", database: databaseStatus() }));
  app.get("/api/csrf-token", csrfTokenRoute);
  app.use("/api", edgeRouter);
  app.use("/api/auth", authRouter);
  app.use("/api", meRouter);
  app.use("/api", profilesRouter);
  app.use((_req, res) => {
    sendError(res, 404, "NOT_FOUND", "Not found");
  });
  app.use(errorHandler);

  return app;
}
