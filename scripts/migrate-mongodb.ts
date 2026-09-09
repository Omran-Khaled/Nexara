import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { applyP15CatalogMigration } from '../server/db/migrations';

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
const databaseName = process.env.MONGODB_DB || process.env.MONGO_DB || 'nexara';
if (!uri) throw new Error('MONGODB_URI (or MONGO_URI) is required to run MongoDB migrations.');

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
try {
  await client.connect();
  const result = await applyP15CatalogMigration(client.db(databaseName));
  console.log(JSON.stringify({ migration: result.migrationId, applied: result.applied, database: databaseName }));
} finally {
  await client.close();
}
