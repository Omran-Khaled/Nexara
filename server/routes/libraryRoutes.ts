import { RequestHandler, Router } from 'express';
import { AuditLogController, BookmarkController, CollectionController, HighlightController, ReadingProgressController, ReviewController, RightsController } from '../controllers/LibraryControllers';

const asyncHandler = (handler: RequestHandler): RequestHandler => (req, res, next) => { Promise.resolve(handler(req, res, next)).catch(next); };

export function createLibraryRoutes(controllers: { progress: ReadingProgressController; bookmarks: BookmarkController; highlights: HighlightController; collections: CollectionController; reviews: ReviewController; rights: RightsController; audits: AuditLogController; }) {
  const router = Router();
  router.put('/reading-progress/:bookId', asyncHandler(controllers.progress.upsert));
  router.get('/reading-progress', asyncHandler(controllers.progress.list));
  router.post('/reading-history/:bookId/open', asyncHandler(controllers.progress.recordOpened));
  router.get('/reading-history', asyncHandler(controllers.progress.listHistory));
  router.post('/bookmarks', asyncHandler(controllers.bookmarks.create));
  router.get('/bookmarks', asyncHandler(controllers.bookmarks.list));
  router.delete('/bookmarks/:id', asyncHandler(controllers.bookmarks.delete));
  router.post('/highlights', asyncHandler(controllers.highlights.create));
  router.get('/highlights', asyncHandler(controllers.highlights.list));
  router.patch('/highlights/:id/note', asyncHandler(controllers.highlights.updateNote));
  router.delete('/highlights/:id', asyncHandler(controllers.highlights.delete));
  router.post('/collections', asyncHandler(controllers.collections.create));
  router.get('/collections', asyncHandler(controllers.collections.list));
  router.put('/collections/:id/books', asyncHandler(controllers.collections.updateBookIds));
  router.delete('/collections/:id', asyncHandler(controllers.collections.delete));
  router.post('/reviews', asyncHandler(controllers.reviews.create));
  router.get('/community/reviews', asyncHandler(controllers.reviews.listFeed));
  router.get('/books/:bookId/reviews', asyncHandler(controllers.reviews.listByBook));
  router.put('/reviews/:id/like', asyncHandler(controllers.reviews.setLike));
  router.post('/reviews/:id/comments', asyncHandler(controllers.reviews.createComment));
  router.get('/reviews/:id/comments', asyncHandler(controllers.reviews.listComments));
  router.post('/rights-records', asyncHandler(controllers.rights.create));
  router.get('/books/:bookId/rights-records', asyncHandler(controllers.rights.listByBook));
  router.get('/audit-logs', asyncHandler(controllers.audits.list));
  return router;
}
