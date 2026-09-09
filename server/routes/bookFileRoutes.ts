import { Router, RequestHandler } from 'express';
import { BookFileController } from '../controllers/BookFileController';
const asyncHandler = (handler: RequestHandler): RequestHandler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
export function createBookFileRoutes(controller: BookFileController): Router {
  const router = Router();
  router.post('/books/:bookId/editions/:editionId/files', asyncHandler(controller.upload));
  router.post('/books/:bookId/editions/:editionId/files/direct-upload', asyncHandler(controller.createDirectUpload));
  router.post('/books/:bookId/editions/:editionId/files/direct-upload/staged-body', asyncHandler(controller.stagedBody));
  router.post('/books/:bookId/editions/:editionId/files/complete-direct-upload', asyncHandler(controller.completeDirectUpload));
  router.get('/books/:bookId/editions/:editionId/files/:fileId/read-url', asyncHandler(controller.readUrl));
  router.get('/books/:bookId/editions/:editionId/files/:fileId/download-url', asyncHandler(controller.downloadUrl));
  router.get('/books/:bookId/editions/:editionId/files/:fileId/content', asyncHandler(controller.content));
  return router;
}
