import React, { useState } from 'react';
import { useEffect, useRef } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { translations } from '../../i18n/translations';
import { getRecommendationsForBook } from '../../lib/recommendations';
import { X, BookOpen, Bookmark, Star, ShieldCheck, ChevronRight, UserRound } from 'lucide-react';
import { DownloadPanel } from './DownloadPanel';
import { motion } from 'motion/react';
import { AccessibleDialog } from '../ui/AccessibleDialog';

export const BookDetailModal: React.FC = () => {
  const {
    detailBook,
    route,
    setDetailBook,
    closeRouteOverlay,
    books,
    authors,
    language,
    openBookInReader,
    toggleSaveBook,
    savedBookIds,
    addToast,
    readingProgress,
    reviews,
    addReview,
    setDetailAuthor,
    requestStates,
    loadBookDetail,
    loadReviews,
  } = useAppStore();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const routedBook = route.kind === 'book' ? books.find((book) => book.id === route.bookId) || (detailBook?.id === route.bookId ? detailBook : null) : null;
  const displayedBook = route.kind === 'book' ? routedBook : detailBook;

  const [activeTab, setActiveTab] = useState<'about' | 'editions' | 'chapters' | 'recommendations' | 'reviews'>('about');
  const [selectedEditionId, setSelectedEditionId] = useState<string>('');
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewTitle, setNewReviewTitle] = useState('');
  const [newReviewContent, setNewReviewContent] = useState('');

  const t = translations[language];
  const isAr = language === 'ar';

  useEffect(() => {
    if (!displayedBook) return;
    void loadBookDetail(displayedBook.id);
    void loadReviews(displayedBook.id);
    // Store actions are recreated on render; the resource id is the intended dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedBook?.id]);

  if (!displayedBook) {
    if (route.kind !== 'book') return null;
    const catalogState = requestStates.catalog;
    const missing = catalogState.status === 'success' || catalogState.status === 'empty' || catalogState.status === 'error';
    return (
      <AccessibleDialog open onClose={closeRouteOverlay} title={isAr ? 'تفاصيل الكتاب' : 'Book details'} className="w-full max-w-md rounded-3xl bg-[#0B1712] border border-[#173125] p-6 text-[#E8E0CF] shadow-2xl">
        <div className="space-y-4 text-center">
          <h2 className="font-literary text-xl font-bold">{missing ? (isAr ? 'الكتاب غير متاح' : 'Book unavailable') : (isAr ? 'جارٍ فتح الكتاب…' : 'Opening book…')}</h2>
          <p className="text-sm text-[#89977C]" role={missing ? 'alert' : 'status'}>{missing ? (isAr ? 'قد يكون الرابط غير صحيح أو أن الكتاب لم يعد متاحاً في الفهرس.' : 'The link may be incorrect or this book is no longer available in the catalog.') : (isAr ? 'نسترجع بيانات هذا الكتاب من الفهرس.' : 'Retrieving this book from the catalog.')}</p>
          <button onClick={closeRouteOverlay} className="px-4 py-2 rounded-xl bg-[#173125] text-[#D2BB82] text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D2BB82]">{isAr ? 'العودة إلى المكتبة' : 'Return to library'}</button>
        </div>
      </AccessibleDialog>
    );
  }

  const author = authors.find((a) => a.id === displayedBook.authorId);
  const isSaved = savedBookIds.includes(displayedBook.id);
  const editions = displayedBook.editions || [];
  const chapters = displayedBook.chapters || [];
  const activeEdition = editions.find((e) => e.id === selectedEditionId) || editions[0] || {
    id: 'default-ed',
    isbn: 'N/A',
    language: 'en',
    languageName: 'Original Edition',
    languageNameAr: 'النسخة الأصلية',
    publicationYear: displayedBook.publicationYear || 2024,
    publisher: 'Nexara Digital Press',
    rightsStatus: 'PUBLIC_DOMAIN',
    licenseType: 'Public Domain',
    attribution: 'Verified Digital Edition',
    source: 'Nexara Heritage Archive',
    pageCount: 100,
    estimatedMinutes: 180,
    files: [],
  };
  const bookReviews = reviews.filter((r) => r.bookId === displayedBook.id);
  const detailState = requestStates.details[displayedBook.id];
  const reviewsState = requestStates.reviews[displayedBook.id];
  const recommendations = getRecommendationsForBook(displayedBook, books, Object.values(readingProgress));

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewContent.trim()) return;
    const saved = await addReview(displayedBook.id, newReviewRating, newReviewTitle || 'Reader Reflection', newReviewContent);
    if (!saved) return;
    setNewReviewTitle('');
    setNewReviewContent('');
    addToast('Your review has been published to the community.', 'تم نشر مراجعتك الأدبية في المجتمع.', 'success');
  };

  return (
    <AccessibleDialog open onClose={closeRouteOverlay} title={isAr ? `تفاصيل ${displayedBook.titleAr}` : `${displayedBook.title} details`} initialFocusRef={closeButtonRef} className="w-full max-w-4xl my-8 max-h-[90vh]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-4xl bg-[#0B1712] border border-[#173125] rounded-3xl shadow-2xl overflow-hidden text-[#E8E0CF] my-8 max-h-[90vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-[#07110D]/90 border-b border-[#173125] flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-4">
            <img
              src={displayedBook.coverImage}
              alt={isAr ? displayedBook.titleAr : displayedBook.title}
              className="w-18 h-26 sm:w-24 sm:h-34 object-cover rounded-xl border border-[#687B61]/40 shadow-xl shrink-0"
            />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#173125] text-[#D2BB82] border border-[#B89A5A]/30">
                  {displayedBook.genres[0]}
                </span>
                <span className="text-xs text-[#89977C]">{displayedBook.readingDifficulty}</span>
                <span className="text-xs text-[#D2BB82] flex items-center gap-1 font-mono">
                  <Star className="w-3.5 h-3.5 fill-[#D2BB82]" />
                  <span>{displayedBook.rating}</span>
                  <span className="text-[#89977C]">({displayedBook.ratingsCount})</span>
                </span>
              </div>

              <h2 className="font-literary text-xl sm:text-2xl font-bold text-[#E8E0CF]">
                {isAr ? displayedBook.titleAr : displayedBook.title}
              </h2>

              <div className="flex items-center gap-2 text-xs sm:text-sm text-[#89977C]">
                <span>{isAr ? 'تأليف:' : 'By:'}</span>
                <button
                  onClick={() => {
                    if (author) {
                      setDetailAuthor(author);
                    }
                  }}
                  className="text-[#D2BB82] hover:underline font-semibold"
                >
                  {isAr ? displayedBook.authorNameAr : displayedBook.authorName}
                </button>
                <span>•</span>
                <span>{displayedBook.publicationYear}</span>
              </div>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            id="book-detail-close-btn"
            onClick={closeRouteOverlay}
            aria-label={isAr ? 'إغلاق تفاصيل الكتاب' : 'Close book details'}
            className="p-2 rounded-xl bg-[#10231A] hover:bg-[#173125] text-[#89977C] hover:text-[#E8E0CF] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {(detailState?.status === 'loading' || reviewsState?.status === 'loading') && (
          <div className="px-6 py-2 text-xs text-[#89977C] bg-[#10231A]" role="status">{isAr ? 'جارٍ تحديث بيانات الكتاب…' : 'Refreshing book data…'}</div>
        )}
        {(detailState?.status === 'error' || reviewsState?.status === 'error') && (
          <div className="px-6 py-2 text-xs text-[#E7A1A1] bg-[#2A1616]" role="alert">{isAr ? (detailState?.error?.messageAr || reviewsState?.error?.messageAr) : (detailState?.error?.message || reviewsState?.error?.message)}</div>
        )}

        {/* Primary Action Bar */}
        <div className="px-6 py-3 bg-[#10231A]/60 border-b border-[#173125] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              id="detail-read-now-btn"
              onClick={() => {
                openBookInReader(displayedBook, activeEdition.id);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#B89A5A] hover:bg-[#D2BB82] text-[#07110D] font-bold text-xs sm:text-sm transition-colors shadow-lg"
            >
              <BookOpen className="w-4 h-4" />
              <span>{t.book.readNow}</span>
            </button>

            <button
              id="detail-save-btn"
              onClick={() => toggleSaveBook(displayedBook.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-colors ${
                isSaved
                  ? 'bg-[#173125] border-[#B89A5A] text-[#D2BB82]'
                  : 'bg-[#0B1712] border-[#173125] text-[#89977C] hover:text-[#E8E0CF]'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              <span>{isSaved ? t.book.saved : t.book.save}</span>
            </button>
          </div>

          <div className="min-w-[220px]">
            <DownloadPanel bookId={displayedBook.id} editionId={activeEdition.id} title={displayedBook.title} titleAr={displayedBook.titleAr} compact />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-[#173125] bg-[#07110D]/40 shrink-0 overflow-x-auto">
          {[
            { id: 'about', label: t.book.about },
            { id: 'editions', label: `${t.book.editions} (${editions.length})` },
            { id: 'chapters', label: `${t.book.contents} (${chapters.length})` },
            { id: 'recommendations', label: t.book.relatedWorks },
            { id: 'reviews', label: `${t.book.reviews} (${bookReviews.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#B89A5A] text-[#D2BB82]'
                  : 'border-transparent text-[#89977C] hover:text-[#E8E0CF]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* 1. ABOUT TAB */}
          {activeTab === 'about' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#B89A5A]">
                  {isAr ? 'نظرة عامة على العمل' : 'Synopsis & Literary Context'}
                </h4>
                <p className="text-sm leading-relaxed text-[#E8E0CF]">
                  {isAr ? displayedBook.descriptionAr : displayedBook.description}
                </p>
              </div>

              {/* Themes & Categories Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[#07110D] border border-[#173125] space-y-2">
                  <span className="text-xs font-semibold text-[#89977C] block">
                    {isAr ? 'المواضيع والأبعاد الفكرية' : 'Themes & Motifs'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {((isAr ? displayedBook.themesAr : displayedBook.themes) || []).map((theme) => (
                      <span
                        key={theme}
                        className="px-2.5 py-1 rounded-lg bg-[#10231A] text-xs text-[#D2BB82] border border-[#173125]"
                      >
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#07110D] border border-[#173125] space-y-2">
                  <span className="text-xs font-semibold text-[#89977C] block">
                    {isAr ? 'التصنيفات والأنواع الأدبية' : 'Categories & Genres'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {((isAr ? displayedBook.genresAr : displayedBook.genres) || []).map((genre) => (
                      <span
                        key={genre}
                        className="px-2.5 py-1 rounded-lg bg-[#10231A] text-xs text-[#89977C] border border-[#173125]"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rights Information Box */}
              <div className="p-4 rounded-2xl bg-[#10231A] border border-[#687B61]/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#D2BB82] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#89977C]" />
                    <span>{t.book.rightsAndLicensing}</span>
                  </span>
                  <span className="text-xs font-mono text-[#89977C]">{activeEdition.licenseType}</span>
                </div>
                <p className="text-xs text-[#BDB5A5] leading-relaxed">
                  {activeEdition.attribution}
                </p>
                <div className="text-[11px] font-mono text-[#89977C] pt-1">
                  {isAr ? 'المصدر الموثق:' : 'Source Archive:'} {activeEdition.source}
                </div>
              </div>
            </div>
          )}

          {/* 2. EDITIONS TAB */}
          {activeTab === 'editions' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {editions.map((edition) => (
                  <div
                    key={edition.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      activeEdition.id === edition.id
                        ? 'bg-[#173125]/80 border-[#B89A5A]'
                        : 'bg-[#07110D] border-[#173125] hover:border-[#687B61]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-[#E8E0CF]">
                        {isAr ? edition.languageNameAr : edition.languageName}
                      </span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#07110D] text-[#D2BB82]">
                        {edition.rightsStatus}
                      </span>
                    </div>

                    <div className="text-xs text-[#89977C] space-y-1">
                      <div>
                        {isAr ? 'الناشر:' : 'Publisher:'} {edition.publisher} ({edition.publicationYear})
                      </div>
                      {edition.translator && (
                        <div>
                          {isAr ? 'المترجم:' : 'Translator:'} {isAr ? edition.translatorAr : edition.translator}
                        </div>
                      )}
                      <div>
                        {isAr ? 'عدد الصفحات:' : 'Pages:'} {edition.pageCount} • {isAr ? 'الوقت التقديري:' : 'Est. time:'}{' '}
                        {Math.round(edition.estimatedMinutes / 60)}h
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-[#173125]">
                      <DownloadPanel bookId={displayedBook.id} editionId={edition.id} title={displayedBook.title} titleAr={displayedBook.titleAr} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. CHAPTERS TAB */}
          {activeTab === 'chapters' && (
            <div className="space-y-3">
              {chapters.map((chapter, idx) => (
                <button
                  key={chapter.id}
                  onClick={() => {
                    openBookInReader(displayedBook, activeEdition.id, idx);
                  }}
                  className="w-full p-4 rounded-2xl bg-[#07110D] hover:bg-[#173125] border border-[#173125] flex items-center justify-between text-left transition-colors group"
                >
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-mono text-[#B89A5A]">
                      {isAr ? `فصل ${idx + 1}` : `Chapter ${idx + 1}`}
                    </span>
                    <div className="text-sm font-semibold text-[#E8E0CF] group-hover:text-[#D2BB82]">
                      {isAr ? chapter.titleAr : chapter.title}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#89977C] group-hover:text-[#E8E0CF]" />
                </button>
              ))}
            </div>
          )}

          {/* 4. DETERMINISTIC RECOMMENDATIONS TAB */}
          {activeTab === 'recommendations' && (
            <div className="space-y-4">
              <div className="text-xs text-[#89977C]">
                {isAr
                  ? 'تم استخلاص هذه الاقتراحات بواسطة خوارزمية قطعية شفافة مبنية على تقاطع المؤلفين، والأنواع، والمواضيع.'
                  : 'Derived through deterministic literary graph analysis based on author, genre, and thematic affinity.'}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recommendations.map(({ book, totalScore, reason, reasonAr }) => (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => setDetailBook(book)}
                    className="p-4 rounded-2xl bg-[#07110D] border border-[#173125] hover:border-[#687B61] transition-colors space-y-3 text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D2BB82]"
                    aria-label={isAr ? `فتح تفاصيل ${book.titleAr}` : `Open details for ${book.title}`}
                  >
                    <div className="flex gap-3">
                      <img
                        src={book.coverImage}
                        alt={isAr ? book.titleAr : book.title}
                        className="w-14 h-20 object-cover rounded-lg border border-[#173125]"
                      />
                      <div>
                        <div className="text-xs font-bold text-[#E8E0CF]">{isAr ? book.titleAr : book.title}</div>
                        <div className="text-[11px] text-[#89977C]">{isAr ? book.authorNameAr : book.authorName}</div>
                        <div className="text-[10px] font-mono text-[#D2BB82] mt-1">
                          {isAr ? 'تطابق فكري:' : 'Affinity Score:'} {totalScore}%
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-[#BDB5A5] italic">
                      "{isAr ? reasonAr : reason}"
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 5. REVIEWS TAB */}
          {activeTab === 'reviews' && (
            <div className="space-y-6">
              {/* Add review form */}
              <form onSubmit={handleCreateReview} className="p-4 rounded-2xl bg-[#07110D] border border-[#173125] space-y-3">
                <h4 className="text-xs font-bold text-[#B89A5A] uppercase tracking-wider">
                  {isAr ? 'أضف قراءتك أو مراجعتك الأدبية' : 'Write a Reader Review'}
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#89977C]">{isAr ? 'التقييم:' : 'Rating:'}</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewReviewRating(star)}
                        className="p-1 text-[#D2BB82]"
                      >
                        <Star className={`w-4 h-4 ${star <= newReviewRating ? 'fill-[#D2BB82]' : ''}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  type="text"
                  value={newReviewTitle}
                  onChange={(e) => setNewReviewTitle(e.target.value)}
                  placeholder={isAr ? 'عنوان المراجعة (مثال: أبعاد فلسفية ملهمة)' : 'Review headline...'}
                  className="w-full bg-[#0B1712] border border-[#173125] rounded-xl px-3 py-2 text-xs text-[#E8E0CF] focus:outline-none"
                />

                <textarea
                  value={newReviewContent}
                  onChange={(e) => setNewReviewContent(e.target.value)}
                  placeholder={isAr ? 'اكتب انطباعك وتحليلك لهذا العمل...' : 'Share your literary reflections on this work...'}
                  rows={3}
                  className="w-full bg-[#0B1712] border border-[#173125] rounded-xl p-3 text-xs text-[#E8E0CF] focus:outline-none"
                />

                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#173125] hover:bg-[#B89A5A] hover:text-[#07110D] text-[#D2BB82] font-semibold text-xs transition-colors"
                >
                  {isAr ? 'نشر المراجعة' : 'Submit Review'}
                </button>
              </form>

              {/* Reviews List */}
              <div className="space-y-3">
                {bookReviews.map((rev) => (
                  <div key={rev.id} className="p-4 rounded-2xl bg-[#07110D] border border-[#173125] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {rev.userAvatar ? (
                          <img src={rev.userAvatar} alt={rev.userName} className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <span className="w-6 h-6 rounded-full bg-[#173125] text-[#D2BB82] inline-flex items-center justify-center" role="img" aria-label={isAr ? `صورة ${rev.userName} الافتراضية` : `${rev.userName} default avatar`}>
                            <UserRound className="w-3.5 h-3.5" aria-hidden="true" />
                          </span>
                        )}
                        <span className="text-xs font-semibold text-[#E8E0CF]">{rev.userName}</span>
                        {rev.isVerifiedReader && (
                          <span className="text-[10px] text-[#687B61] font-mono">({isAr ? 'قارئ موثق' : 'Verified'})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[#D2BB82] text-xs font-mono">
                        <Star className="w-3 h-3 fill-[#D2BB82]" />
                        <span>{rev.rating}</span>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-[#E8E0CF]">{rev.title}</div>
                    <p className="text-xs text-[#BDB5A5] leading-relaxed">{rev.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AccessibleDialog>
  );
};
