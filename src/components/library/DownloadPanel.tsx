import React, { useEffect, useState } from 'react';
import { Download, FileText, LoaderCircle, ShieldAlert, ShieldCheck } from 'lucide-react';
import { downloadsApi, DownloadAvailability } from '../../api/downloads';
import { toUiError } from '../../api/http';
import { useAppStore } from '../../stores/useAppStore';

interface DownloadPanelProps {
  bookId: string;
  editionId: string;
  title: string;
  titleAr: string;
  compact?: boolean;
}

type PanelState = { status: 'loading' | 'ready' | 'error'; data: DownloadAvailability | null };

export const DownloadPanel: React.FC<DownloadPanelProps> = ({ bookId, editionId, title, titleAr, compact = false }) => {
  const { isAuthenticated, language, addToast } = useAppStore();
  const isAr = language === 'ar';
  const [state, setState] = useState<PanelState>({ status: 'loading', data: null });
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated) {
      setState({ status: 'ready', data: null });
      return () => { cancelled = true; };
    }
    setState({ status: 'loading', data: null });
    void downloadsApi.availability(bookId, editionId)
      .then(({ data }) => { if (!cancelled) setState({ status: 'ready', data }); })
      .catch(() => { if (!cancelled) setState({ status: 'error', data: null }); });
    return () => { cancelled = true; };
  }, [bookId, editionId, isAuthenticated]);

  const requestDownload = async (fileId: string) => {
    const file = state.data?.files.find((value) => value.id === fileId && value.availability === 'AVAILABLE');
    if (!file) return;
    setActiveFileId(fileId);
    try {
      await downloadsApi.downloadOriginal(bookId, editionId, file, isAr ? titleAr : title);
      addToast(
        `Downloading the verified original ${file.format} file.`,
        `جارٍ تنزيل ملف ${file.format} الأصلي المتحقق منه.`,
        'success',
      );
    } catch (error) {
      const uiError = toUiError(error);
      addToast(uiError.message, uiError.messageAr, 'error');
    } finally {
      setActiveFileId(null);
    }
  };

  if (!isAuthenticated) {
    return <span className="text-[11px] text-[#89977C]">{isAr ? 'سجّل الدخول للتحقق من إتاحة التنزيل.' : 'Sign in to verify download availability.'}</span>;
  }
  if (state.status === 'loading') {
    return <span className="inline-flex items-center gap-1.5 text-[11px] text-[#89977C]"><LoaderCircle className="w-3.5 h-3.5 animate-spin" />{isAr ? 'جارٍ التحقق من الملفات…' : 'Verifying files…'}</span>;
  }
  if (state.status === 'error') {
    return <span className="text-[11px] text-[#E7A1A1]">{isAr ? 'تعذر التحقق من إتاحة التنزيل.' : 'Download availability could not be verified.'}</span>;
  }

  const availability = state.data;
  if (!availability || !availability.sourceProviderAvailable) {
    return <span className="inline-flex items-center gap-1.5 text-[11px] text-[#E7A1A1]"><ShieldAlert className="w-3.5 h-3.5" />{isAr ? 'مصدر الملف غير متاح حالياً.' : 'The source provider is currently unavailable.'}</span>;
  }
  if (availability.files.length === 0) {
    return <span className="text-[11px] text-[#89977C]">{isAr ? 'لا يوجد ملف أصلي متاح للتنزيل لهذه الطبعة.' : 'No original file is available for this edition.'}</span>;
  }

  return (
    <section className={compact ? 'space-y-2' : 'p-4 rounded-2xl bg-[#10231A] border border-[#687B61]/40 space-y-3'} aria-label={isAr ? 'تنزيل الكتاب' : 'Book download'}>
      {!compact && (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${availability.permittedByRights ? 'border-[#687B61]/50 text-[#D2BB82] bg-[#173125]/40' : 'border-[#4A2528] text-[#E7A1A1] bg-[#1E0F11]'}`}>
              {availability.permittedByRights ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
              {availability.rightsStatus}
            </span>
            <span className="text-[#89977C]">{availability.licenseType}</span>
          </div>
          <p className="text-[11px] text-[#BDB5A5]">{isAr ? 'المصدر:' : 'Source:'} {availability.source}</p>
          <p className="text-[11px] text-[#89977C]">{isAr ? 'الإسناد:' : 'Attribution:'} {availability.attribution}</p>
        </div>
      )}
      <div className="space-y-2">
        {availability.files.map((file) => (
          <div key={file.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#173125] bg-[#0B1712] px-3 py-2">
            <div className="min-w-0 text-[11px]">
              <div className="flex items-center gap-1.5 font-mono text-[#D2BB82]"><FileText className="w-3.5 h-3.5" />{file.format} <span className="text-[#89977C]">· {file.sizeFormatted}</span></div>
              <div className="truncate text-[#89977C]">{file.availability === 'AVAILABLE' ? (isAr ? 'متاح للتنزيل المصرح' : 'Authorized download available') : (isAr ? 'غير متاح للتنزيل الكامل' : 'Full download unavailable')}</div>
            </div>
            {file.availability === 'AVAILABLE' && (
              <button
                id={`download-file-${file.id}`}
                onClick={() => void requestDownload(file.id)}
                disabled={activeFileId === file.id}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-[#687B61] px-2.5 py-1.5 text-[11px] font-semibold text-[#D2BB82] hover:bg-[#173125] disabled:opacity-60"
              >
                {activeFileId === file.id ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {isAr ? 'تنزيل' : 'Download'}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
