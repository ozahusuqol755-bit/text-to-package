import process from "node:process";
import Fastify from "fastify";
import { config } from "./config.js";
import { closeDb, DatabaseSchemaError, DatabaseUnavailableError } from "./db.js";
import { registerTelegramAuth } from "./middleware/telegramAuth.js";
import { analysisRoutes } from "./routes/analyses.js";
import { healthRoutes } from "./routes/health.js";
import { ideaRoutes } from "./routes/ideas.js";
import { logRoutes } from "./routes/logs.js";
import { packRoutes } from "./routes/packs.js";
import { sourceRoutes } from "./routes/sources.js";

export async function buildServer() {
  const app = Fastify({
    logger: config.NODE_ENV !== "test",
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DatabaseUnavailableError || error instanceof DatabaseSchemaError) {
      const statusCode = error instanceof DatabaseUnavailableError ? 503 : 500;
      void reply.status(statusCode).send({
        error: error.code,
        message: error.message,
      });
      return;
    }

    void reply.send(error);
  });

  await registerTelegramAuth(app);
  await healthRoutes(app);
  await sourceRoutes(app);
  await analysisRoutes(app);
  await ideaRoutes(app);
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
