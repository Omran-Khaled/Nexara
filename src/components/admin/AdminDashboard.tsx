import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { translations } from '../../i18n/translations';
import { Book, WorkflowStatus, RightsStatus } from '../../types';
import { ShieldAlert, ShieldCheck, Plus, Trash2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ingestionApi, IngestionJob } from '../../api/ingestion';
import { bookFilesApi } from '../../api/bookFiles';
import { AdminBookUploadPanel } from './AdminBookUploadPanel';
import { AdminUserManagementPanel } from './AdminUserManagementPanel';
import { AdminSourceImportPanel } from './AdminSourceImportPanel';

function classifyBookFile(file: File): { format: 'PDF' | 'EPUB' | 'TXT' | 'HTML'; mimeType: string } | null {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return { format: 'PDF', mimeType: file.type || 'application/pdf' };
  if (extension === 'epub') return { format: 'EPUB', mimeType: file.type || 'application/epub+zip' };
  if (extension === 'txt') return { format: 'TXT', mimeType: file.type || 'text/plain' };
  if (extension === 'html' || extension === 'htm') return { format: 'HTML', mimeType: file.type || 'text/html' };
  return null;
}

export const AdminDashboard: React.FC = () => {
  const {
    books,
    authors,
    language,
    role,
    addBook,
    updateBook,
    deleteBook,
    addToast,
    auditLogs,
    requestStates,
    loadAuditLogs,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'metrics' | 'catalog' | 'upload' | 'imports' | 'pipeline' | 'rights' | 'users' | 'audit'>('metrics');
  const [isAddBookModalOpen, setIsAddBookModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [ingestionJobs, setIngestionJobs] = useState<IngestionJob[]>([]);
  const [ingestionLoading, setIngestionLoading] = useState(false);
  const [pendingDeletion, setPendingDeletion] = useState<Book | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newTitleAr, setNewTitleAr] = useState('');
  const [newAuthorId, setNewAuthorId] = useState(authors[0]?.id || '');
  const [newAuthorName, setNewAuthorName] = useState('');
  const [newAuthorNameAr, setNewAuthorNameAr] = useState('');
  const [newGenre] = useState('Philosophy');
  const [newYear, setNewYear] = useState(1900);
  const [newDesc, setNewDesc] = useState('');
  const [newDescAr, setNewDescAr] = useState('');
  const [newRightsStatus, setNewRightsStatus] = useState<RightsStatus>('PUBLIC_DOMAIN');
  const [newWorkflowStatus] = useState<WorkflowStatus>('DRAFT');
  const [newBookFile, setNewBookFile] = useState<File | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);

  const t = translations[language];
  const isAr = language === 'ar';
  // Render mirror only — the server is the permission authority (AuthorizationRepository).
  // CATALOG_WRITE = MODERATOR|ADMIN; FILE_WRITE+RIGHTS_MANAGE and requireAdmin (=ROLE_MANAGE) = ADMIN.
  const canManageCatalog = role === 'MODERATOR' || role === 'ADMIN';
  const canUploadBooks = role === 'ADMIN';
  const canPublishIngestion = role === 'ADMIN';
  const canManageUsers = role === 'ADMIN';

  useEffect(() => {
    if (activeTab === 'audit') void loadAuditLogs();
    if (activeTab === 'pipeline') void loadIngestionJobs();
    // Store action identity is unstable; the tab transition is the relevant dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageCatalog) {
      addToast('Your account does not have permission to create catalog records.', 'لا يملك حسابك صلاحية إنشاء سجلات في الفهرس.', 'error');
      return;
    }
    if (!newTitle.trim()) return;
    if (!newBookFile) {
      addToast('Choose a book file first.', 'اختر ملف الكتاب أولاً.', 'warning');
      return;
    }
    const classifiedFile = classifyBookFile(newBookFile);
    if (!classifiedFile) {
      addToast('Only PDF, EPUB, TXT, and HTML files are supported.', 'تدعم الواجهة ملفات PDF وEPUB وTXT وHTML فقط.', 'error');
      return;
    }
    if (!rightsConfirmed) {
      addToast('Confirm that this book is published under an Open Access license.', 'أكد أن هذا الكتاب منشور بترخيص وصول مفتوح.', 'warning');
      return;
    }

    const selectedAuthor = authors.find((a) => a.id === newAuthorId) || authors[0];
    const authorName = selectedAuthor?.name || newAuthorName.trim();
    const authorNameAr = selectedAuthor?.nameAr || newAuthorNameAr.trim() || authorName;
    if (!authorName) {
      addToast('Select an existing author or provide the author name.', 'اختر مؤلفاً موجوداً أو أدخل اسم المؤلف.', 'warning');
      return;
    }
    const authorId = selectedAuthor?.id || `author-${Date.now()}`;
    const newBook: Book = {
      id: `book-${Date.now()}`,
      workId: `work-${Date.now()}`,
      slug: newTitle.toLowerCase().replace(/ /g, '-'),
      title: newTitle,
      titleAr: newTitleAr || newTitle,
      originalTitle: newTitle,
      authorId,
      authorName,
      authorNameAr,
      description: newDesc.trim(),
      descriptionAr: newDescAr.trim() || newDesc.trim(),
      coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=600',
      publicationYear: newYear,
      primaryLanguage: 'en',
      genres: [newGenre],
      genresAr: [newGenre],
      categories: ['Philosophy'],
      categoriesAr: ['فلسفة'],
      themes: ['Literature', 'Thought'],
      themesAr: ['أدب', 'فكر'],
      moods: ['contemplative'],
      readingDifficulty: 'Moderate',
      rating: 0,
      ratingsCount: 0,
      reviewsCount: 0,
      downloadsCount: 0,
      readsCount: 0,
      featured: false,
      hiddenGem: false,
      editorialPick: false,
      forestRegion: 'philosophy',
      forestCoords: { x: 50, y: 50 },
      // This form creates catalogue metadata only. A verified source file must be ingested
      // before a record can become readable or downloadable.
      workflowStatus: newWorkflowStatus,
      contentAvailability: 'METADATA_ONLY',
      editions: [
        {
          id: `ed-${Date.now()}`,
          isbn: '978-0-00000-000-0',
          language: 'en',
          languageName: 'English',
          languageNameAr: 'الإنجليزية',
          publicationYear: newYear,
          publisher: 'Nexara catalogue entry',
          rightsStatus: 'OPEN_ACCESS',
          licenseType: 'Open Access',
          attribution: 'Uploaded by Nexara administrator under an Open Access license.',
          source: 'Administrator upload',
          pageCount: 0,
          estimatedMinutes: 0,
          files: [],
        },
      ],
      chapters: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const created = await addBook(newBook);
    if (!created) return;
    try {
      const target = (await bookFilesApi.createDirectUpload(created.id, created.editions[0].id, classifiedFile)).data;
      let temporaryStorageKey: string;
      if (target.mode === 'signed') {
        await bookFilesApi.uploadToSignedTarget(target, newBookFile);
        temporaryStorageKey = target.temporaryStorageKey;
      } else {
        temporaryStorageKey = (await bookFilesApi.stageServerBody(created.id, created.editions[0].id, classifiedFile, newBookFile)).data.temporaryStorageKey;
      }
      await bookFilesApi.completeDirectUpload(created.id, created.editions[0].id, {
        format: classifiedFile.format,
        mimeType: classifiedFile.mimeType,
        temporaryStorageKey,
        originalName: newBookFile.name,
        readingAllowed: true,
        downloadAllowed: true,
        offlineAllowed: false,
        rights: { bookId: created.id, editionId: created.editions[0].id, status: 'OPEN_ACCESS' },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The book was created, but its file could not be stored.';
      addToast(message, 'تم إنشاء السجل، لكن تعذر تخزين ملف الكتاب.', 'error');
      return;
    }
    setIsAddBookModalOpen(false);
    setNewTitle('');
    setNewTitleAr('');
    setNewAuthorName('');
    setNewAuthorNameAr('');
    setNewDesc('');
    setNewDescAr('');
    setNewBookFile(null);
    setRightsConfirmed(false);
    addToast(
      'Catalogue record created as metadata only; source text and rights still require verification.',
      'تم إنشاء سجل بيانات وصفية فقط؛ ما زال النص وحقوقه بحاجة إلى تحقق.',
      'info',
    );
  };

  const loadIngestionJobs = async () => {
    setIngestionLoading(true);
    try { setIngestionJobs((await ingestionApi.list()).data); }
    catch { addToast('Could not load ingestion jobs.', 'تعذر تحميل وظائف الإدخال.', 'error'); }
    finally { setIngestionLoading(false); }
  };

  const handlePublishIngestion = async (job: IngestionJob) => {
    if (!canPublishIngestion) {
      addToast('Your account does not have permission to publish ingestion candidates.', 'لا يملك حسابك صلاحية نشر مرشحات الإدخال.', 'error');
      return;
    }
    try {
      const published = (await ingestionApi.publish(job.id)).data;
      setIngestionJobs((current) => current.map((item) => item.id === published.id ? published : item));
      addToast('The administrator approval stored the verified file permanently and published the book.', 'حفظت موافقة المدير الملف الموثق بصورة دائمة ثم نشرت الكتاب.', 'success');
    } catch {
      addToast('Publication remains blocked until all ingestion checks pass.', 'يبقى النشر محجوبًا حتى تنجح جميع تحققات الإدخال.', 'error');
    }
  };

  const requestDeleteBook = (book: Book) => {
    if (!canManageCatalog) {
      addToast('Your account does not have permission to delete catalog records.', 'لا يملك حسابك صلاحية حذف سجلات الفهرس.', 'error');
      return;
    }
    setPendingDeletion(book);
  };

  const confirmDeleteBook = async () => {
    if (!pendingDeletion) return;
    const book = pendingDeletion;
    setPendingDeletion(null);
    await deleteBook(book.id);
  };

  const handleUpdateWorkflow = (bookId: string, status: WorkflowStatus) => {
    if (!canManageCatalog) {
      addToast('Your account does not have permission to change editorial workflow.', 'لا يملك حسابك صلاحية تغيير مسار التحرير.', 'error');
      return;
    }
    if (status === 'PUBLISHED') { addToast('Use a completed ingestion job to publish.', 'استخدم وظيفة إدخال مكتملة للنشر.', 'warning'); return; }
    updateBook(bookId, { workflowStatus: status });
    addToast(`Workflow status updated to ${status}.`, `تم تحديث حالة العمل إلى ${status}.`, 'success');
  };

  const filteredBooks = books.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.titleAr.includes(searchQuery) ||
      b.authorName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="admin-dashboard-container" className="w-full space-y-6">
      
      {/* CMS Header & Role Indicator */}
      <div className="p-6 rounded-3xl bg-[#0B1712] border border-[#173125] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#D2BB82]">
            <ShieldAlert className="w-4 h-4 text-[#B89A5A]" />
            <span>{isAr ? 'لوحة إدارة المحتوى والحقوق (CMS)' : 'Content & Rights Management'}</span>
          </div>
          <h1 className="font-literary text-2xl sm:text-3xl font-bold text-[#E8E0CF]">
            {t.admin.title}
          </h1>
          <p className="text-xs sm:text-sm text-[#89977C]">
            {t.admin.subtitle}
          </p>
          <p className="text-[11px] text-[#B89A5A]">
            {isAr
              ? 'تعتمد هذه الواجهة على التفويض من الخادم وسجل تدقيق للعمليات المدعومة. لا يمكن نشر النص أو تنزيله قبل تحقق الحقوق.'
              : 'This interface relies on server authorization and audit logging for supported operations. Text cannot be published or downloaded before rights verification.'}
          </p>
          {!canManageCatalog && <p className="text-[11px] text-[#E7A1A1]">{isAr ? 'وصول للقراءة فقط: يلزم دور تحريري أو إداري لإدارة الفهرس.' : 'Read-only access: an editorial or administrative role is required to manage the catalog.'}</p>}
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddBookModalOpen(true)}
            disabled={!canManageCatalog}
            title={canManageCatalog ? undefined : (isAr ? 'يلزم دور تحريري أو إداري' : 'An editorial or administrative role is required')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#B89A5A] hover:bg-[#D2BB82] disabled:bg-[#687B61] disabled:text-[#BDB5A5] disabled:cursor-not-allowed text-[#07110D] font-bold text-xs transition-colors shadow-lg"
          >
            <Plus className="w-4 h-4" />
            <span>{t.admin.addBook}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#173125] pb-2 overflow-x-auto">
        {[
          { id: 'metrics', label: isAr ? 'نظرة عامة ومقاييس' : 'Platform Metrics' },
          { id: 'catalog', label: isAr ? 'إدارة الفهرس' : 'Catalog Works' },
          { id: 'upload', label: isAr ? 'رفع كتاب' : 'Upload Book' },
          { id: 'imports', label: isAr ? 'استيراد المصادر' : 'Import Sources' },
          { id: 'pipeline', label: isAr ? 'مسار النشر والمراجعة' : 'Editorial Pipeline' },
          { id: 'rights', label: isAr ? 'تراخيص وحقوق النشر' : 'Rights & Compliance' },
          { id: 'users', label: isAr ? 'المستخدمون والأدوار' : 'Users & Roles' },
          { id: 'audit', label: isAr ? 'سجل العمليات' : 'Audit Logs' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
              activeTab === tab.id
                ? 'bg-[#173125] border-[#B89A5A] text-[#D2BB82]'
                : 'bg-[#0B1712] border-[#173125] text-[#89977C] hover:text-[#E8E0CF]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {requestStates.admin.status === 'error' && requestStates.admin.error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-[#8B3A3A] bg-[#1E0F11] px-4 py-3 text-xs text-[#F3D5D7]">
          <span className="font-semibold">{isAr ? requestStates.admin.error.messageAr : requestStates.admin.error.message}</span>
          <button type="button" onClick={() => setActiveTab('catalog')} className="shrink-0 rounded-lg border border-[#B89A5A]/60 bg-[#10231A] px-3 py-1.5 text-[10px] font-bold text-[#D2BB82]">{isAr ? 'إعادة المحاولة' : 'Retry'}</button>
        </div>
      )}

      {activeTab === 'imports' && <AdminSourceImportPanel />}

      {/* 1. METRICS TAB */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[#0B1712] border border-[#173125] space-y-1">
              <div className="text-xs text-[#89977C] font-mono">{isAr ? 'إجمالي الأعمال الموثقة' : 'Cataloged Volumes'}</div>
              <div className="font-literary text-2xl font-bold text-[#E8E0CF]">{books.length}</div>
              <div className="text-[10px] text-[#89977C] font-mono">Per-record rights verification required</div>
            </div>

            <div className="p-5 rounded-2xl bg-[#0B1712] border border-[#173125] space-y-1">
              <div className="text-xs text-[#89977C] font-mono">{isAr ? 'المؤلفون والمفكرون في الفهرس' : 'Catalog Authors'}</div>
              <div className="font-literary text-2xl font-bold text-[#D2BB82]">{authors.length}</div>
              <div className="text-[10px] text-[#89977C] font-mono">Classical & Modern Canon</div>
            </div>

            <div className="p-5 rounded-2xl bg-[#0B1712] border border-[#173125] space-y-1">
              <div className="text-xs text-[#89977C] font-mono">{isAr ? 'تحليلات التحميل' : 'Download Analytics'}</div>
              <div className="font-literary text-2xl font-bold text-[#687B61]">—</div>
              <div className="text-[10px] text-[#89977C] font-mono">Recorded by authorized delivery only</div>
            </div>

            <div className="p-5 rounded-2xl bg-[#0B1712] border border-[#173125] space-y-1">
              <div className="text-xs text-[#89977C] font-mono">{isAr ? 'صوتيات الطبيعة' : 'Ambient Generators'}</div>
              <div className="font-literary text-2xl font-bold text-[#E8E0CF]">6</div>
              <div className="text-[10px] text-[#89977C] font-mono">Procedural Web Audio</div>
            </div>
          </div>
        </div>
      )}

      {/* 2. CATALOG MANAGEMENT */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 -translate-y-1/2 left-3 w-4 h-4 text-[#89977C]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? 'ابحث في الفهرس...' : 'Search catalog...'}
                className="w-full bg-[#0B1712] border border-[#173125] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[#E8E0CF] focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-[#0B1712] border border-[#173125] overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#07110D] border-b border-[#173125] text-[#89977C] uppercase font-mono">
                <tr>
                  <th className="p-3.5">{isAr ? 'الكتاب' : 'Title'}</th>
                  <th className="p-3.5">{isAr ? 'المؤلف' : 'Author'}</th>
                  <th className="p-3.5">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="p-3.5">{isAr ? 'الحقوق' : 'Rights'}</th>
                  <th className="p-3.5 text-right">{isAr ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#173125] text-[#E8E0CF]">
                {filteredBooks.map((b) => (
                  <tr key={b.id} className="hover:bg-[#10231A] transition-colors">
                    <td className="p-3.5 font-semibold">
                      {isAr ? b.titleAr : b.title}
                    </td>
                    <td className="p-3.5 text-[#89977C]">
                      {isAr ? b.authorNameAr : b.authorName}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded bg-[#07110D] text-[#D2BB82] font-mono text-[10px]">
                        {b.workflowStatus}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded bg-[#07110D] text-[#687B61] font-mono text-[10px]">
                        {b.editions[0]?.rightsStatus}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => requestDeleteBook(b)}
                        disabled={!canManageCatalog}
                        className="p-1.5 rounded text-[#89977C] hover:text-[#E57373] disabled:opacity-40 disabled:cursor-not-allowed"
                        title={canManageCatalog ? 'Delete' : (isAr ? 'يتطلب صلاحية إدارية' : 'Requires editorial permission')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. DIRECT BOOK UPLOAD */}
      {activeTab === 'upload' && <AdminBookUploadPanel books={books} canUploadBooks={canUploadBooks} isAr={isAr} addToast={addToast} />}

      {/* 4. VERIFIED INGESTION PIPELINE */}
      {activeTab === 'pipeline' && (
        <div className="p-6 rounded-3xl bg-[#0B1712] border border-[#173125] space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-[#D2BB82]">{isAr ? 'خط إدخال الكتب الموثق' : 'Verified book-ingestion pipeline'}</div>
              <p className="text-xs text-[#89977C] mt-1">{isAr ? 'لا يُحفظ أي ملف ولا يُنشر أي كتاب قبل الموافقة الصريحة للمدير، وبعد نجاح تحققات البيانات الوصفية والحقوق والملف والمحتوى.' : 'No file is stored and no book is published before explicit administrator approval, after metadata, rights, file, and content checks pass.'}</p>
            </div>
            <button onClick={() => void loadIngestionJobs()} className="px-3 py-2 rounded-xl border border-[#173125] text-xs text-[#D2BB82]">{isAr ? 'تحديث' : 'Refresh'}</button>
          </div>
          {ingestionLoading && <div className="text-xs text-[#89977C]">{isAr ? 'جارٍ تحميل وظائف الإدخال…' : 'Loading ingestion jobs…'}</div>}
          {!ingestionLoading && ingestionJobs.length === 0 && <div className="p-4 rounded-xl bg-[#07110D] text-xs text-[#89977C]">{isAr ? 'لا توجد وظائف إدخال بعد. استخدم تبويب «استيراد المصادر» لإرسال عمل من Gutenberg أو Wikisource أو ACO للمراجعة.' : 'No ingestion jobs yet. Use Import Sources to submit a Gutenberg, Wikisource, or ACO work for review.'}</div>}
          <div className="space-y-3">
            {ingestionJobs.map((job) => {
              const passed = job.stages.filter((stage) => stage.status === 'PASSED').length;
              const blocked = job.stages.filter((stage) => stage.status === 'FAILED').map((stage) => stage.name);
              return <div key={job.id} className="p-4 rounded-2xl bg-[#07110D] border border-[#173125] space-y-3">
                <div className="flex flex-wrap justify-between gap-2"><div><div className="text-xs font-bold text-[#E8E0CF]">{job.provider} #{job.providerExternalId}</div><div className="text-[10px] font-mono text-[#89977C]">{job.status} · {passed}/{job.stages.length} checks passed</div></div><span className="px-2 py-1 rounded text-[10px] font-mono bg-[#10231A] text-[#D2BB82]">{job.status}</span></div>
                <div className="flex flex-wrap gap-1">{job.stages.map((stage) => <span key={stage.name} className={`px-2 py-1 rounded text-[9px] font-mono ${stage.status === 'PASSED' ? 'bg-[#173125] text-[#B5D3A1]' : stage.status === 'FAILED' ? 'bg-[#3A1717] text-[#F0A0A0]' : 'bg-[#10231A] text-[#89977C]'}`}>{stage.name}: {stage.status}</span>)}</div>
                {blocked.length > 0 && <div className="text-[10px] text-[#E7A1A1]">{isAr ? 'مراحل محجوبة: ' : 'Blocked stages: '}{blocked.join(', ')}</div>}
                {job.status === 'READY_FOR_REVIEW' && <div className="flex flex-wrap items-center gap-3"><span className="text-[10px] text-[#BDB5A5]">{isAr ? 'تتطلب هذه الخطوة موافقة المدير؛ عندها فقط يُخزّن الملف داخلياً ويُنشر.' : 'This requires administrator approval; only then is the file stored internally and the book published.'}</span><button onClick={() => void handlePublishIngestion(job)} disabled={!canPublishIngestion} className="px-3 py-2 rounded-xl bg-[#173125] border border-[#B89A5A]/50 text-xs text-[#D2BB82] disabled:opacity-40 disabled:cursor-not-allowed">{isAr ? 'موافقة: حفظ دائم ونشر' : 'Approve: store & publish'}</button></div>}
              </div>;
            })}
          </div>
        </div>
      )}

      {/* 4. RIGHTS & COMPLIANCE */}
      {activeTab === 'rights' && (
        <div className="p-6 rounded-3xl bg-[#0B1712] border border-[#173125] space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#D2BB82]">
            <ShieldCheck className="w-4 h-4 text-[#687B61]" />
            <span>Digital Rights & Intellectual Property Clearance</span>
          </div>
          <p className="text-xs text-[#89977C] leading-relaxed">
            All cataloged works in Nexara must adhere to international copyright standards (Berne Convention)
            and Open Access licensing principles. Downloads are automatically enabled or restricted based on
            edition rights status metadata.
          </p>

          <div className="space-y-2 pt-2">
            {books.map((b) => (
              <div key={b.id} className="p-3 rounded-xl bg-[#07110D] border border-[#173125] flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-[#E8E0CF]">{b.title}</span>
                  <span className="text-[#89977C] ml-2">({b.editions[0]?.licenseType})</span>
                </div>
                <span className="font-mono text-[10px] text-[#687B61]">{b.editions[0]?.attribution}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. USER ROLES */}
      {activeTab === 'users' && <AdminUserManagementPanel canManageUsers={canManageUsers} isAr={isAr} addToast={addToast} />}

      {/* 6. AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="p-6 rounded-3xl bg-[#0B1712] border border-[#173125] space-y-3">
          <div className="text-xs font-bold text-[#B89A5A] uppercase tracking-wider">
            {isAr ? 'سجل العمليات الإدارية' : 'System Audit Log'}
          </div>
          <div className="space-y-2 text-xs font-mono text-[#89977C]">
            {requestStates.audits.status === 'loading' && <div className="p-3 rounded bg-[#07110D] border border-[#173125]">{isAr ? 'جارٍ تحميل سجل التدقيق…' : 'Loading audit log…'}</div>}
            {requestStates.audits.status === 'error' && (
              <div className="flex items-center justify-between gap-3 rounded border border-[#6B3232] bg-[#2A1616] px-3 py-2">
                <span className="text-[#E7A1A1]">{isAr ? requestStates.audits.error?.messageAr : requestStates.audits.error?.message}</span>
                <button type="button" onClick={() => void loadAuditLogs()} className="shrink-0 rounded-lg border border-[#B89A5A]/60 bg-[#10231A] px-3 py-1.5 text-[10px] font-bold text-[#D2BB82]">{isAr ? 'إعادة المحاولة' : 'Retry'}</button>
              </div>
            )}
            {requestStates.audits.status === 'empty' && <div className="p-3 rounded bg-[#07110D] border border-[#173125]">{isAr ? 'لا توجد أحداث تدقيق من الخادم بعد.' : 'No server audit events are available yet.'}</div>}
            {auditLogs.map((log) => <div key={log.id} className="p-3 rounded bg-[#07110D] border border-[#173125] flex justify-between gap-3"><span>[{new Date(log.timestamp).toISOString()}] {log.action}: {log.details}</span><span className="text-[#687B61]">SERVER</span></div>)}
          </div>
        </div>
      )}

      {/* Destructive-action confirmation */}
      <AnimatePresence>
        {pendingDeletion && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="delete-book-title">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-md bg-[#0B1712] border border-[#6B3232] rounded-3xl p-6 text-[#E8E0CF] shadow-2xl space-y-4">
              <h3 id="delete-book-title" className="font-literary text-xl font-bold">{isAr ? 'تأكيد حذف سجل الفهرس' : 'Confirm catalog-record deletion'}</h3>
              <p className="text-sm leading-relaxed text-[#BDB5A5]">{isAr ? `سيُحذف سجل «${pendingDeletion.titleAr || pendingDeletion.title}». لا تستخدم هذا الإجراء لإلغاء النشر؛ استخدم مسار العمل أو حالة الإدخال للحفاظ على الأثر التشغيلي.` : `The catalog record “${pendingDeletion.title}” will be deleted. Do not use this action to unpublish; use the editorial workflow or ingestion status to retain an operational trail.`}</p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#173125]">
                <button type="button" onClick={() => setPendingDeletion(null)} className="px-4 py-2 rounded-xl bg-[#07110D] text-xs text-[#89977C]">{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button type="button" onClick={() => void confirmDeleteBook()} className="px-4 py-2 rounded-xl bg-[#7D2A2A] text-xs font-bold text-white">{isAr ? 'تأكيد الحذف' : 'Confirm deletion'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Book Modal */}
      <AnimatePresence>
        {isAddBookModalOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setIsAddBookModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-[#0B1712] border border-[#173125] rounded-3xl p-6 text-[#E8E0CF] shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-literary text-xl font-bold text-[#E8E0CF]">
                {isAr ? 'إدراج عمل أدبي جديد' : 'Catalog New Literary Work'}
              </h3>

              <form onSubmit={handleCreateBook} className="space-y-4">
                <div className="rounded-2xl border border-[#B89A5A]/40 bg-[#10231A] p-4">
                  <label className="text-[11px] font-semibold text-[#D2BB82] block mb-2">Book file (PDF, EPUB, TXT, or HTML)</label>
                  <input
                    type="file"
                    accept=".pdf,.epub,.txt,.html,.htm,application/pdf,application/epub+zip,text/plain,text/html"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setNewBookFile(file);
                      if (file && !newTitle.trim()) setNewTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
                    }}
                    className="w-full text-xs text-[#E8E0CF] file:mr-3 file:rounded-lg file:border-0 file:bg-[#B89A5A] file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#07110D]"
                    required
                  />
                  {newBookFile && <p className="mt-2 text-[11px] text-[#89977C]">Selected: {newBookFile.name}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[#89977C] block mb-1">Title (EN)</label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. Meditations"
                      className="w-full bg-[#07110D] border border-[#173125] rounded-xl px-3 py-2 text-xs focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#89977C] block mb-1">العنوان بالعربية</label>
                    <input
                      type="text"
                      value={newTitleAr}
                      onChange={(e) => setNewTitleAr(e.target.value)}
                      placeholder="مثال: التأملات"
                      className="w-full bg-[#07110D] border border-[#173125] rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[#89977C] block mb-1">Existing author (optional)</label>
                    <select value={newAuthorId} onChange={(e) => setNewAuthorId(e.target.value)} className="w-full bg-[#07110D] border border-[#173125] rounded-xl px-3 py-2 text-xs">
                      <option value="">Select an existing author</option>
                      {authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#89977C] block mb-1">Author name (if new)</label>
                    <input type="text" value={newAuthorName} onChange={(e) => setNewAuthorName(e.target.value)} placeholder="e.g. Marcus Aurelius" className="w-full bg-[#07110D] border border-[#173125] rounded-xl px-3 py-2 text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#89977C] block mb-1">اسم المؤلف بالعربية</label>
                    <input type="text" value={newAuthorNameAr} onChange={(e) => setNewAuthorNameAr(e.target.value)} placeholder="مثال: ماركوس أوريليوس" className="w-full bg-[#07110D] border border-[#173125] rounded-xl px-3 py-2 text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#89977C] block mb-1">Year</label>
                    <input
                      type="number"
                      value={newYear}
                      onChange={(e) => setNewYear(parseInt(e.target.value))}
                      className="w-full bg-[#07110D] border border-[#173125] rounded-xl px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#89977C] block mb-1">Rights</label>
                    <select
                      value={newRightsStatus}
                      onChange={(e) => setNewRightsStatus(e.target.value as any)}
                      className="w-full bg-[#07110D] border border-[#173125] rounded-xl px-3 py-2 text-xs"
                    >
                      <option value="PUBLIC_DOMAIN">Public Domain</option>
                      <option value="OPEN_ACCESS">Open Access</option>
                      <option value="LICENSED">Licensed</option>
                      <option value="RESTRICTED">Restricted</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#89977C] block mb-1">Description (EN)</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows={2}
                    className="w-full bg-[#07110D] border border-[#173125] rounded-xl p-3 text-xs focus:outline-none"
                  />
                </div>

                <label className="flex items-start gap-2 text-xs leading-5 text-[#BDB5A5]">
                  <input type="checkbox" checked={rightsConfirmed} onChange={(e) => setRightsConfirmed(e.target.checked)} className="mt-1 accent-[#B89A5A]" required />
                  <span>I confirm that this book is published under an Open Access license and may be made available in the library.</span>
                </label>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#173125]">
                  <button
                    type="button"
                    onClick={() => setIsAddBookModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#07110D] text-xs text-[#89977C]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#B89A5A] text-[#07110D] font-bold text-xs"
                  >
                    Save & Catalog
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
