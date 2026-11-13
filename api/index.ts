import type { Request, Response } from 'express';

let appPromise: Promise<any> | null = null;

export default async function handler(req: Request, res: Response) {
  try {
    if (!appPromise) {
      // Dynamically import server to avoid build-time top-level module resolution issues
      appPromise = import('../server.js').then((mod) => mod.createApp({ skipStatic: true }));
    }
    const app = await appPromise;
    return app(req, res);
  } catch (error: any) {
    console.error('Vercel serverless invocation error:', error);
    res.status(500).json({
      error: 'Serverless function failed to initialize',
      details: error?.message || String(error),
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
    });
  }
}
