import { createApp } from "./app.js";
import { config } from "./config.js";
import { connectDatabase } from "./db.js";
import { logger } from "./logger.js";

async function main() {
  await connectDatabase();
  const app = createApp();
  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, "HDT API listening");
  });
}

main().catch((err) => {
  logger.fatal({ err }, "Failed to start API");
  process.exit(1);
});
