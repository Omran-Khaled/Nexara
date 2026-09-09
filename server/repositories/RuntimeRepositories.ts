import { Collection, Db } from 'mongodb';
import { Achievement, Author, NotificationItem, ReadingPath, TimeCapsule } from '../../src/types';
import { DatabaseError } from '../errors/ApplicationErrors';
import { DownloadRecord, UserAchievementRecord, UserBookStateRecord, UserNotificationRecord, UserTimeCapsuleRecord } from '../models/runtime';

export interface RuntimeRepository {
  listAuthors(): Promise<Author[]>;
  listReadingPaths(): Promise<ReadingPath[]>;
  listUserBookStates(userId: string): Promise<UserBookStateRecord[]>;
  upsertUserBookState(record: UserBookStateRecord): Promise<UserBookStateRecord>;
  listDownloads(userId: string): Promise<DownloadRecord[]>;
  listAchievements(userId: string): Promise<UserAchievementRecord[]>;
  listNotifications(userId: string): Promise<UserNotificationRecord[]>;
  markNotificationRead(userId: string, id: string): Promise<UserNotificationRecord | null>;
  listTimeCapsules(userId: string): Promise<UserTimeCapsuleRecord[]>;
  createTimeCapsule(record: UserTimeCapsuleRecord): Promise<UserTimeCapsuleRecord>;
}

export class MongoRuntimeRepository implements RuntimeRepository {
  private readonly authors: Collection<Author>;
  private readonly readingPaths: Collection<ReadingPath>;
  private readonly userBookStates: Collection<UserBookStateRecord>;
  private readonly downloads: Collection<DownloadRecord>;
  private readonly achievements: Collection<UserAchievementRecord>;
  private readonly notifications: Collection<UserNotificationRecord>;
  private readonly timeCapsules: Collection<UserTimeCapsuleRecord>;

  constructor(db: Db) {
    this.authors = db.collection<Author>('authors');
    this.readingPaths = db.collection<ReadingPath>('reading_paths');
    this.userBookStates = db.collection<UserBookStateRecord>('user_book_states');
    this.downloads = db.collection<DownloadRecord>('downloads');
    this.achievements = db.collection<UserAchievementRecord>('user_achievements');
    this.notifications = db.collection<UserNotificationRecord>('notifications');
    this.timeCapsules = db.collection<UserTimeCapsuleRecord>('time_capsules');
  }

  private async execute<T>(message: string, operation: () => Promise<T>): Promise<T> {
    try { return await operation(); } catch (error) { throw new DatabaseError(message, error); }
  }

  listAuthors() { return this.execute('Could not list authors.', async () => this.authors.find({}, { projection: { _id: 0 } }).sort({ name: 1 }).toArray()); }
  listReadingPaths() { return this.execute('Could not list reading paths.', async () => this.readingPaths.find({}, { projection: { _id: 0 } }).sort({ order: 1, title: 1 }).toArray()); }
  listUserBookStates(userId: string) { return this.execute('Could not list user book states.', async () => this.userBookStates.find({ userId }, { projection: { _id: 0 } }).toArray()); }

  async upsertUserBookState(record: UserBookStateRecord): Promise<UserBookStateRecord> {
    return this.execute('Could not save user book state.', async () => {
      const result = await this.userBookStates.findOneAndUpdate({ userId: record.userId, bookId: record.bookId }, { $set: record }, { upsert: true, returnDocument: 'after', projection: { _id: 0 } });
      if (!result) throw new Error('UPSERT_EMPTY');
      return result;
    });
  }

  listDownloads(userId: string) { return this.execute('Could not list downloads.', async () => this.downloads.find({ userId }, { projection: { _id: 0 } }).sort({ downloadedAt: -1 }).toArray()); }
  listAchievements(userId: string) { return this.execute('Could not list achievements.', async () => this.achievements.find({ userId }, { projection: { _id: 0 } }).sort({ updatedAt: -1 }).toArray()); }
  listNotifications(userId: string) { return this.execute('Could not list notifications.', async () => this.notifications.find({ userId }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray()); }

  async markNotificationRead(userId: string, id: string): Promise<UserNotificationRecord | null> {
    return this.execute('Could not update notification.', async () => this.notifications.findOneAndUpdate({ id, userId }, { $set: { read: true } }, { returnDocument: 'after', projection: { _id: 0 } }));
  }

  listTimeCapsules(userId: string) { return this.execute('Could not list time capsules.', async () => this.timeCapsules.find({ userId }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray()); }

  async createTimeCapsule(record: UserTimeCapsuleRecord): Promise<UserTimeCapsuleRecord> {
    return this.execute('Could not create time capsule.', async () => {
      await this.timeCapsules.insertOne(record);
      return record;
    });
  }
}
