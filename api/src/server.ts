import process from "node:process";
import Fastify from "fastify";
import { config } from "./config.js";
import { closeDb } from "./db.js";
import { registerTelegramAuth } from "./middleware/telegramAuth.js";
import { healthRoutes } from "./routes/health.js";
import { logRoutes } from "./routes/logs.js";
import { packRoutes } from "./routes/packs.js";
import { sourceRoutes } from "./routes/sources.js";

export async function buildServer() {
  const app = Fastify({
    logger: config.NODE_ENV !== "test",
  });

  await registerTelegramAuth(app);
  await healthRoutes(app);
  await sourceRoutes(app);
  await packRoutes(app);
  await logRoutes(app);

  app.addHook("onClose", async () => {
    await closeDb();
  });

  return app;
}

async function main(): Promise<void> {
  const app = await buildServer();

  try {
    await app.listen({ host: config.HOST, port: config.PORT });
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
