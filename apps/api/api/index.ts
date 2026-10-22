import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildApp } from '../src/app';

let app: Awaited<ReturnType<typeof buildApp>> | undefined;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  app.server.emit('request', req, res);
}