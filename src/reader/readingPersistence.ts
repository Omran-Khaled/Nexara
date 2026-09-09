import { ReadingProgress, ReaderFontFamily, ReaderTheme } from '../types';

export interface ReaderPreferences {
  theme: ReaderTheme;
  fontSize: number;
  fontFamily: ReaderFontFamily;
  lineHeight: number;
  contentWidth: number;
  textAlign: 'left' | 'right' | 'justify' | 'center';
  paragraphSpacing: number;
  continuousScroll: boolean;
}
export interface LocalReadingSnapshot {
  bookId: string;
  editionId: string;
  chapterIndex: number;
  scrollPercent: number;
  completedPercent: number;
  totalSecondsSpent: number;
  lastReadAt: string;
  completed: boolean;
  clientSequence: number;
}
type StorageLike = { getItem?: (key: string) => string | null; setItem?: (key: string, value: string) => void };
const PREFERENCES_KEY = 'nexara.reader.preferences.v1';
const progressKey = (bookId: string) => `nexara.reader.progress.${bookId}.v1`;

export function clampPercent(value: number): number { return Math.max(0, Math.min(100, Math.round(value))); }
export function progressFromViewport(element: { scrollTop: number; scrollHeight: number; clientHeight: number }): number {
  const range = Math.max(0, element.scrollHeight - element.clientHeight);
  return range === 0 ? 100 : clampPercent((element.scrollTop / range) * 100);
}
export function monotonicProgress(previous: LocalReadingSnapshot | null, next: LocalReadingSnapshot): LocalReadingSnapshot {
  if (!previous) return { ...next, scrollPercent: clampPercent(next.scrollPercent), completedPercent: clampPercent(next.completedPercent), totalSecondsSpent: Math.max(0, Math.floor(next.totalSecondsSpent)), clientSequence: Math.max(0, Math.floor(next.clientSequence)) };
  const sameChapter = previous.chapterIndex === next.chapterIndex;
  return {
    ...next,
    scrollPercent: sameChapter ? Math.max(previous.scrollPercent, clampPercent(next.scrollPercent)) : clampPercent(next.scrollPercent),
    completedPercent: Math.max(previous.completedPercent, clampPercent(next.completedPercent)),
    totalSecondsSpent: Math.max(previous.totalSecondsSpent, Math.floor(next.totalSecondsSpent)),
    clientSequence: Math.max(previous.clientSequence, Math.floor(next.clientSequence)),
    completed: previous.completed || next.completed,
  };
}
export function readPreferences(storage: StorageLike | null | undefined): Partial<ReaderPreferences> {
  if (!storage) return {};
  try { const raw = storage.getItem(PREFERENCES_KEY); return raw ? JSON.parse(raw) as Partial<ReaderPreferences> : {}; } catch { return {}; }
}
export function writePreferences(storage: StorageLike | null | undefined, value: ReaderPreferences): void { try { storage?.setItem(PREFERENCES_KEY, JSON.stringify(value)); } catch { /* private browsing or quota exhaustion must not break reading */ } }
export function readLocalProgress(storage: StorageLike | null | undefined, bookId: string): LocalReadingSnapshot | null {
  if (!storage) return null;
  try { const raw = storage.getItem(progressKey(bookId)); return raw ? JSON.parse(raw) as LocalReadingSnapshot : null; } catch { return null; }
}
export function writeLocalProgress(storage: StorageLike | null | undefined, snapshot: LocalReadingSnapshot): void {
  try { const previous = readLocalProgress(storage, snapshot.bookId); storage?.setItem(progressKey(snapshot.bookId), JSON.stringify(monotonicProgress(previous, snapshot))); } catch { /* local persistence is best effort */ }
}
export function snapshotFromProgress(progress: ReadingProgress, clientSequence: number): LocalReadingSnapshot { return { bookId: progress.bookId, editionId: progress.editionId, chapterIndex: progress.currentChapterIndex, scrollPercent: progress.currentScrollPercent, completedPercent: progress.completedPercent, totalSecondsSpent: progress.totalSecondsSpent, lastReadAt: progress.lastReadAt, completed: progress.completed, clientSequence }; }
