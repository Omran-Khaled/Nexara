import { Router } from 'express';
import { RuntimeController } from '../controllers/RuntimeControllers';

const asyncHandler = (handler: (req: any, res: any) => Promise<unknown>) => (req: any, res: any, next: any) => { void handler(req, res).catch(next); };

export function createRuntimeRoutes(controller: RuntimeController): Router {
  const router = Router();
  router.get('/authors', asyncHandler(controller.listAuthors));
  router.get('/reading-paths', asyncHandler(controller.listReadingPaths));
  router.get('/me/runtime-data', asyncHandler(controller.listPersonal));
  router.put('/me/book-states', asyncHandler(controller.upsertBookState));
  router.post('/me/time-capsules', asyncHandler(controller.createTimeCapsule));
  router.patch('/me/notifications/:id/read', asyncHandler(controller.markNotificationRead));
  return router;
}
