export type AppView = 'forest' | 'library' | 'discover' | 'paths' | 'map' | 'my-library' | 'community' | 'admin' | 'wander' | 'moods';

export type AppRoute =
  | { kind: 'view'; view: AppView }
  | { kind: 'book'; bookId: string }
  | { kind: 'reader'; bookId: string }
  | { kind: 'author'; authorId: string }
  | { kind: 'path'; pathId: string }
  | { kind: 'not-found'; pathname: string };

export const VIEW_PATHS: Record<AppView, string> = {
  forest: '/',
  library: '/library',
  discover: '/discover',
  paths: '/paths',
  map: '/map',
  'my-library': '/my-library',
  community: '/community',
  admin: '/admin',
  wander: '/discover/wander',
  moods: '/discover/moods',
};

function normalizePathname(pathname: string): string {
  const clean = pathname.replace(/\/+/g, '/').replace(/\/+$/, '') || '/';
  return clean.startsWith('/') ? clean : `/${clean}`;
}

function decodedSegment(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value);
    return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(decoded) ? decoded : null;
  } catch { return null; }
}

export function routeForView(view: AppView): AppRoute { return { kind: 'view', view }; }

export function pathForRoute(route: AppRoute): string {
  if (route.kind === 'view') return VIEW_PATHS[route.view];
  if (route.kind === 'book') return `/books/${encodeURIComponent(route.bookId)}`;
  if (route.kind === 'reader') return `/books/${encodeURIComponent(route.bookId)}/read`;
  if (route.kind === 'author') return `/authors/${encodeURIComponent(route.authorId)}`;
  if (route.kind === 'path') return `/paths/${encodeURIComponent(route.pathId)}`;
  return normalizePathname(route.pathname);
}

export function parseAppRoute(pathname: string): AppRoute {
  const normalized = normalizePathname(pathname);
  const view = (Object.entries(VIEW_PATHS).find(([, path]) => path === normalized)?.[0] as AppView | undefined);
  if (view) return { kind: 'view', view };

  const reader = /^\/books\/([^/]+)\/read$/.exec(normalized);
  if (reader) {
    const bookId = decodedSegment(reader[1]);
    return bookId ? { kind: 'reader', bookId } : { kind: 'not-found', pathname: normalized };
  }
  const book = /^\/books\/([^/]+)$/.exec(normalized);
  if (book) {
    const bookId = decodedSegment(book[1]);
    return bookId ? { kind: 'book', bookId } : { kind: 'not-found', pathname: normalized };
  }
  const author = /^\/authors\/([^/]+)$/.exec(normalized);
  if (author) {
    const authorId = decodedSegment(author[1]);
    return authorId ? { kind: 'author', authorId } : { kind: 'not-found', pathname: normalized };
  }
  const path = /^\/paths\/([^/]+)$/.exec(normalized);
  if (path) {
    const pathId = decodedSegment(path[1]);
    return pathId ? { kind: 'path', pathId } : { kind: 'not-found', pathname: normalized };
  }
  return { kind: 'not-found', pathname: normalized };
}

export function isOverlayRoute(route: AppRoute): boolean {
  return route.kind === 'book' || route.kind === 'author' || route.kind === 'path' || route.kind === 'reader';
}

export function viewForRoute(route: AppRoute): AppView {
  if (route.kind === 'view') return route.view;
  if (route.kind === 'path') return 'paths';
  if (route.kind === 'not-found') return 'forest';
  return 'library';
}
