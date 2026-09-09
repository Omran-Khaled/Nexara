import React, { useState, useMemo, useCallback } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { translations } from '../../i18n/translations';
import { searchBooks } from '../../lib/searchEngine';
import { BookCard } from './BookCard';
import { Search, SlidersHorizontal, LayoutGrid, List, Columns3, Image as ImageIcon, RotateCcw, BookOpen } from 'lucide-react';

export const LibraryView: React.FC = () => {
  const { language, books, authors, requestStates, loadBackendData } = useAppStore();
  const catalogState = requestStates.catalog;

  const [searchQuery, setSearchQuery] = useState('');
  const [viewType, setViewType] = useState<'grid' | 'list' | 'compact' | 'cover-first'>('grid');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [selectedAuthor, setSelectedAuthor] = useState('All');
  const [selectedRights, setSelectedRights] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [sortBy, setSortBy] = useState<'popular' | 'newest' | 'rating' | 'downloads' | 'title'>('popular');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  const t = translations[language];
  const isAr = language === 'ar';

  // Distinct genres, languages, and difficulty values from books dataset
  const allGenres = useMemo(() => {
    return Array.from(new Set(books.flatMap((b) => (isAr ? b.genresAr : b.genres))));
  }, [books, isAr]);

  const allRightsStatuses = ['PUBLIC_DOMAIN', 'LICENSED', 'OPEN_ACCESS', 'RESTRICTED'];
  const allDifficulties = ['Accessible', 'Moderate', 'Demanding', 'Scholar'];

  // Memoized Filtered books to eliminate redundant calculations
  const filteredBooks = useMemo(() => {
    return searchBooks(books, {
      query: searchQuery,
      genre: selectedGenre,
      language: selectedLanguage,
      authorId: selectedAuthor,
      rightsStatus: selectedRights,
      difficulty: selectedDifficulty,
      sortBy,
    });
  }, [books, searchQuery, selectedGenre, selectedLanguage, selectedAuthor, selectedRights, selectedDifficulty, sortBy]);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedGenre('All');
    setSelectedLanguage('All');
    setSelectedAuthor('All');
    setSelectedRights('All');
    setSelectedDifficulty('All');
    setSortBy('popular');
  }, []);

  return (
    <div id="central-library-container" className="w-full space-y-6">
      
      {/* Library Banner */}
      <div className="p-6 rounded-3xl bg-[#0B1712] border border-[#173125] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#B89A5A]">
            <BookOpen className="w-3.5 h-3.5" />
            <span>{isAr ? 'المكتبة الرقمية الموثقة' : 'Verified Digital Library'}</span>
          </div>
          <h1 className="font-literary text-2xl sm:text-3xl font-bold text-[#E8E0CF]">
            {t.library.title}
          </h1>
          <p className="text-xs sm:text-sm text-[#89977C] leading-relaxed">
            {t.library.subtitle}
          </p>
        </div>

        {/* View Switchers (Grid / List / Compact / Cover-First) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-[#07110D] border border-[#173125]" role="group" aria-label={isAr ? 'طريقة عرض الكتب' : 'Book display style'}>
            <button
              onClick={() => setViewType('grid')}
              className={`p-2 rounded-lg text-xs transition-colors ${
                viewType === 'grid' ? 'bg-[#173125] text-[#D2BB82]' : 'text-[#89977C] hover:text-[#E8E0CF]'
              }`}
              title={t.library.grid}
              aria-label={t.library.grid}
              aria-pressed={viewType === 'grid'}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewType('list')}
              className={`p-2 rounded-lg text-xs transition-colors ${
                viewType === 'list' ? 'bg-[#173125] text-[#D2BB82]' : 'text-[#89977C] hover:text-[#E8E0CF]'
              }`}
              title={t.library.list}
              aria-label={t.library.list}
              aria-pressed={viewType === 'list'}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewType('compact')}
              className={`p-2 rounded-lg text-xs transition-colors ${
                viewType === 'compact' ? 'bg-[#173125] text-[#D2BB82]' : 'text-[#89977C] hover:text-[#E8E0CF]'
              }`}
              title={t.library.compact}
              aria-label={t.library.compact}
              aria-pressed={viewType === 'compact'}
            >
              <Columns3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewType('cover-first')}
              className={`p-2 rounded-lg text-xs transition-colors ${
                viewType === 'cover-first' ? 'bg-[#173125] text-[#D2BB82]' : 'text-[#89977C] hover:text-[#E8E0CF]'
              }`}
              title={t.library.coverFirst}
              aria-label={t.library.coverFirst}
              aria-pressed={viewType === 'cover-first'}
            >
              <ImageIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {catalogState.status === 'loading' && (
        <div className="px-4 py-3 rounded-2xl bg-[#10231A] border border-[#173125] text-xs text-[#89977C]" role="status">
          {isAr ? 'جارٍ تحميل الفهرس من الخادم…' : 'Loading the catalogue from the server…'}
        </div>
      )}
      {catalogState.status === 'error' && (
        <div className="p-4 rounded-2xl bg-[#2A1616] border border-[#6B3232] flex items-center justify-between gap-3 text-xs" role="alert">
          <span className="text-[#E8E0CF]">{isAr ? catalogState.error?.messageAr : catalogState.error?.message}</span>
          <button onClick={() => void loadBackendData()} className="px-3 py-1.5 rounded-lg bg-[#3D1F1F] hover:bg-[#512727] text-[#E8E0CF]">
            {isAr ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="p-4 rounded-2xl bg-[#0B1712] border border-[#173125] space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Main Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="absolute top-1/2 -translate-y-1/2 left-3 w-4 h-4 text-[#B89A5A]" aria-hidden="true" />
            <label htmlFor="library-search-input" className="sr-only">{isAr ? 'البحث في فهرس المكتبة' : 'Search the library catalog'}</label>
            <input
              id="library-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.library.searchPlaceholder}
              className="w-full bg-[#07110D] border border-[#173125] rounded-xl pl-9 pr-4 py-2.5 text-xs sm:text-sm text-[#E8E0CF] placeholder-[#89977C] focus:outline-none focus:border-[#687B61]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label={isAr ? 'مسح البحث' : 'Clear search'}
                className="absolute top-1/2 -translate-y-1/2 right-3 text-xs text-[#89977C] hover:text-[#E8E0CF]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              id="library-sort-select"
              aria-label={isAr ? 'ترتيب النتائج' : 'Sort results'}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#07110D] border border-[#173125] rounded-xl px-3 py-2.5 text-xs text-[#E8E0CF] focus:outline-none focus:border-[#687B61]"
            >
              <option value="popular">{t.library.popular}</option>
              <option value="newest">{t.library.newest}</option>
              <option value="rating">{t.library.highestRated}</option>
              <option value="downloads">{t.library.mostDownloaded}</option>
              <option value="title">{t.library.az}</option>
            </select>

            <button
              onClick={() => setIsFilterDrawerOpen(!isFilterDrawerOpen)}
              aria-expanded={isFilterDrawerOpen}
              aria-controls="library-filter-panel"
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
                isFilterDrawerOpen
                  ? 'bg-[#173125] border-[#B89A5A] text-[#D2BB82]'
                  : 'bg-[#07110D] border-[#173125] text-[#89977C] hover:text-[#E8E0CF]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{t.library.filterBy}</span>
            </button>
          </div>
        </div>

        {/* Multi-faceted Expanded Filters */}
        {isFilterDrawerOpen && (
          <div id="library-filter-panel" className="pt-3 border-t border-[#173125] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Genre Filter */}
            <div>
              <label htmlFor="library-filter-genre" className="text-[11px] font-semibold text-[#89977C] block mb-1">
                {t.library.genre}
              </label>
              <select
                id="library-filter-genre"
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="w-full bg-[#07110D] border border-[#173125] rounded-lg px-2.5 py-1.5 text-xs text-[#E8E0CF]"
              >
                <option value="All">{t.library.all}</option>
                {allGenres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Language Filter */}
            <div>
              <label htmlFor="library-filter-language" className="text-[11px] font-semibold text-[#89977C] block mb-1">
                {t.library.language}
              </label>
              <select
                id="library-filter-language"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full bg-[#07110D] border border-[#173125] rounded-lg px-2.5 py-1.5 text-xs text-[#E8E0CF]"
              >
                <option value="All">{t.library.all}</option>
                <option value="ar">{isAr ? 'العربية' : 'Arabic'}</option>
                <option value="en">{isAr ? 'الإنجليزية' : 'English'}</option>
                <option value="ru">{isAr ? 'الروسية' : 'Russian'}</option>
                <option value="de">{isAr ? 'الألمانية' : 'German'}</option>
                <option value="fa">{isAr ? 'الفارسية' : 'Persian'}</option>
              </select>
            </div>

            {/* Author Filter */}
            <div>
              <label htmlFor="library-filter-author" className="text-[11px] font-semibold text-[#89977C] block mb-1">
                {t.library.author}
              </label>
              <select
                id="library-filter-author"
                value={selectedAuthor}
                onChange={(e) => setSelectedAuthor(e.target.value)}
                className="w-full bg-[#07110D] border border-[#173125] rounded-lg px-2.5 py-1.5 text-xs text-[#E8E0CF]"
              >
                <option value="All">{t.library.all}</option>
                {authors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {isAr ? a.nameAr : a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Rights Status Filter */}
            <div>
              <label htmlFor="library-filter-rights" className="text-[11px] font-semibold text-[#89977C] block mb-1">
                {t.library.rightsStatus}
              </label>
              <select
                id="library-filter-rights"
                value={selectedRights}
                onChange={(e) => setSelectedRights(e.target.value)}
                className="w-full bg-[#07110D] border border-[#173125] rounded-lg px-2.5 py-1.5 text-xs text-[#E8E0CF]"
              >
                <option value="All">{t.library.all}</option>
                {allRightsStatuses.map((r) => (
                  <option key={r} value={r}>
                    {r.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty Filter */}
            <div>
              <label htmlFor="library-filter-difficulty" className="text-[11px] font-semibold text-[#89977C] block mb-1">
                {t.library.difficulty}
              </label>
              <select
                id="library-filter-difficulty"
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full bg-[#07110D] border border-[#173125] rounded-lg px-2.5 py-1.5 text-xs text-[#E8E0CF]"
              >
                <option value="All">{t.library.all}</option>
                {allDifficulties.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Results Bar */}
        <div className="flex items-center justify-between text-xs text-[#89977C] pt-1" role="status" aria-live="polite" aria-atomic="true">
          <div>
            <span className="font-mono text-[#D2BB82] font-semibold">{filteredBooks.length}</span>{' '}
            <span>{t.library.resultsFound}</span>
          </div>

          {(selectedGenre !== 'All' ||
            selectedLanguage !== 'All' ||
            selectedAuthor !== 'All' ||
            selectedRights !== 'All' ||
            selectedDifficulty !== 'All' ||
            searchQuery) && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-[#B89A5A] hover:text-[#D2BB82] font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t.library.resetFilters}</span>
            </button>
          )}
        </div>
      </div>

      {/* Books Container */}
      {catalogState.status === 'loading' && books.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5" role="status" aria-label={isAr ? 'جارٍ تحميل الكتب' : 'Loading books'}>
          {Array.from({ length: 8 }, (_, index) => <div key={index} className="rounded-2xl bg-[#0B1712] border border-[#173125] p-4 space-y-3 animate-pulse" aria-hidden="true"><div className="aspect-[3/4] rounded-xl bg-[#173125]" /><div className="h-4 rounded bg-[#173125] w-4/5" /><div className="h-3 rounded bg-[#173125] w-3/5" /></div>)}
        </div>
      ) : catalogState.status === 'empty' ? (
        <div className="p-12 text-center bg-[#0B1712] border border-[#173125] rounded-3xl space-y-3">
          <BookOpen className="w-10 h-10 text-[#687B61] mx-auto" />
          <h3 className="font-literary text-xl font-bold text-[#E8E0CF]">{isAr ? 'لا توجد كتب منشورة في الفهرس' : 'The server catalogue is empty'}</h3>
          <p className="text-xs sm:text-sm text-[#89977C] max-w-md mx-auto">{isAr ? 'لم يُرجع الخادم أي كتب في هذا الطلب.' : 'The server returned no books for this request.'}</p>
        </div>
      ) : filteredBooks.length > 0 ? (
        <div
          role="region"
          aria-label={isAr ? 'نتائج فهرس الكتب' : 'Book catalog results'}
          aria-busy={catalogState.status === 'loading'}
          className={
            viewType === 'compact'
              ? 'space-y-2'
              : viewType === 'list'
              ? 'space-y-4'
              : viewType === 'cover-first'
              ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4'
              : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5'
          }
        >
          {filteredBooks.map((book) => (
            <BookCard key={book.id} book={book} viewMode={viewType} />
          ))}
        </div>
      ) : (
        <div className="p-12 text-center bg-[#0B1712] border border-[#173125] rounded-3xl space-y-3">
          <BookOpen className="w-10 h-10 text-[#687B61] mx-auto" />
          <h3 className="font-literary text-xl font-bold text-[#E8E0CF]">
            {t.library.noBooksFound}
          </h3>
          <p className="text-xs sm:text-sm text-[#89977C] max-w-md mx-auto">
            {t.library.noBooksFoundSub}
          </p>
          <button
            onClick={resetFilters}
            className="mt-2 px-4 py-2 rounded-xl bg-[#173125] text-[#D2BB82] hover:bg-[#B89A5A] hover:text-[#07110D] font-semibold text-xs transition-colors"
          >
            {t.library.resetFilters}
          </button>
        </div>
      )}
    </div>
  );
};
