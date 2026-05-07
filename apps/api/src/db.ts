import mongoose from "mongoose";
import { config } from "./config.js";
import { logger } from "./logger.js";

export async function connectDatabase() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(config.MONGODB_URI, {
    dbName: config.MONGODB_DB_NAME
  });
  logger.info({ dbName: config.MONGODB_DB_NAME }, "MongoDB connected");
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
