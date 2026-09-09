import { useState, useEffect } from 'react';
import {
  LanguageCode,
  UserRole,
  ForestRegionId,
  ReaderTheme,
  ReaderFontFamily,
  SoundscapeType,
  Book,
  Author,
  ReadingPath,
  Review,
  UserCollection,
  Achievement,
  TimeCapsule,
  AuditLog,
  NotificationItem,
  Bookmark,
  Highlight,
  ReadingProgress,
  ReadingHistoryEntry,
  ReviewComment,
} from '../types';
import { audioEngine } from '../lib/audioEngine';
import { canOpenInReader, readerUnavailableMessage } from '../lib/contentIntegrity';
import { booksApi } from '../api/books';
import { readingApi } from '../api/reading';
import { libraryApi } from '../api/library';
import { reviewsApi } from '../api/reviews';
import { adminApi } from '../api/admin';
import { auditApi } from '../api/audit';
import { toUiError, UiError } from '../api/http';
import { runtimeApi, DownloadHistoryItem } from '../api/runtime';
import { downloadsApi } from '../api/downloads';
import { monotonicProgress, readLocalProgress, readPreferences, snapshotFromProgress, writeLocalProgress, writePreferences } from '../reader/readingPersistence';
import { AppRoute, AppView, parseAppRoute, pathForRoute, routeForView as routeModelForView, viewForRoute } from '../lib/appRoutes';

export type ViewMode = AppView;
export { parseAppRoute, pathForRoute } from '../lib/appRoutes';
export function routeForView(mode: ViewMode): string { return pathForRoute(routeModelForView(mode)); }
export function viewForPath(pathname: string): ViewMode { return viewForRoute(parseAppRoute(pathname)); }

export type RequestStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';
export interface RequestState { status: RequestStatus; error: UiError | null; updatedAt: string | null; }
export interface ProgressSyncState { clientSequence: number; acknowledgedSequence: number; pending: boolean; retryable: boolean; lastError: UiError | null; }
const idleRequest = (): RequestState => ({ status: 'idle', error: null, updatedAt: null });

export interface AppState {
  language: LanguageCode;
  /** View rendering state derived from the semantic route for existing view components. */
  viewMode: ViewMode;
  /** Canonical browser-addressable state for pages, detail overlays, and reader sessions. */
  route: AppRoute;
  selectedRegionId: ForestRegionId | 'all';
  
  // The UI reflects a verified Supabase session; server-side roles remain authoritative.
  role: UserRole;
  isAuthenticated: boolean;
  currentUser: {
    id: string;
    name: string;
    nameAr: string;
    email: string;
    avatar: string;
  };

  // Books and CMS
  books: Book[];
  authors: Author[];
  readingPaths: ReadingPath[];
  reviews: Review[];
  reviewComments: Record<string, ReviewComment[]>;
  auditLogs: AuditLog[];
  notifications: NotificationItem[];
  downloadHistory: DownloadHistoryItem[];

  // API freshness and request outcomes for server-backed resources.
  requestStates: {
    catalog: RequestState;
    details: Record<string, RequestState>;
    progress: RequestState;
    bookmarks: RequestState;
    highlights: RequestState;
    collections: RequestState;
    reviews: Record<string, RequestState>;
    admin: RequestState;
    audits: RequestState;
  };
  progressSync: Record<string, ProgressSyncState>;

  // Reader State
  activeReadingBook: Book | null;
  activeEditionId: string | null;
  currentChapterIndex: number;
  readerTheme: ReaderTheme;
  readerFontSize: number;
  readerFontFamily: ReaderFontFamily;
  readerLineHeight: number;
  readerPageMargin: 'compact' | 'normal' | 'wide';
  readerContinuousScroll: boolean;
  readerContentWidth: number;
  readerTextAlign: 'left' | 'right' | 'justify' | 'center';
  readerParagraphSpacing: number;
  isReadingRitualOpen: boolean;
  ritualTimerMinutes: number;
  isRitualRunning: boolean;

  // Personal Library
  savedBookIds: string[];
  currentlyReadingBookIds: string[];
  wantToReadBookIds: string[];
  finishedBookIds: string[];
  favoriteBookIds: string[];
  downloadedBookIds: string[];
  customCollections: UserCollection[];
  readingProgress: Record<string, ReadingProgress>;
  readingHistory: ReadingHistoryEntry[];
  bookmarks: Bookmark[];
  highlights: Highlight[];
  timeCapsules: TimeCapsule[];
  achievements: Achievement[];

  // Soundscape
  activeSoundscape: SoundscapeType;
  isAudioMuted: boolean;
  audioVolume: number;

  // Modals & Navigation
  isCommandPaletteOpen: boolean;
  isOnlineSearchOpen: boolean;
  isAuthModalOpen: boolean;
  isQuoteStudioOpen: boolean;
  activeQuoteHighlight: Highlight | null;
  detailBook: Book | null;
  detailAuthor: Author | null;
  detailPath: ReadingPath | null;
  selectedMoodId: string | null;

  // Toast feedback
  toasts: { id: string; message: string; messageAr: string; type?: 'info' | 'success' | 'warning' | 'error' }[];
}

const initialReaderPreferences = typeof window === 'undefined' ? {} : readPreferences(window.localStorage);
const DEFAULT_APP_STATE: AppState = {
  language: 'en',
  route: typeof window === 'undefined' ? routeModelForView('forest') : parseAppRoute(window.location.pathname),
  viewMode: typeof window === 'undefined' ? 'forest' : viewForRoute(parseAppRoute(window.location.pathname)),
  selectedRegionId: 'all',

  role: 'GUEST',
  isAuthenticated: false,
  currentUser: {
    id: '',
    name: '',
    nameAr: '',
    email: '',
    avatar: '',
  },

  // Server-backed resources begin empty and are populated only by API responses.
  books: [],
  authors: [],
  readingPaths: [],
  reviews: [],
  reviewComments: {},
  auditLogs: [],
  requestStates: {
    catalog: idleRequest(),
    details: {},
    progress: idleRequest(),
    bookmarks: idleRequest(),
    highlights: idleRequest(),
    collections: idleRequest(),
    reviews: {},
    admin: idleRequest(),
    audits: idleRequest(),
  },
  progressSync: {},

  notifications: [],
  downloadHistory: [],

  activeReadingBook: null,
  activeEditionId: null,
  currentChapterIndex: 0,
  readerTheme: initialReaderPreferences.theme || 'forest',
  readerFontSize: initialReaderPreferences.fontSize || 18,
  readerFontFamily: (initialReaderPreferences.fontFamily as AppState['readerFontFamily']) || 'serif',
  readerLineHeight: initialReaderPreferences.lineHeight || 1.8,
  readerPageMargin: 'normal',
  readerContinuousScroll: initialReaderPreferences.continuousScroll || false,
  readerContentWidth: initialReaderPreferences.contentWidth || 720,
  readerTextAlign: initialReaderPreferences.textAlign || 'justify',
  readerParagraphSpacing: initialReaderPreferences.paragraphSpacing || 24,
  isReadingRitualOpen: false,
  ritualTimerMinutes: 15,
  isRitualRunning: false,

  savedBookIds: [],
  currentlyReadingBookIds: [],
  wantToReadBookIds: [],
  finishedBookIds: [],
  favoriteBookIds: [],
  downloadedBookIds: [],
  customCollections: [],
  readingProgress: {
  },
  readingHistory: [],
  bookmarks: [],
  highlights: [],
  timeCapsules: [],
  achievements: [],

  activeSoundscape: 'silence',
  isAudioMuted: false,
  audioVolume: 0.35,

  isCommandPaletteOpen: false,
  isOnlineSearchOpen: false,
  isAuthModalOpen: false,
  isQuoteStudioOpen: false,
  activeQuoteHighlight: null,
  detailBook: null,
  detailAuthor: null,
  detailPath: null,
  selectedMoodId: null,

  toasts: [],
};

