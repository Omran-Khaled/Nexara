import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { translations } from '../../i18n/translations';
import { BookChapter, HighlightColor, ReaderTheme, ReaderFontFamily } from '../../types';
import confetti from 'canvas-confetti';
import { X, ChevronLeft, ChevronRight, Bookmark, BookmarkCheck, Search, Settings, List, Flame, Quote, Check, Maximize2, Minimize2, Sun, Moon, TreePine, ArrowLeft } from 'lucide-react';
import { DownloadPanel } from '../library/DownloadPanel';
import { motion, AnimatePresence } from 'motion/react';
import { progressFromViewport } from '../../reader/readingPersistence';
import { chaptersApi } from '../../api/chapters';

export const ReadingEngine: React.FC = () => {
  const {
    activeReaderBook,
    closeReader,
    readerSettings,
    updateReaderSettings,
    language,
    addHighlight,
    bookmarks,
    addBookmark,
    removeBookmark,
    updateReadingProgress,
    readingProgress,
    markBookFinished,
    finishedBookIds,
    setQuoteStudioOpen,
    setReadingRitualOpen,
    addToast,
    requestStates,
    progressSync,
    retryReadingProgress,
  } = useAppStore();

  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionPopup, setSelectionPopup] = useState<{
    visible: boolean;
    text: string;
    x: number;
    y: number;
  }>({ visible: false, text: '', x: 0, y: 0 });
  const [noteDraft, setNoteDraft] = useState('');
  const [isNoteInputOpen, setIsNoteInputOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadedChapters, setLoadedChapters] = useState<Record<string, BookChapter>>({});
  const chapterAbortRef = useRef<AbortController | null>(null);
  const [chapterRetryToken, setChapterRetryToken] = useState(0);
  const [chapterLoadFailed, setChapterLoadFailed] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPersistedScroll = useRef(-1);
  const sessionStartedAt = useRef(Date.now());

  const t = translations[language];
  const isAr = language === 'ar';

  if (!activeReaderBook) return null;

  const chapters = activeReaderBook.chapters || [];
  const currentChapterIndex = readerSettings.currentChapterIndex || 0;
  const chapterKey = `${activeReaderBook.id}:${currentChapterIndex}`;
  const currentChapter = loadedChapters[chapterKey] || chapters[currentChapterIndex] || chapters[0] || {
    id: 'ch-default',
    pageNumber: 1,
    title: 'Text Passage',
    titleAr: 'النص الأدبي',
    content: 'No content available.',
    contentAr: 'لا يوجد محتوى متاح.',
  };
  const totalChapters = Math.max(chapters.length, 1);
  const isPreview = activeReaderBook.contentAvailability === 'PREVIEW';
  useEffect(() => {
    const localChapter = chapters[currentChapterIndex];
    if (!activeReaderBook.id || !Number.isInteger(currentChapterIndex) || loadedChapters[chapterKey] || !localChapter) return;
    chapterAbortRef.current?.abort();
    const controller = new AbortController();
    chapterAbortRef.current = controller;
    void chaptersApi.get(activeReaderBook.id, currentChapterIndex, controller.signal).then(({ data }) => {
      if (!controller.signal.aborted) {
        setLoadedChapters((cache) => ({ ...cache, [chapterKey]: data }));
        setChapterLoadFailed(false);
      }
    }).catch(() => { if (!controller.signal.aborted) setChapterLoadFailed(true); });
    return () => controller.abort();
  }, [activeReaderBook.id, currentChapterIndex, chapterKey, chapterRetryToken]);
  const progressState = requestStates.progress;
  const syncState = progressSync[activeReaderBook.id];

  const isBookmarked = bookmarks.some(
    (b) => b.bookId === activeReaderBook.id && b.chapterIndex === currentChapterIndex
  );
  const isFinished = finishedBookIds.includes(activeReaderBook.id);

  // Restore the saved chapter offset and persist chapter transitions.
  useEffect(() => {
    const restore = () => {
      const saved = readingProgress[activeReaderBook.id];
      const savedPercent = saved?.currentChapterIndex === currentChapterIndex ? saved.currentScrollPercent : 0;
      const element = contentRef.current;
      if (element) element.scrollTop = Math.max(0, element.scrollHeight - element.clientHeight) * savedPercent / 100;
      lastPersistedScroll.current = savedPercent;
      const completed = Math.round(((currentChapterIndex + savedPercent / 100) / totalChapters) * 100);
      updateReadingProgress(activeReaderBook.id, currentChapterIndex, savedPercent, completed, 0);
      if (completed === 100 && !isFinished) { markBookFinished(activeReaderBook.id); confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } }); }
    };
    const frame = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(frame);
  }, [currentChapterIndex, activeReaderBook.id, totalChapters]);

  // Persist scroll position and accumulated reading time without a request per pixel.
  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;
    const handleScroll = () => {
      const percent = progressFromViewport(element);
      if (Math.abs(percent - lastPersistedScroll.current) < 1 && Date.now() - sessionStartedAt.current < 15000) return;
      if (scrollPersistTimer.current) clearTimeout(scrollPersistTimer.current);
      scrollPersistTimer.current = setTimeout(() => {
        const elapsed = Math.max(0, Math.floor((Date.now() - sessionStartedAt.current) / 1000));
        const completed = Math.round(((currentChapterIndex + percent / 100) / totalChapters) * 100);
        updateReadingProgress(activeReaderBook.id, currentChapterIndex, percent, completed, elapsed);
        lastPersistedScroll.current = percent;
        sessionStartedAt.current = Date.now();
      }, 700);
    };
    element.addEventListener('scroll', handleScroll, { passive: true });
    const interval = window.setInterval(handleScroll, 15000);
    return () => { element.removeEventListener('scroll', handleScroll); window.clearInterval(interval); if (scrollPersistTimer.current) clearTimeout(scrollPersistTimer.current); };
  }, [activeReaderBook.id, currentChapterIndex, totalChapters]);

  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setSelectionPopup((prev) => ({ ...prev, visible: false }));
        return;
      }

      const selectedText = selection.toString().trim();
      if (selectedText.length < 3) return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setSelectionPopup({
        visible: true,
        text: selectedText,
        x: rect.left + rect.width / 2,
        y: Math.max(10, rect.top - 50),
      });
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const handleCreateHighlight = (color: HighlightColor) => {
    if (!selectionPopup.text) return;
    addHighlight({
      bookId: activeReaderBook.id,
      bookTitle: activeReaderBook.title,
      authorName: activeReaderBook.authorName,
      chapterIndex: currentChapterIndex,
      chapterTitle: currentChapter.title,
      selectedText: selectionPopup.text,
      color,
      note: noteDraft || undefined,
    });
    setSelectionPopup({ visible: false, text: '', x: 0, y: 0 });
    setNoteDraft('');
    setIsNoteInputOpen(false);
    addToast('Passage saved to your Memory Grove.', 'تم حفظ الاقتباس في دوحة الذاكرة.', 'success');
  };

  const handleCreateQuoteCard = () => {
    if (!selectionPopup.text) return;
    setQuoteStudioOpen(true, {
      id: 'temp-quote',
      bookId: activeReaderBook.id,
      bookTitle: isAr ? activeReaderBook.titleAr : activeReaderBook.title,
      authorName: isAr ? activeReaderBook.authorNameAr : activeReaderBook.authorName,
      chapterIndex: currentChapterIndex,
      chapterTitle: currentChapter.title,
      selectedText: selectionPopup.text,
      color: 'gold',
      createdAt: new Date().toISOString(),
    });
    setSelectionPopup({ visible: false, text: '', x: 0, y: 0 });
  };

  const handleToggleBookmark = () => {
    if (isBookmarked) {
      const mark = bookmarks.find(
        (b) => b.bookId === activeReaderBook.id && b.chapterIndex === currentChapterIndex
      );
      if (mark) removeBookmark(mark.id);
    } else {
      addBookmark({
        bookId: activeReaderBook.id,
        editionId: activeReaderBook.editions?.[0]?.id ?? '',
        chapterIndex: currentChapterIndex,
        progressPercent: 0,
        title: isAr ? currentChapter.titleAr : currentChapter.title,
      });
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const getThemeClass = (theme: ReaderTheme) => {
    switch (theme) {
      case 'paper':
        return 'theme-paper text-[#2C2416] bg-[#F7F3E9]';
      case 'night':
        return 'theme-night text-[#D8D4CF] bg-[#0E1110]';
      case 'forest':
      default:
        return 'theme-forest text-[#E8E0CF] bg-[#07110D]';
    }
  };

  const getFontFamilyClass = (font: ReaderFontFamily) => {
    switch (font) {
      case 'serif':
        return 'font-literary';
      case 'sans':
        return 'font-sans';
      case 'amiri':
        return 'font-amiri';
      case 'amiri-quran':
        return 'font-amiri-quran';
      case 'mono':
        return 'font-mono';
      default:
        return 'font-literary';
    }
  };

  const chapterContent = isAr ? currentChapter.contentAr : currentChapter.content;

  return (
    <div
      ref={containerRef}
      id="reading-engine-viewport"
      className={`fixed inset-0 z-50 flex flex-col transition-colors duration-300 ${getThemeClass(
        readerSettings.theme
      )}`}
      style={{ direction: isAr ? 'rtl' : 'ltr' }}
    >
      {/* Top Reader Navigation Bar */}
      <header className="h-16 px-4 sm:px-6 border-b border-current/10 flex items-center justify-between gap-4 shrink-0 backdrop-blur-md bg-current/5">
        
        {/* Back button & Book title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            id="reader-exit-button"
            onClick={closeReader}
            className="p-2 rounded-xl border border-current/20 hover:bg-current/10 transition-colors flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{isAr ? 'خروج' : 'Exit'}</span>
          </button>

          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-bold font-literary truncate">
              {isAr ? activeReaderBook.titleAr : activeReaderBook.title}
            </h1>
            <div className="text-[11px] opacity-70 truncate">
              {isAr ? currentChapter.titleAr : currentChapter.title}
            </div>
            {isPreview && (
              <div className="text-[9px] font-mono text-[#B89A5A]">
                {isAr ? 'مقتطفات معاينة — ليست نصاً كاملاً' : 'PREVIEW EXCERPTS — NOT FULL TEXT'}
              </div>
            )}
          </div>
        </div>

        {/* Reader Controls Toolbar */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {syncState?.pending && progressState.status === 'loading' && <span className="hidden md:inline text-[10px] opacity-70" role="status">{isAr ? 'جارٍ حفظ التقدم…' : 'Saving progress…'}</span>}
          {syncState?.lastError && (
            <button onClick={() => retryReadingProgress(activeReaderBook.id)} className="hidden md:inline px-2 py-1 rounded-lg border border-[#A34B4B]/60 text-[10px] text-[#E7A1A1] hover:bg-[#A34B4B]/10" title={isAr ? syncState.lastError.messageAr : syncState.lastError.message}>
              {isAr ? 'إعادة حفظ التقدم' : 'Retry progress'}
            </button>
          )}
          {/* Table of contents */}
          <button
            id="reader-toc-trigger"
            onClick={() => setIsTocOpen(!isTocOpen)}
            className={`p-2 rounded-xl border border-current/20 transition-colors ${
              isTocOpen ? 'bg-current/20 font-bold' : 'hover:bg-current/10'
            }`}
            title={t.reader.toc}
          >
            <List className="w-4 h-4" />
          </button>

          {/* Reading Ritual timer */}
          <button
            id="reader-ritual-trigger"
            onClick={() => setReadingRitualOpen(true)}
            className="p-2 rounded-xl border border-current/20 hover:bg-current/10 transition-colors"
            title={t.reader.ritual}
          >
            <Flame className="w-4 h-4 text-[#B89A5A]" />
          </button>

          {/* Search inside chapter */}
          <button
            id="reader-search-trigger"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className={`p-2 rounded-xl border border-current/20 transition-colors ${
              isSearchOpen ? 'bg-current/20 font-bold' : 'hover:bg-current/10'
            }`}
            title="Search in chapter"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Bookmark page */}
          <button
            id="reader-bookmark-trigger"
            onClick={handleToggleBookmark}
            className={`p-2 rounded-xl border border-current/20 transition-colors ${
              isBookmarked ? 'bg-[#B89A5A]/30 text-[#D2BB82]' : 'hover:bg-current/10'
            }`}
            title={isBookmarked ? t.reader.removeBookmark : t.reader.addBookmark}
          >
            {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          </button>

          <div className="hidden lg:block max-w-[360px]">
            <DownloadPanel bookId={activeReaderBook.id} editionId={activeReaderBook.editions[0]?.id || ''} title={activeReaderBook.title} titleAr={activeReaderBook.titleAr} compact />
          </div>

          {/* Typography Settings Menu */}
          <button
            id="reader-settings-trigger"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`p-2 rounded-xl border border-current/20 transition-colors ${
              isSettingsOpen ? 'bg-current/20 font-bold' : 'hover:bg-current/10'
            }`}
            title="Typography & Appearance"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="hidden sm:flex p-2 rounded-xl border border-current/20 hover:bg-current/10 transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Reading Canvas & Scroll Container */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Table of Contents Drawer */}
        <AnimatePresence>
          {isTocOpen && (
            <motion.div
              initial={{ x: isAr ? 300 : -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: isAr ? 300 : -300, opacity: 0 }}
              className={`w-72 sm:w-80 h-full border-current/10 bg-current/5 backdrop-blur-xl p-4 overflow-y-auto z-30 shrink-0 ${
                isAr ? 'border-l' : 'border-r'
              }`}
            >
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-current/10">
                <span className="text-xs font-bold font-literary uppercase tracking-wider">
                  {t.reader.toc} ({totalChapters})
                </span>
                <button onClick={() => setIsTocOpen(false)} className="p-1 opacity-70 hover:opacity-100">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                {chapters.map((ch, idx) => (
                  <button
                    key={ch.id}
                    onClick={() => {
                      updateReaderSettings({ currentChapterIndex: idx });
                      setIsTocOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-xs transition-colors ${
                      currentChapterIndex === idx
                        ? 'bg-[#B89A5A]/20 font-bold border border-[#B89A5A]/40'
                        : 'hover:bg-current/10 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-[10px] font-mono opacity-60">
                        {isAr ? `فصل ${idx + 1}` : `Chapter ${idx + 1}`}
                      </div>
                      <div className="truncate font-literary">{isAr ? ch.titleAr : ch.title}</div>
                    </div>
                    {currentChapterIndex === idx && <Check className="w-4 h-4 text-[#D2BB82]" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Text Content Area */}
        <div ref={contentRef} data-reader-scroll-container="true" className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-8 py-8 sm:py-12 flex justify-center">
          <div
            className={`w-full transition-all duration-300 ${getFontFamilyClass(readerSettings.fontFamily)}`}
            style={{
              maxWidth: `${readerSettings.contentWidth}px`,
              fontSize: `${readerSettings.fontSize}px`,
              lineHeight: readerSettings.lineHeight,
              textAlign: readerSettings.textAlign,
            }}
          >
            {/* Chapter Header */}
            <div className="text-center mb-10 pb-6 border-b border-current/10">
              <div className="text-xs font-mono uppercase tracking-widest opacity-60 mb-2">
                {isAr ? `الفصل ${currentChapterIndex + 1} من ${totalChapters}` : `Chapter ${currentChapterIndex + 1} of ${totalChapters}`}
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-literary">
                {isAr ? currentChapter.titleAr : currentChapter.title}
              </h2>
            </div>

            {chapterLoadFailed && !loadedChapters[chapterKey] && (
              <div role="alert" className="mb-4 p-3 rounded-2xl bg-current/10 border border-current/20 flex items-center justify-between gap-2">
                <span className="text-xs opacity-80">{isAr ? 'تعذّر تحميل فصل هذا الكتاب من الخادم؛ تُعرض نسخة مؤقتة.' : 'This chapter could not be fetched from the server; showing a temporary copy.'}</span>
                <button type="button" onClick={() => setChapterRetryToken((token) => token + 1)} className="shrink-0 px-2.5 py-1 rounded-lg border border-current/20 text-xs opacity-90 hover:bg-current/10">{isAr ? 'إعادة المحاولة' : 'Retry'}</button>
              </div>
            )}

            {/* In-Chapter Search Filter Input (if active) */}
            {isSearchOpen && (
              <div className="mb-6 p-3 rounded-2xl bg-current/10 border border-current/20 flex items-center gap-2">
                <Search className="w-4 h-4 opacity-70" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isAr ? 'ابحث عن كلمة في هذا الفصل...' : 'Search within this chapter...'}
                  className="w-full bg-transparent text-sm focus:outline-none placeholder-current/50"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-xs opacity-70">
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* Chapter Body Paragraphs */}
            <div className="flex flex-col leading-relaxed selection:bg-[#B89A5A]/30" style={{ gap: `${readerSettings.paragraphSpacing}px` }}>
              {chapterContent.split('\n\n').map((paragraph, pIdx) => {
                if (searchQuery.trim()) {
                  const parts = paragraph.split(new RegExp(`(${searchQuery})`, 'gi'));
                  return (
                    <p key={pIdx}>
                      {parts.map((part, i) =>
                        part.toLowerCase() === searchQuery.toLowerCase() ? (
                          <mark key={i} className="bg-[#B89A5A] text-[#07110D] font-bold px-1 rounded">
                            {part}
                          </mark>
                        ) : (
                          part
                        )
                      )}
                    </p>
                  );
                }
                return <p key={pIdx}>{paragraph}</p>;
              })}
            </div>

            {/* Chapter Bottom Navigation */}
            <div className="mt-16 pt-8 border-t border-current/10 flex items-center justify-between gap-4">
              <button
                disabled={currentChapterIndex === 0}
                onClick={() => updateReaderSettings({ currentChapterIndex: currentChapterIndex - 1 })}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-current/20 hover:bg-current/10 disabled:opacity-30 disabled:pointer-events-none transition-colors text-xs font-semibold"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{t.reader.prevChapter}</span>
              </button>

              <div className="text-xs font-mono opacity-70">
                {Math.round(((currentChapterIndex + 1) / totalChapters) * 100)}% {isAr ? 'مكتمل' : 'completed'}
              </div>

              <button
                disabled={currentChapterIndex === totalChapters - 1}
                onClick={() => updateReaderSettings({ currentChapterIndex: currentChapterIndex + 1 })}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-current/20 hover:bg-current/10 disabled:opacity-30 disabled:pointer-events-none transition-colors text-xs font-semibold"
              >
                <span>{t.reader.nextChapter}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Text Selection Floating Action Toolbar */}
        <AnimatePresence>
          {selectionPopup.visible && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{
                position: 'fixed',
                left: `${selectionPopup.x}px`,
                top: `${selectionPopup.y}px`,
                transform: 'translate(-50%, -100%)',
              }}
              className="z-50 p-2 rounded-2xl bg-[#0B1712] border border-[#B89A5A]/60 shadow-2xl backdrop-blur-xl flex flex-col gap-2 text-[#E8E0CF]"
            >
              <div className="flex items-center gap-1.5">
                {/* 4 Ink Highlights */}
                {(['gold', 'moss', 'burgundy', 'blue'] as HighlightColor[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => handleCreateHighlight(c)}
                    className={`w-6 h-6 rounded-full border border-white/20 transition-transform hover:scale-125 ${
                      c === 'gold'
                        ? 'bg-[#B89A5A]'
                        : c === 'moss'
                        ? 'bg-[#687B61]'
                        : c === 'burgundy'
                        ? 'bg-[#8B3A3A]'
                        : 'bg-[#3A6B8B]'
                    }`}
                    title={`Highlight in ${c}`}
                  />
                ))}

                <div className="w-[1px] h-5 bg-[#173125] mx-1" />

                {/* Turn into Quote Card */}
                <button
                  onClick={handleCreateQuoteCard}
                  className="p-1.5 rounded-lg hover:bg-[#173125] text-[#D2BB82] flex items-center gap-1 text-xs font-medium"
                  title="Make Quote Card"
                >
                  <Quote className="w-3.5 h-3.5" />
                  <span>{isAr ? 'بطاقة' : 'Card'}</span>
                </button>

                {/* Add Note Button */}
                <button
                  onClick={() => setIsNoteInputOpen(!isNoteInputOpen)}
                  className="p-1.5 rounded-lg hover:bg-[#173125] text-[#89977C] hover:text-[#E8E0CF] text-xs font-medium"
                  title="Add Reflection Note"
                >
                  {isAr ? 'ملاحظة' : 'Note'}
                </button>
              </div>

              {/* Collapsible note input */}
              {isNoteInputOpen && (
                <div className="pt-2 border-t border-[#173125] flex items-center gap-1.5">
                  <input
                    type="text"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder={isAr ? 'اكتب ملاحظتك على هذا النص...' : 'Write your thought...'}
                    className="w-48 bg-[#07110D] border border-[#173125] rounded-lg px-2 py-1 text-xs text-[#E8E0CF] focus:outline-none"
                  />
                  <button
                    onClick={() => handleCreateHighlight('gold')}
                    className="px-2 py-1 rounded bg-[#B89A5A] text-[#07110D] font-bold text-xs"
                  >
                    {isAr ? 'حفظ' : 'Save'}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Drawer */}
        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div
              initial={{ x: isAr ? -320 : 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: isAr ? -320 : 320, opacity: 0 }}
              className={`w-72 sm:w-80 h-full border-current/10 bg-current/5 backdrop-blur-xl p-5 overflow-y-auto z-30 shrink-0 space-y-6 ${
                isAr ? 'border-r' : 'border-l'
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-current/10">
                <span className="text-xs font-bold uppercase tracking-wider">{t.reader.appearance}</span>
                <button onClick={() => setIsSettingsOpen(false)} className="p-1 opacity-70 hover:opacity-100">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Themes: Paper, Night, Forest */}
              <div className="space-y-2">
                <label className="text-xs font-semibold opacity-70 block">{t.reader.theme}</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => updateReaderSettings({ theme: 'paper' })}
                    className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                      readerSettings.theme === 'paper'
                        ? 'border-[#B89A5A] bg-[#F7F3E9] text-[#2C2416] shadow-md font-bold'
                        : 'border-current/20 opacity-70'
                    }`}
                  >
                    <Sun className="w-4 h-4 text-[#B89A5A]" />
                    <span>{t.reader.themePaper}</span>
                  </button>

                  <button
                    onClick={() => updateReaderSettings({ theme: 'forest' })}
                    className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                      readerSettings.theme === 'forest'
                        ? 'border-[#B89A5A] bg-[#07110D] text-[#E8E0CF] shadow-md font-bold'
                        : 'border-current/20 opacity-70'
                    }`}
                  >
                    <TreePine className="w-4 h-4 text-[#687B61]" />
                    <span>{t.reader.themeForest}</span>
                  </button>

                  <button
                    onClick={() => updateReaderSettings({ theme: 'night' })}
                    className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                      readerSettings.theme === 'night'
                        ? 'border-[#B89A5A] bg-[#0E1110] text-[#D8D4CF] shadow-md font-bold'
                        : 'border-current/20 opacity-70'
                    }`}
                  >
                    <Moon className="w-4 h-4 text-[#89977C]" />
                    <span>{t.reader.themeNight}</span>
                  </button>
                </div>
              </div>

              {/* Typography / Font Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold opacity-70 block">{t.reader.fontFamily}</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'serif', label: 'Playfair / Literata' },
                    { id: 'amiri', label: 'Amiri Naskh (أميري)' },
                    { id: 'amiri-quran', label: 'Amiri Quran (قرآني)' },
                    { id: 'sans', label: 'Plus Jakarta Sans' },
                  ].map((font) => (
                    <button
                      key={font.id}
                      onClick={() => updateReaderSettings({ fontFamily: font.id as any })}
                      className={`p-2.5 rounded-xl border text-xs text-center transition-all ${
                        readerSettings.fontFamily === font.id
                          ? 'border-[#B89A5A] bg-current/15 font-bold'
                          : 'border-current/20 opacity-70 hover:opacity-100'
                      }`}
                    >
                      {font.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs opacity-80">
                  <span>{t.reader.fontSize}</span>
                  <span className="font-mono">{readerSettings.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="14"
                  max="28"
                  value={readerSettings.fontSize}
                  onChange={(e) => updateReaderSettings({ fontSize: parseInt(e.target.value) })}
                  className="w-full h-1 bg-current/20 rounded-lg appearance-none cursor-pointer accent-[#B89A5A]"
                />
              </div>

              {/* Line Height Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs opacity-80">
                  <span>{t.reader.lineHeight}</span>
                  <span className="font-mono">{readerSettings.lineHeight}</span>
                </div>
                <input
                  type="range"
                  min="1.4"
                  max="2.4"
                  step="0.1"
                  value={readerSettings.lineHeight}
                  onChange={(e) => updateReaderSettings({ lineHeight: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-current/20 rounded-lg appearance-none cursor-pointer accent-[#B89A5A]"
                />
              </div>

              {/* Content Width Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs opacity-80">
                  <span>{t.reader.margins}</span>
                  <span className="font-mono">{readerSettings.contentWidth}px</span>
                </div>
                <input
                  type="range"
                  min="550"
                  max="950"
                  step="50"
                  value={readerSettings.contentWidth}
                  onChange={(e) => updateReaderSettings({ contentWidth: parseInt(e.target.value) })}
                  className="w-full h-1 bg-current/20 rounded-lg appearance-none cursor-pointer accent-[#B89A5A]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold opacity-70 block">{isAr ? 'محاذاة النص' : 'Text alignment'}</label>
                <div className="grid grid-cols-4 gap-1">
                  {(['left', 'right', 'justify', 'center'] as const).map((align) => (
                    <button key={align} onClick={() => updateReaderSettings({ textAlign: align })} className={`p-2 rounded-lg border text-[10px] ${readerSettings.textAlign === align ? 'border-[#B89A5A] bg-current/15 font-bold' : 'border-current/20 opacity-70'}`}>
                      {align === 'left' ? 'L' : align === 'right' ? 'R' : align === 'justify' ? 'J' : 'C'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs opacity-80"><span>{isAr ? 'مسافة الفقرات' : 'Paragraph spacing'}</span><span className="font-mono">{readerSettings.paragraphSpacing}px</span></div>
                <input type="range" min="8" max="48" step="4" value={readerSettings.paragraphSpacing} onChange={(e) => updateReaderSettings({ paragraphSpacing: parseInt(e.target.value) })} className="w-full h-1 bg-current/20 rounded-lg appearance-none cursor-pointer accent-[#B89A5A]" />
              </div>

              <label className="flex items-center justify-between gap-3 text-xs font-semibold opacity-80 cursor-pointer">
                <span>{isAr ? 'تمرير مستمر بين الفصول' : 'Continuous reading mode'}</span>
                <input type="checkbox" checked={readerSettings.continuousScroll} onChange={(e) => updateReaderSettings({ continuousScroll: e.target.checked })} className="accent-[#B89A5A]" />
              </label>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
