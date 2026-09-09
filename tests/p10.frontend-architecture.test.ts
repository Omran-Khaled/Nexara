import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseAppRoute, pathForRoute, routeForView, viewForRoute } from '../src/lib/appRoutes';

const root = new URL('..', import.meta.url);
const source = async (relative: string) => readFile(new URL(relative, root), 'utf8');

async function routeModelTests(): Promise<void> {
  assert.deepEqual(parseAppRoute('/'), { kind: 'view', view: 'forest' });
  assert.deepEqual(parseAppRoute('/library/'), { kind: 'view', view: 'library' });
  assert.deepEqual(parseAppRoute('/discover/moods'), { kind: 'view', view: 'moods' });
  assert.deepEqual(parseAppRoute('/books/book-42'), { kind: 'book', bookId: 'book-42' });
  assert.deepEqual(parseAppRoute('/books/book-42/read'), { kind: 'reader', bookId: 'book-42' });
  assert.deepEqual(parseAppRoute('/authors/author_7'), { kind: 'author', authorId: 'author_7' });
  assert.deepEqual(parseAppRoute('/paths/path:alpha'), { kind: 'path', pathId: 'path:alpha' });
  assert.equal(parseAppRoute('/books/%2Fetc%2Fpasswd').kind, 'not-found');
  assert.equal(parseAppRoute('/unknown/deep/link').kind, 'not-found');
  const roundTrips = [routeForView('library'), { kind: 'book', bookId: 'book-42' } as const, { kind: 'reader', bookId: 'book-42' } as const, { kind: 'author', authorId: 'author_7' } as const, { kind: 'path', pathId: 'path:alpha' } as const];
  for (const route of roundTrips) assert.deepEqual(parseAppRoute(pathForRoute(route)), route);
  assert.equal(viewForRoute({ kind: 'book', bookId: 'book-42' }), 'library');
  assert.equal(viewForRoute({ kind: 'path', pathId: 'path-alpha' }), 'paths');
}

async function implementationGuardTests(): Promise<void> {
  const [app, store, dialog, navbar, palette, library, bookCard] = await Promise.all([
    source('src/App.tsx'),
    source('src/stores/useAppStore.ts'),
    source('src/components/ui/AccessibleDialog.tsx'),
    source('src/components/navigation/Navbar.tsx'),
    source('src/components/navigation/CommandPalette.tsx'),
    source('src/components/library/LibraryView.tsx'),
    source('src/components/library/BookCard.tsx'),
  ]);
  assert.match(app, /syncRouteFromLocation/);
  assert.match(app, /route\.kind !== 'reader'/);
  assert.match(store, /navigateToRoute/);
  assert.match(store, /closeRouteOverlay/);
  assert.match(store, /kind: 'reader'/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /event\.key === 'Escape'/);
  assert.match(dialog, /event\.key !== 'Tab'/);
  assert.match(navbar, /AccessibleDialog/);
  assert.match(palette, /role="combobox"/);
  assert.match(palette, /ArrowDown/);
  assert.match(library, /animate-pulse/);
  assert.match(library, /aria-busy/);
  assert.match(bookCard, /aria-label=\{detailLabel\}/);
}

const main = async () => {
  await routeModelTests();
  await implementationGuardTests();
  console.log('P10 frontend architecture gate passed: semantic routes, deep links, accessible dialogs, keyboard navigation, and resilient library states are present.');
};
main().catch((error) => { console.error(error); process.exitCode = 1; });
