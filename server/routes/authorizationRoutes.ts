import { RequestHandler, Router } from 'express';
import { AuthorizationController } from '../controllers/AuthorizationController';

const asyncHandler = (handler: RequestHandler): RequestHandler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
export function createAuthorizationRoutes(controller: AuthorizationController): Router {
  const router = Router();
  router.get('/auth/me', asyncHandler(controller.me));
  router.post('/admin/users/:userId/roles', asyncHandler(controller.assignRole));
  router.delete('/admin/users/:userId/roles', asyncHandler(controller.revokeRole));
  return router;
}
