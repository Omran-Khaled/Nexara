import { RequestHandler, Router } from 'express';
import { DownloadController } from '../controllers/DownloadController';

const asyncHandler = (handler: RequestHandler): RequestHandler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

export function createDownloadRoutes(controller: DownloadController): Router {
  const router = Router();
  router.get('/books/:bookId/editions/:editionId/downloads', asyncHandler(controller.availability));
  router.post('/books/:bookId/editions/:editionId/files/:fileId/downloads', asyncHandler(controller.requestDownload));
  return router;
}
