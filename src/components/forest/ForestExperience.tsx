import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { BRAND_CONFIG } from '../../config/brand';
import { translations } from '../../i18n/translations';
import { Book } from '../../types';
import { MemoryGrove } from './MemoryGrove';
import { CinematicForestCanvas } from './CinematicForestCanvas';
import { TreePine, BookOpen, Sparkles, Compass, Bookmark, ChevronRight, X, Feather, Moon, Sun, Archive, Waves } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const ForestExperience: React.FC = () => {
  const {
    language,
    books,
    selectedRegionId,
    setSelectedRegionId,
    setViewMode,
    openBookInReader,
    toggleSaveBook,
    savedBookIds,
    setDetailBook,
    readingProgress,
  } = useAppStore();

  const [activeGroveTab, setActiveGroveTab] = useState<'forest' | 'memory-grove'>('forest');
  const [hoveredBook, setHoveredBook] = useState<Book | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<Book | null>(null);

  const t = translations[language];
  const isAr = language === 'ar';

  const regions = BRAND_CONFIG.forestRegions;

  // Memoize filtered books to optimize re-renders
  const displayedBooks = useMemo(() => {
    return selectedRegionId === 'all'
      ? books
      : books.filter((b) => b.forestRegion === selectedRegionId);
  }, [books, selectedRegionId]);

  const getRegionIcon = (iconName: string) => {
    switch (iconName) {
      case 'Compass':
        return <Compass className="w-4 h-4 text-[#B89A5A]" />;
      case 'TreePine':
        return <TreePine className="w-4 h-4 text-[#687B61]" />;
      case 'Feather':
        return <Feather className="w-4 h-4 text-[#89977C]" />;
      case 'Waves':
        return <Waves className="w-4 h-4 text-[#D2BB82]" />;
      case 'Moon':
        return <Moon className="w-4 h-4 text-[#4A2528]" />;
      case 'Archive':
        return <Archive className="w-4 h-4 text-[#BDB5A5]" />;
      case 'Sun':
        return <Sun className="w-4 h-4 text-[#89977C]" />;
      default:
        return <TreePine className="w-4 h-4 text-[#89977C]" />;
    }
  };

  return (
    <div id="forest-experience-container" className="w-full flex flex-col gap-6">
      
      {/* Top Banner / Hero & View Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-[#0B1712] border border-[#173125] relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-radial from-[#173125]/40 to-transparent blur-3xl pointer-events-none" />

        <div className="space-y-1 relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-[#B89A5A] uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAr ? 'مشهد الغابة الحية' : 'Living Forest Experience'}</span>
          </div>
          <h1 className="font-literary text-2xl sm:text-3xl md:text-4xl font-bold text-[#E8E0CF]">
            {isAr ? BRAND_CONFIG.heroTitleAr : BRAND_CONFIG.heroTitle}
          </h1>
          <p className="text-xs sm:text-sm text-[#89977C] leading-relaxed">
            {isAr ? BRAND_CONFIG.heroSubtitleAr : BRAND_CONFIG.heroSubtitle}
          </p>
        </div>

        {/* Forest Switcher */}
        <div className="flex flex-wrap items-center gap-2 relative z-10">
          <div className="flex items-center p-1 rounded-xl bg-[#07110D] border border-[#173125]">
            <button
              id="forest-tab-toggle-main"
              onClick={() => setActiveGroveTab('forest')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeGroveTab === 'forest'
                  ? 'bg-[#173125] text-[#E8E0CF] font-semibold shadow'
                  : 'text-[#89977C] hover:text-[#E8E0CF]'
              }`}
            >
              {t.forest.title}
            </button>
            <button
              id="forest-tab-toggle-grove"
              onClick={() => setActiveGroveTab('memory-grove')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeGroveTab === 'memory-grove'
                  ? 'bg-[#173125] text-[#D2BB82] font-semibold shadow'
                  : 'text-[#89977C] hover:text-[#E8E0CF]'
              }`}
            >
              <TreePine className="w-3 h-3 text-[#D2BB82]" />
              <span>{t.forest.memoryGrove}</span>
            </button>
          </div>

          <button
            id="forest-switch-to-library-btn"
            onClick={() => setViewMode('library')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#10231A] hover:bg-[#173125] border border-[#687B61]/50 text-xs font-semibold text-[#E8E0CF] transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#B89A5A]" />
            <span>{t.forest.switchBack}</span>
          </button>
        </div>
      </div>

        {activeGroveTab === 'memory-grove' ? (
          <MemoryGrove />
        ) : (
          <>
            {/* Region Selector */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                id="forest-region-pill-all"
                onClick={() => setSelectedRegionId('all')}
                className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                  selectedRegionId === 'all'
                    ? 'bg-[#173125] border-[#B89A5A]/60 text-[#E8E0CF] shadow'
                    : 'bg-[#0B1712] border-[#173125] text-[#89977C] hover:text-[#E8E0CF]'
                }`}
              >
                {t.forest.allRegions} ({books.length})
              </button>
              {regions.map((region) => {
                const regionBooksCount = books.filter((b) => b.forestRegion === region.id).length;
                return (
                  <button
                    key={region.id}
                    id={`forest-region-pill-${region.id}`}
                    onClick={() => setSelectedRegionId(region.id)}
                    className={`shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                      selectedRegionId === region.id
                        ? 'bg-[#173125] border-[#B89A5A]/60 text-[#D2BB82] shadow font-semibold'
                        : 'bg-[#0B1712] border-[#173125] text-[#89977C] hover:text-[#E8E0CF]'
                    }`}
                  >
                    {getRegionIcon(region.icon)}
                    <span>{isAr ? region.nameAr : region.name}</span>
                    <span className="text-[10px] font-mono opacity-60">({regionBooksCount})</span>
                  </button>
                );
              })}
            </div>

            {/* Living Cinematic Forest & Interactive Nodes */}
            <div className="relative w-full h-[620px] rounded-3xl border border-[#173125] bg-[#07110D] overflow-hidden shadow-2xl">
              
              {/* 60FPS Living Trees Engine */}
              <CinematicForestCanvas className="absolute inset-0 w-full h-full" showControls={true} />

              {/* Interactive Book Waypoints in the Forest */}
              <div className="absolute inset-0 p-6 z-20 pointer-events-none">
                {displayedBooks.map((book) => {
                  const isHovered = hoveredBook?.id === book.id;
                  const progress = readingProgress[book.id]?.completedPercent || 0;

                  return (
                    <motion.div
                      key={book.id}
                      id={`forest-book-waypoint-${book.id}`}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.5 }}
                      style={{
                        position: 'absolute',
                        left: `${book.forestCoords.x}%`,
                        top: `${book.forestCoords.y}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      onMouseEnter={() => setHoveredBook(book)}
                      onMouseLeave={() => setHoveredBook(null)}
                      onClick={() => setSelectedDestination(book)}
                      className="cursor-pointer group select-none pointer-events-auto"
                    >
                    {/* Glowing Aura Ring */}
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isHovered
                          ? 'bg-[#B89A5A]/30 scale-125 glow-gold border border-[#D2BB82]'
                          : 'bg-[#10231A]/90 border border-[#687B61]/50 group-hover:border-[#B89A5A]/80 shadow-lg'
                      }`}
                    >
                      <BookOpen
                        className={`w-5 h-5 transition-colors ${
                          isHovered ? 'text-[#D2BB82]' : 'text-[#89977C] group-hover:text-[#E8E0CF]'
                        }`}
                      />
                    </div>

                    {/* Miniature Title Label */}
                    <div className="mt-1.5 text-center">
                      <div className="text-[11px] font-semibold text-[#E8E0CF] bg-[#07110D]/90 px-2 py-0.5 rounded-md border border-[#173125] whitespace-nowrap shadow-md">
                        {isAr ? book.titleAr : book.title}
                      </div>
                      {progress > 0 && (
                        <div className="text-[9px] font-mono text-[#D2BB82] mt-0.5">
                          {progress}% {isAr ? 'مقروء' : 'read'}
                        </div>
                      )}
                    </div>

                    {/* Tooltip on Hover */}
                    <AnimatePresence>
                      {isHovered && !selectedDestination && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 5, scale: 0.95 }}
                          className={`absolute bottom-full mb-3 w-64 p-3 rounded-2xl bg-[#0B1712]/95 border border-[#B89A5A]/50 shadow-2xl backdrop-blur-md z-30 pointer-events-none ${
                            book.forestCoords.x > 50 ? '-translate-x-3/4' : '-translate-x-1/4'
                          }`}
                        >
                          <div className="flex gap-3">
                            <img
                              src={book.coverImage}
                              alt={book.title}
                              className="w-12 h-16 object-cover rounded-lg border border-[#173125]"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-[#E8E0CF] truncate">
                                {isAr ? book.titleAr : book.title}
                              </div>
                              <div className="text-[11px] text-[#89977C] truncate">
                                {isAr ? book.authorNameAr : book.authorName}
                              </div>
                              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[#D2BB82]">
                                <span>★ {book.rating}</span>
                                <span>•</span>
                                <span>{book.genres[0]}</span>
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 text-[10px] text-[#BDB5A5] line-clamp-2">
                            {isAr ? book.descriptionAr : book.description}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            {/* Destination Arrived Drawer / Modal */}
            <AnimatePresence>
              {selectedDestination && (
                <motion.div
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 50 }}
                  className="absolute bottom-6 left-6 right-6 max-w-2xl mx-auto p-5 rounded-2xl bg-[#0B1712]/95 border border-[#B89A5A]/60 shadow-2xl backdrop-blur-xl z-40"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <img
                        src={selectedDestination.coverImage}
                        alt={selectedDestination.title}
                        className="w-16 h-22 sm:w-20 sm:h-28 object-cover rounded-xl shadow-lg border border-[#687B61]/40 shrink-0"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#173125] text-[#D2BB82] border border-[#B89A5A]/30">
                            {t.forest.arrivedAt}
                          </span>
                          <span className="text-xs text-[#89977C]">{selectedDestination.genres[0]}</span>
                        </div>
                        <h3 className="font-literary text-lg sm:text-xl font-bold text-[#E8E0CF]">
                          {isAr ? selectedDestination.titleAr : selectedDestination.title}
                        </h3>
                        <p className="text-xs text-[#89977C]">
                          {isAr ? selectedDestination.authorNameAr : selectedDestination.authorName} • {selectedDestination.publicationYear}
                        </p>
                        <p className="text-xs text-[#BDB5A5] line-clamp-2 pt-1">
                          {isAr ? selectedDestination.descriptionAr : selectedDestination.description}
                        </p>
                      </div>
                    </div>

                    <button
                      id="forest-close-destination-drawer"
                      onClick={() => setSelectedDestination(null)}
                      className="p-1.5 rounded-lg bg-[#07110D] text-[#89977C] hover:text-[#E8E0CF] transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Actions inside Destination */}
                  <div className="mt-4 pt-3 border-t border-[#173125] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        id="forest-read-destination-btn"
                        onClick={() => {
                          openBookInReader(selectedDestination);
                          setSelectedDestination(null);
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#B89A5A] hover:bg-[#D2BB82] text-[#07110D] font-bold text-xs transition-colors shadow-lg"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{t.book.readNow}</span>
                      </button>

                      <button
                        id="forest-save-destination-btn"
                        onClick={() => toggleSaveBook(selectedDestination.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                          savedBookIds.includes(selectedDestination.id)
                            ? 'bg-[#173125] border-[#B89A5A] text-[#D2BB82]'
                            : 'bg-[#10231A] border-[#173125] text-[#89977C] hover:text-[#E8E0CF]'
                        }`}
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>{savedBookIds.includes(selectedDestination.id) ? t.book.saved : t.book.save}</span>
                      </button>
                    </div>

                    <button
                      id="forest-details-destination-btn"
                      onClick={() => {
                        setDetailBook(selectedDestination);
                        setSelectedDestination(null);
                      }}
                      className="flex items-center gap-1 text-xs text-[#89977C] hover:text-[#D2BB82] transition-colors font-medium"
                    >
                      <span>{t.book.about}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
};
