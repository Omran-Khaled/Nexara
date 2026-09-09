import type { Request, Response } from 'express';
import { getRuntimeApp } from '../server/runtime/createRuntimeApp';

export default async function nexaraApi(request: Request, response: Response): Promise<void> {
  try {
    const app = await getRuntimeApp();
    app(request, response);
  } catch (error) {
    response.status(503).json({
      error: {
        code: 'RUNTIME_UNAVAILABLE',
        message: 'Nexara is temporarily unavailable while required services are being initialized.',
      },
    });
    console.error(JSON.stringify({ event: 'vercel_runtime_initialization_failed', errorType: error instanceof Error ? error.name : typeof error }));
  }
}
