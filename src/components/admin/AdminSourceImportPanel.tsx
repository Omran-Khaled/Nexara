import React, { useState } from 'react';
import { BookOpenCheck, Loader2, ShieldCheck } from 'lucide-react';
import { ingestionApi } from '../../api/ingestion';
import { toUiError } from '../../api/http';
import { useAppStore } from '../../stores/useAppStore';

type ApprovedSource = 'Gutenberg' | 'Wikisource' | 'ArabicCollectionsOnline';

const sourceDetails: Record<ApprovedSource, { en: string; ar: string; placeholder: string }> = {
  Gutenberg: { en: 'Project Gutenberg — numeric eBook ID only.', ar: 'مشروع غوتنبرغ — رقم الكتاب الرقمي فقط.', placeholder: '1342' },
  Wikisource: { en: 'Wikisource — exact page title; only pages with explicit public-domain or CC BY-SA evidence pass.', ar: 'ويكي مصدر — عنوان الصفحة الدقيق؛ لا يمر إلا العمل الذي يحمل دليلاً صريحاً على الملكية العامة أو CC BY-SA.', placeholder: 'Pride and Prejudice' },
  ArabicCollectionsOnline: { en: 'Arabic Collections Online — permanent title identifier, e.g. columbia_aco001050. The title page must expose its official PDF.', ar: 'المجموعات العربية على الإنترنت — معرّف العنوان الدائم، مثل columbia_aco001050. يجب أن تعرض صفحة العنوان ملف PDF الرسمي.', placeholder: 'columbia_aco001050' },
};

export const AdminSourceImportPanel: React.FC = () => {
  const { language, addToast, role } = useAppStore();
  const isAr = language === 'ar';
  const [source, setSource] = useState<ApprovedSource>('Gutenberg');
  const [externalId, setExternalId] = useState('');
  const [wikisourceLanguage, setWikisourceLanguage] = useState(isAr ? 'ar' : 'en');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const canManage = role === 'ADMIN';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) {
      addToast('Only an administrator may submit a source for review.', 'لا يحق إلا للمدير إرسال مصدر للمراجعة.', 'error');
      return;
    }
    if (!externalId.trim() || !confirmed) {
      addToast('Enter the source identifier and confirm the rights-review notice.', 'أدخل معرّف المصدر وأكّد إشعار مراجعة الحقوق.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      if (source === 'Gutenberg') await ingestionApi.startGutenberg(externalId.trim());
      else if (source === 'Wikisource') await ingestionApi.startWikisource(externalId.trim(), wikisourceLanguage.trim().toLowerCase());
      else await ingestionApi.startAco(externalId.trim());
      setExternalId('');
      setConfirmed(false);
      addToast('Candidate submitted for source, rights, integrity, and content checks. It has not been stored or published.', 'أُرسل المرشح إلى فحوص المصدر والحقوق والسلامة والمحتوى. لم يُحفظ ولم يُنشر بعد.', 'success');
    } catch (error) {
      const uiError = toUiError(error);
      addToast(uiError.message, uiError.messageAr, 'error');
    } finally { setSubmitting(false); }
  };

  const detail = sourceDetails[source];
  return (
    <section className="rounded-2xl border border-[#173125] bg-[#0B1712] p-5 space-y-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-[#173125] p-2 text-[#D2BB82]"><BookOpenCheck className="h-5 w-5" /></div>
        <div>
          <h2 className="font-literary text-lg font-bold text-[#E8E0CF]">{isAr ? 'استيراد من مصدر معتمد' : 'Approved-source import'}</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[#89977C]">{isAr ? 'تنشئ هذه الخطوة مرشح مراجعة فقط. لا تُنسخ الملفات إلى تخزين Nexara ولا يُنشر الكتاب إلا بعد موافقة مدير صريحة من مسار المراجعة.' : 'This step creates a review candidate only. Nexara does not store a file or publish a book until an administrator explicitly approves it in the review pipeline.'}</p>
        </div>
      </div>
      <div className="rounded-xl border border-[#B89A5A]/40 bg-[#10231A] p-3 text-[11px] leading-5 text-[#D2BB82]">
        <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
        {isAr ? 'تقبل Nexara فقط حالة ملكية عامة أو ترخيصاً مفتوحاً مثبتاً، وتحفظ رابط الدليل والرابط الدائم وبصمة SHA-256 عند الموافقة.' : 'Nexara accepts only evidenced public-domain or open-license works, and retains the proof URL, permalink, and SHA-256 checksum at approval.'}
      </div>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-xs text-[#BDB5A5]">
          <span>{isAr ? 'المصدر' : 'Source'}</span>
          <select value={source} onChange={(event) => { setSource(event.target.value as ApprovedSource); setExternalId(''); setConfirmed(false); }} className="w-full rounded-xl border border-[#173125] bg-[#07110D] px-3 py-2.5 text-[#E8E0CF] outline-none">
            <option value="Gutenberg">Project Gutenberg</option>
            <option value="Wikisource">Wikisource</option>
            <option value="ArabicCollectionsOnline">Arabic Collections Online (ACO)</option>
          </select>
        </label>
        {source === 'Wikisource' && <label className="space-y-1.5 text-xs text-[#BDB5A5]">
          <span>{isAr ? 'لغة ويكي مصدر (رمز فرعي)' : 'Wikisource language subdomain'}</span>
          <input value={wikisourceLanguage} onChange={(event) => setWikisourceLanguage(event.target.value)} maxLength={12} pattern="[A-Za-z]{2,12}" required className="w-full rounded-xl border border-[#173125] bg-[#07110D] px-3 py-2.5 text-[#E8E0CF] outline-none" placeholder="ar / en" />
        </label>}
        <label className={`space-y-1.5 text-xs text-[#BDB5A5] ${source === 'Wikisource' ? '' : 'md:col-span-1'}`}>
          <span>{isAr ? 'معرّف المصدر أو عنوانه' : 'Source identifier or page title'}</span>
          <input value={externalId} onChange={(event) => setExternalId(event.target.value)} required maxLength={240} className="w-full rounded-xl border border-[#173125] bg-[#07110D] px-3 py-2.5 text-[#E8E0CF] outline-none" placeholder={detail.placeholder} />
        </label>
        <p className="md:col-span-2 text-[11px] leading-5 text-[#89977C]">{isAr ? detail.ar : detail.en}</p>
        <label className="md:col-span-2 flex items-start gap-2 text-xs leading-5 text-[#BDB5A5]">
          <input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" className="mt-1 accent-[#B89A5A]" />
          <span>{isAr ? 'أفهم أن الإرسال لا يعني الإذن بالنشر، وأنني سأراجع دليل الحقوق والملف والبصمة في المسار قبل الموافقة على الحفظ الدائم.' : 'I understand that submission is not authorization to publish, and that I must review the rights evidence, file, and checksum in the pipeline before approving permanent storage.'}</span>
        </label>
        <div className="md:col-span-2 flex justify-end">
          <button type="submit" disabled={!canManage || submitting} className="inline-flex items-center gap-2 rounded-xl bg-[#B89A5A] px-4 py-2.5 text-xs font-bold text-[#07110D] disabled:cursor-not-allowed disabled:bg-[#687B61]">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isAr ? 'إرسال للمراجعة فقط' : 'Submit for review only'}
          </button>
        </div>
      </form>
    </section>
  );
};
