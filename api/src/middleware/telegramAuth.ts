import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export interface TelegramActor {
  id: string;
  username: string;
  displayName: string;
  initData?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    actor?: TelegramActor;
  }
}

function readInitData(request: FastifyRequest): string | undefined {
  const header = request.headers["x-telegram-init-data"];
  if (Array.isArray(header)) return header[0];
  return header;
}

export async function registerTelegramAuth(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", async (request: FastifyRequest, _reply: FastifyReply) => {
    const initData = readInitData(request);

    // TODO: validate Telegram Mini App initData signature server-side.
    // DEV ONLY: this mock actor is unsafe for production because it does not
    // prove Telegram identity. Replace before exposing protected API routes.
    const actor: TelegramActor = {
      id: "dev-operator",
      username: "operator_kz",
      displayName: "Dev Operator",
    };

    if (initData) actor.initData = initData;

    request.actor = actor;
  });
}
