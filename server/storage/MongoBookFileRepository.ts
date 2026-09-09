import { Db } from 'mongodb';
import { BookFileRecord, BookFileRepository } from './BookFileRepository';
export class MongoBookFileRepository implements BookFileRepository {
  private readonly collection;
  constructor(db: Db) { this.collection = db.collection<BookFileRecord>('book_files'); }
  async create(record: BookFileRecord) { await this.collection.insertOne(record); return record; }
  async get(bookId: string, editionId: string, fileId: string) { return this.collection.findOne({ id: fileId, bookId, editionId }, { projection: { _id: 0 } }); }
  async list(bookId: string, editionId: string) { return this.collection.find({ bookId, editionId }, { projection: { _id: 0 } }).sort({ format: 1 }).toArray(); }
  async markVerified(fileId: string, checksum: string) { const timestamp = new Date().toISOString(); const result = await this.collection.findOneAndUpdate({ id: fileId }, { $set: { checksum, verifiedAt: timestamp, updatedAt: timestamp } }, { returnDocument: 'after', projection: { _id: 0 } }); if (!result) throw new Error('File not found.'); return result; }
  async delete(fileId: string) { return (await this.collection.deleteOne({ id: fileId })).deletedCount === 1; }
}
