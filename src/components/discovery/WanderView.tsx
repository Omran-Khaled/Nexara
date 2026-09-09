import React, { useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { translations } from '../../i18n/translations';
import { getWanderBook } from '../../lib/recommendations';
import { Compass, Sparkles, BookOpen, Bookmark, RotateCcw, ArrowRight, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const WanderView: React.FC = () => {
  const { books, language, openBookInReader, toggleSaveBook, savedBookIds, setDetailBook } = useAppStore();

  const [wanderSeed, setWanderSeed] = useState(() => Date.now());
  const t = translations[language];
  const isAr = language === 'ar';

  const serendipityResult = getWanderBook(books, [], wanderSeed);
  const book = serendipityResult.book;
  const isSaved = savedBookIds.includes(book.id);

  const handleWanderAgain = () => {
    setWanderSeed((previousSeed) => previousSeed + 1);
  };

  return (
    <div id="wander-view-container" className="w-full max-w-4xl mx-auto space-y-6 py-4">
      
      {/* Header */}
      <div className="text-center space-y-2 max-w-xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10231A] border border-[#173125] text-xs font-mono text-[#B89A5A] uppercase tracking-wider">
          <Compass className="w-3.5 h-3.5" />
          <span>{isAr ? 'التجوال الحُر في الغابة' : 'Quiet Forest Wander'}</span>
        </div>
        <h1 className="font-literary text-2xl sm:text-3xl md:text-4xl font-bold text-[#E8E0CF]">
          {isAr ? 'خذني إلى ركن غير متوقع' : 'Take Me Somewhere Unexpected'}
        </h1>
        <p className="text-xs sm:text-sm text-[#89977C]">
          {isAr
            ? 'خوارزمية قطعية لا تعتمد على الإعلانات أو الترويج التجاري، بل تهديك إلى كنوز أدبية خفية.'
            : 'A calm serendipity engine guided by literary depth and historical weight, not advertisements or trends.'}
        </p>
      </div>

      {/* Literary Sanctuary Discovery Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${book.id}-${wanderSeed}`}
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.96 }}
          transition={{ duration: 0.3 }}
          className="p-6 sm:p-8 rounded-3xl bg-[#0B1712] border border-[#B89A5A]/50 shadow-2xl space-y-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-80 h-80 bg-radial from-[#173125]/50 to-transparent blur-3xl pointer-events-none" />

          {/* Rationale Tag */}
          <div className="flex items-center gap-2 text-xs font-mono text-[#D2BB82] bg-[#07110D] border border-[#173125] px-3.5 py-1.5 rounded-xl w-fit">
            <Sparkles className="w-3.5 h-3.5 text-[#B89A5A]" />
            <span>{isAr ? serendipityResult.reasonAr : serendipityResult.reason}</span>
          </div>

          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10">
            {/* Book Cover */}
            <div className="relative group shrink-0">
              <img
                src={book.coverImage}
                alt={book.title}
                className="w-36 h-52 sm:w-44 sm:h-64 object-cover rounded-2xl border border-[#687B61]/50 shadow-2xl"
              />
              <div className="absolute top-2 right-2">
                <button
                  onClick={() => toggleSaveBook(book.id)}
                  className={`p-2 rounded-xl backdrop-blur-md border ${
                    isSaved
                      ? 'bg-[#173125] border-[#B89A5A] text-[#D2BB82]'
                      : 'bg-[#07110D]/80 border-[#173125] text-[#89977C]'
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Book Context Details */}
            <div className="space-y-4 text-center md:text-left flex-1">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#173125] text-[#D2BB82]">
                    {book.genres[0]}
                  </span>
                  <span className="text-xs text-[#89977C]">{book.readingDifficulty}</span>
                  <span className="text-xs text-[#D2BB82] flex items-center gap-1 font-mono">
                    <Star className="w-3.5 h-3.5 fill-[#D2BB82]" />
                    <span>{book.rating}</span>
                  </span>
                </div>

                <h2 className="font-literary text-2xl sm:text-3xl font-bold text-[#E8E0CF]">
                  {isAr ? book.titleAr : book.title}
                </h2>

                <div className="text-sm text-[#89977C]">
                  {isAr ? book.authorNameAr : book.authorName} • {book.publicationYear}
                </div>
              </div>

              <p className="text-xs sm:text-sm text-[#BDB5A5] leading-relaxed">
                {isAr ? book.descriptionAr : book.description}
              </p>

              {/* Themes */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 pt-2">
                {(isAr ? book.themesAr : book.themes).map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-1 rounded-lg bg-[#07110D] border border-[#173125] text-xs text-[#89977C]"
                  >
                    {t}
                  </span>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-4 border-t border-[#173125]">
                <button
                  onClick={() => openBookInReader(book)}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#B89A5A] hover:bg-[#D2BB82] text-[#07110D] font-bold text-xs sm:text-sm transition-colors shadow-lg"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>{t.book.readNow}</span>
                </button>

                <button
                  onClick={() => setDetailBook(book)}
                  className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-[#10231A] hover:bg-[#173125] border border-[#173125] text-xs text-[#E8E0CF] font-semibold transition-colors"
                >
                  <span>{t.book.about}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Wander Again Trigger */}
      <div className="text-center pt-2">
        <button
          id="wander-again-btn"
          onClick={handleWanderAgain}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#0B1712] hover:bg-[#10231A] border border-[#173125] hover:border-[#687B61] text-xs font-semibold text-[#E8E0CF] transition-colors"
        >
          <RotateCcw className="w-4 h-4 text-[#B89A5A]" />
          <span>{isAr ? 'تجول إلى ركن آخر في الغابة' : 'Wander to Another Corner'}</span>
        </button>
      </div>
    </div>
  );
};
