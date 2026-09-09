import { Router, RequestHandler } from 'express';
import { LocalAuthController } from '../controllers/LocalAuthController';

const asyncHandler = (handler: RequestHandler): RequestHandler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
export function createLocalAuthRoutes(controller: LocalAuthController): Router {
  const router = Router();
  router.post('/auth/local/register', asyncHandler(controller.register));
  router.post('/auth/local/login', asyncHandler(controller.login));
  router.post('/auth/local/logout', asyncHandler(controller.logout));
  router.get('/auth/local/session', asyncHandler(controller.session));
  router.patch('/auth/local/profile', asyncHandler(controller.updateProfile));
  router.post('/auth/local/password', asyncHandler(controller.updatePassword));
  return router;
}