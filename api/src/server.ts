import process from "node:process";
import Fastify from "fastify";
import { config } from "./config.js";
import { closeDb, DatabaseSchemaError, DatabaseUnavailableError } from "./db.js";
import { registerTelegramAuth } from "./middleware/telegramAuth.js";
import { aiRoutes } from "./routes/ai.js";
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

  app.addHook("onRequest", async (_request, reply) => {
    reply.header("access-control-allow-origin", "*");
    reply.header("access-control-allow-methods", "GET,POST,OPTIONS");
    reply.header("access-control-allow-headers", "content-type,x-telegram-init-data");
  });

  app.options("/*", async (_request, reply) => reply.status(204).send());

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
  await aiRoutes(app);
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
