import { Router } from 'express';
import { IngestionController } from '../controllers/IngestionController';

const asyncHandler = (handler: (req: any, res: any) => Promise<unknown>) => (req: any, res: any, next: any) => { void handler(req, res).catch(next); };

export function createIngestionRoutes(controller: IngestionController): Router {
  const router = Router();
  router.post('/gutenberg', asyncHandler(controller.startGutenberg));
  router.post('/wikisource', asyncHandler(controller.startWikisource));
  router.post('/aco', asyncHandler(controller.startAco));
  router.get('/', asyncHandler(controller.list));
  router.get('/:id', asyncHandler(controller.get));
  router.post('/:id/publish', asyncHandler(controller.publish));
  return router;
}
