import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/createApp';
import { InMemoryAuthorizationRepository } from '../server/auth/AuthorizationRepository';
import { InMemoryBookRepository } from '../server/repositories/BookRepository';
import { InMemoryAuditLogRepository, InMemoryBookmarkRepository, InMemoryCollectionRepository, InMemoryHighlightRepository, InMemoryReadingProgressRepository, InMemoryReviewRepository, InMemoryRightsRepository } from '../server/repositories/LibraryRepositories';
import { Book } from '../src/types';

const book: Book = {
  id: 'p8-book', workId: 'p8-work', slug: 'p8-book', title: 'P8 Book', titleAr: 'كتاب P8', authorId: 'p8-author', authorName: 'P8 Author', authorNameAr: 'مؤلف P8', coverImage: '/cover.png', description: 'P8', descriptionAr: 'P8', genres: ['Test'], genresAr: ['اختبار'], categories: ['Test'], categoriesAr: ['اختبار'], themes: [], themesAr: [], moods: [], rating: 0, ratingsCount: 0, reviewsCount: 0, downloadsCount: 0, readsCount: 0, featured: false, hiddenGem: false, editorialPick: false, forestRegion: 'archive-woods', forestCoords: { x: 1, y: 1 }, readingDifficulty: 'Accessible', primaryLanguage: 'en', publicationYear: 2026, contentAvailability: 'FULL_TEXT', workflowStatus: 'DRAFT', createdAt: '2026-08-18T00:00:00.000Z', updatedAt: '2026-08-18T00:00:00.000Z',
  editions: [{ id: 'p8-edition', language: 'en', languageName: 'English', languageNameAr: 'الإنجليزية', publisher: 'P8', publicationYear: 2026, pageCount: 1, estimatedMinutes: 1, rightsStatus: 'PUBLIC_DOMAIN', licenseType: 'Public Domain', source: 'P8', attribution: 'P8', files: [] }],
  chapters: [{ id: 'p8-chapter', title: 'One', titleAr: 'واحد', content: 'Content', contentAr: 'محتوى', pageNumber: 1 }],
};

function call(server: http.Server, method: string, path: string, body?: unknown, identity?: string, claimedRole = 'ADMIN') {
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: address.port, method, path, headers: { ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}), ...(identity ? { 'x-nexara-test-user': identity, 'x-nexara-test-role': claimedRole } : {}) } }, (res) => {
      const raw: Buffer[] = []; res.on('data', (part) => raw.push(Buffer.from(part))); res.on('end', () => { const text = Buffer.concat(raw).toString(); resolve({ status: res.statusCode || 0, body: text ? JSON.parse(text) : null }); });
    });
    req.on('error', reject); if (payload) req.write(payload); req.end();
  });
}

const main = async () => {
  const roles = new InMemoryAuthorizationRepository();
  await roles.assignRole({ userId: 'moderator', role: 'MODERATOR', assignedBy: 'bootstrap' });
  await roles.assignRole({ userId: 'admin', role: 'ADMIN', assignedBy: 'bootstrap' });
  const app = createApp({
    bookRepository: new InMemoryBookRepository([book]), progressRepository: new InMemoryReadingProgressRepository(), bookmarkRepository: new InMemoryBookmarkRepository(), highlightRepository: new InMemoryHighlightRepository(), collectionRepository: new InMemoryCollectionRepository(), reviewRepository: new InMemoryReviewRepository(), rightsRepository: new InMemoryRightsRepository(), auditRepository: new InMemoryAuditLogRepository(), authorizationRepository: roles,
    auth: { supabaseUrl: null, supabasePublishableKey: null, allowTestIdentity: true, useTestRoleResolver: true, roleResolver: roles },
  });
  const server = app.listen(0);
  try {
    const guest = await call(server, 'GET', '/api/auth/me');
    assert.equal(guest.status, 401, 'guest must not receive an authenticated principal');

    const authenticated = await call(server, 'GET', '/api/auth/me', undefined, 'reader', 'ADMIN');
    assert.equal(authenticated.status, 200); assert.deepEqual(authenticated.body.data.roles, ['READER'], 'client-provided ADMIN header must not elevate a reader when resolver is enabled');

    const readerForbidden = await call(server, 'PATCH', '/api/books/p8-book', { title: 'Reader takeover' }, 'reader', 'ADMIN');
    assert.equal(readerForbidden.status, 403, 'normal reader cannot modify catalog');

    const readerUploadForbidden = await call(server, 'POST', '/api/books/p8-book/editions/p8-edition/files', undefined, 'reader', 'READER');
    assert.equal(readerUploadForbidden.status, 403, 'normal reader cannot upload book files (controller FILE_WRITE permission gate)');

    const moderator = await call(server, 'PATCH', '/api/books/p8-book', { title: 'Moderator edit' }, 'moderator', 'READER');
    assert.equal(moderator.status, 200, 'moderator receives CATALOG_WRITE through a server-side assignment');
    const moderatorForbidden = await call(server, 'POST', '/api/admin/users/reader/roles', { role: 'ADMIN' }, 'moderator');
    assert.equal(moderatorForbidden.status, 403, 'moderator cannot manage role assignments');

    const adminRole = await call(server, 'POST', '/api/admin/users/reader/roles', { role: 'MODERATOR' }, 'admin', 'READER');
    assert.equal(adminRole.status, 201, 'admin can assign durable roles through a protected route');
    const readerNowModerator = await call(server, 'GET', '/api/auth/me', undefined, 'reader', 'READER');
    assert.ok(readerNowModerator.body.data.roles.includes('MODERATOR'), 'role is resolved from the server repository on each request');

    const victimBookmark = await call(server, 'POST', '/api/bookmarks', { userId: 'attacker', bookId: 'p8-book', editionId: 'p8-edition', chapterIndex: 0, progressPercent: 10, title: 'Victim bookmark' }, 'victim');
    assert.equal(victimBookmark.status, 201); assert.equal(victimBookmark.body.data.userId, 'victim', 'request body userId is overwritten by authenticated identity');
    const idorDelete = await call(server, 'DELETE', `/api/bookmarks/${victimBookmark.body.data.id}`, undefined, 'attacker');
    assert.equal(idorDelete.status, 404, 'guessed foreign resource id cannot be deleted');
    const victimStillOwns = await call(server, 'GET', '/api/bookmarks?userId=attacker', undefined, 'victim');
    assert.equal(victimStillOwns.status, 200); assert.equal(victimStillOwns.body.data.length, 1, 'query userId cannot replace principal ownership scope');

    const forbiddenResource = await call(server, 'GET', '/api/audit-logs', undefined, 'reader');
    assert.equal(forbiddenResource.status, 403, 'reader cannot access audit data');
    console.log('P8 authentication/authorization gate passed: guest, authenticated user, reader, moderator, admin, forbidden resource, and IDOR attempt.');
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
};
main().catch((error) => { console.error(error); process.exitCode = 1; });
