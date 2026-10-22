import type { IncomingMessage, ServerResponse } from "http";
import { buildApp } from "./app";

let appPromise: ReturnType<typeof buildApp> | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  appPromise ??= buildApp().then(async (a) => {
    await a.ready();
    return a;
  });
  const app = await appPromise;
  app.server.emit("request", req, res);
}