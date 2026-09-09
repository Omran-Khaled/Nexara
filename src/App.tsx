
import { lazy, Suspense, useEffect, useMemo, useRef } from 'react';
import { useAppStore } from './stores/useAppStore';
import { translations } from './i18n/translations';
import { BRAND_CONFIG } from './config/brand';
import { Navbar } from './components/navigation/Navbar';
import { SiteFooter } from './components/navigation/SiteFooter';
import { ToastContainer } from './components/ui/Toast';
import { Compass, Sparkles, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthenticatedProfile, authMode, localAuth, profileFromUser, supabase } from './lib/auth';
import { accountApi, primaryUserRole } from './api/account';

const ForestExperience = lazy(() => import('./components/forest/ForestExperience').then((module) => ({ default: module.ForestExperience })));
const LibraryView = lazy(() => import('./components/library/LibraryView').then((module) => ({ default: module.LibraryView })));
const WanderView = lazy(() => import('./components/discovery/WanderView').then((module) => ({ default: module.WanderView })));
const MoodDiscovery = lazy(() => import('./components/discovery/MoodDiscovery').then((module) => ({ default: module.MoodDiscovery })));
const ReadingPathsView = lazy(() => import('./components/discovery/ReadingPathsView').then((module) => ({ default: module.ReadingPathsView })));
const LiteraryMap = lazy(() => import('./components/discovery/LiteraryMap').then((module) => ({ default: module.LiteraryMap })));
const MyLibraryView = lazy(() => import('./components/personal/MyLibraryView').then((module) => ({ default: module.MyLibraryView })));
const CommunityView = lazy(() => import('./components/community/CommunityView').then((module) => ({ default: module.CommunityView })));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard').then((module) => ({ default: module.AdminDashboard })));
const ReadingEngine = lazy(() => import('./components/reader/ReadingEngine').then((module) => ({ default: module.ReadingEngine })));
const ReadingRitualModal = lazy(() => import('./components/reader/ReadingRitualModal').then((module) => ({ default: module.ReadingRitualModal })));
const QuoteStudio = lazy(() => import('./components/quotes/QuoteStudio').then((module) => ({ default: module.QuoteStudio })));
const BookDetailModal = lazy(() => import('./components/library/BookDetailModal').then((module) => ({ default: module.BookDetailModal })));
const AuthorDetailModal = lazy(() => import('./components/author/AuthorDetailModal').then((module) => ({ default: module.AuthorDetailModal })));
const AuthModal = lazy(() => import('./components/auth/AuthModal').then((module) => ({ default: module.AuthModal })));
const OnlineBookSearchModal = lazy(() => import('./components/discovery/OnlineBookSearchModal').then((module) => ({ default: module.OnlineBookSearchModal })));
const CommandPalette = lazy(() => import('./components/navigation/CommandPalette').then((module) => ({ default: module.CommandPalette })));

