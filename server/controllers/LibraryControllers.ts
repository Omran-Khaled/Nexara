import { Request, Response } from 'express';
import { AuditService, BookmarkService, CollectionService, HighlightService, ReadingService, ReviewService, RightsService } from '../services/LibraryServices';
import { parseId } from '../utils/http';
import { validateBookmark, validateCollection, validateCollectionBookIds, validateHighlight, validateProgress, validateReview, validateReviewComment, validateReviewLike, validateRights } from '../validators/libraryValidators';
import { ValidationError } from '../errors/ApplicationErrors';
import { requirePermission, requirePrincipal } from '../middleware/auth';

function ownerId(req: Request): string { return requirePrincipal(req).id; }
function bodyNote(body: unknown) {
  const note = (body as Record<string, unknown>)?.note;
  if (typeof note !== 'string' || note.length > 10_000) throw new ValidationError({ note: 'must be a string with at most 10000 characters.' });
  return note.trim();
}
function owned<T extends object>(req: Request, input: T): T & { userId: string } { return { ...input, userId: ownerId(req) }; }
function safeDisplayName(req: Request): string {
  const email = requirePrincipal(req).email;
  return email ? email.split('@')[0].slice(0, 80) : 'Nexara Reader';
}
function feedLimit(value: unknown): number {
  if (value === undefined) return 50;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new ValidationError({ limit: 'must be a positive integer.' });
  const limit = Number(value);
  if (limit < 1 || limit > 100) throw new ValidationError({ limit: 'must be between 1 and 100.' });
  return limit;
}

export class ReadingProgressController {
  constructor(private readonly service: ReadingService) {}
  upsert = async (req: Request, res: Response) => res.json({ data: await this.service.upsert(parseId(req.params.bookId, 'bookId'), owned(req, validateProgress(req.body))) });
  list = async (req: Request, res: Response) => res.json({ data: await this.service.list(ownerId(req), typeof req.query.bookId === 'string' ? parseId(req.query.bookId, 'bookId') : undefined) });
  recordOpened = async (req: Request, res: Response) => res.status(201).json({ data: await this.service.recordOpened(parseId(req.params.bookId, 'bookId'), ownerId(req), parseId((req.body as Record<string, unknown>)?.editionId, 'editionId')) });
  listHistory = async (req: Request, res: Response) => res.json({ data: await this.service.listHistory(ownerId(req), feedLimit(req.query.limit)) });
}
export class BookmarkController {
  constructor(private readonly service: BookmarkService) {}
  create = async (req: Request, res: Response) => res.status(201).json({ data: await this.service.create(owned(req, validateBookmark(req.body))) });
  list = async (req: Request, res: Response) => res.json({ data: await this.service.list(ownerId(req), typeof req.query.bookId === 'string' ? parseId(req.query.bookId, 'bookId') : undefined) });
  delete = async (req: Request, res: Response) => { await this.service.delete(parseId(req.params.id, 'bookmarkId'), ownerId(req)); res.status(204).send(); };
}
export class HighlightController {
  constructor(private readonly service: HighlightService) {}
  create = async (req: Request, res: Response) => res.status(201).json({ data: await this.service.create(owned(req, validateHighlight(req.body))) });
  list = async (req: Request, res: Response) => res.json({ data: await this.service.list(ownerId(req), typeof req.query.bookId === 'string' ? parseId(req.query.bookId, 'bookId') : undefined) });
  updateNote = async (req: Request, res: Response) => res.json({ data: await this.service.updateNote(parseId(req.params.id, 'highlightId'), ownerId(req), bodyNote(req.body)) });
  delete = async (req: Request, res: Response) => { await this.service.delete(parseId(req.params.id, 'highlightId'), ownerId(req)); res.status(204).send(); };
}
export class CollectionController {
  constructor(private readonly service: CollectionService) {}
  create = async (req: Request, res: Response) => res.status(201).json({ data: await this.service.create(owned(req, validateCollection(req.body))) });
  list = async (req: Request, res: Response) => res.json({ data: await this.service.list(ownerId(req)) });
  updateBookIds = async (req: Request, res: Response) => res.json({ data: await this.service.updateBookIds(parseId(req.params.id, 'collectionId'), ownerId(req), validateCollectionBookIds(req.body)) });
  delete = async (req: Request, res: Response) => { await this.service.delete(parseId(req.params.id, 'collectionId'), ownerId(req)); res.status(204).send(); };
}
export class ReviewController {
  constructor(private readonly service: ReviewService) {}
  create = async (req: Request, res: Response) => {
    const validated = validateReview(req.body);
    const principal = requirePrincipal(req);
    res.status(201).json({ data: await this.service.create({ ...validated, userId: principal.id, userName: safeDisplayName(req), userAvatar: '' }) });
  };
  listByBook = async (req: Request, res: Response) => res.json({ data: await this.service.listByBook(parseId(req.params.bookId, 'bookId'), req.principal?.id) });
  listFeed = async (req: Request, res: Response) => res.json({ data: await this.service.listFeed(req.principal?.id, feedLimit(req.query.limit)) });
  setLike = async (req: Request, res: Response) => res.json({ data: await this.service.setLike(parseId(req.params.id, 'reviewId'), ownerId(req), validateReviewLike(req.body)) });
  createComment = async (req: Request, res: Response) => res.status(201).json({ data: await this.service.createComment(parseId(req.params.id, 'reviewId'), ownerId(req), safeDisplayName(req), '', validateReviewComment(req.body)) });
  listComments = async (req: Request, res: Response) => res.json({ data: await this.service.listComments(parseId(req.params.id, 'reviewId')) });
}
export class RightsController {
  constructor(private readonly service: RightsService) {}
  create = async (req: Request, res: Response) => { const principal = requirePermission(req, 'RIGHTS_MANAGE'); res.status(201).json({ data: await this.service.create(validateRights(req.body), principal.id) }); };
  listByBook = async (req: Request, res: Response) => res.json({ data: await this.service.listByBook(parseId(req.params.bookId, 'bookId')) });
}
export class AuditLogController {
  constructor(private readonly service: AuditService) {}
  list = async (req: Request, res: Response) => { requirePermission(req, 'AUDIT_READ'); res.json({ data: await this.service.list(typeof req.query.entityType === 'string' ? req.query.entityType : undefined, typeof req.query.entityId === 'string' ? parseId(req.query.entityId, 'entityId') : undefined) }); };
}
