import React from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { translations } from '../../i18n/translations';
import { Book } from '../../types';
import { BookOpen, Bookmark, Eye, Star, ShieldCheck, ShieldAlert } from 'lucide-react';

interface BookCardProps {
  book: Book;
  viewMode?: 'grid' | 'list' | 'compact' | 'cover-first';
}

export const BookCard: React.FC<BookCardProps> = ({ book, viewMode = 'grid' }) => {
  const {
    language,
    openBookInReader,
    toggleSaveBook,
    savedBookIds,
    setDetailBook,
    readingProgress,
  } = useAppStore();

  const t = translations[language];
  const isAr = language === 'ar';

  const isSaved = savedBookIds.includes(book.id);
  const progress = readingProgress[book.id]?.completedPercent || 0;
  const primaryEdition = book.editions[0];
  const detailLabel = isAr ? `فتح تفاصيل كتاب ${book.titleAr}` : `Open details for ${book.title}`;

  const getRightsBadge = (status: string) => {
    switch (status) {
      case 'PUBLIC_DOMAIN':
        return (
          <span className="px-2 py-0.5 rounded bg-[#173125] text-[#D2BB82] border border-[#687B61]/40 text-[10px] font-mono flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[#89977C]" />
            <span>{isAr ? 'ملكية عامة' : 'Public Domain'}</span>
          </span>
        );
      case 'OPEN_ACCESS':
        return (
          <span className="px-2 py-0.5 rounded bg-[#10231A] text-[#89977C] border border-[#687B61]/30 text-[10px] font-mono flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[#89977C]" />
            <span>{isAr ? 'وصول حر' : 'Open Access'}</span>
          </span>
        );
      case 'LICENSED':
        return (
          <span className="px-2 py-0.5 rounded bg-[#1A1812] text-[#B89A5A] border border-[#B89A5A]/40 text-[10px] font-mono flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[#B89A5A]" />
            <span>{isAr ? 'مرخص رسمياً' : 'Licensed'}</span>
          </span>
        );
      case 'RESTRICTED':
      case 'PREVIEW_ONLY':
        return (
          <span className="px-2 py-0.5 rounded bg-[#1E0F11] text-[#F3D5D7] border border-[#4A2528] text-[10px] font-mono flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-[#E57373]" />
            <span>{isAr ? 'معاينة فقط' : 'Preview Only'}</span>
          </span>
        );
      default:
        return null;
    }
  };

  if (viewMode === 'compact') {
    return (
      <div
        id={`book-card-compact-${book.id}`}
        onClick={() => setDetailBook(book)}
        role="group"
        aria-label={isAr ? `إجراءات ${book.titleAr}` : `Actions for ${book.title}`}
        className="flex items-center justify-between p-3 rounded-xl bg-[#0B1712] border border-[#173125] hover:border-[#687B61]/60 transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={book.coverImage}
            alt={book.title}
            className="w-10 h-14 object-cover rounded border border-[#173125] shrink-0"
          />
          <div className="min-w-0">
            <div className="text-sm font-bold text-[#E8E0CF] group-hover:text-[#D2BB82] truncate">
              {isAr ? book.titleAr : book.title}
            </div>
            <div className="text-xs text-[#89977C] truncate">
              {isAr ? book.authorNameAr : book.authorName} • {book.genres[0]}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {getRightsBadge(primaryEdition?.rightsStatus)}
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDetailBook(book);
              }}
              className="p-2 rounded-lg border border-[#173125] bg-[#07110D] hover:bg-[#173125] text-[#89977C] hover:text-[#E8E0CF] transition-colors"
              aria-label={detailLabel}
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openBookInReader(book);
              }}
              className="p-2 rounded-lg bg-[#173125] hover:bg-[#B89A5A] hover:text-[#07110D] text-[#D2BB82] transition-colors"
              title={t.book.readNow}
              aria-label={`${t.book.readNow}: ${isAr ? book.titleAr : book.title}`}
            >
              <BookOpen className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div
        id={`book-card-list-${book.id}`}
        onClick={() => setDetailBook(book)}
        role="group"
        aria-label={isAr ? `إجراءات ${book.titleAr}` : `Actions for ${book.title}`}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-[#0B1712] border border-[#173125] hover:border-[#687B61]/60 transition-colors gap-4 cursor-pointer group"
      >
        <div className="flex items-center gap-4 min-w-0">
          <img
            src={book.coverImage}
            alt={book.title}
            className="w-16 h-22 object-cover rounded-xl border border-[#173125] shadow shrink-0"
          />
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              {getRightsBadge(primaryEdition?.rightsStatus)}
              <span className="text-xs text-[#89977C]">{book.readingDifficulty}</span>
            </div>
            <h3 className="font-literary text-base sm:text-lg font-bold text-[#E8E0CF] group-hover:text-[#D2BB82] truncate">
              {isAr ? book.titleAr : book.title}
            </h3>
            <div className="text-xs text-[#89977C]">
              {isAr ? book.authorNameAr : book.authorName} ({book.publicationYear})
            </div>
            <p className="text-xs text-[#BDB5A5] line-clamp-2 max-w-xl">
              {isAr ? book.descriptionAr : book.description}
            </p>
          </div>
        </div>

        <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#173125]">
          <div className="flex items-center gap-1 text-xs text-[#D2BB82] font-mono">
            <Star className="w-3.5 h-3.5 fill-[#D2BB82]" />
            <span>{book.rating}</span>
            <span className="text-[#89977C]">({book.ratingsCount})</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleSaveBook(book.id);
              }}
              className={`p-2 rounded-xl border transition-colors ${
                isSaved ? 'bg-[#173125] border-[#B89A5A] text-[#D2BB82]' : 'bg-[#07110D] border-[#173125] text-[#89977C]'
              }`}
              title={isSaved ? t.book.saved : t.book.save}
              aria-label={`${isSaved ? t.book.saved : t.book.save}: ${isAr ? book.titleAr : book.title}`}
              aria-pressed={isSaved}
            >
              <Bookmark className="w-4 h-4" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setDetailBook(book);
              }}
              className="p-2 rounded-xl bg-[#10231A] hover:bg-[#173125] border border-[#173125] text-[#89977C] hover:text-[#E8E0CF]"
              aria-label={detailLabel}
            ><Eye className="w-4 h-4" /></button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openBookInReader(book);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#B89A5A] hover:bg-[#D2BB82] text-[#07110D] font-bold text-xs transition-colors shadow"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{t.book.readNow}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'cover-first') {
    return (
      <button
        type="button"
        id={`book-card-cover-${book.id}`}
        onClick={() => setDetailBook(book)}
        aria-label={detailLabel}
        className="relative group rounded-2xl overflow-hidden border border-[#173125] bg-[#0B1712] cursor-pointer shadow-xl transition-all hover:-translate-y-1 hover:border-[#B89A5A]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D2BB82] text-start"
      >
        <div className="aspect-[3/4] w-full overflow-hidden">
          <img
            src={book.coverImage}
            alt={book.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-[#07110D] via-[#07110D]/40 to-transparent p-4 flex flex-col justify-end">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              {getRightsBadge(primaryEdition?.rightsStatus)}
              <span className="text-[10px] font-mono text-[#D2BB82] flex items-center gap-1">
                ★ {book.rating}
              </span>
            </div>
            <h3 className="font-literary text-base font-bold text-[#E8E0CF] group-hover:text-[#D2BB82] line-clamp-1">
              {isAr ? book.titleAr : book.title}
            </h3>
            <div className="text-xs text-[#89977C] line-clamp-1">
              {isAr ? book.authorNameAr : book.authorName}
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div
      id={`book-card-grid-${book.id}`}
      onClick={() => setDetailBook(book)}
      role="group"
      aria-label={isAr ? `إجراءات ${book.titleAr}` : `Actions for ${book.title}`}
      className="flex flex-col justify-between rounded-2xl bg-[#0B1712] border border-[#173125] hover:border-[#687B61]/60 p-4 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group"
    >
      <div className="space-y-3">
        {/* Cover with Floating Action Controls */}
        <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-[#07110D] border border-[#173125]">
          <img
            src={book.coverImage}
            alt={book.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />

          {/* Top Badges */}
          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1">
            {getRightsBadge(primaryEdition?.rightsStatus)}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleSaveBook(book.id);
              }}
              className={`p-1.5 rounded-lg backdrop-blur-md transition-colors ${
                isSaved
                  ? 'bg-[#173125]/90 text-[#D2BB82] border border-[#B89A5A]'
                  : 'bg-[#07110D]/70 text-[#E8E0CF] hover:bg-[#173125]'
              }`}
              title={isSaved ? t.book.saved : t.book.save}
              aria-label={`${isSaved ? t.book.saved : t.book.save}: ${isAr ? book.titleAr : book.title}`}
              aria-pressed={isSaved}
            >
              <Bookmark className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Reading Progress Bar (if reading) */}
          {progress > 0 && (
            <div className="absolute bottom-0 inset-x-0 bg-[#07110D]/80 p-1.5 backdrop-blur-sm">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#D2BB82] mb-1">
                <span>{isAr ? 'التقدم:' : 'Progress:'}</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-1 bg-[#173125] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#687B61] to-[#D2BB82]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Text Metadata */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-[#89977C]">
            <span>{book.genres[0]}</span>
            <span className="flex items-center gap-1 text-[#D2BB82] font-mono">
              <Star className="w-3 h-3 fill-[#D2BB82]" />
              <span>{book.rating}</span>
            </span>
          </div>

          <h3 className="font-literary text-base font-bold text-[#E8E0CF] group-hover:text-[#D2BB82] transition-colors line-clamp-1">
            {isAr ? book.titleAr : book.title}
          </h3>

          <p className="text-xs text-[#89977C] line-clamp-1">
            {isAr ? book.authorNameAr : book.authorName} • {book.publicationYear}
          </p>

          <p className="text-xs text-[#BDB5A5] line-clamp-2 leading-relaxed pt-1">
            {isAr ? book.descriptionAr : book.description}
          </p>
        </div>
      </div>

      {/* Card Action Buttons */}
      <div className="mt-4 pt-3 border-t border-[#173125] flex items-center justify-between gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            openBookInReader(book);
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#173125] hover:bg-[#B89A5A] text-[#D2BB82] hover:text-[#07110D] font-bold text-xs transition-colors"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>{t.book.readNow}</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setDetailBook(book);
          }}
          className="p-2 rounded-xl bg-[#10231A] hover:bg-[#173125] border border-[#173125] text-[#89977C] hover:text-[#E8E0CF] transition-colors"
          title={t.book.about}
          aria-label={`${t.book.about}: ${isAr ? book.titleAr : book.title}`}
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
