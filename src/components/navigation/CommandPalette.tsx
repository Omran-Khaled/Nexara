import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { searchBooks } from '../../lib/searchEngine';
import { Search, BookOpen, User, Sparkles, Compass, Flame, Globe, ShieldAlert, ArrowRight, X } from 'lucide-react';
import { motion } from 'motion/react';
import { AccessibleDialog } from '../ui/AccessibleDialog';

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    books,
    authors,
    readingPaths,
    language,
    setLanguage,
    setViewMode,
    openBookInReader,
    setDetailBook,
    setDetailAuthor,
    setDetailPath,
    setReadingRitualOpen,
    setQuoteStudioOpen,
  } = useAppStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<HTMLButtonElement[]>([]);

  const isAr = language === 'ar';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setSelectedIndex(0);
    } else {
      setQuery('');
    }
  }, [isCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const matchingBooks = searchBooks(books, { query, sortBy: 'popular' }).slice(0, 4);
  const matchingAuthors = authors
    .filter(
      (a) =>
        a.name.toLowerCase().includes(query.toLowerCase()) ||
        a.nameAr.includes(query) ||
        query.toLowerCase().includes(a.slug)
    )
    .slice(0, 3);
  const matchingPaths = readingPaths
    .filter((p) => p.title.toLowerCase().includes(query.toLowerCase()) || p.titleAr.includes(query))
    .slice(0, 3);

  const actions = [
    {
      id: 'act-wander',
      title: 'Take Me Somewhere Unexpected (Wander)',
      titleAr: 'خذني إلى مكان غير متوقع (تجوال هادئ)',
      icon: <Compass className="w-4 h-4 text-[#B89A5A]" />,
      action: () => {
        setViewMode('wander');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'act-moods',
      title: 'Discover Literature by Mood',
      titleAr: 'اكتشف الكتب حسب الحالة المزاجية',
      icon: <Sparkles className="w-4 h-4 text-[#89977C]" />,
      action: () => {
        setViewMode('moods');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'act-ritual',
      title: 'Start a Focused Reading Ritual',
      titleAr: 'بدء طقس القراءة المركزة الهادئة',
      icon: <Flame className="w-4 h-4 text-[#D2BB82]" />,
      action: () => {
        setReadingRitualOpen(true);
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'act-quotes',
      title: 'Open Quote Card Studio',
      titleAr: 'فتح استوديو بطاقات الاقتباسات',
      icon: <BookOpen className="w-4 h-4 text-[#687B61]" />,
      action: () => {
        setQuoteStudioOpen(true);
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'act-lang',
      title: language === 'en' ? 'Switch Interface to Arabic (العربية)' : 'Switch Interface to English',
      titleAr: language === 'ar' ? 'التبديل إلى الواجهة الإنجليزية (English)' : 'التبديل إلى العربية',
      icon: <Globe className="w-4 h-4 text-[#B89A5A]" />,
      action: () => {
        setLanguage(language === 'en' ? 'ar' : 'en');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'act-admin',
      title: 'Open CMS & Rights Dashboard',
      titleAr: 'لوحة التحكم وإدارة الحقوق والنشر (CMS)',
      icon: <ShieldAlert className="w-4 h-4 text-[#4A2528]" />,
      action: () => {
        setViewMode('admin');
        setCommandPaletteOpen(false);
      },
    },
  ];

  const optionCount = matchingBooks.length + matchingAuthors.length + matchingPaths.length + actions.length;
  const focusResult = (index: number) => {
    if (!optionCount) return;
    const normalized = (index + optionCount) % optionCount;
    setSelectedIndex(normalized);
    resultRefs.current[normalized]?.focus();
  };
  const onPaletteKeyDown = (event: React.KeyboardEvent) => {
    if (!optionCount) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); focusResult((resultRefs.current.indexOf(document.activeElement as HTMLButtonElement) + 1 + optionCount) % optionCount); }
    if (event.key === 'ArrowUp') { event.preventDefault(); const current = resultRefs.current.indexOf(document.activeElement as HTMLButtonElement); focusResult(current <= 0 ? optionCount - 1 : current - 1); }
    if (event.key === 'Home') { event.preventDefault(); focusResult(0); }
    if (event.key === 'End') { event.preventDefault(); focusResult(optionCount - 1); }
    if (event.key === 'Enter' && document.activeElement === inputRef.current) { event.preventDefault(); resultRefs.current[selectedIndex]?.click(); }
  };

  return (
    <AccessibleDialog open={isCommandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} title={isAr ? 'البحث والأوامر' : 'Search and commands'} initialFocusRef={inputRef} className="w-full max-w-2xl" backdropClassName="items-start p-4 sm:p-6 md:p-20">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -20 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-2xl bg-[#0B1712] border border-[#173125] rounded-2xl shadow-2xl overflow-hidden text-[#E8E0CF]"
        onKeyDown={onPaletteKeyDown}
      >
        {/* Search Header */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#173125] gap-3 bg-[#07110D]/60">
          <Search className="w-5 h-5 text-[#B89A5A] shrink-0" />
          <input
            ref={inputRef}
            id="command-palette-input"
            type="text"
            role="combobox"
            aria-label={isAr ? 'البحث في Nexara' : 'Search Nexara'}
            aria-controls="command-palette-results"
            aria-expanded="true"
            aria-autocomplete="list"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isAr ? 'ابحث في الكتب، المؤلفين، المسارات، الإجراءات...' : 'Search books, authors, paths, actions...'}
            className="w-full bg-transparent text-sm sm:text-base text-[#E8E0CF] placeholder-[#89977C] focus:outline-none"
          />
          <button
            onClick={() => setCommandPaletteOpen(false)}
            aria-label={isAr ? 'إغلاق لوحة الأوامر' : 'Close command palette'}
            className="p-1 rounded-lg hover:bg-[#10231A] text-[#89977C] hover:text-[#E8E0CF] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results Body */}
        <div id="command-palette-results" role="listbox" aria-label={isAr ? 'نتائج البحث والإجراءات' : 'Search results and actions'} className="max-h-[65vh] overflow-y-auto p-3 space-y-4">
          
          {/* Books Section */}
          {matchingBooks.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-[#89977C] uppercase tracking-wider px-3 mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3 h-3 text-[#B89A5A]" />
                <span>{isAr ? 'الكتب والأعمال الأدبية' : 'Books & Literary Works'}</span>
              </div>
              <div className="space-y-1">
                {matchingBooks.map((book) => (
                  <button
                    key={book.id}
                    ref={(node) => { if (node) resultRefs.current[matchingBooks.indexOf(book)] = node; }}
                    role="option"
                    aria-selected={selectedIndex === matchingBooks.indexOf(book)}
                    onClick={() => {
                      setDetailBook(book);
                      setCommandPaletteOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#10231A] transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={book.coverImage}
                        alt={book.title}
                        className="w-8 h-11 object-cover rounded shadow border border-[#173125]"
                      />
                      <div>
                        <div className="text-sm font-medium text-[#E8E0CF] group-hover:text-[#D2BB82] transition-colors">
                          {isAr ? book.titleAr : book.title}
                        </div>
                        <div className="text-xs text-[#89977C]">
                          {isAr ? book.authorNameAr : book.authorName} • {book.publicationYear}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#173125] text-[#D2BB82]">
                        ★ {book.rating}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#687B61] group-hover:text-[#E8E0CF] transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Authors Section */}
          {matchingAuthors.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-[#89977C] uppercase tracking-wider px-3 mb-1.5 flex items-center gap-1.5">
                <User className="w-3 h-3 text-[#89977C]" />
                <span>{isAr ? 'المؤلفون والمفكرون' : 'Authors & Thinkers'}</span>
              </div>
              <div className="space-y-1">
                {matchingAuthors.map((author) => (
                  <button
                    key={author.id}
                    ref={(node) => { if (node) resultRefs.current[matchingBooks.length + matchingAuthors.indexOf(author)] = node; }}
                    role="option"
                    aria-selected={selectedIndex === matchingBooks.length + matchingAuthors.indexOf(author)}
                    onClick={() => {
                      setDetailAuthor(author);
                      setCommandPaletteOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#10231A] transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={author.avatar}
                        alt={author.name}
                        className="w-8 h-8 rounded-full object-cover border border-[#173125]"
                      />
                      <div>
                        <div className="text-sm font-medium text-[#E8E0CF] group-hover:text-[#D2BB82] transition-colors">
                          {isAr ? author.nameAr : author.name}
                        </div>
                        <div className="text-xs text-[#89977C]">{isAr ? author.eraAr : author.era}</div>
                      </div>
                    </div>
                    <span className="text-xs text-[#687B61]">{isAr ? author.countryAr : author.country}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reading Paths */}
          {matchingPaths.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-[#89977C] uppercase tracking-wider px-3 mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#D2BB82]" />
                <span>{isAr ? 'مسارات القراءة' : 'Reading Paths'}</span>
              </div>
              <div className="space-y-1">
                {matchingPaths.map((path) => (
                  <button
                    key={path.id}
                    ref={(node) => { if (node) resultRefs.current[matchingBooks.length + matchingAuthors.length + matchingPaths.indexOf(path)] = node; }}
                    role="option"
                    aria-selected={selectedIndex === matchingBooks.length + matchingAuthors.length + matchingPaths.indexOf(path)}
                    onClick={() => {
                      setDetailPath(path);
                      setCommandPaletteOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#10231A] transition-colors text-left group"
                  >
                    <div>
                      <div className="text-sm font-medium text-[#E8E0CF] group-hover:text-[#D2BB82]">
                        {isAr ? path.titleAr : path.title}
                      </div>
                      <div className="text-xs text-[#89977C]">{isAr ? path.subtitleAr : path.subtitle}</div>
                    </div>
                    <span className="text-xs text-[#B89A5A] font-mono">{path.estimatedHours}h</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div>
            <div className="text-[11px] font-semibold text-[#89977C] uppercase tracking-wider px-3 mb-1.5 flex items-center gap-1.5">
              <Compass className="w-3 h-3 text-[#B89A5A]" />
              <span>{isAr ? 'إجراءات سريعة' : 'Quick Actions'}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {actions.map((act) => (
                <button
                  key={act.id}
                  ref={(node) => { if (node) resultRefs.current[matchingBooks.length + matchingAuthors.length + matchingPaths.length + actions.indexOf(act)] = node; }}
                  role="option"
                  aria-selected={selectedIndex === matchingBooks.length + matchingAuthors.length + matchingPaths.length + actions.indexOf(act)}
                  onClick={act.action}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#10231A] transition-colors text-left group text-xs text-[#BDB5A5] hover:text-[#E8E0CF]"
                >
                  <div className="p-1.5 rounded-lg bg-[#07110D] border border-[#173125] group-hover:border-[#687B61]/40">
                    {act.icon}
                  </div>
                  <span>{isAr ? act.titleAr : act.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 border-t border-[#173125] bg-[#07110D]/80 flex items-center justify-between text-[11px] text-[#89977C]">
          <span>{isAr ? 'اضغط ESC للإغلاق' : 'Press ESC to exit'}</span>
          <span className="font-mono text-[#D2BB82]">{isAr ? 'نظام بحث قطعي دقيق' : 'Deterministic Search Engine'}</span>
        </div>
      </motion.div>
    </AccessibleDialog>
  );
};
