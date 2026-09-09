import { Db, MongoClient } from 'mongodb';
import { DatabaseError } from '../errors/ApplicationErrors';

export class MongoDatabase {
  private client: MongoClient | null = null;
  private database: Db | null = null;

  constructor(private readonly uri: string, private readonly dbName: string) {}

  async connect(): Promise<Db> {
    if (this.database) return this.database;
    try {
      this.client = new MongoClient(this.uri, { serverSelectionTimeoutMS: 10_000 });
      await this.client.connect();
      this.database = this.client.db(this.dbName);
      return this.database;
    } catch (error) {
      await this.close();
      throw new DatabaseError('MongoDB connection failed.', error);
    }
  }

  async ping(): Promise<void> {
    if (!this.database) throw new DatabaseError('MongoDB is not connected.');
    try {
      await this.database.command({ ping: 1, maxTimeMS: 2_500 });
    } catch (error) {
      throw new DatabaseError('MongoDB readiness ping failed.', error);
    }
  }

  async close(): Promise<void> {
    await this.client?.close();
    this.client = null;
    this.database = null;
  }
}
