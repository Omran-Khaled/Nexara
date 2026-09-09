import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { MongoClient } from 'mongodb';
import { Author, Book } from '../src/types';
import { WorkDocument } from '../server/models/catalog';
import { applyP15CatalogMigration } from '../server/db/migrations';
import { MongoCatalogRepository } from '../server/repositories/CatalogRepository';

interface SeedFile {
  users?: unknown[];
  authors: Author[];
  works: Array<Omit<WorkDocument, 'createdAt' | 'updatedAt'>>;
  books: Book[];
}

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
const databaseName = process.env.MONGODB_DB || process.env.MONGO_DB || 'nexara';
const inputPath = process.argv[2];
if (!uri) throw new Error('MONGODB_URI (or MONGO_URI) is required to seed MongoDB.');
if (!inputPath) throw new Error('Usage: npm run db:seed -- /absolute/path/to/seed.json');

const parsed = JSON.parse(await readFile(inputPath, 'utf8')) as SeedFile;
if (!Array.isArray(parsed.authors) || !Array.isArray(parsed.works) || !Array.isArray(parsed.books)) {
  throw new Error('Seed JSON must include array fields: authors, works, and books.');
}
if (parsed.users !== undefined && !Array.isArray(parsed.users)) throw new Error('Seed JSON users, when present, must be an array.');

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
try {
  await client.connect();
  const db = client.db(databaseName);
  await applyP15CatalogMigration(db);
  const catalog = new MongoCatalogRepository(db);

  for (const author of parsed.authors) await catalog.upsertAuthor(author);
  for (const work of parsed.works) await catalog.upsertWork(work);
  for (const book of parsed.books) await catalog.upsertBookAggregate(book);
  if (parsed.users?.length) {
    const timestamp = new Date().toISOString();
    for (const user of parsed.users) {
      if (!user || typeof user !== 'object') throw new Error('Every users entry must be an object.');
      const document = user as Record<string, unknown>;
      if (typeof document.id !== 'string' || typeof document.email !== 'string' || typeof document.role !== 'string' || typeof document.status !== 'string') throw new Error('Each user requires id, email, role, and status.');
      await db.collection('users').updateOne({ id: document.id }, { $set: { ...document, updatedAt: timestamp }, $setOnInsert: { createdAt: timestamp } }, { upsert: true });
    }
  }
  console.log(JSON.stringify({ seeded: { users: parsed.users?.length || 0, authors: parsed.authors.length, works: parsed.works.length, books: parsed.books.length }, database: databaseName }));
} finally {
  await client.close();
}
