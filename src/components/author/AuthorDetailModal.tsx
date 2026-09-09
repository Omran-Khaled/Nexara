import React, { useRef } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { AccessibleDialog } from '../ui/AccessibleDialog';

export const AuthorDetailModal: React.FC = () => {
  const { detailAuthor, route, closeRouteOverlay, books, authors, language, setDetailBook, requestStates } = useAppStore();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const isAr = language === 'ar';

  const routedAuthor = route.kind === 'author' ? authors.find((author) => author.id === route.authorId) || (detailAuthor?.id === route.authorId ? detailAuthor : null) : null;
  const displayedAuthor = route.kind === 'author' ? routedAuthor : detailAuthor;
  if (!displayedAuthor) {
    if (route.kind !== 'author') return null;
    const missing = ['success', 'empty', 'error'].includes(requestStates.catalog.status);
    return <AccessibleDialog open onClose={closeRouteOverlay} title={isAr ? 'تفاصيل المؤلف' : 'Author details'} className="w-full max-w-md rounded-3xl bg-[#0B1712] border border-[#173125] p-6 text-[#E8E0CF] shadow-2xl"><div className="space-y-4 text-center"><h2 className="font-literary text-xl font-bold">{missing ? (isAr ? 'المؤلف غير متاح' : 'Author unavailable') : (isAr ? 'جارٍ فتح المؤلف…' : 'Opening author…')}</h2><p className="text-sm text-[#89977C]" role={missing ? 'alert' : 'status'}>{missing ? (isAr ? 'قد يكون الرابط غير صحيح أو لم يعد هذا المؤلف موجوداً في الفهرس.' : 'The link may be incorrect or this author is no longer available in the catalog.') : (isAr ? 'نسترجع بيانات المؤلف من الفهرس.' : 'Retrieving author details from the catalog.')}</p><button onClick={closeRouteOverlay} className="px-4 py-2 rounded-xl bg-[#173125] text-[#D2BB82] text-sm font-semibold">{isAr ? 'العودة إلى المكتبة' : 'Return to library'}</button></div></AccessibleDialog>;
  }

  const authorBooks = books.filter((b) => b.authorId === displayedAuthor.id);
  const languageLabels: Record<string, { en: string; ar: string }> = {
    en: { en: 'English', ar: 'الإنجليزية' },
    ar: { en: 'Arabic', ar: 'العربية' },
    fr: { en: 'French', ar: 'الفرنسية' },
    de: { en: 'German', ar: 'الألمانية' },
    es: { en: 'Spanish', ar: 'الإسبانية' },
    it: { en: 'Italian', ar: 'الإيطالية' },
    ru: { en: 'Russian', ar: 'الروسية' },
    la: { en: 'Latin', ar: 'اللاتينية' },
    el: { en: 'Greek', ar: 'اليونانية' },
  };
  const authorLanguages = displayedAuthor.languages.length
    ? displayedAuthor.languages.map((code) => languageLabels[code]?.[isAr ? 'ar' : 'en'] || code).join(isAr ? '، ' : ', ')
    : (isAr ? 'غير محددة' : 'Not specified');

  return (
    <AccessibleDialog open onClose={closeRouteOverlay} title={isAr ? `تفاصيل ${displayedAuthor.nameAr}` : `${displayedAuthor.name} details`} initialFocusRef={closeButtonRef} className="w-full max-w-3xl my-8 max-h-[90vh]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-3xl bg-[#0B1712] border border-[#173125] rounded-3xl shadow-2xl overflow-hidden text-[#E8E0CF] my-8 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-6 bg-[#07110D]/90 border-b border-[#173125] flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={displayedAuthor.avatar}
              alt={isAr ? displayedAuthor.nameAr : displayedAuthor.name}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-[#B89A5A]/60 shadow-lg shrink-0"
            />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#173125] text-[#D2BB82]">
                  {isAr ? displayedAuthor.eraAr : displayedAuthor.era}
                </span>
                <span className="text-xs text-[#89977C]">{isAr ? displayedAuthor.countryAr : displayedAuthor.country}</span>
              </div>
              <h2 className="font-literary text-2xl font-bold text-[#E8E0CF]">
                {isAr ? displayedAuthor.nameAr : displayedAuthor.name}
              </h2>
              <div className="text-xs text-[#89977C] flex items-center gap-2">
                <span>{isAr ? 'اللغة الأصلية:' : 'Original language:'} {authorLanguages}</span>
                <span>•</span>
                <span>{authorBooks.length} {isAr ? 'أعمال في المكتبة' : 'works in library'}</span>
              </div>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            onClick={closeRouteOverlay}
            aria-label={isAr ? 'إغلاق تفاصيل المؤلف' : 'Close author details'}
            className="p-2 rounded-xl bg-[#10231A] hover:bg-[#173125] text-[#89977C] hover:text-[#E8E0CF]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Biography */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#B89A5A]">
              {isAr ? 'السيرة الأدبية والفكرية' : 'Literary Biography & Thought'}
            </h4>
            <p className="text-sm leading-relaxed text-[#BDB5A5]">
              {isAr ? displayedAuthor.bioAr : displayedAuthor.bio}
            </p>
          </div>

          {/* Author's works */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#89977C]">
              {isAr ? 'الأعمال المتوفرة في المكتبة' : 'Available Volumes'} ({authorBooks.length})
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {authorBooks.map((book) => (
                <button
                  type="button"
                  key={book.id}
                  onClick={() => setDetailBook(book)}
                  className="p-4 rounded-2xl bg-[#07110D] border border-[#173125] hover:border-[#687B61] transition-colors flex gap-3 text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D2BB82]"
                  aria-label={isAr ? `فتح تفاصيل ${book.titleAr}` : `Open details for ${book.title}`}
                >
                  <img
                    src={book.coverImage}
                    alt={book.title}
                    className="w-12 h-16 object-cover rounded shadow"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#E8E0CF] truncate">
                      {isAr ? book.titleAr : book.title}
                    </div>
                    <div className="text-xs text-[#89977C]">{book.publicationYear}</div>
                    <div className="text-[10px] text-[#D2BB82] font-mono mt-1">★ {book.rating}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </AccessibleDialog>
  );
};
