import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { INITIAL_AUTHORS, INITIAL_BOOKS } from './fixtures/libraryFixtures';

function runCommand(command: string, args: string[], environment: NodeJS.ProcessEnv): Promise<{ status: number; output: string }> {
  return new Promise((resolve, reject) => {
    // Windows resolves `npm` through cmd.exe (`npm.cmd`); Node refuses to spawn `.cmd`
    // targets directly (EINVAL since the CVE-2024-27980 fix), so Windows delegates the
    // argument joining to Node's own shell mode. POSIX spawns the binary directly.
    const child = spawn(command, args, { cwd: process.cwd(), env: environment, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
    let output = '';
    child.stdout.on('data', (chunk) => { output += String(chunk); });
    child.stderr.on('data', (chunk) => { output += String(chunk); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ status: code ?? 1, output }));
  });
}

const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
const client = new MongoClient(replSet.getUri());
await client.connect();
const databaseName = 'nexara-p2-seed-command';
const temp = await mkdtemp(join(tmpdir(), 'nexara-p2-seed-'));

try {
  const author = structuredClone(INITIAL_AUTHORS[0]);
  const book = structuredClone(INITIAL_BOOKS[0]);
  book.id = 'seed-book-one';
  book.slug = 'seed-book-one';
  book.workId = 'seed-work-one';
  book.authorId = author.id;
  book.authorName = author.name;
  book.authorNameAr = author.nameAr;
  book.editions = book.editions.map((edition, index) => ({ ...edition, id: `seed-edition-${index}`, isbn: index === 0 ? '9780000001011' : undefined, files: edition.files.map((file, fileIndex) => ({ ...file, id: `seed-file-${index}-${fileIndex}` })) }));
  book.chapters = book.chapters.map((chapter, index) => ({ ...chapter, id: `seed-chapter-${index}` }));
  const seedPath = join(temp, 'seed.json');
  await writeFile(seedPath, JSON.stringify({
    users: [{ id: 'seed-user-one', email: 'seed-user@example.test', role: 'READER', status: 'ACTIVE' }],
    authors: [author],
    works: [{ id: 'seed-work-one', authorId: author.id, slug: 'seed-work-one', title: 'Seed Work', titleAr: 'عمل البذر', description: 'Operator supplied seed work.', descriptionAr: 'عمل بذر يقدمه المشغل.', primaryLanguage: 'en', publicationYear: 2026 }],
    books: [book],
  }, null, 2));

  const environment = { ...process.env, MONGODB_URI: replSet.getUri(), MONGODB_DB: databaseName };
  const first = await runCommand('npm', ['run', 'db:seed', '--', seedPath], environment);
  assert.equal(first.status, 0, first.output);
  const second = await runCommand('npm', ['run', 'db:seed', '--', seedPath], environment);
  assert.equal(second.status, 0, second.output);
  const migrate = await runCommand('npm', ['run', 'db:migrate'], environment);
  assert.equal(migrate.status, 0, migrate.output);

  const db = client.db(databaseName);
  assert.equal(await db.collection('schema_migrations').countDocuments({ id: 'p2-core-schema-v1' }), 1);
  assert.equal(await db.collection('users').countDocuments({ id: 'seed-user-one' }), 1);
  assert.equal(await db.collection('authors').countDocuments({ id: author.id }), 1);
  assert.equal(await db.collection('works').countDocuments({ id: 'seed-work-one' }), 1);
  assert.equal(await db.collection('books').countDocuments({ id: book.id }), 1);
  assert.equal(await db.collection('editions').countDocuments({ bookId: book.id }), book.editions.length);
  assert.equal(await db.collection('book_files').countDocuments({ bookId: book.id }), 0, 'Seed metadata must not create a physical book file without stored verified bytes.');
  assert.equal((await db.collection('books').findOne({ id: book.id }))?.editions?.flatMap((edition: { files?: unknown[] }) => edition.files || []).length, 0, 'Catalogue records must not advertise seed file stubs as downloads.');
  assert.equal(await db.collection('chapters').countDocuments({ bookId: book.id }), book.chapters.length);
  console.log('P2 operator migration and seed command checks passed.');
} finally {
  await client.close();
  await replSet.stop();
  await rm(temp, { recursive: true, force: true });
}
