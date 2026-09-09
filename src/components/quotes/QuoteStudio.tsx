import React, { useState, useRef } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { translations } from '../../i18n/translations';
import { QuoteCardTheme } from '../../types';
import { X, Quote, Download, Copy, Check, Palette, TreePine } from 'lucide-react';
import { motion } from 'motion/react';
import { AccessibleDialog } from '../ui/AccessibleDialog';

export const QuoteStudio: React.FC = () => {
  const { isQuoteStudioOpen, setQuoteStudioOpen, activeQuoteData, language, addToast } = useAppStore();

  const [quoteText, setQuoteText] = useState(
    activeQuoteData?.selectedText ||
      'Reading is that fruitful conversation with the finest minds of past centuries.'
  );
  const [author, setAuthor] = useState(activeQuoteData?.authorName || 'René Descartes');
  const [workTitle, setWorkTitle] = useState(activeQuoteData?.bookTitle || 'Discourse on the Method');
  const [theme, setTheme] = useState<QuoteCardTheme>('forest');
  const [fontSize, setFontSize] = useState<number>(20);
  const [copied, setCopied] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const t = translations[language];
  const isAr = language === 'ar';

  if (!isQuoteStudioOpen) return null;

  const handleCopyText = () => {
    const fullText = `"${quoteText}"\n— ${author}, 《${workTitle}》\nShared via Nexara • Digital Library & Forest of Literature`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast('Quote copied with full citation.', 'تم نسخ الاقتباس مع التوثيق الكامل.', 'success');
  };

  const handleExportImage = () => {
    const element = cardRef.current;
    if (!element) return;

    // Create an offscreen HTML5 canvas to generate a high-res PNG image
    const canvas = document.createElement('canvas');
    const scale = 2;
    const width = 600 * scale;
    const height = 400 * scale;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (theme === 'parchment') {
      ctx.fillStyle = '#F4EEDB';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#B89A5A';
      ctx.lineWidth = 4;
      ctx.strokeRect(20 * scale, 20 * scale, (600 - 40) * scale, (400 - 40) * scale);
      ctx.fillStyle = '#2C2416';
    } else if (theme === 'forest') {
      ctx.fillStyle = '#07110D';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#687B61';
      ctx.lineWidth = 3;
      ctx.strokeRect(20 * scale, 20 * scale, (600 - 40) * scale, (400 - 40) * scale);
      ctx.fillStyle = '#E8E0CF';
    } else if (theme === 'night') {
      ctx.fillStyle = '#090D11';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#3A4E68';
      ctx.lineWidth = 2;
      ctx.strokeRect(20 * scale, 20 * scale, (600 - 40) * scale, (400 - 40) * scale);
      ctx.fillStyle = '#E8E0CF';
    } else if (theme === 'crimson') {
      ctx.fillStyle = '#1A0B0E';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#B89A5A';
      ctx.lineWidth = 3;
      ctx.strokeRect(20 * scale, 20 * scale, (600 - 40) * scale, (400 - 40) * scale);
      ctx.fillStyle = '#F3D5D7';
    } else {
      ctx.fillStyle = '#0B1712';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#E8E0CF';
    }

    ctx.fillStyle = '#B89A5A';
    ctx.font = `italic ${40 * scale}px serif`;
    ctx.fillText('“', 40 * scale, 70 * scale);

    ctx.font = `italic ${fontSize * scale}px "Literata", "Amiri", serif`;
    ctx.fillStyle = theme === 'parchment' ? '#2C2416' : '#E8E0CF';

    const words = quoteText.split(' ');
    let line = '';
    let y = 110 * scale;
    const maxWidth = (600 - 100) * scale;
    const lineHeight = (fontSize + 12) * scale;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, 50 * scale, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 50 * scale, y);

    ctx.fillStyle = '#D2BB82';
    ctx.font = `bold ${14 * scale}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(`— ${author}`, 50 * scale, 340 * scale);

    ctx.fillStyle = theme === 'parchment' ? '#7A6B53' : '#89977C';
    ctx.font = `${12 * scale}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(`《${workTitle}》 • Nexara Forest`, 50 * scale, 365 * scale);

    const link = document.createElement('a');
    link.download = `nexara-quote-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    addToast('Quote Card downloaded as PNG image.', 'تم تحميل بطاقة الاقتباس كصورة PNG.', 'success');
  };

  const getThemeContainerClass = (t: QuoteCardTheme) => {
    switch (t) {
      case 'parchment':
        return 'bg-[#F4EEDB] text-[#2C2416] border-[#B89A5A] shadow-amber-900/10';
      case 'forest':
        return 'bg-[#07110D] text-[#E8E0CF] border-[#687B61]/60 shadow-emerald-950/30';
      case 'night':
        return 'bg-[#090D11] text-[#E8E0CF] border-[#3A4E68]/60 shadow-blue-950/30';
      case 'crimson':
        return 'bg-[#1A0B0E] text-[#F3D5D7] border-[#B89A5A]/60 shadow-rose-950/30';
      case 'minimal':
      default:
        return 'bg-[#0B1712] text-[#E8E0CF] border-[#173125]';
    }
  };

  return (
    <AccessibleDialog open={isQuoteStudioOpen} onClose={() => setQuoteStudioOpen(false)} title={isAr ? 'استوديو الاقتباسات' : 'Quote studio'} initialFocusRef={closeButtonRef} className="w-full max-w-4xl my-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-4xl bg-[#0B1712] border border-[#173125] rounded-3xl shadow-2xl overflow-hidden text-[#E8E0CF] my-6 flex flex-col"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 bg-[#07110D]/90 border-b border-[#173125] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#173125] text-[#D2BB82]">
              <Quote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-literary text-xl font-bold">{t.quotes.title}</h2>
              <p className="text-xs text-[#89977C]">{t.quotes.subtitle}</p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            onClick={() => setQuoteStudioOpen(false)}
            aria-label={isAr ? 'إغلاق استوديو الاقتباسات' : 'Close quote studio'}
            className="p-2 rounded-xl bg-[#10231A] hover:bg-[#173125] text-[#89977C] hover:text-[#E8E0CF]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Studio Workspace: Controls (Left) & Live Card Preview (Right) */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto">
          
          {/* Controls Editor (Left) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Quote Text Input */}
            <div className="space-y-1.5">
              <label htmlFor="quote-studio-text" className="text-xs font-semibold text-[#89977C]">{isAr ? 'نص الاقتباس' : 'Quote Passage'}</label>
              <textarea
                id="quote-studio-text"
                value={quoteText}
                onChange={(e) => setQuoteText(e.target.value)}
                rows={4}
                className="w-full bg-[#07110D] border border-[#173125] rounded-2xl p-3 text-xs sm:text-sm text-[#E8E0CF] focus:outline-none focus:border-[#687B61]"
              />
            </div>

            {/* Author & Work inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="quote-studio-author" className="text-[11px] font-semibold text-[#89977C]">{isAr ? 'المؤلف' : 'Author'}</label>
                <input
                  id="quote-studio-author"
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full bg-[#07110D] border border-[#173125] rounded-xl px-3 py-2 text-xs text-[#E8E0CF] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="quote-studio-work" className="text-[11px] font-semibold text-[#89977C]">{isAr ? 'اسم العمل / الكتاب' : 'Book Title'}</label>
                <input
                  id="quote-studio-work"
                  type="text"
                  value={workTitle}
                  onChange={(e) => setWorkTitle(e.target.value)}
                  className="w-full bg-[#07110D] border border-[#173125] rounded-xl px-3 py-2 text-xs text-[#E8E0CF] focus:outline-none"
                />
              </div>
            </div>

            {/* Theme Preset Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#89977C] flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" />
                <span>{isAr ? 'الطابع البصري' : 'Visual Theme'}</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'forest', label: 'Forest', labelAr: 'غابة' },
                  { id: 'parchment', label: 'Parchment', labelAr: 'مخطوطة' },
                  { id: 'night', label: 'Night', labelAr: 'ليل' },
                  { id: 'crimson', label: 'Crimson', labelAr: 'أندلسي' },
                  { id: 'minimal', label: 'Minimal', labelAr: 'بسيط' },
                ].map((th) => (
                  <button
                    key={th.id}
                    onClick={() => setTheme(th.id as any)}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                      theme === th.id
                        ? 'bg-[#173125] border-[#B89A5A] text-[#D2BB82]'
                        : 'bg-[#07110D] border-[#173125] text-[#89977C] hover:text-[#E8E0CF]'
                    }`}
                  >
                    {isAr ? th.labelAr : th.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[#89977C]">
                <label htmlFor="quote-studio-font-size">{isAr ? 'حجم الخط' : 'Font Size'}</label>
                <span className="font-mono">{fontSize}px</span>
              </div>
              <input
                id="quote-studio-font-size"
                type="range"
                min="14"
                max="28"
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value))}
                className="w-full h-1 bg-[#173125] rounded-lg appearance-none cursor-pointer accent-[#B89A5A]"
              />
            </div>
          </div>

          {/* Live Card Preview (Right) */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center space-y-4">
            
            <div
              ref={cardRef}
              id="quote-card-preview"
              className={`w-full aspect-[3/2] max-w-md p-6 sm:p-8 rounded-3xl border-2 shadow-2xl flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${getThemeContainerClass(
                theme
              )}`}
            >
              {/* Subtle watermark */}
              <div className="absolute top-4 right-4 opacity-20 pointer-events-none">
                <TreePine className="w-12 h-12" />
              </div>

              <div className="space-y-3 relative z-10">
                <Quote className="w-8 h-8 text-[#B89A5A]/80 mb-2" />
                <p
                  className="font-literary italic leading-relaxed"
                  style={{ fontSize: `${fontSize}px` }}
                >
                  "{quoteText}"
                </p>
              </div>

              <div className="pt-4 border-t border-current/20 flex items-end justify-between relative z-10">
                <div>
                  <div className="font-literary font-bold text-sm text-[#D2BB82]">{author}</div>
                  <div className="text-xs opacity-75 font-serif">《{workTitle}》</div>
                </div>

                <div className="text-[10px] font-mono opacity-50 uppercase tracking-widest">
                  Nexara Library
                </div>
              </div>
            </div>

            {/* Export & Copy Action Buttons */}
            <div className="flex items-center gap-3 w-full max-w-md">
              <button
                onClick={handleCopyText}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#07110D] border border-[#173125] hover:border-[#687B61] text-xs font-semibold text-[#E8E0CF] transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-[#687B61]" /> : <Copy className="w-4 h-4 text-[#B89A5A]" />}
                <span>{copied ? (isAr ? 'تم النسخ!' : 'Copied!') : t.quotes.copyText}</span>
              </button>

              <button
                onClick={handleExportImage}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#B89A5A] hover:bg-[#D2BB82] text-[#07110D] font-bold text-xs transition-colors shadow-lg"
              >
                <Download className="w-4 h-4" />
                <span>{t.quotes.downloadImage}</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AccessibleDialog>
  );
};