export default function App() {
  const {
    viewMode,
    route,
    books,
    setViewMode,
    syncRouteFromLocation,
    openBookInReader,
    language,
    activeReaderBook,
    isOnlineSearchOpen,
    isCommandPaletteOpen,
    isReadingRitualOpen,
    isQuoteStudioOpen,
    isAuthModalOpen,
    detailBook,
    detailAuthor,
    setOnlineSearchOpen,
    loadBackendData,
    startAuthenticatedSession,
    endAuthenticatedSession,
  } = useAppStore();
  const mainRef = useRef<HTMLElement>(null);
  const isAr = language === 'ar';
  const t = translations[language as keyof typeof translations] ?? translations.en;
  const routeAnnouncement = useMemo(() => {
    if (route.kind === 'book') return isAr ? 'تم فتح تفاصيل الكتاب.' : 'Book details opened.';
    if (route.kind === 'reader') return isAr ? 'تم فتح القارئ.' : 'Reader opened.';
    if (route.kind === 'author') return isAr ? 'تم فتح تفاصيل المؤلف.' : 'Author details opened.';
    if (route.kind === 'path') return isAr ? 'تم فتح مسار القراءة.' : 'Reading path opened.';
    if (route.kind === 'not-found') return isAr ? 'المسار غير موجود.' : 'Route not found.';
    return isAr ? 'تم تغيير الصفحة.' : 'Page changed.';
  }, [isAr, route]);

  useEffect(() => {
    const onPopState = () => syncRouteFromLocation();
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // The listener owns history-to-state reconciliation only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (route.kind !== 'reader' || !books.length) return;
    const book = books.find((candidate) => candidate.id === route.bookId);
    if (book && activeReaderBook?.id !== book.id) openBookInReader(book);
    // Route hydration intentionally reacts only when the targeted record becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.kind, route.kind === 'reader' ? route.bookId : '', books.length, activeReaderBook?.id]);

  useEffect(() => {
    if (route.kind === 'reader') return;
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
      mainRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [route]);

  useEffect(() => {
    let active = true;
    let sessionRevision = 0;
    // Single hydration authority: resolve roles from the server, then start the
    // session. Works identically for the Supabase and local development providers.
    const hydrateAuthenticatedProfile = async (profile: AuthenticatedProfile) => {
      const revision = ++sessionRevision;
      let verifiedRole = primaryUserRole(['READER']);
      try {
        const principal = (await accountApi.me()).data;
        verifiedRole = primaryUserRole(principal.roles);
      } catch {
        // Server remains authoritative. A failed refresh is represented as the least-privileged role.
      }
      if (!active || revision !== sessionRevision) return;
      startAuthenticatedSession(profile, verifiedRole);
      await loadBackendData();
    };
    const hydrateAuthenticatedSession = (user: Parameters<typeof profileFromUser>[0]) => hydrateAuthenticatedProfile(profileFromUser(user));
    const hydrate = async () => {
      if (authMode === 'local') {
        const restored = await localAuth.restore();
        if (!active) return;
        if (restored) await hydrateAuthenticatedProfile(restored);
        else await loadBackendData();
        return;
      }
      if (!supabase) {
        await loadBackendData();
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session?.user) await hydrateAuthenticatedSession(data.session.user);
      else await loadBackendData();
    };
    void hydrate();
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) void hydrateAuthenticatedSession(session.user);
      else {
        sessionRevision += 1;
        endAuthenticatedSession();
        void loadBackendData();
      }
    });
    return () => {
      active = false;
      sessionRevision += 1;
      subscription?.data.subscription.unsubscribe();
    };
    // The lightweight store returns action closures per render; session hydration is mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Suspense fallback={<div role="status" className="min-h-screen bg-[#07110D] text-[#89977C] grid place-items-center text-sm">{isAr ? 'جارٍ تحميل الواجهة…' : 'Loading view…'}</div>}><div
      id="nexara-root-app"
      className="min-h-screen bg-[#07110D] text-[#E8E0CF] flex flex-col font-sans selection:bg-[#B89A5A]/30 selection:text-[#E8E0CF] transition-colors"
      style={{ direction: isAr ? 'rtl' : 'ltr' }}
    >
      {/* Global Navigation Bar */}
      <Navbar />

      {/* Main Content Viewport */}
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{routeAnnouncement}</p>
      <main ref={mainRef} tabIndex={-1} aria-label={isAr ? 'محتوى Nexara الرئيسي' : 'Nexara main content'} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 focus:outline-none">
        {route.kind === 'not-found' ? (
          <section className="max-w-xl mx-auto py-24 text-center space-y-5" aria-labelledby="route-not-found-title">
            <p className="text-sm font-mono text-[#D2BB82]">404</p>
            <h1 id="route-not-found-title" className="font-literary text-3xl font-bold text-[#E8E0CF]">{isAr ? 'لم نعثر على هذه الوجهة' : 'This destination could not be found'}</h1>
            <p className="text-sm leading-relaxed text-[#89977C]">{isAr ? 'تحقق من الرابط أو عُد إلى المكتبة لاستكشاف الأعمال المتاحة.' : 'Check the address or return to the library to explore available works.'}</p>
            <button onClick={() => setViewMode('library')} className="px-4 py-2.5 rounded-xl bg-[#B89A5A] text-[#07110D] text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8E0CF]">{isAr ? 'الذهاب إلى المكتبة' : 'Go to library'}</button>
          </section>
        ) : <AnimatePresence mode="wait">
          {viewMode === 'forest' && (
            <motion.div
              key="forest"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ForestExperience />
            </motion.div>
          )}

          {viewMode === 'library' && (
            <motion.div
              key="library"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <LibraryView />
            </motion.div>
          )}

          {viewMode === 'discover' && (
            <motion.div
              key="discover"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              {/* Discover Hub Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <button
                  type="button"
                  onClick={() => setViewMode('wander')}
                  className="p-6 rounded-3xl bg-[#0B1712] border border-[#173125] hover:border-[#B89A5A]/60 transition-all group space-y-3 shadow-xl text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D2BB82]"
                >
                  <div className="p-3 rounded-2xl bg-[#173125] text-[#D2BB82] w-fit">
                    <Compass className="w-6 h-6" />
                  </div>
                  <h3 className="font-literary text-xl font-bold text-[#E8E0CF] group-hover:text-[#D2BB82]">
                    {isAr ? 'تجوال هادئ في الغابة' : 'Quiet Forest Wander'}
                  </h3>
                  <p className="text-xs text-[#89977C] leading-relaxed">
                    {isAr
                      ? 'دع الخوارزمية القطعية ترشدك إلى عمل غير متوقع بناءً على وزنه الأدبي والتاريخي.'
                      : 'Let deterministic serendipity lead you to an unexpected work of profound historical weight.'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('moods')}
                  className="p-6 rounded-3xl bg-[#0B1712] border border-[#173125] hover:border-[#687B61]/60 transition-all group space-y-3 shadow-xl text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D2BB82]"
                >
                  <div className="p-3 rounded-2xl bg-[#10231A] text-[#89977C] w-fit">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="font-literary text-xl font-bold text-[#E8E0CF] group-hover:text-[#D2BB82]">
                    {isAr ? 'بوابات المزاج والإلهام' : 'Atmospheric Moods'}
                  </h3>
                  <p className="text-xs text-[#89977C] leading-relaxed">
                    {isAr
                      ? 'اختر الطابع الروحي أو الفلسفي الذي تبحث عنه، واستكشف الأعمال المتوافقة معه.'
                      : 'Choose an internal tone or emotional state to uncover aligned literary masterworks.'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('paths')}
                  className="p-6 rounded-3xl bg-[#0B1712] border border-[#173125] hover:border-[#687B61]/60 transition-all group space-y-3 shadow-xl text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D2BB82]"
                >
                  <div className="p-3 rounded-2xl bg-[#173125] text-[#D2BB82] w-fit">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h3 className="font-literary text-xl font-bold text-[#E8E0CF] group-hover:text-[#D2BB82]">
                    {isAr ? 'مسارات القراءة المنهجية' : 'Curated Reading Paths'}
                  </h3>
                  <p className="text-xs text-[#89977C] leading-relaxed">
                    {isAr
                      ? 'رحلات قراءة متسلسلة تصحبك خطوة بخطوة عبر محطات الفكر الكلاسيكي.'
                      : 'Sequential reading journeys that guide you step-by-step through landmark ideas.'}
                  </p>
                </button>
              </div>

              {/* Embed Moods below Discover Hub */}
              <MoodDiscovery />
            </motion.div>
          )}

          {viewMode === 'wander' && (
            <motion.div
              key="wander"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <WanderView />
            </motion.div>
          )}

          {viewMode === 'moods' && (
            <motion.div
              key="moods"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <MoodDiscovery />
            </motion.div>
          )}

          {viewMode === 'paths' && (
            <motion.div
              key="paths"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ReadingPathsView />
            </motion.div>
          )}

          {viewMode === 'map' && (
            <motion.div
              key="map"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <LiteraryMap />
            </motion.div>
          )}

          {viewMode === 'my-library' && (
            <motion.div
              key="my-library"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <MyLibraryView />
            </motion.div>
          )}

          {viewMode === 'community' && (
            <motion.div
              key="community"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <CommunityView />
            </motion.div>
          )}

          {viewMode === 'admin' && (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <AdminDashboard />
            </motion.div>
          )}
        </AnimatePresence>}
      </main>

      {/* Global Footer */}
      <SiteFooter />

      {/* Reading Engine Layer (Active when a book is being read) */}
      {activeReaderBook && <ReadingEngine />}

      {/* Lazy modal units load only when their store state requests them. */}
      {isCommandPaletteOpen && <CommandPalette />}
      {isOnlineSearchOpen && <OnlineBookSearchModal isOpen={isOnlineSearchOpen} onClose={() => setOnlineSearchOpen(false)} />}
      {isReadingRitualOpen && <ReadingRitualModal />}
      {isQuoteStudioOpen && <QuoteStudio />}
      {(detailBook || route.kind === 'book') && <BookDetailModal />}
      {(detailAuthor || route.kind === 'author') && <AuthorDetailModal />}
      {isAuthModalOpen && <AuthModal />}
      <ToastContainer />
    </div></Suspense>
  );
}
