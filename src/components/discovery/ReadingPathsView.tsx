import React, { useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { translations } from '../../i18n/translations';
import { ReadingPath, Book } from '../../types';
import { Sparkles, Clock, BookOpen, CheckCircle } from 'lucide-react';

export const ReadingPathsView: React.FC = () => {
  const {
    readingPaths,
    books,
    language,
    openBookInReader,
    readingProgress,
    detailPath,
    route,
    setDetailPath,
    setViewMode,
  } = useAppStore();

  const [selectedPath, setSelectedPath] = useState<ReadingPath | null>(detailPath || readingPaths[0] || null);

  const t = translations[language];
  const isAr = language === 'ar';

  const routePath = route.kind === 'path' ? readingPaths.find((path) => path.id === route.pathId) || (detailPath?.id === route.pathId ? detailPath : null) : null;
  const activePath = routePath || selectedPath || detailPath || readingPaths[0];

  const getStepBook = (bookId: string): Book | undefined => {
    return books.find((b) => b.id === bookId);
  };

  if (!activePath) {
    return (
      <div id="reading-paths-container" className="w-full max-w-3xl mx-auto space-y-6">
        <div className="p-6 rounded-3xl bg-[#0B1712] border border-[#173125] space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#D2BB82]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAr ? 'مسارات القراءة المنهجية' : 'Editorial Reading Paths'}</span>
          </div>
          <h1 className="font-literary text-2xl sm:text-3xl font-bold text-[#E8E0CF]">{t.paths.title}</h1>
          <p className="text-xs sm:text-sm text-[#89977C]">{t.paths.subtitle}</p>
        </div>
        <section className="p-8 sm:p-12 rounded-3xl bg-[#07110D] border border-[#173125] text-center space-y-4" aria-live="polite">
          <Sparkles className="w-10 h-10 mx-auto text-[#B89A5A]" aria-hidden="true" />
          <h2 className="font-literary text-xl font-bold text-[#E8E0CF]">{isAr ? 'لا توجد مسارات قراءة منشورة حالياً' : 'No reading paths are published yet'}</h2>
          <p className="max-w-lg mx-auto text-sm leading-relaxed text-[#89977C]">{isAr ? 'يجري فريق التحرير إعداد رحلات قراءة موثقة. يمكنك في هذه الأثناء استكشاف الأعمال المنشورة وبدء القراءة مباشرة.' : 'The editorial team is preparing verified reading journeys. In the meantime, explore the published works and begin reading directly.'}</p>
          <button onClick={() => setViewMode('library')} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#B89A5A] hover:bg-[#D2BB82] text-[#07110D] font-bold text-sm transition-colors">
            <BookOpen className="w-4 h-4" aria-hidden="true" />
            <span>{isAr ? 'استكشف المكتبة' : 'Explore the library'}</span>
          </button>
        </section>
      </div>
    );
  }

  return (
    <div id="reading-paths-container" className="w-full space-y-6">
      
      {/* Header */}
      <div className="p-6 rounded-3xl bg-[#0B1712] border border-[#173125] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#D2BB82]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAr ? 'مسارات القراءة المنهجية' : 'Editorial Reading Paths'}</span>
          </div>
          <h1 className="font-literary text-2xl sm:text-3xl font-bold text-[#E8E0CF]">
            {t.paths.title}
          </h1>
          <p className="text-xs sm:text-sm text-[#89977C]">
            {t.paths.subtitle}
          </p>
        </div>
      </div>

      {/* Main Path Explorer Layout: Paths Sidebar (Left) & Active Path Timeline (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Paths Selector (Left) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-semibold text-[#89977C] uppercase tracking-wider px-1">
            {isAr ? 'جميع المسارات المتاحة' : 'Curated Journeys'} ({readingPaths.length})
          </div>

          <div className="space-y-2">
            {readingPaths.map((path) => {
              const isSelected = path.id === activePath.id;
              return (
                <button
                  key={path.id}
                  onClick={() => {
                    setSelectedPath(path);
                    setDetailPath(path);
                  }}
                  aria-current={isSelected ? 'true' : undefined}
                  className={`w-full p-4 rounded-2xl border text-left transition-all duration-200 flex items-start gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D2BB82] ${
                    isSelected
                      ? 'bg-[#173125] border-[#B89A5A] shadow-lg text-[#E8E0CF]'
                      : 'bg-[#0B1712] border-[#173125] text-[#89977C] hover:text-[#E8E0CF] hover:border-[#687B61]/60'
                  }`}
                >
                  <img
                    src={path.coverImage}
                    alt={path.title}
                    className="w-12 h-16 object-cover rounded-lg border border-[#173125] shrink-0"
                  />
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#07110D] text-[#D2BB82]">
                        {path.difficulty}
                      </span>
                      <span className="text-[10px] text-[#89977C] font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{path.estimatedHours}h</span>
                      </span>
                    </div>

                    <div className="text-sm font-bold truncate">
                      {isAr ? path.titleAr : path.title}
                    </div>

                    <div className="text-xs opacity-75 line-clamp-1">
                      {isAr ? path.subtitleAr : path.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Path Deep Timeline (Right) */}
        <div className="lg:col-span-8 p-6 sm:p-8 rounded-3xl bg-[#0B1712] border border-[#173125] space-y-6">
          <div className="space-y-2 pb-6 border-b border-[#173125]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#173125] text-[#D2BB82]">
                {activePath.difficulty}
              </span>
              <span className="text-xs text-[#89977C] flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5" />
                <span>{activePath.estimatedHours} {isAr ? 'ساعات قراءة' : 'hours total'}</span>
              </span>
              <span className="text-xs text-[#89977C]">
                • {(activePath.steps || []).length} {isAr ? 'محطات معرفية' : 'Milestones'}
              </span>
            </div>

            <h2 className="font-literary text-2xl sm:text-3xl font-bold text-[#E8E0CF]">
              {isAr ? activePath.titleAr : activePath.title}
            </h2>

            <p className="text-sm text-[#89977C] leading-relaxed">
              {isAr ? activePath.descriptionAr : activePath.description}
            </p>
          </div>

          {/* Stepped Timeline */}
          <div className="space-y-6 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-[#173125]">
            {(activePath.steps || []).map((step, idx) => {
              const book = getStepBook(step.bookId);
              const progress = book ? readingProgress[book.id]?.completedPercent || 0 : 0;

              return (
                <div key={step.id} className="relative flex items-start gap-4 sm:gap-6 group">
                  {/* Step Number Dot */}
                  <div
                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-mono font-bold text-xs shrink-0 z-10 ${
                      progress === 100
                        ? 'bg-[#173125] border-[#687B61] text-[#D2BB82]'
                        : 'bg-[#0B1712] border-[#B89A5A]/60 text-[#E8E0CF]'
                    }`}
                  >
                    {progress === 100 ? <CheckCircle className="w-4 h-4 text-[#89977C]" /> : idx + 1}
                  </div>

                  {/* Step Card Content */}
                  <div className="flex-1 p-5 rounded-2xl bg-[#07110D] border border-[#173125] group-hover:border-[#687B61]/60 transition-colors space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-[#B89A5A]">
                          {isAr ? `المحطة ${idx + 1}` : `Milestone ${idx + 1}`}
                        </span>
                        <h4 className="text-base font-bold font-literary text-[#E8E0CF]">
                          {isAr ? step.stepTitleAr : step.stepTitle}
                        </h4>
                      </div>

                      <span className="text-xs font-mono text-[#89977C] shrink-0">
                        {step.estimatedMinutes} mins
                      </span>
                    </div>

                    <p className="text-xs text-[#BDB5A5] italic">
                      "{isAr ? step.curatorNoteAr : step.curatorNote}"
                    </p>

                    {/* Book Attachment */}
                    {book && (
                      <div className="p-3 rounded-xl bg-[#0B1712] border border-[#173125] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={book.coverImage}
                            alt={book.title}
                            className="w-10 h-14 object-cover rounded shadow"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[#E8E0CF] truncate">
                              {isAr ? book.titleAr : book.title}
                            </div>
                            <div className="text-[11px] text-[#89977C] truncate">
                              {isAr ? book.authorNameAr : book.authorName}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => openBookInReader(book)}
                            className="px-3 py-1.5 rounded-lg bg-[#B89A5A] hover:bg-[#D2BB82] text-[#07110D] font-bold text-xs transition-colors flex items-center gap-1"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>{t.book.readNow}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
