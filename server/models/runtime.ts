import { Achievement, Author, NotificationItem, ReadingPath, TimeCapsule } from '../../src/types';

export interface UserBookStateRecord {
  id: string;
  userId: string;
  bookId: string;
  saved: boolean;
  favourite: boolean;
  shelf: 'SAVED' | 'CURRENTLY_READING' | 'WANT_TO_READ' | 'FINISHED' | 'NONE';
  updatedAt: string;
}

export interface DownloadRecord {
  id: string;
  userId: string;
  bookId: string;
  editionId: string;
  format: 'PDF' | 'EPUB' | 'TXT' | 'HTML';
  downloadedAt: string;
}

export interface UserAchievementRecord extends Achievement {
  userId: string;
  updatedAt: string;
}

export interface UserNotificationRecord extends NotificationItem {
  userId: string;
}

export interface UserTimeCapsuleRecord extends TimeCapsule {
  userId: string;
}

export type RuntimeEntity = Author | ReadingPath | UserBookStateRecord | DownloadRecord | UserAchievementRecord | UserNotificationRecord | UserTimeCapsuleRecord;
