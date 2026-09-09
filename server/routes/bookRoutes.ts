import { Router, RequestHandler } from 'express';
import { BookController } from '../controllers/BookController';

const asyncHandler = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export function createBookRoutes(controller: BookController): Router {
  const router = Router();
  router.get('/', asyncHandler(controller.list));
  router.get('/:id/chapters/:index', asyncHandler(controller.getChapter));
  router.get('/:id', asyncHandler(controller.get));
  router.post('/', asyncHandler(controller.create));
  router.patch('/:id', asyncHandler(controller.update));
  router.delete('/:id', asyncHandler(controller.delete));
  return router;
}
