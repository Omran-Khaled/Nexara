import { ShieldCheck, TreePine } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { translations } from '../../i18n/translations';
import { BRAND_CONFIG } from '../../config/brand';

/**
 * Global application footer.
 *
 * Layout model (viewport-proof, not breakpoint-patched):
 * - Below `lg` (<1024px) the footer stacks vertically and centers its three zones
 *   (brand, navigation, trust badge). This covers small phones (320px) through
 *   tablets without horizontal overflow because every zone clamps itself
 *   (`min-w-0`/`shrink-0`) and the navigation row wraps internally instead of
 *   pushing siblings out of the container.
 * - At `lg` and above the zones share one row (`justify-between`) where navigation
 *   may still wrap internally. Arabic labels are longer than English ones, so the
 *   row switch happens at 1024px; switching at 768px crowded the three zones
 *   against each other in RTL.
 * - Direction (LTR/RTL), fonts and logical alignment are inherited from the document;
 *   this component hard-codes no direction.
 * - Vertical rhythm is fixed padding in normal flow, so the footer never overlaps
 *   main content regardless of viewport height.
 */
export const SiteFooter = () => {
  const { language, setViewMode, setReadingRitualOpen, setQuoteStudioOpen } = useAppStore();
  const t = translations[language as keyof typeof translations] ?? translations.en;
  const isAr = language === 'ar';

  const links: Array<{ id: string; label: string; accent?: boolean; action: () => void }> = [
    { id: 'forest', label: t.nav.forest, action: () => setViewMode('forest') },
    { id: 'library', label: t.nav.library, action: () => setViewMode('library') },
    { id: 'ritual', label: t.ritual.title, action: () => setReadingRitualOpen(true) },
    { id: 'quotes', label: t.quotes.title, action: () => setQuoteStudioOpen(true) },
    { id: 'admin', label: t.nav.admin, accent: true, action: () => setViewMode('admin') },
  ];

  return (
    <footer className="mt-8 border-t border-[#173125] bg-[#07110D] sm:mt-12">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="flex flex-col items-center gap-6 text-center lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:text-start">
          {/* Brand */}
          <div className="flex min-w-0 flex-col items-center gap-3 sm:flex-row">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#687B61]/40 bg-[#173125]"
              aria-hidden="true"
            >
              <TreePine className="h-4 w-4 text-[#D2BB82]" />
            </div>
            <div className="min-w-0">
              <span className="font-literary block text-base font-bold leading-tight text-[#E8E0CF]">
                {isAr ? BRAND_CONFIG.nameAr : BRAND_CONFIG.name}
              </span>
              <span className="block break-words text-xs leading-snug text-[#89977C]">{t.footer.tagline}</span>
            </div>
          </div>

          {/* Navigation */}
          <nav
            aria-label={t.footer.navigation}
            className="flex max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-1 lg:justify-end"
          >
            {links.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={link.action}
                className={`rounded-lg px-2.5 py-1.5 text-xs transition-colors hover:bg-[#173125]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B89A5A] ${
                  link.accent ? 'text-[#D2BB82] hover:text-[#E8E0CF]' : 'text-[#89977C] hover:text-[#E8E0CF]'
                }`}
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Trust badge */}
          <div className="flex shrink-0 items-center gap-1.5 font-mono text-xs text-[#89977C]">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#687B61]" aria-hidden="true" />
            <span>{t.footer.openAccessBadge}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
