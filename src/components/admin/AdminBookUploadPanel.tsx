import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  FileCheck2,
  FileUp,
  LoaderCircle,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { bookFilesApi } from "../../api/bookFiles";
import { Book, FileFormat } from "../../types";

const MAX_BYTES = 50 * 1024 * 1024;
const formatForFile = (
  file: File,
): { format: FileFormat; mimeType: string } | null => {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pdf")
    return { format: "PDF", mimeType: file.type || "application/pdf" };
  if (extension === "epub")
    return { format: "EPUB", mimeType: file.type || "application/epub+zip" };
  if (extension === "txt")
    return { format: "TXT", mimeType: file.type || "text/plain" };
  if (extension === "html" || extension === "htm")
    return { format: "HTML", mimeType: file.type || "text/html" };
  return null;
};

interface Props {
  books: Book[];
  canUploadBooks: boolean;
  isAr: boolean;
  addToast: (
    message: string,
    messageAr: string,
    type?: "info" | "success" | "warning" | "error",
  ) => void;
}

export const AdminBookUploadPanel: React.FC<Props> = ({
  books,
  canUploadBooks,
  isAr,
  addToast,
}) => {
  const [bookId, setBookId] = useState("");
  const [editionId, setEditionId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [readingAllowed, setReadingAllowed] = useState(true);
  const [downloadAllowed, setDownloadAllowed] = useState(true);
  const [offlineAllowed, setOfflineAllowed] = useState(false);
  const [phase, setPhase] = useState<
    "idle" | "signing" | "uploading" | "verifying" | "complete" | "error"
  >("idle");
  const [completedName, setCompletedName] = useState("");

  useEffect(() => {
    if (!books.length) {
      setBookId("");
      setEditionId("");
      return;
    }
    if (!books.some((book) => book.id === bookId)) setBookId(books[0].id);
  }, [bookId, books]);

  const selectedBook = useMemo(
    () => books.find((book) => book.id === bookId) || null,
    [bookId, books],
  );
  useEffect(() => {
    const editions = selectedBook?.editions || [];
    if (!editions.length) {
      setEditionId("");
      return;
    }
    if (!editions.some((edition) => edition.id === editionId))
      setEditionId(editions[0].id);
  }, [editionId, selectedBook]);
  const selectedEdition = useMemo(
    () =>
      selectedBook?.editions.find((edition) => edition.id === editionId) ||
      null,
    [editionId, selectedBook],
  );

  const busy =
    phase === "signing" || phase === "uploading" || phase === "verifying";
  const phaseLabel =
    phase === "signing"
      ? isAr
        ? "يجري إنشاء رابط الرفع الآمن…"
        : "Creating secure upload link…"
      : phase === "uploading"
        ? isAr
          ? "يجري رفع الملف إلى التخزين الخاص…"
          : "Uploading to private storage…"
        : phase === "verifying"
          ? isAr
            ? "يجري فحص الملف وتثبيت سجل الحقوق…"
            : "Scanning file and recording rights…"
          : null;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canUploadBooks) {
      addToast(
        "Your account does not have permission to upload books.",
        "لا يملك حسابك صلاحية رفع الكتب.",
        "error",
      );
      return;
    }
    if (!selectedBook || !selectedEdition || !file) {
      addToast(
        "Choose a catalog book, edition, and file first.",
        "اختر كتاباً وإصداراً وملفاً أولاً.",
        "warning",
      );
      return;
    }
    if (file.size > MAX_BYTES) {
      addToast(
        "Files larger than 50MB are not allowed by this storage policy.",
        "لا تسمح سياسة التخزين الحالية بملفات أكبر من 50MB.",
        "error",
      );
      return;
    }
    const classified = formatForFile(file);
    if (!classified) {
      addToast(
        "Only PDF, EPUB, TXT, and HTML files are supported.",
        "تدعم الواجهة ملفات PDF وEPUB وTXT وHTML فقط.",
        "error",
      );
      return;
    }
    if (!readingAllowed && offlineAllowed) {
      addToast(
        "Offline access requires reader access.",
        "يتطلب الوصول دون اتصال السماح بالقراءة.",
        "warning",
      );
      return;
    }

    setPhase("signing");
    setCompletedName("");
    try {
      const target = (
        await bookFilesApi.createDirectUpload(
          selectedBook.id,
          selectedEdition.id,
          classified,
        )
      ).data;
      setPhase("uploading");
      let stagedKey: string;
      if (target.mode === "signed") {
        // S3-compatible production storage: browser PUTs directly to the signed URL.
        await bookFilesApi.uploadToSignedTarget(target, file);
        stagedKey = target.temporaryStorageKey;
      } else {
        // Local development storage: the same bytes stage through the API and then
        // pass the identical verification, malware scan, rights, and commit path.
        if (file.size > target.maxBytes) {
          throw new Error(
            isAr
              ? `حجم الملف يتجاوز سياسة التخزين (${Math.floor(target.maxBytes / 1048576)}MB).`
              : `The file exceeds the ${Math.floor(target.maxBytes / 1048576)}MB storage policy.`,
          );
        }
        stagedKey = (
          await bookFilesApi.stageServerBody(selectedBook.id, selectedEdition.id, classified, file)
        ).data.temporaryStorageKey;
      }
      setPhase("verifying");
      await bookFilesApi.completeDirectUpload(
        selectedBook.id,
        selectedEdition.id,
        {
          format: classified.format,
          mimeType: classified.mimeType,
          temporaryStorageKey: stagedKey,
          originalName: file.name,
          readingAllowed,
          downloadAllowed,
          offlineAllowed,
          rights: {
            bookId: selectedBook.id,
            editionId: selectedEdition.id,
            status: selectedEdition.rightsStatus,
          },
        },
      );
      setCompletedName(file.name);
      setPhase("complete");
      setFile(null);
      addToast(
        "The file passed verification and was stored permanently.",
        "اجتاز الملف الفحص وتم تخزينه بشكل دائم.",
        "success",
      );
    } catch (error) {
      setPhase("error");
      const message =
        error instanceof Error
          ? error.message
          : "Upload could not be completed.";
      addToast(
        message,
        "تعذر رفع الملف أو تخزينه.",
        "error",
      );
    }
  };
  const requiredLabel = <span className="text-[#D2BB82]"> *</span>;
  return (
    <section className="p-6 rounded-3xl bg-[#0B1712] border border-[#173125] space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#D2BB82]">
            <UploadCloud className="w-4 h-4" />
            {isAr ? "رفع كتاب دائم إلى Nexara" : "Permanent book upload to Nexara"}
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#89977C]">
            {isAr
              ? "يرفع المشرف الملف، ويفحصه الخادم، ثم يحفظه في تخزين Nexara الدائم."
              : "The administrator selects a file; the server checks it and stores it permanently in Nexara."}
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#687B61]/60 bg-[#10231A] text-[10px] text-[#B5D3A1]">
          <ShieldCheck className="w-3.5 h-3.5" />
          {isAr ? "فحص + تخزين دائم" : "Scan + durable storage"}
        </div>
      </div>

      <div className="rounded-2xl border border-[#B89A5A]/40 bg-[#10231A] p-4 text-xs leading-relaxed text-[#D2BB82]">
        {isAr
          ? "اختر الملف فقط؛ سيُخزّن دائمًا في Nexara ويُربط بالإصدار تلقائيًا بعد فحص سلامته."
          : "Choose the file only; Nexara will store it permanently and attach it to the edition automatically after safety checks."}
      </div>

      {!books.length ? (
        <div className="rounded-2xl border border-[#B89A5A]/40 bg-[#10231A] p-4 text-xs text-[#D2BB82]">
          {isAr
            ? "أنشئ سجل الكتاب والإصدار أولاً، ثم اختر الملف."
            : "Create the book and edition first, then choose the file."}
          </div>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-[11px] font-semibold text-[#89977C]">
              {isAr ? "الكتاب في الفهرس" : "Catalog book"}
              <select
                value={bookId}
                onChange={(event) => setBookId(event.target.value)}
                disabled={busy || !canUploadBooks}
                className="mt-1.5 w-full bg-[#07110D] border border-[#173125] rounded-xl px-3 py-2.5 text-xs text-[#E8E0CF]"
              >
                <option value="" disabled>
                  {isAr ? "اختر كتاباً" : "Select a book"}
                </option>
                {books.map((book) => (
                  <option value={book.id} key={book.id}>
                    {isAr ? book.titleAr : book.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-[#89977C]">
              {isAr ? "الإصدار" : "Edition"}
              <select
                value={editionId}
                onChange={(event) => setEditionId(event.target.value)}
                disabled={busy || !canUploadBooks || !(selectedBook?.editions.length)}
                className="mt-1.5 w-full bg-[#07110D] border border-[#173125] rounded-xl px-3 py-2.5 text-xs text-[#E8E0CF]"
              >
                <option value="" disabled>
                  {isAr ? "اختر إصداراً" : "Select an edition"}
                </option>
                {selectedBook?.editions.map((edition) => (
                  <option value={edition.id} key={edition.id}>
                    {edition.languageName} · {edition.publicationYear}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedEdition && (
            <div className="rounded-xl border border-[#687B61]/45 bg-[#07110D] px-3 py-2 text-[11px] text-[#B5D3A1]">
              <FileCheck2 className="inline w-3.5 h-3.5 me-1" />
              {isAr ? "سيُربط الملف بهذا الإصدار تلقائيًا." : "The file will be attached to this edition automatically."}
            </div>
          )}

          <label className="block text-[11px] font-semibold text-[#89977C]">
            {isAr ? "ملف الكتاب" : "Book file"}
            {requiredLabel}
            <input
              type="file"
              accept=".pdf,.epub,.txt,.html,.htm,application/pdf,application/epub+zip,text/plain,text/html"
              disabled={busy || !canUploadBooks}
              onChange={(event) => {
                setFile(event.target.files?.[0] || null);
                setPhase("idle");
              }}
              className="mt-1.5 block w-full text-xs text-[#BDB5A5] file:mr-3 file:rounded-lg file:border-0 file:bg-[#173125] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#D2BB82]"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 rounded-2xl bg-[#07110D] border border-[#173125]">
            {[
              { checked: readingAllowed, set: setReadingAllowed, label: isAr ? "السماح بالقراءة" : "Allow reading" },
              { checked: downloadAllowed, set: setDownloadAllowed, label: isAr ? "السماح بالتنزيل" : "Allow downloads" },
              { checked: offlineAllowed, set: setOfflineAllowed, label: isAr ? "وصول دون اتصال" : "Offline access" },
            ].map((option) => (
              <label key={option.label} className="flex items-center gap-2 text-xs text-[#BDB5A5]">
                <input
                  type="checkbox"
                  checked={option.checked}
                  onChange={(event) => option.set(event.target.checked)}
                  disabled={busy || !canUploadBooks}
                  className="accent-[#B89A5A]"
                />
                {option.label}
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="text-[11px] text-[#89977C]">
              {file
                ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)}MB`
                : isAr
                  ? "الحد الأقصى: 50MB. الأنواع: PDF، EPUB، TXT، HTML."
                  : "Maximum: 50MB. Types: PDF, EPUB, TXT, HTML."}
              {phaseLabel && <span className="ms-2 text-[#D2BB82]">{phaseLabel}</span>}
            </div>
            <button
              type="submit"
              disabled={busy || !file || !canUploadBooks || !editionId}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#B89A5A] text-[#07110D] font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? (
                <LoaderCircle className="w-4 h-4 animate-spin" />
              ) : phase === "complete" ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <FileUp className="w-4 h-4" />
              )}
              {busy
                ? isAr
                  ? "جارٍ المعالجة…"
                  : "Processing…"
                : isAr
                  ? "رفع وفحص وتسجيل الحقوق"
                  : "Upload, scan & record rights"}
            </button>
          </div>

          {phase === "complete" && (
            <div role="status" className="rounded-xl border border-[#467A58] bg-[#10231A] px-3 py-2 text-xs text-[#B5D3A1]">
              {isAr
                ? `تم حفظ «${completedName}» بأمان في المكتبة.`
                : `“${completedName}” was securely stored in the library.`}
            </div>
          )}
          {phase === "error" && (
            <div role="alert" className="rounded-xl border border-[#8B3A3A] bg-[#1E0F11] px-3 py-2 text-xs text-[#F3D5D7]">
              {isAr
                ? "تعذر رفع الملف أو تخزينه."
                : "The file could not be uploaded or stored."}
            </div>
          )}
        </form>
      )}
    </section>
  );
};
