import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { ingestionApi } from '../../api/ingestion';
import { discoveryApi, DiscoveryResult, DiscoveryProviderReport } from '../../api/discovery';
import { toUiError } from '../../api/http';
import { contentAvailabilityLabel, readerUnavailableMessage } from '../../lib/contentIntegrity';
import { downloadGutenbergBook } from '../../api/publicDomainDownloads';
import { Globe, Search, BookOpen, Plus, Check, ExternalLink, Library, Loader2, X, Download } from 'lucide-react';
import { motion } from 'motion/react';
import { AccessibleDialog } from '../ui/AccessibleDialog';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const OnlineBookSearchModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const {
    language,
    addToast,
    isAuthenticated,
    setAuthModalOpen,
  } = useAppStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DiscoveryResult[]>([]);
  const [providerReports, setProviderReports] = useState<DiscoveryProviderReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const searchControllerRef = React.useRef<AbortController | null>(null);
  const searchRequestIdRef = React.useRef(0);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [submittedIds, setSubmittedIds] = useState<Record<string, boolean>>({});

  const isAr = language === 'ar';

  useEffect(() => {
    if (isOpen && results.length === 0 && !query) {
      handleSearch('Literature');
    }
  }, [isOpen]);

  const handleSearch = async (searchTerm?: string) => {
    const q = searchTerm !== undefined ? searchTerm : query;
    if (!q.trim()) return;
    searchControllerRef.current?.abort();
    const controller = new AbortController();
    searchControllerRef.current = controller;
    const requestId = ++searchRequestIdRef.current;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await discoveryApi.search(q, { signal: controller.signal, page: 1, limit: 20 });
      if (controller.signal.aborted || requestId !== searchRequestIdRef.current) return;
      setResults(response.data);
      setProviderReports(response.providers);
    } catch (error) {
      if (controller.signal.aborted || requestId !== searchRequestIdRef.current) return;
      const uiError = toUiError(error);
      setErrorMessage(isAr ? uiError.messageAr : uiError.message);
      setResults([]);
      setProviderReports([]);
    } finally {
      if (!controller.signal.aborted && requestId === searchRequestIdRef.current) setIsLoading(false);
    }
  };

  const handleSubmitForIngestion = async (item: DiscoveryResult) => {
    const externalIds = item.providerExternalIds as Partial<Record<string, string>> | undefined;
    const gutenbergId = externalIds?.Gutenberg;
    const wikisourceId = externalIds?.Wikisource;
    const acoId = externalIds?.ArabicCollectionsOnline;
    try {
      if (gutenbergId) await ingestionApi.startGutenberg(gutenbergId);
      else if (wikisourceId) await ingestionApi.startWikisource(wikisourceId, item.language || 'en');
      else if (acoId) await ingestionApi.startAco(acoId);
      else {
        addToast('This result is catalogue metadata or lacks a verified approved-source identifier, so it cannot be stored permanently.', 'هذه النتيجة بيانات فهرسية أو تفتقر إلى معرّف مصدر معتمد وموثق، لذلك لا يمكن حفظها بصورة دائمة.', 'info');
        return;
      }
      setSubmittedIds((previous) => ({ ...previous, [item.id]: true }));
      addToast(`"${item.title}" was submitted for metadata, rights, file, and content validation. It is not stored or published yet.`, `أُرسل «${item.title}» إلى مراحل التحقق من البيانات الوصفية والحقوق والملف والمحتوى. لم يُحفظ ولم يُنشر بعد.`, 'success');
    } catch (error) {
      const uiError = toUiError(error);
      addToast(uiError.message, uiError.messageAr, 'error');
    }
  };

  const handleDownload = async (id: string, title: string) => {
    if (!isAuthenticated) {
      setAuthModalOpen(true);
      addToast('Sign in to download public-domain books.', 'سجّل الدخول لتنزيل كتب الملكية العامة.', 'info');
      return;
    }
    try {
      await downloadGutenbergBook(id, 'txt');
      addToast(`Downloading “${title}” from its verified public-domain source.`, `يتم تنزيل «${title}» من مصدر ملكية عامة موثّق.`, 'success');
    } catch (error) {
      const uiError = toUiError(error);
      addToast(uiError.message, uiError.messageAr, 'error');
    }
  };

  const handleSourceView = (item: DiscoveryResult) => {
    if (!item.externalUrl) {
      addToast(readerUnavailableMessage(item.contentAvailability), readerUnavailableMessage(item.contentAvailability, true), 'warning');
      return;
    }
    window.open(item.externalUrl, '_blank', 'noopener,noreferrer');
  };

  if (!isOpen) return null;

  const filteredResults = results.filter((r) => {
    if (selectedSource === 'all') return true;
    return r.providers.some((provider) => provider.toLowerCase().includes(selectedSource.toLowerCase()));
  });

  return (
    <AccessibleDialog open={isOpen} onClose={onClose} title={isAr ? 'البحث الحي في المكتبات العالمية' : 'Live global library search'} initialFocusRef={searchInputRef} className="w-full max-w-4xl max-h-[90vh]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-4xl max-h-[90vh] bg-[#07110D] border border-[#173125] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#173125] bg-[#0B1712] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#173125] border border-[#687B61]/50 flex items-center justify-center text-[#D2BB82] shadow-inner">
              <Globe className="w-5 h-5 text-[#B89A5A]" />
            </div>
            <div>
              <h2 className="font-literary text-xl font-bold text-[#E8E0CF]">
                {isAr ? 'البحث الحي في الأرشيف المفتوح والمكتبات العالمية' : 'Live Global Public Domain Book Search'}
              </h2>
              <p className="text-xs text-[#89977C]">
                {isAr
                  ? 'يبحث مباشرة في OpenLibrary ومشروع غوتنبرغ والأرشيف الأدبي المفتوح'
                  : 'Direct real-time search across OpenLibrary, Gutenberg, and public domain repositories'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={isAr ? 'إغلاق البحث الخارجي' : 'Close online search'}
            className="p-2 rounded-xl text-[#89977C] hover:text-[#E8E0CF] hover:bg-[#10231A] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Quick Categories */}
        <div className="p-4 sm:p-6 border-b border-[#173125] space-y-3 bg-[#08140F]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-[#89977C] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <label htmlFor="online-search-query" className="sr-only">{isAr ? 'البحث في المكتبات العالمية' : 'Search global libraries'}</label>
              <input
                ref={searchInputRef}
                id="online-search-query"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  isAr
                    ? 'ابحث باسم الكتاب أو المؤلف (مثال: ابن خلدون، كليلة ودمنة، أفلاطون، دوستويفسكي، Dante, Tolstoy...)'
                    : 'Search by book title or author (e.g., Ibn Khaldun, Plato, Dostoevsky, Hamlet, Tolstoy...)'
                }
                className="w-full pl-11 pr-4 py-3 bg-[#0B1712] border border-[#173125] rounded-2xl text-sm text-[#E8E0CF] placeholder-[#89977C]/60 focus:outline-none focus:border-[#B89A5A]"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-[#173125] to-[#1F4432] border border-[#B89A5A]/50 text-xs font-bold text-[#D2BB82] hover:text-[#E8E0CF] transition-all flex items-center gap-2 shadow-lg shrink-0"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>{isAr ? 'بحث عبر الإنترنت' : 'Search Web'}</span>
            </button>
          </form>

          {/* Quick Suggestions & Source Filter */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              <span className="text-[#89977C] text-[11px] font-mono mr-1">
                {isAr ? 'مقترحات:' : 'Suggestions:'}
              </span>
              {[
                { label: isAr ? 'مقدمة ابن خلدون' : 'Ibn Khaldun', q: 'Ibn Khaldun' },
                { label: isAr ? 'كليلة ودمنة' : 'Kalila and Dimna', q: 'Kalila' },
                { label: isAr ? 'جمهورية أفلاطون' : 'Plato Republic', q: 'Plato Republic' },
                { label: isAr ? 'الجريمة والعقاب' : 'Dostoevsky', q: 'Dostoevsky' },
                { label: isAr ? 'دون كيخوته' : 'Don Quixote', q: 'Don Quixote' },
              ].map((s) => (
                <button
                  key={s.q}
                  onClick={() => {
                    setQuery(s.q);
                    handleSearch(s.q);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#0B1712] border border-[#173125] hover:border-[#687B61] text-[#BDB5A5] hover:text-[#E8E0CF] text-[11px] whitespace-nowrap"
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              {['all', 'openlibrary', 'gutenberg', 'wikisource', 'aco', 'heritage'].map((src) => (
                <button
                  key={src}
                  onClick={() => setSelectedSource(src)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono capitalize transition-all ${
                    selectedSource === src
                      ? 'bg-[#173125] text-[#D2BB82] border border-[#B89A5A]/50 font-bold'
                      : 'text-[#89977C] hover:text-[#E8E0CF]'
                  }`}
                >
                  {src}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {!isLoading && providerReports.length > 0 && (
            <div className="flex flex-wrap gap-2 text-[10px] text-[#89977C]" aria-label="Discovery provider reports">
              {providerReports.map((report) => (
                <span key={report.provider} className="px-2 py-1 rounded-lg bg-[#10231A] border border-[#173125]">
                  {report.provider}: {report.status} · {report.durationMs}ms{report.error ? ` · ${report.error}` : ''}
                </span>
              ))}
            </div>
          )}
          {isLoading ? (
            <div className="py-20 text-center space-y-4" role="status">
              <Loader2 className="w-8 h-8 text-[#B89A5A] animate-spin mx-auto" />
              <p className="text-sm text-[#89977C] font-literary">
                {isAr ? 'جاري الاتصال بالأرشيفات العالمية واسترجاع الفهارس...' : 'Searching global repositories & public domain libraries...'}
              </p>
            </div>
          ) : errorMessage ? (
            <div className="py-16 text-center space-y-3" role="alert">
              <p className="text-sm font-semibold text-[#E7A1A1]">{errorMessage}</p>
              <button onClick={() => void handleSearch()} className="px-3 py-2 rounded-xl border border-[#6B3232] text-xs text-[#E8E0CF]">{isAr ? 'إعادة المحاولة' : 'Retry'}</button>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Library className="w-10 h-10 text-[#89977C]/40 mx-auto" />
              <p className="text-sm font-semibold text-[#E8E0CF]">
                {isAr ? 'لم نعثر على نتائج مباشرة، جرب كلمة بحث أخرى' : 'No books found, try another search term'}
              </p>
              <p className="text-xs text-[#89977C]">
                {isAr ? 'يمكنك البحث عن أي مؤلف كلاسيكي أو عنوان عالمي بالإنجليزية أو العربية' : 'Search for any classic author or title in English or Arabic'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredResults.map((item) => {
                const isSubmitted = submittedIds[item.id];
                const canRead = item.contentAvailability === 'FULL_TEXT' || item.contentAvailability === 'PREVIEW';
                const gutenbergId = item.rightsStatus === 'PUBLIC_DOMAIN' && item.rightsVerification === 'VERIFIED' ? item.providerExternalIds?.Gutenberg : undefined;
                const publicationYear = item.publicationYear;
                const publicationYearLabel = publicationYear !== null && Number.isFinite(publicationYear) && publicationYear !== 0
                  ? (publicationYear > 0 ? String(publicationYear) : `${Math.abs(publicationYear)} ${isAr ? 'ق.م' : 'BCE'}`)
                  : (isAr ? 'سنة غير متاحة' : 'Year unavailable');
                
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-2xl bg-[#0B1712] border border-[#173125] hover:border-[#687B61]/60 transition-all flex gap-4 group"
                  >
                    <img
                      src={item.coverUrl}
                      alt={item.title}
                      className="w-20 h-28 object-cover rounded-xl border border-[#173125] shrink-0 shadow-md group-hover:scale-105 transition-transform"
                    />
                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="px-2 py-0.5 rounded text-[9px] font-mono uppercase bg-[#10231A] text-[#B89A5A] border border-[#173125]">
                            {item.providers.join(' + ')}
                          </span>
                          <span className="text-[10px] text-[#89977C] font-mono">
                            {publicationYearLabel}
                          </span>
                        </div>
                        <h3 className="font-literary text-sm font-bold text-[#E8E0CF] truncate" title={item.title}>
                          {item.title}
                        </h3>
                        <p className="text-xs text-[#B89A5A] truncate">
                          {item.author}
                        </p>
                        <span className="inline-flex w-fit px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#10231A] text-[#89977C] border border-[#173125]">
                          {contentAvailabilityLabel(item.contentAvailability, isAr)}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-2 mt-2 border-t border-[#173125]">
                        {gutenbergId ? (
                          <button
                            onClick={() => void handleDownload(gutenbergId, item.title)}
                            className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#173125] hover:bg-[#1F4432] text-[11px] font-semibold text-[#D2BB82] flex items-center justify-center gap-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D2BB82]"
                          >
                            <Download className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{isAr ? 'تنزيل نص كامل' : 'Download full text'}</span>
                          </button>
                        ) : canRead ? (
                          <button
                            onClick={() => handleSourceView(item)}
                            className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#173125] hover:bg-[#1F4432] text-[11px] font-semibold text-[#D2BB82] flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>{item.contentAvailability === 'PREVIEW' ? (isAr ? 'قراءة المقتطفات' : 'Read preview') : (isAr ? 'قراءة فورية' : 'Read now')}</span>
                          </button>
                        ) : item.externalUrl ? (
                          <a
                            href={item.externalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#10231A] hover:bg-[#173125] text-[11px] font-semibold text-[#D2BB82] flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>{isAr ? 'عرض المصدر' : 'View source'}</span>
                          </a>
                        ) : (
                          <span className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#10231A] text-[11px] font-medium text-[#89977C] flex items-center justify-center">
                            {isAr ? 'بيانات وصفية فقط' : 'Metadata only'}
                          </span>
                        )}
                        <button
                          onClick={() => void handleSubmitForIngestion(item)}
                          disabled={isSubmitted}
                          className={`py-1.5 px-3 rounded-xl text-[11px] font-medium border flex items-center gap-1 transition-all ${
                            isSubmitted
                              ? 'bg-[#10231A] border-[#687B61] text-[#89977C]'
                              : 'bg-[#07110D] border-[#173125] hover:border-[#B89A5A] text-[#E8E0CF]'
                          }`}
                        >
                          {isSubmitted ? <Check className="w-3.5 h-3.5 text-[#D2BB82]" /> : <Plus className="w-3.5 h-3.5 text-[#B89A5A]" />}
                          <span>{isSubmitted ? (isAr ? 'قيد المراجعة' : 'Under review') : (isAr ? 'إرسال للمراجعة' : 'Submit for review')}</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AccessibleDialog>
  );
};