// Global Store State and Listeners
let globalState = DEFAULT_APP_STATE;
const listeners = new Set<() => void>();
const progressTimers = new Map<string, ReturnType<typeof setTimeout>>();
const progressInFlight = new Set<string>();
let activeDetailController: AbortController | null = null;
const reviewControllers = new Map<string, AbortController>();
/** Coalesces concurrent backend-hydration calls (mount restore + onAuthStateChange + adoptUser) into one fetch. */
let backendHydrationPromise: Promise<void> | null = null;

function notify() {
  listeners.forEach((l) => l());
}

export function useAppStore() {
  const [state, setState] = useState<AppState>(globalState);

  useEffect(() => {
    const listener = () => setState({ ...globalState });
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const update = (fn: (prev: AppState) => Partial<AppState>) => {
    globalState = { ...globalState, ...fn(globalState) };
    notify();
  };
    const browserStorage = typeof window === 'undefined' ? null : window.localStorage;
  const commitRoute = (route: AppRoute, historyMode: 'push' | 'replace' | 'none' = 'push') => {
    update(() => ({ route, viewMode: viewForRoute(route) }));
    if (typeof window === 'undefined' || historyMode === 'none') return;
    const path = pathForRoute(route);
    if (window.location.pathname === path) return;
    window.history[historyMode === 'replace' ? 'replaceState' : 'pushState']({ nexaraRoute: route }, '', path);
  };
  const scheduleProgressSync = (bookId: string, delayMs = 450) => {
    const existingTimer = progressTimers.get(bookId);
    if (existingTimer) globalThis.clearTimeout(existingTimer);
    progressTimers.set(bookId, globalThis.setTimeout(() => { progressTimers.delete(bookId); void synchronizeProgress(bookId); }, delayMs));
  };

  const synchronizeProgress = async (bookId: string) => {
    if (progressInFlight.has(bookId)) return;
    const progress = globalState.readingProgress[bookId];
    const sync = globalState.progressSync[bookId];
    if (!progress?.editionId || !sync) return;
    const sentSequence = sync.clientSequence;
    progressInFlight.add(bookId);
    update((s) => ({ requestStates: { ...s.requestStates, progress: { status: 'loading', error: null, updatedAt: s.requestStates.progress.updatedAt } } }));
    try {
      const { data } = await readingApi.upsert(bookId, { userId: globalState.currentUser.id, editionId: progress.editionId, currentChapterIndex: progress.currentChapterIndex, currentScrollPercent: progress.currentScrollPercent, completedPercent: progress.completedPercent, totalSecondsSpent: progress.totalSecondsSpent, clientSequence: sentSequence, clientUpdatedAt: new Date().toISOString() });
      const current = globalState.progressSync[bookId];
      if (data.clientSequence >= (current?.acknowledgedSequence ?? 0)) {
        update((s) => ({
          readingProgress: data.clientSequence >= (s.progressSync[bookId]?.clientSequence ?? 0) ? { ...s.readingProgress, [bookId]: { bookId: data.bookId, editionId: data.editionId, currentChapterIndex: data.currentChapterIndex, currentScrollPercent: data.currentScrollPercent, completedPercent: data.completedPercent, lastReadAt: data.lastReadAt, totalSecondsSpent: data.totalSecondsSpent, completed: data.completed } } : s.readingProgress,
          progressSync: { ...s.progressSync, [bookId]: { clientSequence: Math.max(s.progressSync[bookId]?.clientSequence ?? 0, data.clientSequence), acknowledgedSequence: data.clientSequence, pending: (s.progressSync[bookId]?.clientSequence ?? 0) > data.clientSequence, retryable: false, lastError: null } },
          requestStates: { ...s.requestStates, progress: { status: 'success', error: null, updatedAt: new Date().toISOString() } },
        }));
      }
    } catch (error) {
      update((s) => ({ progressSync: { ...s.progressSync, [bookId]: { ...(s.progressSync[bookId] ?? { clientSequence: sentSequence, acknowledgedSequence: 0, pending: true }), pending: true, retryable: toUiError(error).retryable, lastError: toUiError(error) } }, requestStates: { ...s.requestStates, progress: { status: 'error', error: toUiError(error), updatedAt: s.requestStates.progress.updatedAt } } }));
    } finally {
      progressInFlight.delete(bookId);
      const latest = globalState.progressSync[bookId];
      if (latest && latest.clientSequence > sentSequence) scheduleProgressSync(bookId, 0);
    }
  };

  return {
    ...state,

    // Collections & Storage Aliases
    userCollections: state.customCollections || [],
    downloadedFiles: state.downloadHistory.map((record) => {
      const book = state.books.find((candidate) => candidate.id === record.bookId);
      return {
        id: record.id,
        bookId: record.bookId,
        bookTitle: book ? (state.language === 'ar' ? book.titleAr : book.title) : record.bookId,
        format: record.format,
        timestamp: record.downloadedAt,
      };
    }),
    activeQuoteData: state.activeQuoteHighlight,

    // Public and personal domain data is loaded exclusively from the API. Empty responses remain empty.
    loadBackendData: () => {
      if (backendHydrationPromise) return backendHydrationPromise;
      backendHydrationPromise = (async () => {
      update((s) => ({ requestStates: { ...s.requestStates, catalog: { status: 'loading', error: null, updatedAt: s.requestStates.catalog.updatedAt } } }));
      const publicResults = await Promise.allSettled([
        booksApi.list({ page: 1, limit: 24 }),
        runtimeApi.listAuthors(),
        runtimeApi.listReadingPaths(),
      ]);
      const [catalog, authors, readingPaths] = publicResults;
      const timestamp = new Date().toISOString();
      update((s) => ({
        books: catalog.status === 'fulfilled' ? catalog.value.data : s.books,
        authors: authors.status === 'fulfilled' ? authors.value.data : s.authors,
        readingPaths: readingPaths.status === 'fulfilled' ? readingPaths.value.data : s.readingPaths,
        requestStates: { ...s.requestStates, catalog: catalog.status === 'fulfilled' ? { status: catalog.value.data.length ? 'success' : 'empty', error: null, updatedAt: timestamp } : { status: 'error', error: toUiError(catalog.reason), updatedAt: null } },
      }));
      if (!globalState.isAuthenticated) return;

      const userId = globalState.currentUser.id;
      update((s) => ({ requestStates: { ...s.requestStates, progress: { status: 'loading', error: null, updatedAt: s.requestStates.progress.updatedAt }, bookmarks: { status: 'loading', error: null, updatedAt: s.requestStates.bookmarks.updatedAt }, highlights: { status: 'loading', error: null, updatedAt: s.requestStates.highlights.updatedAt }, collections: { status: 'loading', error: null, updatedAt: s.requestStates.collections.updatedAt } } }));
      const [progress, history, bookmarks, highlights, collections, runtime] = await Promise.allSettled([
        readingApi.list(userId),
        readingApi.listHistory(userId),
        libraryApi.listBookmarks(userId),
        libraryApi.listHighlights(userId),
        libraryApi.listCollections(userId),
        runtimeApi.getPersonal(),
      ]);
      update((s) => {
        const states = { ...s.requestStates };
        const result: Partial<AppState> = { requestStates: states };
        if (progress.status === 'fulfilled') { result.readingProgress = Object.fromEntries(progress.value.data.map(({ userId: _userId, id: _id, clientSequence, clientUpdatedAt, ...value }) => [value.bookId, value])); result.progressSync = Object.fromEntries(progress.value.data.map((value) => [value.bookId, { clientSequence: value.clientSequence, acknowledgedSequence: value.clientSequence, pending: false, retryable: false, lastError: null }])); states.progress = { status: progress.value.data.length ? 'success' : 'empty', error: null, updatedAt: timestamp }; } else { states.progress = { status: 'error', error: toUiError(progress.reason), updatedAt: null }; }
        if (history.status === 'fulfilled') result.readingHistory = history.value.data;
        if (bookmarks.status === 'fulfilled') { result.bookmarks = bookmarks.value.data.map(({ userId: _userId, ...value }) => value); states.bookmarks = { status: bookmarks.value.data.length ? 'success' : 'empty', error: null, updatedAt: timestamp }; } else { states.bookmarks = { status: 'error', error: toUiError(bookmarks.reason), updatedAt: null }; }
        if (highlights.status === 'fulfilled') { result.highlights = highlights.value.data.map(({ userId: _userId, ...value }) => value); states.highlights = { status: highlights.value.data.length ? 'success' : 'empty', error: null, updatedAt: timestamp }; } else { states.highlights = { status: 'error', error: toUiError(highlights.reason), updatedAt: null }; }
        if (collections.status === 'fulfilled') { result.customCollections = collections.value.data.map(({ userId: _userId, ...value }) => value); states.collections = { status: collections.value.data.length ? 'success' : 'empty', error: null, updatedAt: timestamp }; } else { states.collections = { status: 'error', error: toUiError(collections.reason), updatedAt: null }; }
        if (runtime.status === 'fulfilled') {
          const data = runtime.value.data;
          const idsFor = (shelf: string) => data.bookStates.filter((entry) => entry.shelf === shelf).map((entry) => entry.bookId);
          result.savedBookIds = data.bookStates.filter((entry) => entry.saved).map((entry) => entry.bookId);
          result.favoriteBookIds = data.bookStates.filter((entry) => entry.favourite).map((entry) => entry.bookId);
          result.currentlyReadingBookIds = idsFor('CURRENTLY_READING');
          result.wantToReadBookIds = idsFor('WANT_TO_READ');
          result.finishedBookIds = idsFor('FINISHED');
          result.downloadHistory = data.downloads;
          result.downloadedBookIds = Array.from(new Set(data.downloads.map((entry) => entry.bookId)));
          result.achievements = data.achievements;
          result.notifications = data.notifications;
          result.timeCapsules = data.timeCapsules;
        }
        return result;
      });
      })().finally(() => { backendHydrationPromise = null; });
    },
    loadBookDetail: async (bookId: string) => {
      const existing = globalState.requestStates.details[bookId];
      if (existing?.status === 'loading') return;
      activeDetailController?.abort();
      const controller = new AbortController();
      activeDetailController = controller;
      update((s) => ({ requestStates: { ...s.requestStates, details: { ...s.requestStates.details, [bookId]: { status: 'loading', error: null, updatedAt: s.requestStates.details[bookId]?.updatedAt ?? null } } } }));
      try {
        const { data } = await booksApi.get(bookId, controller.signal);
        if (!controller.signal.aborted && globalState.detailBook?.id === bookId) update((s) => ({ books: s.books.some((book) => book.id === data.id) ? s.books.map((book) => book.id === data.id ? data : book) : [...s.books, data], detailBook: data, requestStates: { ...s.requestStates, details: { ...s.requestStates.details, [bookId]: { status: 'success', error: null, updatedAt: new Date().toISOString() } } } }));
      } catch (error) {
        if (!controller.signal.aborted) update((s) => ({ requestStates: { ...s.requestStates, details: { ...s.requestStates.details, [bookId]: { status: 'error', error: toUiError(error), updatedAt: null } } } }));
      } finally {
        if (activeDetailController === controller) activeDetailController = null;
      }
    },
    loadReviews: async (bookId: string) => {
      reviewControllers.get(bookId)?.abort();
      const controller = new AbortController();
      reviewControllers.set(bookId, controller);
      update((s) => ({ requestStates: { ...s.requestStates, reviews: { ...s.requestStates.reviews, [bookId]: { status: 'loading', error: null, updatedAt: s.requestStates.reviews[bookId]?.updatedAt ?? null } } } }));
      try {
        const { data } = await reviewsApi.listByBook(bookId, controller.signal);
        if (!controller.signal.aborted) update((s) => ({ reviews: [...s.reviews.filter((review) => review.bookId !== bookId), ...data], requestStates: { ...s.requestStates, reviews: { ...s.requestStates.reviews, [bookId]: { status: data.length ? 'success' : 'empty', error: null, updatedAt: new Date().toISOString() } } } }));
      } catch (error) {
        if (!controller.signal.aborted) update((s) => ({ requestStates: { ...s.requestStates, reviews: { ...s.requestStates.reviews, [bookId]: { status: 'error', error: toUiError(error), updatedAt: null } } } }));
      } finally {
        if (reviewControllers.get(bookId) === controller) reviewControllers.delete(bookId);
      }
    },
    loadCommunityFeed: async () => {
      update((s) => ({ requestStates: { ...s.requestStates, reviews: { ...s.requestStates.reviews, community: { status: 'loading', error: null, updatedAt: s.requestStates.reviews.community?.updatedAt ?? null } } } }));
      try {
        const { data } = await reviewsApi.listFeed();
        update((s) => ({ reviews: data, requestStates: { ...s.requestStates, reviews: { ...s.requestStates.reviews, community: { status: data.length ? 'success' : 'empty', error: null, updatedAt: new Date().toISOString() } } } }));
      } catch (error) {
        const uiError = toUiError(error);
        update((s) => ({ requestStates: { ...s.requestStates, reviews: { ...s.requestStates.reviews, community: { status: 'error', error: uiError, updatedAt: null } } } }));
      }
    },
    loadReviewComments: async (reviewId: string) => {
      try {
        const { data } = await reviewsApi.listComments(reviewId);
        update((s) => ({ reviewComments: { ...s.reviewComments, [reviewId]: data } }));
      } catch (error) {
        const uiError = toUiError(error);
        update((s) => ({ toasts: [...s.toasts, { id: `toast-${Date.now()}`, message: uiError.message, messageAr: uiError.messageAr, type: 'error' }] }));
      }
    },
    loadAuditLogs: async () => {
      update((s) => ({ requestStates: { ...s.requestStates, audits: { status: 'loading', error: null, updatedAt: s.requestStates.audits.updatedAt } } }));
      try {
        const { data } = await auditApi.list();
        update((s) => ({ auditLogs: data, requestStates: { ...s.requestStates, audits: { status: data.length ? 'success' : 'empty', error: null, updatedAt: new Date().toISOString() } } }));
      } catch (error) {
        update((s) => ({ requestStates: { ...s.requestStates, audits: { status: 'error', error: toUiError(error), updatedAt: null } } }));
      }
    },

    // Language & View
    setLanguage: (lang: LanguageCode) => {
      update(() => ({ language: lang }));
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    },
    setViewMode: (mode: ViewMode, historyMode: 'push' | 'replace' | 'none' = 'push') => {
      commitRoute(routeModelForView(mode), historyMode);
    },
    navigateToRoute: (route: AppRoute, historyMode: 'push' | 'replace' | 'none' = 'push') => commitRoute(route, historyMode),
    syncRouteFromLocation: () => commitRoute(parseAppRoute(typeof window === 'undefined' ? '/' : window.location.pathname), 'none'),
    closeRouteOverlay: () => {
      const current = globalState.route;
      const fallback = current.kind === 'path' ? routeModelForView('paths') : routeModelForView('library');
      update(() => ({ detailBook: null, detailAuthor: null, detailPath: null, activeReadingBook: null }));
      commitRoute(fallback, 'replace');
    },
    setSelectedRegionId: (regionId: ForestRegionId | 'all') => update(() => ({ selectedRegionId: regionId })),

    // Session state is established only by the Supabase client and enforced again by the server.
    setAuthModalOpen: (open: boolean) => update(() => ({ isAuthModalOpen: open })),
    startAuthenticatedSession: (profile: { id: string; email: string; name: string; nameAr: string }, verifiedRole: UserRole = 'READER') => {
      if (globalState.isAuthenticated && globalState.currentUser.id === profile.id && globalState.role === verifiedRole) return;
      update((s) => ({
        isAuthenticated: true,
        role: verifiedRole,
        currentUser: { ...s.currentUser, ...profile },
        isAuthModalOpen: false,
      }));
    },
    endAuthenticatedSession: () => {
      if (!globalState.isAuthenticated && !globalState.currentUser.id) return;
      update((s) => ({
      isAuthenticated: false,
      role: 'GUEST',
      currentUser: { ...s.currentUser, id: '', email: '', name: '', nameAr: '', avatar: '' },
      detailBook: null,
      detailAuthor: null,
      detailPath: null,
      bookmarks: [], highlights: [], customCollections: [], readingProgress: {}, readingHistory: [], progressSync: {}, savedBookIds: [], currentlyReadingBookIds: [], wantToReadBookIds: [], finishedBookIds: [], favoriteBookIds: [], downloadedBookIds: [], downloadHistory: [], achievements: [], notifications: [], timeCapsules: [], reviews: [], reviewComments: {},
      }));
    },

    // Reader State & Actions
    activeReaderBook: state.activeReadingBook,
    readerSettings: {
      theme: state.readerTheme,
      fontSize: state.readerFontSize,
      fontFamily: state.readerFontFamily,
      lineHeight: state.readerLineHeight,
      pageMargin: state.readerPageMargin,
      continuousScroll: state.readerContinuousScroll,
          contentWidth: state.readerContentWidth,
      textAlign: state.readerTextAlign,
      paragraphSpacing: state.readerParagraphSpacing,
      currentChapterIndex: state.currentChapterIndex,
    },
    updateReaderSettings: (settings: Partial<{
      theme: ReaderTheme;
      fontSize: number;
      fontFamily: AppState['readerFontFamily'];
      lineHeight: number;
      pageMargin: AppState['readerPageMargin'];
      continuousScroll: boolean;
      contentWidth: number;
      textAlign: 'left' | 'right' | 'justify' | 'center';
      paragraphSpacing: number;
      currentChapterIndex: number;
    }>) => {
      update((s) => {
        const next = { ...s,
          ...(settings.theme !== undefined ? { readerTheme: settings.theme } : {}),
          ...(settings.fontSize !== undefined ? { readerFontSize: settings.fontSize } : {}),
          ...(settings.fontFamily !== undefined ? { readerFontFamily: settings.fontFamily } : {}),
          ...(settings.lineHeight !== undefined ? { readerLineHeight: settings.lineHeight } : {}),
          ...(settings.pageMargin !== undefined ? { readerPageMargin: settings.pageMargin } : {}),
          ...(settings.continuousScroll !== undefined ? { readerContinuousScroll: settings.continuousScroll } : {}),
          ...(settings.contentWidth !== undefined ? { readerContentWidth: settings.contentWidth } : {}),
        ...(settings.textAlign !== undefined ? { readerTextAlign: settings.textAlign } : {}),
        ...(settings.paragraphSpacing !== undefined ? { readerParagraphSpacing: settings.paragraphSpacing } : {}),
        ...(settings.currentChapterIndex !== undefined ? { currentChapterIndex: settings.currentChapterIndex } : {}),
        };
        writePreferences(browserStorage, { theme: next.readerTheme, fontSize: next.readerFontSize, fontFamily: next.readerFontFamily as any, lineHeight: next.readerLineHeight, contentWidth: next.readerContentWidth, textAlign: next.readerTextAlign, paragraphSpacing: next.readerParagraphSpacing, continuousScroll: next.readerContinuousScroll });
        return next;
      });
    },
    updateReadingProgress: (bookId: string, chapterIndex: number, scrollPercent: number, completedPercent: number, elapsedSeconds = 15) => {
      update((s) => {
        const existing = s.readingProgress[bookId];
        const nextSequence = (s.progressSync[bookId]?.clientSequence ?? 0) + 1;
        const candidate: ReadingProgress = { bookId, editionId: s.activeEditionId || existing?.editionId || '', currentChapterIndex: chapterIndex, currentScrollPercent: scrollPercent, completedPercent: Math.max(existing?.completedPercent || 0, completedPercent), lastReadAt: new Date().toISOString(), totalSecondsSpent: (existing?.totalSecondsSpent || 0) + Math.max(0, Math.floor(elapsedSeconds)), completed: completedPercent >= 100 || (existing?.completed ?? false) };
        const merged = existing ? { ...candidate, currentScrollPercent: existing.currentChapterIndex === chapterIndex ? Math.max(existing.currentScrollPercent, candidate.currentScrollPercent) : candidate.currentScrollPercent, totalSecondsSpent: Math.max(existing.totalSecondsSpent, candidate.totalSecondsSpent) } : candidate;
        const sync = { clientSequence: nextSequence, acknowledgedSequence: s.progressSync[bookId]?.acknowledgedSequence ?? 0, pending: true, retryable: false, lastError: null };
        writeLocalProgress(browserStorage, snapshotFromProgress(merged, nextSequence));
        return { readingProgress: { ...s.readingProgress, [bookId]: merged }, progressSync: { ...s.progressSync, [bookId]: sync } };
      });
      scheduleProgressSync(bookId);
    },
    retryReadingProgress: (bookId: string) => scheduleProgressSync(bookId, 0),
    markBookFinished: async (bookId: string) => {
      if (!globalState.isAuthenticated) return false;
      const existing = globalState.finishedBookIds.includes(bookId);
      try {
        await runtimeApi.saveBookState({ bookId, saved: globalState.savedBookIds.includes(bookId), favourite: globalState.favoriteBookIds.includes(bookId), shelf: 'FINISHED' });
        if (!existing) update((s) => ({ finishedBookIds: Array.from(new Set([...s.finishedBookIds, bookId])) }));
        return true;
      } catch (error) {
        const uiError = toUiError(error);
        update((s) => ({ toasts: [...s.toasts, { id: `toast-${Date.now()}`, message: uiError.message, messageAr: uiError.messageAr, type: 'error' }] }));
        return false;
      }
    },

    // Reader Actions
    openBookInReader: (book: Book, editionId?: string, chapterIndex?: number) => {
      if (!canOpenInReader(book)) {
        const message = readerUnavailableMessage(book.contentAvailability);
        const messageAr = readerUnavailableMessage(book.contentAvailability, true);
        update((s) => ({
          toasts: [...s.toasts, { id: 'toast-' + Date.now(), message, messageAr, type: 'warning' }],
        }));
        return false;
      }

      const edId = editionId || book.editions[0]?.id || '';
      const requestedChapter = chapterIndex;
      const local = readLocalProgress(browserStorage, book.id);
      update((s) => {
        const currentlyReading = Array.from(new Set([book.id, ...s.currentlyReadingBookIds]));
        const progress = s.readingProgress[book.id] || (local ? { bookId: book.id, editionId: local.editionId || edId, currentChapterIndex: local.chapterIndex, currentScrollPercent: local.scrollPercent, completedPercent: local.completedPercent, lastReadAt: local.lastReadAt, totalSecondsSpent: local.totalSecondsSpent, completed: local.completed } : {
          bookId: book.id,
          editionId: edId,
          currentChapterIndex: requestedChapter ?? local?.chapterIndex ?? 0,
          currentScrollPercent: local?.scrollPercent ?? 0,
          completedPercent: 0,
          lastReadAt: new Date().toISOString(),
          totalSecondsSpent: 0,
          completed: false,
        });
        const resumeChapter = requestedChapter ?? s.readingProgress[book.id]?.currentChapterIndex ?? local?.chapterIndex ?? 0;

        return {
          activeReadingBook: book,
          activeEditionId: edId,
          currentChapterIndex: resumeChapter,
          currentlyReadingBookIds: currentlyReading,
          readingProgress: {
            ...s.readingProgress,
            [book.id]: {
              ...progress,
              currentChapterIndex: chapterIndex,
              lastReadAt: new Date().toISOString(),
            },
          },
        };
      });
      if (globalState.isAuthenticated && edId) {
        void readingApi.recordOpened(book.id, edId).then(({ data }) => update((s) => ({ readingHistory: [data, ...s.readingHistory.filter((entry) => entry.id !== data.id)] }))).catch((error) => {
          const uiError = toUiError(error);
          update((s) => ({ toasts: [...s.toasts, { id: `toast-${Date.now()}`, message: uiError.message, messageAr: uiError.messageAr, type: 'warning' }] }));
        });
      }
      commitRoute({ kind: 'reader', bookId: book.id });
      return true;
    },
    closeReader: () => {
      const bookId = globalState.activeReadingBook?.id;
      update(() => ({ activeReadingBook: null }));
      commitRoute(bookId ? { kind: 'book', bookId } : routeModelForView('library'), 'replace');
    },
    setChapterIndex: (index: number) => {
      update((s) => {
        if (!s.activeReadingBook) return {};
        const bookId = s.activeReadingBook.id;
        const totalChapters = s.activeReadingBook.chapters.length || 1;
        const completedPct = Math.round(((index + 1) / totalChapters) * 100);
        const existing = s.readingProgress[bookId];

        const nextSequence = (s.progressSync[bookId]?.clientSequence ?? 0) + 1;
        return { currentChapterIndex: index, readingProgress: { ...s.readingProgress, [bookId]: {               ...existing,
              bookId,
              editionId: s.activeEditionId || '',
              currentChapterIndex: index,
              currentScrollPercent: existing?.currentScrollPercent ?? 0,
              completedPercent: completedPct, lastReadAt: new Date().toISOString(), totalSecondsSpent: (existing?.totalSecondsSpent || 0) + 120, completed: completedPct >= 100 } }, progressSync: { ...s.progressSync, [bookId]: { clientSequence: nextSequence, acknowledgedSequence: s.progressSync[bookId]?.acknowledgedSequence ?? 0, pending: true, retryable: false, lastError: null } } };
      });
      if (globalState.activeReadingBook) scheduleProgressSync(globalState.activeReadingBook.id);
    },
    setReaderTheme: (theme: ReaderTheme) => update(() => ({ readerTheme: theme })),
    setReaderFontSize: (size: number) => update(() => ({ readerFontSize: size })),
    setReaderFontFamily: (font: AppState['readerFontFamily']) => update(() => ({ readerFontFamily: font })),
    setReaderLineHeight: (height: number) => update(() => ({ readerLineHeight: height })),
    setReaderPageMargin: (margin: AppState['readerPageMargin']) => update(() => ({ readerPageMargin: margin })),
    setReaderContinuousScroll: (continuous: boolean) => update(() => ({ readerContinuousScroll: continuous })),

    // Ritual
    setReadingRitualOpen: (open: boolean) => update(() => ({ isReadingRitualOpen: open })),
    setRitualTimerMinutes: (min: number) => update(() => ({ ritualTimerMinutes: min })),
    setRitualRunning: (running: boolean) => update(() => ({ isRitualRunning: running })),

    // Bookmarks & highlights wait for a confirmed server response; no optimistic rollback is needed.
    addBookmark: async (bookmark: Omit<Bookmark, 'id' | 'createdAt'>) => {
      update((s) => ({ requestStates: { ...s.requestStates, bookmarks: { status: 'loading', error: null, updatedAt: s.requestStates.bookmarks.updatedAt } } }));
      try {
        const { data } = await libraryApi.createBookmark({ ...bookmark, userId: globalState.currentUser.id });
        update((s) => ({ bookmarks: [data, ...s.bookmarks], requestStates: { ...s.requestStates, bookmarks: { status: 'success', error: null, updatedAt: new Date().toISOString() } } }));
      } catch (error) {
        const uiError = toUiError(error);
        update((s) => ({ requestStates: { ...s.requestStates, bookmarks: { status: 'error', error: uiError, updatedAt: s.requestStates.bookmarks.updatedAt } }, toasts: [...s.toasts, { id: `toast-${Date.now()}`, message: uiError.message, messageAr: uiError.messageAr, type: 'error' }] }));
      }
    },
    removeBookmark: async (id: string) => {
      update((s) => ({ requestStates: { ...s.requestStates, bookmarks: { status: 'loading', error: null, updatedAt: s.requestStates.bookmarks.updatedAt } } }));
      try { await libraryApi.deleteBookmark(id, globalState.currentUser.id); update((s) => ({ bookmarks: s.bookmarks.filter((bookmark) => bookmark.id !== id), requestStates: { ...s.requestStates, bookmarks: { status: s.bookmarks.length > 1 ? 'success' : 'empty', error: null, updatedAt: new Date().toISOString() } } })); } catch (error) { const uiError = toUiError(error); update((s) => ({ requestStates: { ...s.requestStates, bookmarks: { status: 'error', error: uiError, updatedAt: s.requestStates.bookmarks.updatedAt } } })); }
    },
    addHighlight: async (highlight: Omit<Highlight, 'id' | 'createdAt'>) => {
      update((s) => ({ requestStates: { ...s.requestStates, highlights: { status: 'loading', error: null, updatedAt: s.requestStates.highlights.updatedAt } } }));
      try { const { data } = await libraryApi.createHighlight({ userId: globalState.currentUser.id, bookId: highlight.bookId, chapterIndex: highlight.chapterIndex, selectedText: highlight.selectedText, color: highlight.color, note: highlight.note }); update((s) => ({ highlights: [data, ...s.highlights], requestStates: { ...s.requestStates, highlights: { status: 'success', error: null, updatedAt: new Date().toISOString() } } })); } catch (error) { const uiError = toUiError(error); update((s) => ({ requestStates: { ...s.requestStates, highlights: { status: 'error', error: uiError, updatedAt: s.requestStates.highlights.updatedAt } } })); }
    },
    removeHighlight: async (id: string) => {
      update((s) => ({ requestStates: { ...s.requestStates, highlights: { status: 'loading', error: null, updatedAt: s.requestStates.highlights.updatedAt } } }));
      try { await libraryApi.deleteHighlight(id, globalState.currentUser.id); update((s) => ({ highlights: s.highlights.filter((highlight) => highlight.id !== id), requestStates: { ...s.requestStates, highlights: { status: s.highlights.length > 1 ? 'success' : 'empty', error: null, updatedAt: new Date().toISOString() } } })); } catch (error) { const uiError = toUiError(error); update((s) => ({ requestStates: { ...s.requestStates, highlights: { status: 'error', error: uiError, updatedAt: s.requestStates.highlights.updatedAt } } })); }
    },
    updateHighlightNote: async (id: string, note: string) => {
      update((s) => ({ requestStates: { ...s.requestStates, highlights: { status: 'loading', error: null, updatedAt: s.requestStates.highlights.updatedAt } } }));
      try { const { data } = await libraryApi.updateHighlightNote(id, globalState.currentUser.id, note); update((s) => ({ highlights: s.highlights.map((highlight) => highlight.id === id ? data : highlight), requestStates: { ...s.requestStates, highlights: { status: 'success', error: null, updatedAt: new Date().toISOString() } } })); } catch (error) { const uiError = toUiError(error); update((s) => ({ requestStates: { ...s.requestStates, highlights: { status: 'error', error: uiError, updatedAt: s.requestStates.highlights.updatedAt } } })); }
    },

    // Shelves and favourites are persisted before the visible state changes.
    toggleSaveBook: async (bookId: string) => {
      if (!globalState.isAuthenticated) return false;
      const saved = !globalState.savedBookIds.includes(bookId);
      try {
        await runtimeApi.saveBookState({ bookId, saved, favourite: globalState.favoriteBookIds.includes(bookId), shelf: globalState.finishedBookIds.includes(bookId) ? 'FINISHED' : globalState.currentlyReadingBookIds.includes(bookId) ? 'CURRENTLY_READING' : globalState.wantToReadBookIds.includes(bookId) ? 'WANT_TO_READ' : saved ? 'SAVED' : 'NONE' });
        update((s) => ({ savedBookIds: saved ? Array.from(new Set([...s.savedBookIds, bookId])) : s.savedBookIds.filter((id) => id !== bookId) }));
        return true;
      } catch (error) { const uiError = toUiError(error); update((s) => ({ toasts: [...s.toasts, { id: `toast-${Date.now()}`, message: uiError.message, messageAr: uiError.messageAr, type: 'error' }] })); return false; }
    },
    toggleFavoriteBook: async (bookId: string) => {
      if (!globalState.isAuthenticated) return false;
      const favourite = !globalState.favoriteBookIds.includes(bookId);
      try {
        await runtimeApi.saveBookState({ bookId, saved: globalState.savedBookIds.includes(bookId), favourite, shelf: globalState.finishedBookIds.includes(bookId) ? 'FINISHED' : globalState.currentlyReadingBookIds.includes(bookId) ? 'CURRENTLY_READING' : globalState.wantToReadBookIds.includes(bookId) ? 'WANT_TO_READ' : globalState.savedBookIds.includes(bookId) ? 'SAVED' : 'NONE' });
        update((s) => ({ favoriteBookIds: favourite ? Array.from(new Set([...s.favoriteBookIds, bookId])) : s.favoriteBookIds.filter((id) => id !== bookId) }));
        return true;
      } catch (error) { const uiError = toUiError(error); update((s) => ({ toasts: [...s.toasts, { id: `toast-${Date.now()}`, message: uiError.message, messageAr: uiError.messageAr, type: 'error' }] })); return false; }
    },
    downloadBookFile: async (book: Book, editionId: string, format: string) => {
      if (!globalState.isAuthenticated) return false;
      const edition = book.editions.find((value) => value.id === editionId) || book.editions[0];
      if (!edition) return false;
      try {
        const { data: availability } = await downloadsApi.availability(book.id, edition.id);
        const file = availability.files.find((value) => value.format === format && value.availability === 'AVAILABLE');
        if (!file) return false;
        await downloadsApi.downloadOriginal(book.id, edition.id, file, book.title);
        update((state) => ({ downloadedBookIds: Array.from(new Set([...state.downloadedBookIds, book.id])) }));
        return true;
      } catch (error) {
        const uiError = toUiError(error);
        update((state) => ({ toasts: [...state.toasts, { id: `toast-${Date.now()}`, message: uiError.message, messageAr: uiError.messageAr, type: 'error' }] }));
        return false;
      }
    },

    // Collections are server-confirmed; title conflicts and invalid book references remain visible to the user.
    createCollection: async (title: string, description = '', colorTheme = '#687B61', bookIds: string[] = []) => {
      update((s) => ({ requestStates: { ...s.requestStates, collections: { status: 'loading', error: null, updatedAt: s.requestStates.collections.updatedAt } } }));
      try { const { data } = await libraryApi.createCollection({ userId: globalState.currentUser.id, title, description, isPublic: true, bookIds, colorTheme }); update((s) => ({ customCollections: [data, ...s.customCollections], requestStates: { ...s.requestStates, collections: { status: 'success', error: null, updatedAt: new Date().toISOString() } } })); } catch (error) { const uiError = toUiError(error); update((s) => ({ requestStates: { ...s.requestStates, collections: { status: 'error', error: uiError, updatedAt: s.requestStates.collections.updatedAt } }, toasts: [...s.toasts, { id: `toast-${Date.now()}`, message: uiError.message, messageAr: uiError.messageAr, type: 'error' }] })); }
    },
    updateCollectionBookIds: async (id: string, bookIds: string[]) => {
      update((s) => ({ requestStates: { ...s.requestStates, collections: { status: 'loading', error: null, updatedAt: s.requestStates.collections.updatedAt } } }));
      try {
        const { data } = await libraryApi.updateCollectionBookIds(id, globalState.currentUser.id, bookIds);
        update((s) => ({ customCollections: s.customCollections.map((collection) => collection.id === id ? data : collection), requestStates: { ...s.requestStates, collections: { status: 'success', error: null, updatedAt: new Date().toISOString() } } }));
        return true;
      } catch (error) {
        const uiError = toUiError(error);
        update((s) => ({ requestStates: { ...s.requestStates, collections: { status: 'error', error: uiError, updatedAt: s.requestStates.collections.updatedAt } }, toasts: [...s.toasts, { id: `toast-${Date.now()}`, message: uiError.message, messageAr: uiError.messageAr, type: 'error' }] }));
        return false;
      }
    },
    deleteCollection: async (id: string) => {
      update((s) => ({ requestStates: { ...s.requestStates, collections: { status: 'loading', error: null, updatedAt: s.requestStates.collections.updatedAt } } }));
      try { await libraryApi.deleteCollection(id, globalState.currentUser.id); update((s) => ({ customCollections: s.customCollections.filter((collection) => collection.id !== id), requestStates: { ...s.requestStates, collections: { status: s.customCollections.length > 1 ? 'success' : 'empty', error: null, updatedAt: new Date().toISOString() } } })); } catch (error) { const uiError = toUiError(error); update((s) => ({ requestStates: { ...s.requestStates, collections: { status: 'error', error: uiError, updatedAt: s.requestStates.collections.updatedAt } } })); }
    },

    // Time capsules persist under the authenticated owner before being shown in the library.
    createTimeCapsule: async (book: Book, unlockDate: string, note: string) => {
      if (!globalState.isAuthenticated) return false;
      try {
        const { data } = await runtimeApi.createTimeCapsule({ bookId: book.id, unlockDate, personalNote: note });
        update((s) => ({ timeCapsules: [data, ...s.timeCapsules.filter((capsule) => capsule.id !== data.id)] }));
        return true;
      } catch (error) { const uiError = toUiError(error); update((s) => ({ toasts: [...s.toasts, { id: `toast-${Date.now()}`, message: uiError.message, messageAr: uiError.messageAr, type: 'error' }] })); return false; }
    },

    // Soundscape
    setSoundscape: (type: SoundscapeType) => {
      audioEngine.play(type);
      update(() => ({ activeSoundscape: type }));
    },
    toggleAudioMute: () => {
      const muted = audioEngine.toggleMute();
      update(() => ({ isAudioMuted: muted }));
    },
    setAudioVolume: (vol: number) => {
      audioEngine.setVolume(vol);
      update(() => ({ audioVolume: vol }));
    },

    // Modals
    setCommandPaletteOpen: (open: boolean) => update(() => ({ isCommandPaletteOpen: open })),
    setOnlineSearchOpen: (open: boolean) => update(() => ({ isOnlineSearchOpen: open })),
    setQuoteStudioOpen: (open: boolean, highlight?: Highlight) => {
      update(() => ({ isQuoteStudioOpen: open, activeQuoteHighlight: highlight || null }));
    },
    setDetailBook: (book: Book | null) => {
      if (!book) return commitRoute(routeModelForView('library'), 'replace');
      update(() => ({ detailBook: book }));
      commitRoute({ kind: 'book', bookId: book.id });
    },
    setDetailAuthor: (author: Author | null) => {
      if (!author) return commitRoute(routeModelForView('library'), 'replace');
      update(() => ({ detailAuthor: author }));
      commitRoute({ kind: 'author', authorId: author.id });
    },
    setDetailPath: (path: ReadingPath | null) => {
      if (!path) return commitRoute(routeModelForView('paths'), 'replace');
      update(() => ({ detailPath: path }));
      commitRoute({ kind: 'path', pathId: path.id });
    },
    setSelectedMoodId: (moodId: string | null) => update(() => ({ selectedMoodId: moodId })),

    // Admin CMS actions are API-confirmed; local role simulation is never treated as authorization.
    addBook: async (book: Book) => {
      update((s) => ({ requestStates: { ...s.requestStates, admin: { status: 'loading', error: null, updatedAt: s.requestStates.admin.updatedAt } } }));
      try { const { data } = await adminApi.createBook(book); const audits = await auditApi.list(); update((s) => ({ books: [data, ...s.books.filter((item) => item.id !== data.id)], auditLogs: audits.data, requestStates: { ...s.requestStates, admin: { status: 'success', error: null, updatedAt: new Date().toISOString() }, audits: { status: audits.data.length ? 'success' : 'empty', error: null, updatedAt: new Date().toISOString() } } })); return data; } catch (error) { const uiError = toUiError(error); update((s) => ({ requestStates: { ...s.requestStates, admin: { status: 'error', error: uiError, updatedAt: s.requestStates.admin.updatedAt } }, toasts: [...s.toasts, { id: `toast-${Date.now()}`, message: uiError.message, messageAr: uiError.messageAr, type: 'error' }] })); return false; }
    },
    updateBook: async (bookId: string, updates: Partial<Book>) => {
      update((s) => ({ requestStates: { ...s.requestStates, admin: { status: 'loading', error: null, updatedAt: s.requestStates.admin.updatedAt } } }));
      try { const { data } = await adminApi.updateBook(bookId, updates); const audits = await auditApi.list(); update((s) => ({ books: s.books.map((book) => book.id === bookId ? data : book), auditLogs: audits.data, requestStates: { ...s.requestStates, admin: { status: 'success', error: null, updatedAt: new Date().toISOString() }, audits: { status: audits.data.length ? 'success' : 'empty', error: null, updatedAt: new Date().toISOString() } } })); } catch (error) { const uiError = toUiError(error); update((s) => ({ requestStates: { ...s.requestStates, admin: { status: 'error', error: uiError, updatedAt: s.requestStates.admin.updatedAt } } })); }
    },
    deleteBook: async (bookId: string) => {
      update((s) => ({ requestStates: { ...s.requestStates, admin: { status: 'loading', error: null, updatedAt: s.requestStates.admin.updatedAt } } }));
      try { await adminApi.deleteBook(bookId); const audits = await auditApi.list(); update((s) => ({ books: s.books.filter((book) => book.id !== bookId), auditLogs: audits.data, requestStates: { ...s.requestStates, admin: { status: 'success', error: null, updatedAt: new Date().toISOString() }, audits: { status: audits.data.length ? 'success' : 'empty', error: null, updatedAt: new Date().toISOString() } } })); } catch (error) { const uiError = toUiError(error); update((s) => ({ requestStates: { ...s.requestStates, admin: { status: 'error', error: uiError, updatedAt: s.requestStates.admin.updatedAt } } })); }
    },
    saveBookChanges: async (updatedBook: Book) => {
      if (globalState.books.some((book) => book.id === updatedBook.id)) await adminApi.updateBook(updatedBook.id, updatedBook).then(({ data }) => update((s) => ({ books: s.books.map((book) => book.id === data.id ? data : book) }))).catch((error) => { const uiError = toUiError(error); update((s) => ({ requestStates: { ...s.requestStates, admin: { status: 'error', error: uiError, updatedAt: s.requestStates.admin.updatedAt } } })); });
      else await adminApi.createBook(updatedBook).then(({ data }) => update((s) => ({ books: [data, ...s.books] }))).catch((error) => { const uiError = toUiError(error); update((s) => ({ requestStates: { ...s.requestStates, admin: { status: 'error', error: uiError, updatedAt: s.requestStates.admin.updatedAt } } })); });
    },

    // Reviews are only inserted into UI state after the backend validates and persists them.
    addReview: async (bookId: string, rating: number, title: string, content: string) => {
      update((s) => ({ requestStates: { ...s.requestStates, reviews: { ...s.requestStates.reviews, [bookId]: { status: 'loading', error: null, updatedAt: s.requestStates.reviews[bookId]?.updatedAt ?? null } } } }));
      try {
        const { data } = await reviewsApi.create({ userId: globalState.currentUser.id, userName: globalState.currentUser.name, userAvatar: globalState.currentUser.avatar, bookId, rating, title, content });
        update((s) => ({ reviews: [data, ...s.reviews.filter((review) => review.id !== data.id)], requestStates: { ...s.requestStates, reviews: { ...s.requestStates.reviews, [bookId]: { status: 'success', error: null, updatedAt: new Date().toISOString() } } } }));
        return true;
      } catch (error) {
        const uiError = toUiError(error);
        update((s) => ({ requestStates: { ...s.requestStates, reviews: { ...s.requestStates.reviews, [bookId]: { status: 'error', error: uiError, updatedAt: s.requestStates.reviews[bookId]?.updatedAt ?? null } } }, toasts: [...s.toasts, { id: `toast-${Date.now()}`, message: uiError.message, messageAr: uiError.messageAr, type: 'error' }] }));
        return false;
      }
    },

    toggleReviewLike: async (reviewId: string, liked: boolean) => {
      if (!globalState.isAuthenticated) return false;
      try {
        const { data } = await reviewsApi.setLike(reviewId, liked);
        update((s) => ({ reviews: s.reviews.map((review) => review.id === reviewId ? { ...review, likes: data.likes, likedByCurrentUser: data.liked } : review) }));
        return true;
      } catch (error) {
        const uiError = toUiError(error);
        update((s) => ({ toasts: [...s.toasts, { id: `toast-${Date.now()}`, message: uiError.message, messageAr: uiError.messageAr, type: 'error' }] }));
        return false;
      }
    },
    addReviewComment: async (reviewId: string, content: string) => {
      if (!globalState.isAuthenticated) return false;
      try {
        const { data } = await reviewsApi.createComment(reviewId, content);
        update((s) => ({ reviewComments: { ...s.reviewComments, [reviewId]: [...(s.reviewComments[reviewId] || []), data] }, reviews: s.reviews.map((review) => review.id === reviewId ? { ...review, commentsCount: (review.commentsCount || 0) + 1 } : review) }));
        return true;
      } catch (error) {
        const uiError = toUiError(error);
        update((s) => ({ toasts: [...s.toasts, { id: `toast-${Date.now()}`, message: uiError.message, messageAr: uiError.messageAr, type: 'error' }] }));
        return false;
      }
    },

    // Toast feedback
    addToast: (message: string, messageAr: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
      const id = 'toast-' + Date.now();
      update((s) => ({ toasts: [...s.toasts, { id, message, messageAr, type }] }));
      setTimeout(() => {
        update((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, 4000);
    },
    removeToast: (id: string) => update((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  };
}
