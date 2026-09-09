import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { BookCard } from '../library/BookCard';
import { BookmarkCheck, BookOpen, Download, FolderPlus, Highlighter, History, LoaderCircle, Sparkles, StickyNote, Trash2, TrendingUp, X } from 'lucide-react';

type LibraryTab = 'reading' | 'saved' | 'finished' | 'collections' | 'history' | 'bookmarks' | 'highlights' | 'notes' | 'downloads' | 'stats';

export const MyLibraryView: React.FC = () => {
  const store = useAppStore();
  const {
    language, books, isAuthenticated, currentUser, savedBookIds, finishedBookIds, readingProgress, readingHistory, userCollections,
    bookmarks, highlights, downloadedFiles, createCollection, updateCollectionBookIds, deleteCollection, removeBookmark, removeHighlight, updateHighlightNote,
  } = store;
  const isAr = language === 'ar';
  const [activeTab, setActiveTab] = useState<LibraryTab>('reading');
  const [creatingShelf, setCreatingShelf] = useState(false);
  const [shelfTitle, setShelfTitle] = useState('');
  const [shelfDescription, setShelfDescription] = useState('');
  const [shelfBookIds, setShelfBookIds] = useState<string[]>([]);
  const [savingShelf, setSavingShelf] = useState(false);
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

  const inProgressBooks = useMemo(() => books.filter((book) => readingProgress[book.id]?.completedPercent > 0 && !finishedBookIds.includes(book.id)), [books, readingProgress, finishedBookIds]);
  const savedBooks = useMemo(() => books.filter((book) => savedBookIds.includes(book.id)), [books, savedBookIds]);
  const finishedBooks = useMemo(() => books.filter((book) => finishedBookIds.includes(book.id)), [books, finishedBookIds]);
  const shelfCandidateBooks = useMemo(() => books.filter((book) => savedBookIds.includes(book.id) || userCollections.some((collection) => collection.bookIds.includes(book.id))), [books, savedBookIds, userCollections]);
  const pageCount = useMemo(() => (Object.values(readingProgress) as Array<{ bookId: string; editionId: string; completedPercent: number }>).reduce((total, progress) => {
    const book = books.find((item) => item.id === progress.bookId);
    const pages = book?.editions.find((edition) => edition.id === progress.editionId)?.pageCount || 0;
    return total + (pages * progress.completedPercent / 100);
  }, 0), [books, readingProgress]);
  const streak = useMemo(() => {
    const activeDates = new Set(readingHistory.map((entry) => entry.occurredAt.slice(0, 10)));
    let cursor = new Date(); let count = 0;
    while (activeDates.has(cursor.toISOString().slice(0, 10))) { count += 1; cursor = new Date(cursor.getTime() - 86_400_000); }
    return count;
  }, [readingHistory]);
  const genreStats = useMemo(() => {
    const engaged = new Set([...Object.keys(readingProgress), ...readingHistory.map((entry) => entry.bookId)]);
    const counts = new Map<string, number>();
    books.filter((book) => engaged.has(book.id)).forEach((book) => (isAr ? book.genresAr : book.genres).forEach((genre) => counts.set(genre, (counts.get(genre) || 0) + 1)));
    const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
    return [...counts.entries()].sort(([, left], [, right]) => right - left).slice(0, 4).map(([name, value], index) => ({ name, percent: total ? Math.round(value * 100 / total) : 0, color: ['bg-[#B89A5A]', 'bg-[#687B61]', 'bg-[#8B3A3A]', 'bg-[#3A6B8B]'][index] }));
  }, [books, readingHistory, readingProgress, isAr]);

  const tabs: Array<{ id: LibraryTab; label: string; count?: number }> = [
    { id: 'reading', label: isAr ? 'أقرأ حالياً' : 'Currently Reading', count: inProgressBooks.length },
    { id: 'saved', label: isAr ? 'المحفوظة' : 'Saved', count: savedBooks.length },
    { id: 'finished', label: isAr ? 'المكتملة' : 'Finished', count: finishedBooks.length },
    { id: 'collections', label: isAr ? 'رفوفي' : 'Shelves', count: userCollections.length },
    { id: 'history', label: isAr ? 'سجل القراءة' : 'History', count: readingHistory.length },
    { id: 'bookmarks', label: isAr ? 'العلامات' : 'Bookmarks', count: bookmarks.length },
    { id: 'highlights', label: isAr ? 'الإضاءات' : 'Highlights', count: highlights.length },
    { id: 'notes', label: isAr ? 'الملاحظات' : 'Notes', count: highlights.filter((item) => item.note?.trim()).length },
    { id: 'downloads', label: isAr ? 'التحميلات' : 'Downloads', count: downloadedFiles.length },
    { id: 'stats', label: isAr ? 'إحصاءات فعلية' : 'Actual Stats' },
  ];

  const empty = (icon: React.ReactNode, title: string, detail: string) => (
    <div className="p-10 text-center bg-[#0B1712] border border-[#173125] rounded-3xl space-y-2">
      {icon}<h2 className="font-literary text-lg font-bold text-[#E8E0CF]">{title}</h2><p className="text-xs text-[#89977C]">{detail}</p>
    </div>
  );
  const eventText = (event: string) => isAr
    ? ({ OPENED: 'بدأت جلسة قراءة', PROGRESS_SAVED: 'حفظت التقدم', COMPLETED: 'أكملت القراءة' }[event] || event)
    : ({ OPENED: 'Opened a reading session', PROGRESS_SAVED: 'Saved reading progress', COMPLETED: 'Completed reading' }[event] || event);
  const handleCreateShelf = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!shelfTitle.trim()) return;
    setSavingShelf(true);
    await createCollection(shelfTitle.trim(), shelfDescription.trim(), '#687B61', shelfBookIds);
    setSavingShelf(false); setShelfTitle(''); setShelfDescription(''); setShelfBookIds([]); setCreatingShelf(false);
  };
  const updateShelfMembership = async (collectionId: string, currentIds: string[], bookId: string) => {
    const nextIds = currentIds.includes(bookId) ? currentIds.filter((id) => id !== bookId) : [...currentIds, bookId];
    await updateCollectionBookIds(collectionId, nextIds);
  };

  if (!isAuthenticated) return (
    <section className="p-10 text-center rounded-3xl bg-[#0B1712] border border-[#173125] space-y-3">
      <BookOpen className="w-8 h-8 text-[#687B61] mx-auto" />
      <h1 className="font-literary text-2xl font-bold text-[#E8E0CF]">{isAr ? 'مكتبتك الشخصية تنتظر تسجيل الدخول' : 'Your personal library is ready when you sign in'}</h1>
      <p className="text-sm text-[#89977C]">{isAr ? 'سجّل الدخول لحفظ الكتب ومزامنة التقدم والرفوف والعلامات والإضاءات والملاحظات.' : 'Sign in to save books and synchronize progress, shelves, bookmarks, highlights, and notes.'}</p>
    </section>
  );

  return (
    <div id="my-library-view-container" className="w-full space-y-6">
      <header className="p-6 rounded-3xl bg-[#0B1712] border border-[#173125] flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-4">
          {currentUser.avatar ? <img src={currentUser.avatar} alt={isAr ? currentUser.nameAr : currentUser.name} className="w-16 h-16 rounded-2xl object-cover border-2 border-[#B89A5A]/60" /> : <div aria-hidden="true" className="w-16 h-16 rounded-2xl bg-[#173125] text-[#D2BB82] grid place-items-center font-literary text-2xl">{(isAr ? currentUser.nameAr : currentUser.name).slice(0, 1).toUpperCase()}</div>}
          <div><span className="text-xs font-mono uppercase text-[#B89A5A] px-2 py-0.5 rounded bg-[#173125]">{store.role}</span><h1 className="font-literary text-2xl sm:text-3xl font-bold text-[#E8E0CF] mt-1">{isAr ? currentUser.nameAr : currentUser.name}</h1><p className="text-xs sm:text-sm text-[#89977C]">{isAr ? 'هذه الصفحة تعرض سجلات مكتبتك المتزامنة فقط.' : 'This page shows only your synchronized library records.'}</p></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-3 rounded-2xl bg-[#07110D] border border-[#173125] text-center"><div className="font-literary text-xl font-bold text-[#D2BB82]">{streak}</div><div className="text-[10px] text-[#89977C] uppercase">{isAr ? 'أيام متتالية' : 'Day streak'}</div></div>
          <div className="px-4 py-3 rounded-2xl bg-[#07110D] border border-[#173125] text-center"><div className="font-literary text-xl font-bold text-[#687B61]">{finishedBooks.length}</div><div className="text-[10px] text-[#89977C] uppercase">{isAr ? 'مكتملة' : 'Finished'}</div></div>
          <div className="px-4 py-3 rounded-2xl bg-[#07110D] border border-[#173125] text-center"><div className="font-literary text-xl font-bold text-[#E8E0CF]">{Math.round(pageCount)}</div><div className="text-[10px] text-[#89977C] uppercase">{isAr ? 'صفحة مقروءة' : 'Pages read'}</div></div>
        </div>
      </header>

      <nav className="flex items-center gap-2 overflow-x-auto pb-1" aria-label={isAr ? 'أقسام المكتبة الشخصية' : 'Personal library sections'}>
        {tabs.map((tab) => <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id)} aria-pressed={activeTab === tab.id} className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border ${activeTab === tab.id ? 'bg-[#173125] border-[#B89A5A] text-[#D2BB82]' : 'bg-[#0B1712] border-[#173125] text-[#89977C] hover:text-[#E8E0CF]'}`}>{tab.label}{tab.count !== undefined && <span className="ms-1 opacity-70">({tab.count})</span>}</button>)}
      </nav>

      {activeTab === 'reading' && (inProgressBooks.length ? <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">{inProgressBooks.map((book) => <BookCard key={book.id} book={book} viewMode="grid" />)}</div> : empty(<BookOpen className="w-8 h-8 text-[#687B61] mx-auto" />, isAr ? 'لا توجد قراءة نشطة' : 'No active reading', isAr ? 'افتح كتاباً لبدء تسجيل تقدمك.' : 'Open a book to begin recording progress.'))}
      {activeTab === 'saved' && (savedBooks.length ? <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">{savedBooks.map((book) => <BookCard key={book.id} book={book} viewMode="grid" />)}</div> : empty(<BookmarkCheck className="w-8 h-8 text-[#687B61] mx-auto" />, isAr ? 'لا توجد كتب محفوظة' : 'No saved books', isAr ? 'استخدم زر الحفظ في أي كتاب لإضافته هنا.' : 'Use Save on any book to add it here.'))}
      {activeTab === 'finished' && (finishedBooks.length ? <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">{finishedBooks.map((book) => <BookCard key={book.id} book={book} viewMode="grid" />)}</div> : empty(<Sparkles className="w-8 h-8 text-[#687B61] mx-auto" />, isAr ? 'لا توجد أعمال مكتملة' : 'No finished works', isAr ? 'ستظهر الأعمال عند وصول التقدم المخزن إلى الاكتمال.' : 'Works appear when persisted progress reaches completion.'))}

      {activeTab === 'collections' && <section className="space-y-5">
        <div className="flex justify-between items-center"><h2 className="text-xs font-semibold uppercase tracking-wider text-[#89977C]">{isAr ? 'رفوفك المخصصة' : 'Your custom shelves'}</h2><button type="button" onClick={() => setCreatingShelf((value) => !value)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#173125] text-[#D2BB82] text-xs font-semibold"><FolderPlus className="w-3.5 h-3.5" />{isAr ? 'رف جديد' : 'New shelf'}</button></div>
        {creatingShelf && <form onSubmit={(event) => void handleCreateShelf(event)} className="p-5 rounded-2xl bg-[#0B1712] border border-[#B89A5A]/50 space-y-3">
          <label className="block text-xs text-[#D2BB82]">{isAr ? 'اسم الرف' : 'Shelf name'}<input value={shelfTitle} onChange={(event) => setShelfTitle(event.target.value)} required maxLength={160} className="mt-1 w-full bg-[#07110D] border border-[#173125] rounded-xl px-3 py-2 text-xs text-[#E8E0CF]" /></label>
          <label className="block text-xs text-[#D2BB82]">{isAr ? 'الوصف (اختياري)' : 'Description (optional)'}<input value={shelfDescription} onChange={(event) => setShelfDescription(event.target.value)} maxLength={2000} className="mt-1 w-full bg-[#07110D] border border-[#173125] rounded-xl px-3 py-2 text-xs text-[#E8E0CF]" /></label>
          {savedBooks.length > 0 && <fieldset><legend className="text-xs text-[#89977C] mb-2">{isAr ? 'أضف كتباً محفوظة' : 'Add saved books'}</legend><div className="flex flex-wrap gap-2">{savedBooks.map((book) => <label key={book.id} className="text-xs rounded-lg bg-[#07110D] border border-[#173125] px-2 py-1"><input type="checkbox" checked={shelfBookIds.includes(book.id)} onChange={() => setShelfBookIds((current) => current.includes(book.id) ? current.filter((id) => id !== book.id) : [...current, book.id])} /><span className="ms-1">{isAr ? book.titleAr : book.title}</span></label>)}</div></fieldset>}
          <div className="flex gap-2"><button type="submit" disabled={savingShelf} className="px-4 py-2 rounded-xl bg-[#B89A5A] text-[#07110D] font-bold text-xs disabled:opacity-50">{savingShelf ? <LoaderCircle className="w-4 h-4 animate-spin" /> : (isAr ? 'إنشاء' : 'Create')}</button><button type="button" onClick={() => setCreatingShelf(false)} className="px-4 py-2 rounded-xl bg-[#07110D] text-[#89977C] text-xs">{isAr ? 'إلغاء' : 'Cancel'}</button></div>
        </form>}
        {userCollections.length ? <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {userCollections.map((collection) => (
            <article key={collection.id} className="p-5 rounded-2xl bg-[#0B1712] border border-[#173125] space-y-4">
              <div className="flex justify-between gap-3"><div><h3 className="font-literary text-base font-bold text-[#E8E0CF]">{collection.title}</h3>{collection.description && <p className="text-xs text-[#89977C] mt-1">{collection.description}</p>}</div><button type="button" onClick={() => void deleteCollection(collection.id)} className="p-1.5 text-[#89977C] hover:text-[#E57373]" aria-label={isAr ? 'حذف الرف' : 'Delete shelf'}><Trash2 className="w-4 h-4" /></button></div>
              {shelfCandidateBooks.length ? <div className="space-y-2">{shelfCandidateBooks.map((book) => <label key={book.id} className="flex items-center gap-2 text-xs text-[#BDB5A5]"><input type="checkbox" checked={collection.bookIds.includes(book.id)} onChange={() => void updateShelfMembership(collection.id, collection.bookIds, book.id)} /><span>{isAr ? book.titleAr : book.title}</span></label>)}</div> : <p className="text-xs text-[#89977C]">{isAr ? 'احفظ كتباً أولاً ثم أضفها إلى هذا الرف.' : 'Save books first, then add them to this shelf.'}</p>}
            </article>
          ))}
        </div> : empty(<FolderPlus className="w-8 h-8 text-[#687B61] mx-auto" />, isAr ? 'لا توجد رفوف بعد' : 'No shelves yet', isAr ? 'أنشئ رفاً وأضف إليه الكتب المحفوظة.' : 'Create a shelf and add saved books to it.')}
      </section>}

      {activeTab === 'history' && (readingHistory.length ? <section className="space-y-2">{readingHistory.map((entry) => { const book = books.find((item) => item.id === entry.bookId); return <article key={entry.id} className="p-4 rounded-2xl bg-[#0B1712] border border-[#173125] flex justify-between gap-3"><div><h2 className="text-sm font-bold text-[#E8E0CF]">{book ? (isAr ? book.titleAr : book.title) : entry.bookId}</h2><p className="text-xs text-[#89977C]">{eventText(entry.event)}</p></div><time className="text-[11px] text-[#89977C] font-mono">{new Date(entry.occurredAt).toLocaleString()}</time></article>; })}</section> : empty(<History className="w-8 h-8 text-[#687B61] mx-auto" />, isAr ? 'سجل القراءة فارغ' : 'Reading history is empty', isAr ? 'سيسجل فتح الكتب وحفظ التقدم وإكمال القراءة هنا.' : 'Opening a book, saving progress, and completion will be recorded here.'))}
      {activeTab === 'bookmarks' && (bookmarks.length ? <section className="space-y-2">{bookmarks.map((bookmark) => { const book = books.find((item) => item.id === bookmark.bookId); return <article key={bookmark.id} className="p-4 rounded-2xl bg-[#0B1712] border border-[#173125] flex justify-between gap-3"><div><h2 className="text-sm font-bold text-[#E8E0CF]">{bookmark.title}</h2><p className="text-xs text-[#89977C]">{book ? (isAr ? book.titleAr : book.title) : bookmark.bookId} · {bookmark.progressPercent}%</p></div><button type="button" onClick={() => void removeBookmark(bookmark.id)} className="p-1 text-[#89977C] hover:text-[#E57373]" aria-label={isAr ? 'إزالة العلامة' : 'Remove bookmark'}><X className="w-4 h-4" /></button></article>; })}</section> : empty(<BookmarkCheck className="w-8 h-8 text-[#687B61] mx-auto" />, isAr ? 'لا توجد علامات' : 'No bookmarks', isAr ? 'أضف علامة من القارئ للعودة إلى موضعك.' : 'Add a bookmark in the reader to return to a position.'))}
      {(activeTab === 'highlights' || activeTab === 'notes') && (() => { const items = activeTab === 'notes' ? highlights.filter((item) => item.note?.trim()) : highlights; return items.length ? <section className="space-y-3">{items.map((highlight) => <article key={highlight.id} className="p-4 rounded-2xl bg-[#0B1712] border border-[#173125] space-y-3"><div className="flex justify-between gap-3"><div><p className="text-xs text-[#D2BB82]">{highlight.bookTitle} · {highlight.chapterTitle}</p><blockquote className="text-sm text-[#E8E0CF] mt-2 border-s-2 border-[#B89A5A] ps-3">{highlight.selectedText}</blockquote></div><button type="button" onClick={() => void removeHighlight(highlight.id)} className="p-1 text-[#89977C] hover:text-[#E57373]" aria-label={isAr ? 'إزالة الإضاءة' : 'Remove highlight'}><X className="w-4 h-4" /></button></div><textarea value={draftNotes[highlight.id] ?? highlight.note ?? ''} onChange={(event) => setDraftNotes((current) => ({ ...current, [highlight.id]: event.target.value }))} onBlur={(event) => { if (event.target.value !== (highlight.note || '')) void updateHighlightNote(highlight.id, event.target.value); }} maxLength={10000} placeholder={isAr ? 'أضف ملاحظة خاصة…' : 'Add a private note…'} className="w-full min-h-20 bg-[#07110D] border border-[#173125] rounded-xl p-3 text-xs text-[#E8E0CF]" /></article>)}</section> : empty(activeTab === 'notes' ? <StickyNote className="w-8 h-8 text-[#687B61] mx-auto" /> : <Highlighter className="w-8 h-8 text-[#687B61] mx-auto" />, activeTab === 'notes' ? (isAr ? 'لا توجد ملاحظات' : 'No notes yet') : (isAr ? 'لا توجد إضاءات' : 'No highlights yet'), activeTab === 'notes' ? (isAr ? 'أضف ملاحظة إلى أي إضاءة داخل القارئ.' : 'Add a note to a highlight in the reader.') : (isAr ? 'حدد نصاً من القارئ لإنشاء إضاءة.' : 'Select text in the reader to create a highlight.')); })()}
      {activeTab === 'downloads' && (downloadedFiles.length ? <section className="space-y-2">{downloadedFiles.map((file) => <article key={file.id} className="p-4 rounded-2xl bg-[#0B1712] border border-[#173125] flex justify-between gap-3"><div className="flex gap-3"><Download className="w-4 h-4 text-[#D2BB82]" /><div><h2 className="text-sm font-bold text-[#E8E0CF]">{file.bookTitle}</h2><p className="text-xs text-[#89977C]">{file.format} · {new Date(file.timestamp).toLocaleDateString()}</p></div></div><span className="text-[10px] text-[#687B61]">{isAr ? 'سجل تنزيل' : 'Download record'}</span></article>)}</section> : empty(<Download className="w-8 h-8 text-[#687B61] mx-auto" />, isAr ? 'لا توجد تنزيلات' : 'No downloads', isAr ? 'ستظهر النسخ التي ينشئها مسار التنزيل المرخص هنا.' : 'Files retrieved through the authorized download flow appear here.'))}
      {activeTab === 'stats' && <section className="p-6 rounded-3xl bg-[#0B1712] border border-[#173125] space-y-4"><h2 className="font-literary text-lg font-bold text-[#E8E0CF] flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#B89A5A]" />{isAr ? 'التوزيع الفعلي للقراءة' : 'Actual reading distribution'}</h2>{genreStats.length ? genreStats.map((item) => <div key={item.name} className="space-y-1"><div className="flex justify-between text-xs"><span className="text-[#E8E0CF]">{item.name}</span><span className="text-[#89977C]">{item.percent}%</span></div><div className="h-2 bg-[#07110D] rounded-full overflow-hidden"><div className={`h-full ${item.color}`} style={{ width: `${item.percent}%` }} /></div></div>) : <p className="text-xs text-[#89977C]">{isAr ? 'ستظهر التوزيعات بعد تسجيل نشاط قراءة حقيقي.' : 'Distribution will appear after actual reading activity is recorded.'}</p>}</section>}
    </div>
  );
};
