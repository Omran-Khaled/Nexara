import { Router } from 'express';
import { DiscoveryController } from './DiscoveryController';
import { GutenbergDownloadController } from './GutenbergDownloadController';

export function createDiscoveryRoutes(controller: DiscoveryController, downloads: GutenbergDownloadController) {
  const router = Router();
  router.get('/search', (req, res, next) => { void controller.search(req, res).catch(next); });
  router.get('/gutenberg/:id/download', (req, res, next) => { void downloads.download(req, res).catch(next); });
  return router;
}
