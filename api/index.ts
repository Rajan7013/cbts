import type { Request, Response } from 'express';
import { createApp } from '../server';

let appPromise: ReturnType<typeof createApp> | null = null;

export default async function handler(req: Request, res: Response) {
  if (!appPromise) {
    appPromise = createApp({ skipStatic: true });
  }
  const app = await appPromise;
  return app(req, res);
}
