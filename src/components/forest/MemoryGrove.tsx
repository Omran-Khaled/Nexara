import React, { useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { HighlightColor } from '../../types';
import { Sparkles, TreePine, BookOpen, Quote, Trash2, ArrowRight, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const MemoryGrove: React.FC = () => {
  const {
    language,
    highlights,
    removeHighlight,
    bookmarks,
    finishedBookIds,
    books,
    openBookInReader,
    setQuoteStudioOpen,
  } = useAppStore();

  const [selectedColor, setSelectedColor] = useState<HighlightColor | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'highlights' | 'notes' | 'completed'>('highlights');

  const isAr = language === 'ar';

  const completedBooks = books.filter((b) => finishedBookIds.includes(b.id));

  const filteredHighlights = highlights.filter((h) => {
    if (activeTab === 'notes' && !h.note) return false;
    if (selectedColor !== 'all' && h.color !== selectedColor) return false;
    return true;
  });

  const getColorClasses = (color: HighlightColor) => {
    switch (color) {
      case 'gold':
        return 'border-[#B89A5A]/60 bg-[#1C170E]/60 text-[#D2BB82]';
      case 'moss':
        return 'border-[#687B61]/60 bg-[#10231A]/60 text-[#89977C]';
      case 'burgundy':
        return 'border-[#4A2528]/80 bg-[#1E0F11]/60 text-[#F3D5D7]';
      case 'blue':
        return 'border-[#2D4A68]/60 bg-[#0E1724]/60 text-[#A5C2E8]';
    }
  };

  return (
    <div id="memory-grove-container" className="w-full space-y-6">
      
      {/* Grove Sanctuary Header */}
      <div className="p-6 rounded-3xl bg-[#0B1712] border border-[#173125] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-xl">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#D2BB82]">
            <TreePine className="w-4 h-4 text-[#687B61]" />
            <span>{isAr ? 'الملاذ الشخصي والذاكرة الأدبية' : 'Personal Literary Sanctuary'}</span>
          </div>
          <h2 className="font-literary text-2xl font-bold text-[#E8E0CF]">
            {isAr ? 'دوحة الذاكرة الخاصة بك' : 'Your Personal Memory Grove'}
          </h2>
          <p className="text-xs sm:text-sm text-[#89977C]">
            {isAr
              ? 'كل اقتباس تظلله، وكل فكرة تدونها، وكل عمل تتمه، يغرس شجرة مضيئة في رحلتك الأدبية.'
              : 'Every passage you highlight, reflection you record, and volume you finish blooms into a permanent landmark in your grove.'}
          </p>
        </div>

        {/* Grove Quick Stats */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-3 rounded-2xl bg-[#07110D] border border-[#173125] text-center">
            <div className="font-literary text-xl font-bold text-[#D2BB82]">{highlights.length}</div>
            <div className="text-[10px] text-[#89977C] uppercase tracking-wider">{isAr ? 'اقتباس' : 'Passages'}</div>
          </div>
          <div className="px-4 py-3 rounded-2xl bg-[#07110D] border border-[#173125] text-center">
            <div className="font-literary text-xl font-bold text-[#89977C]">{bookmarks.length}</div>
            <div className="text-[10px] text-[#89977C] uppercase tracking-wider">{isAr ? 'علامة' : 'Marks'}</div>
          </div>
          <div className="px-4 py-3 rounded-2xl bg-[#07110D] border border-[#173125] text-center">
            <div className="font-literary text-xl font-bold text-[#E8E0CF]">{completedBooks.length}</div>
            <div className="text-[10px] text-[#89977C] uppercase tracking-wider">{isAr ? 'أعمال تامة' : 'Completed'}</div>
          </div>
        </div>
      </div>

      {/* Tabs and Color Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center p-1 rounded-xl bg-[#0B1712] border border-[#173125]">
          <button
            onClick={() => setActiveTab('highlights')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'highlights' ? 'bg-[#173125] text-[#E8E0CF] font-semibold' : 'text-[#89977C] hover:text-[#E8E0CF]'
            }`}
          >
            {isAr ? 'جميع التظليلات' : 'All Highlights'} ({highlights.length})
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'notes' ? 'bg-[#173125] text-[#E8E0CF] font-semibold' : 'text-[#89977C] hover:text-[#E8E0CF]'
            }`}
          >
            {isAr ? 'الملاحظات الخاصة' : 'Private Notes'} ({highlights.filter((h) => h.note).length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'completed' ? 'bg-[#173125] text-[#E8E0CF] font-semibold' : 'text-[#89977C] hover:text-[#E8E0CF]'
            }`}
          >
            {isAr ? 'الأعمال المنجزة' : 'Finished Works'} ({completedBooks.length})
          </button>
        </div>

        {activeTab !== 'completed' && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#89977C] flex items-center gap-1">
              <Filter className="w-3 h-3" />
              <span>{isAr ? 'لون الحبر:' : 'Ink Color:'}</span>
            </span>
            {(['all', 'gold', 'moss', 'burgundy', 'blue'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setSelectedColor(c)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono capitalize transition-all border ${
                  selectedColor === c
                    ? 'bg-[#173125] border-[#B89A5A] text-[#D2BB82]'
                    : 'bg-[#0B1712] border-[#173125] text-[#89977C] hover:text-[#E8E0CF]'
                }`}
              >
                {c === 'all' ? (isAr ? 'الكل' : 'All') : c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grove Items Grid */}
      {activeTab === 'completed' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {completedBooks.map((book) => (
            <div
              key={book.id}
              className="p-4 rounded-2xl bg-[#0B1712] border border-[#173125] flex items-center gap-4 hover:border-[#687B61]/60 transition-colors"
            >
              <img
                src={book.coverImage}
                alt={book.title}
                className="w-14 h-20 object-cover rounded-lg border border-[#173125] shadow"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono text-[#D2BB82] flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>{isAr ? 'تمت قراءته بالكامل' : '100% Completed'}</span>
                </div>
                <div className="text-sm font-bold text-[#E8E0CF] truncate mt-0.5">
                  {isAr ? book.titleAr : book.title}
                </div>
                <div className="text-xs text-[#89977C] truncate">
                  {isAr ? book.authorNameAr : book.authorName}
                </div>
                <button
                  onClick={() => openBookInReader(book)}
                  className="mt-2 text-xs font-semibold text-[#B89A5A] hover:text-[#D2BB82] flex items-center gap-1"
                >
                  <span>{isAr ? 'إعادة القراءة' : 'Re-read'}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
          {completedBooks.length === 0 && (
            <div className="col-span-full p-8 text-center bg-[#0B1712] border border-[#173125] rounded-2xl text-xs text-[#89977C]">
              {isAr ? 'لم تتم قراءة أي كتاب بعد. ابدأ رحلتك الآن في المكتبة.' : 'No finished works yet. Begin your reading journey in the library.'}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {filteredHighlights.map((hl) => {
              const book = books.find((b) => b.id === hl.bookId);
              return (
                <motion.div
                  key={hl.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 backdrop-blur-sm ${getColorClasses(
                    hl.color
                  )}`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs opacity-70">
                      <div className="font-literary font-semibold text-[#E8E0CF]">{hl.bookTitle}</div>
                      <span>{new Date(hl.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div className="font-literary italic text-base sm:text-lg leading-relaxed text-[#E8E0CF]">
                      "{hl.selectedText}"
                    </div>

                    {hl.note && (
                      <div className="p-2.5 rounded-xl bg-[#07110D]/70 border border-[#173125] text-xs text-[#BDB5A5] leading-relaxed">
                        <span className="text-[#D2BB82] font-semibold block mb-0.5">
                          {isAr ? 'ملاحظتك الشخصية:' : 'Your Note:'}
                        </span>
                        {hl.note}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-current/20 flex items-center justify-between gap-2 text-xs">
                    <span className="text-[11px] opacity-75">{hl.authorName}</span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setQuoteStudioOpen(true, hl)}
                        className="px-2.5 py-1 rounded-lg bg-[#07110D] hover:bg-[#173125] text-[#D2BB82] flex items-center gap-1 font-medium transition-colors"
                        title={isAr ? 'تصميم بطاقة اقتباس' : 'Create Quote Card'}
                      >
                        <Quote className="w-3 h-3" />
                        <span>{isAr ? 'بطاقة' : 'Card'}</span>
                      </button>

                      {book && (
                        <button
                          onClick={() => openBookInReader(book, undefined, hl.chapterIndex)}
                          className="px-2.5 py-1 rounded-lg bg-[#07110D] hover:bg-[#173125] text-[#E8E0CF] flex items-center gap-1 font-medium transition-colors"
                          title={isAr ? 'الذهاب إلى موضع النص في الكتاب' : 'Go to context in book'}
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>{isAr ? 'قراءة' : 'Jump'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => removeHighlight(hl.id)}
                        className="p-1 rounded-lg bg-[#07110D] hover:text-[#E57373] text-[#89977C] transition-colors"
                        title={isAr ? 'حذف' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filteredHighlights.length === 0 && (
            <div className="col-span-full p-12 text-center bg-[#0B1712] border border-[#173125] rounded-3xl space-y-2">
              <TreePine className="w-8 h-8 text-[#687B61] mx-auto" />
              <div className="font-literary text-lg font-bold text-[#E8E0CF]">
                {isAr ? 'دوحتك بانتظار أولى ومضاتها الفكرية' : 'Your Memory Grove is waiting for its first seeds'}
              </div>
              <p className="text-xs text-[#89977C]">
                {isAr
                  ? 'ظلل المقاطع التي تلامس روحك أثناء القراءة لتظهر تلقائياً هنا وفي استوديو الاقتباسات.'
                  : 'Highlight quotes while reading to have them grow in your sanctuary and convert into quote cards.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
