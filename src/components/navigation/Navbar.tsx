import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { translations } from '../../i18n/translations';
import { BRAND_CONFIG } from '../../config/brand';
import { SoundscapeType } from '../../types';
import { TreePine, BookOpen, Compass, Map, Sparkles, BookmarkCheck, Users, ShieldAlert, Search, Volume2, VolumeX, Globe, User, ChevronDown, Menu, X, Flame, CloudRain, Wind, Moon, Library as LibraryIcon, Quote } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AccessibleDialog } from '../ui/AccessibleDialog';

export const Navbar: React.FC = () => {
  const {
    language,
    setLanguage,
    viewMode,
    setViewMode,
    role,
    isAuthenticated,
    currentUser,
    setAuthModalOpen,
    activeSoundscape,
    setSoundscape,
    isAudioMuted,
    toggleAudioMute,
    audioVolume,
    setAudioVolume,
    setCommandPaletteOpen,
    setOnlineSearchOpen,
    setReadingRitualOpen,
    setQuoteStudioOpen,
    addToast,
    savedBookIds,
  } = useAppStore();

  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const audioMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (isAudioMenuOpen) setIsAudioMenuOpen(false);
      if (isUserMenuOpen) setIsUserMenuOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (isAudioMenuOpen && !audioMenuRef.current?.contains(target)) setIsAudioMenuOpen(false);
      if (isUserMenuOpen && !userMenuRef.current?.contains(target)) setIsUserMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [isAudioMenuOpen, isUserMenuOpen]);

  const t = translations[language];
  const isAr = language === 'ar';

  const soundscapes: { type: SoundscapeType; label: string; labelAr: string; icon: React.ReactNode }[] = [
    { type: 'silence', label: 'Silence', labelAr: 'صمت', icon: <VolumeX className="w-4 h-4" /> },
    { type: 'rain', label: 'Forest Rain', labelAr: 'مطر الغابة', icon: <CloudRain className="w-4 h-4" /> },
    { type: 'night-forest', label: 'Night Forest', labelAr: 'غابة ليلية', icon: <Moon className="w-4 h-4" /> },
    { type: 'fireplace', label: 'Fireplace', labelAr: 'موقد نار', icon: <Flame className="w-4 h-4" /> },
    { type: 'wind', label: 'Mountain Wind', labelAr: 'رياح الجبل', icon: <Wind className="w-4 h-4" /> },
    { type: 'library', label: 'Quiet Library', labelAr: 'سكينة المكتبة', icon: <LibraryIcon className="w-4 h-4" /> },
  ];

  const currentSoundscapeObj = soundscapes.find((s) => s.type === activeSoundscape);

  const navLinks = [
    {
      id: 'nav-link-forest',
      mode: 'forest' as const,
      label: t.nav.forest,
      icon: <TreePine className="w-4 h-4" />,
      accentColor: 'text-[#89977C]',
    },
    {
      id: 'nav-link-library',
      mode: 'library' as const,
      label: t.nav.library,
      icon: <BookOpen className="w-4 h-4" />,
      accentColor: 'text-[#D2BB82]',
    },
    {
      id: 'nav-link-discover',
      mode: 'discover' as const,
      label: t.nav.discover,
      icon: <Compass className="w-4 h-4" />,
      accentColor: 'text-[#B89A5A]',
    },
    {
      id: 'nav-link-paths',
      mode: 'paths' as const,
      label: t.nav.paths,
      icon: <Sparkles className="w-4 h-4" />,
      accentColor: 'text-[#89977C]',
    },
    {
      id: 'nav-link-map',
      mode: 'map' as const,
      label: t.nav.map,
      icon: <Map className="w-4 h-4" />,
      accentColor: 'text-[#D2BB82]',
    },
    {
      id: 'nav-link-mylibrary',
      mode: 'my-library' as const,
      label: t.nav.myLibrary,
      icon: <BookmarkCheck className="w-4 h-4" />,
      accentColor: 'text-[#89977C]',
      badge: savedBookIds.length > 0 ? savedBookIds.length : undefined,
    },
    {
      id: 'nav-link-community',
      mode: 'community' as const,
      label: t.nav.community,
      icon: <Users className="w-4 h-4" />,
      accentColor: 'text-[#89977C]',
    },
    {
      id: 'nav-link-admin',
      mode: 'admin' as const,
      label: t.nav.admin,
      icon: <ShieldAlert className="w-4 h-4" />,
      accentColor: 'text-[#D2BB82]',
      highlight: true,
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full max-w-full overflow-x-clip border-b border-[#173125]/90 bg-[#07110D]/95 backdrop-blur-xl shadow-2xl transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 min-h-16 py-2 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
        
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
          <button
            id="brand-logo-button"
            onClick={() => setViewMode('forest')}
            className="flex items-center gap-2.5 sm:gap-3 group text-left transition-transform active:scale-95"
            title={isAr ? 'العودة للغابة الرئيسية' : 'Return to Living Forest'}
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#1A382B] to-[#0A1913] border border-[#687B61]/50 flex items-center justify-center shadow-lg shadow-black/40 group-hover:border-[#B89A5A] group-hover:shadow-[#B89A5A]/20 transition-all">
              <TreePine className="w-5 h-5 text-[#D2BB82] group-hover:text-[#E8E0CF] transition-colors" />
            </div>
            <div className="hidden sm:block">
              <span className="font-literary text-lg sm:text-xl font-bold tracking-wider text-[#E8E0CF] block leading-tight group-hover:text-[#D2BB82] transition-colors">
                {isAr ? BRAND_CONFIG.nameAr : BRAND_CONFIG.name}
              </span>
              <span className="text-[10px] text-[#89977C] font-mono tracking-widest uppercase block">
                {isAr ? 'غابة الأدب والفكر' : 'The Living Forest Library'}
              </span>
            </div>
          </button>
        </div>

        {/* Center: Desktop Navigation Bar */}
        <nav className="hidden 2xl:flex max-w-[55vw] overflow-x-auto scrollbar-thin items-center gap-1 p-1 rounded-2xl bg-[#0B1712]/90 border border-[#173125]/80 text-xs font-medium">
          {navLinks.map((item) => {
            const isActive =
              viewMode === item.mode ||
              (item.mode === 'discover' && (viewMode === 'wander' || viewMode === 'moods'));

            return (
              <button
                key={item.id}
                id={item.id}
                onClick={() => setViewMode(item.mode)}
                className={`relative px-3 py-2 rounded-xl transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? 'bg-[#173125] text-[#E8E0CF] font-bold shadow-md shadow-black/30 border border-[#687B61]/40'
                    : item.highlight
                    ? 'text-[#D2BB82]/80 hover:text-[#D2BB82] hover:bg-[#10231A]'
                    : 'text-[#89977C] hover:text-[#E8E0CF] hover:bg-[#10231A]/60'
                }`}
              >
                <span className={isActive ? 'text-[#D2BB82]' : item.accentColor}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#10231A] text-[#D2BB82] text-[10px] font-mono border border-[#687B61]/40">
                    {item.badge}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute -bottom-1 left-2 right-2 h-0.5 bg-[#B89A5A] rounded-full"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          
          {/* Live Online Book Search Trigger */}
          <button
            id="online-web-search-trigger"
            onClick={() => setOnlineSearchOpen(true)}
            className="hidden md:flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-xl bg-gradient-to-r from-[#173125] to-[#10231A] border border-[#B89A5A]/60 hover:border-[#D2BB82] text-xs text-[#D2BB82] hover:text-[#E8E0CF] transition-all group shadow-md"
            title={isAr ? 'البحث الحي في الأرشيف المفتوح والمكتبات العالمية' : 'Live Global Public Domain Book Search'}
          >
            <Globe className="w-4 h-4 text-[#B89A5A] group-hover:rotate-180 transition-transform duration-500" />
            <span className="hidden md:inline font-literary font-bold">{isAr ? 'البحث الحي في الإنترنت' : 'Online Book Search'}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#B89A5A]/20 text-[#D2BB82] text-[9px] font-mono border border-[#B89A5A]/40 uppercase tracking-tighter">
              WEB
            </span>
          </button>

          {/* Quick Spotlight Search */}
          <button
            id="global-search-trigger"
            onClick={() => setCommandPaletteOpen(true)}
            className="hidden sm:flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-xl bg-[#0B1712] border border-[#173125] hover:border-[#687B61] text-xs text-[#89977C] hover:text-[#E8E0CF] transition-all group shadow-sm"
            title={isAr ? 'بحث سريع (Ctrl + K)' : 'Spotlight Search (Ctrl + K)'}
          >
            <Search className="w-4 h-4 text-[#B89A5A] group-hover:scale-110 transition-transform" />
            <span className="hidden 2xl:inline font-literary">{isAr ? 'فهارس المكتبة' : 'Catalog'}</span>
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-[#10231A] border border-[#173125] text-[10px] font-mono text-[#D2BB82]">
              ⌘K
            </kbd>
          </button>

          {/* Quick Reading Ritual Trigger */}
          <button
            id="navbar-ritual-trigger"
            onClick={() => setReadingRitualOpen(true)}
            className="hidden sm:flex p-2 sm:px-2.5 sm:py-2 rounded-xl bg-[#0B1712] border border-[#173125] hover:border-[#B89A5A]/60 text-xs text-[#89977C] hover:text-[#E8E0CF] transition-all flex items-center gap-1.5"
            title={isAr ? 'طقس القراءة الهادئة ومؤقت التركيز' : 'Quiet Reading Ritual & Focus Timer'}
          >
            <Flame className="w-4 h-4 text-[#B89A5A] animate-pulse" />
            <span className="hidden xl:inline text-xs text-[#E8E0CF] font-medium">
              {t.reader.ritual}
            </span>
          </button>

          {/* Quick Quote Studio Trigger */}
          <button
            id="navbar-quotes-trigger"
            onClick={() => setQuoteStudioOpen(true)}
            className="hidden sm:flex p-2 rounded-xl bg-[#0B1712] border border-[#173125] hover:border-[#687B61] text-xs text-[#89977C] hover:text-[#E8E0CF] transition-all items-center gap-1.5"
            title={isAr ? 'استوديو الاقتباسات والبطاقات الأدبية' : 'Literary Quote Studio'}
          >
            <Quote className="w-4 h-4 text-[#D2BB82]" />
          </button>

          {/* Ambient Soundscape Controller */}
          <div ref={audioMenuRef} className="relative hidden md:block">
            <button
              id="audio-soundscape-trigger"
              onClick={() => {
                setIsAudioMenuOpen((open) => !open);
                setIsUserMenuOpen(false);
              }}
              aria-haspopup="menu"
              aria-expanded={isAudioMenuOpen}
              aria-controls="audio-soundscape-menu"
              className={`p-2 sm:px-2.5 sm:py-2 rounded-xl border transition-all flex items-center gap-1.5 ${
                activeSoundscape !== 'silence' && !isAudioMuted
                  ? 'bg-[#173125] border-[#B89A5A]/60 text-[#D2BB82] shadow-lg shadow-[#173125]'
                  : 'bg-[#0B1712] border-[#173125] text-[#89977C] hover:text-[#E8E0CF]'
              }`}
              title={t.nav.soundscape}
            >
              {isAudioMuted || activeSoundscape === 'silence' ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <div className="flex items-center gap-1">
                  <Volume2 className="w-4 h-4 text-[#D2BB82]" />
                  <span className="hidden xl:inline text-xs font-mono text-[#D2BB82]">
                    {isAr ? currentSoundscapeObj?.labelAr : currentSoundscapeObj?.label}
                  </span>
                  {/* Subtle Audio Waves */}
                  <span className="flex items-end gap-0.5 h-3 ml-0.5">
                    <span className="w-0.5 h-2 bg-[#D2BB82] animate-ping" />
                    <span className="w-0.5 h-3 bg-[#D2BB82]" />
                    <span className="w-0.5 h-1.5 bg-[#D2BB82]" />
                  </span>
                </div>
              )}
            </button>

            {/* Audio Dropdown Menu */}
            <AnimatePresence>
              {isAudioMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  id="audio-soundscape-menu"
                  role="menu"
                  className={`absolute top-full mt-2 w-64 p-3 rounded-2xl bg-[#0B1712] border border-[#173125] shadow-2xl z-50 ${
                    isAr ? 'left-0' : 'right-0'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#173125]">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#B89A5A] flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>{t.nav.soundscape}</span>
                    </span>
                    <button
                      onClick={toggleAudioMute}
                      className="text-xs text-[#89977C] hover:text-[#E8E0CF] flex items-center gap-1 px-2 py-0.5 rounded bg-[#10231A] border border-[#173125]"
                    >
                      {isAudioMuted ? <VolumeX className="w-3 h-3 text-[#D2BB82]" /> : <Volume2 className="w-3 h-3 text-[#89977C]" />}
                      <span>{isAudioMuted ? (isAr ? 'تشغيل' : 'Unmute') : (isAr ? 'كتم' : 'Mute')}</span>
                    </button>
                  </div>

                  <div className="space-y-1">
                    {soundscapes.map((s) => (
                      <button
                        key={s.type}
                        onClick={() => {
                          setSoundscape(s.type);
                          if (s.type === 'silence') setIsAudioMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${
                          activeSoundscape === s.type
                            ? 'bg-[#173125] text-[#D2BB82] font-semibold border border-[#B89A5A]/40'
                            : 'text-[#BDB5A5] hover:bg-[#10231A] hover:text-[#E8E0CF]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={activeSoundscape === s.type ? 'text-[#D2BB82]' : 'text-[#89977C]'}>
                            {s.icon}
                          </span>
                          <span>{isAr ? s.labelAr : s.label}</span>
                        </div>
                        {activeSoundscape === s.type && <span className="w-2 h-2 rounded-full bg-[#D2BB82]" />}
                      </button>
                    ))}
                  </div>

                  {/* Volume Slider */}
                  <div className="mt-3 pt-2.5 border-t border-[#173125] px-1">
                    <div className="flex items-center justify-between text-[11px] text-[#89977C] mb-1.5 font-mono">
                      <span>{isAr ? 'مستوى الصوت' : 'Sound Volume'}</span>
                      <span className="text-[#D2BB82]">{Math.round(audioVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={audioVolume}
                      onChange={(e) => setAudioVolume(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-[#173125] rounded-lg appearance-none cursor-pointer accent-[#B89A5A]"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bilingual Language Switcher (Pill Style) */}
          <button
            id="language-switcher-button"
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-[#0B1712] border border-[#173125] hover:border-[#687B61] text-xs font-semibold text-[#E8E0CF] transition-all shadow-sm group"
            title="Switch Language / تبديل اللغة (العربية / English)"
          >
            <Globe className="w-3.5 h-3.5 text-[#B89A5A] group-hover:rotate-45 transition-transform" />
            <span className="font-mono text-[11px]">
              {language === 'ar' ? 'EN' : 'عربي'}
            </span>
          </button>

          {/* User Profile & Role Simulation Menu */}
          <div ref={userMenuRef} className="relative">
            <button
              id="user-profile-menu-trigger"
              onClick={() => {
                setIsUserMenuOpen((open) => !open);
                setIsAudioMenuOpen(false);
              }}
              aria-haspopup="menu"
              aria-expanded={isUserMenuOpen}
              aria-controls="user-profile-menu"
              className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#0B1712] border border-[#173125] hover:border-[#687B61] transition-all shadow-sm"
              title={isAuthenticated ? (isAr ? 'إدارة حسابك' : 'Manage your account') : (isAr ? 'تسجيل الدخول أو إنشاء حساب' : 'Sign in or create an account')}
            >
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={isAr ? currentUser.nameAr : currentUser.name}
                  className="w-7 h-7 rounded-lg object-cover border border-[#687B61]/50"
                />
              ) : (
                <span aria-hidden="true" className="w-7 h-7 rounded-lg bg-[#173125] border border-[#687B61]/50 grid place-items-center">
                  <User className="w-4 h-4 text-[#D2BB82]" />
                </span>
              )}
              <div className="hidden sm:block text-left">
                <span className="text-xs font-medium text-[#E8E0CF] block leading-none truncate max-w-[80px]">
                  {isAr ? currentUser.nameAr : currentUser.name}
                </span>
                <span className="text-[10px] text-[#B89A5A] font-mono leading-none block mt-0.5">
                  {isAuthenticated ? role : (isAr ? 'ضيف' : 'Guest')}
                </span>
              </div>
              <ChevronDown className="w-3 h-3 text-[#89977C]" />
            </button>

            {/* Profile Dropdown */}
            <AnimatePresence>
              {isUserMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  id="user-profile-menu"
                  role="menu"
                  className={`absolute top-full mt-2 w-72 p-3 rounded-2xl bg-[#0B1712] border border-[#173125] shadow-2xl z-50 ${
                    isAr ? 'left-0' : 'right-0'
                  }`}
                >
                  <div className="p-3 mb-2 bg-[#10231A] rounded-xl border border-[#173125] flex items-center gap-3">
                    {currentUser.avatar ? (
                      <img
                        src={currentUser.avatar}
                        alt={isAr ? currentUser.nameAr : currentUser.name}
                        className="w-9 h-9 rounded-xl object-cover border border-[#687B61]"
                      />
                    ) : (
                      <span aria-hidden="true" className="w-9 h-9 rounded-xl bg-[#173125] border border-[#687B61] grid place-items-center">
                        <User className="w-4 h-4 text-[#D2BB82]" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-[#E8E0CF] truncate">
                        {isAr ? currentUser.nameAr : currentUser.name}
                      </div>
                      <div className="text-[11px] text-[#89977C] font-mono truncate">{currentUser.email}</div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#173125] space-y-1">
                    <button
                      onClick={() => {
                        setViewMode('my-library');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-[#BDB5A5] hover:bg-[#10231A] hover:text-[#E8E0CF] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <BookmarkCheck className="w-3.5 h-3.5 text-[#89977C]" />
                        <span>{t.nav.myLibrary}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#D2BB82]">
                        {savedBookIds.length} {isAr ? 'محفوظ' : 'saved'}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setAuthModalOpen(true);
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-[#BDB5A5] hover:bg-[#10231A] hover:text-[#E8E0CF] transition-colors"
                    >
                      <User className="w-3.5 h-3.5 text-[#B89A5A]" />
                      <span>{isAuthenticated ? (isAr ? 'إدارة الحساب' : 'Manage account') : (isAr ? 'تسجيل الدخول أو إنشاء حساب' : 'Sign in or create an account')}</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile Hamburger Menu Toggle */}
          <button
            id="mobile-nav-toggle"
            ref={mobileToggleRef}
            onClick={() => {
              setIsMobileNavOpen((open) => !open);
              setIsAudioMenuOpen(false);
              setIsUserMenuOpen(false);
            }}
            className="2xl:hidden p-2 rounded-xl bg-[#0B1712] border border-[#173125] text-[#89977C] hover:text-[#E8E0CF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D2BB82]"
            aria-label={isAr ? 'فتح أو إغلاق قائمة التنقل' : 'Toggle navigation menu'}
            aria-expanded={isMobileNavOpen}
            aria-controls="mobile-navigation-drawer"
          >
            {isMobileNavOpen ? <X className="w-5 h-5 text-[#D2BB82]" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {isMobileNavOpen && (
          <AccessibleDialog open={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} title={isAr ? 'التنقل على الجوال' : 'Mobile navigation'} className="w-full max-w-sm h-full ms-auto" backdropClassName="items-stretch justify-end p-0">
          <motion.nav
            initial={{ x: isAr ? '-100%' : '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: isAr ? '-100%' : '100%', opacity: 0 }}
            transition={{ duration: 0.2 }}
            id="mobile-navigation-drawer"
            aria-label={isAr ? 'التنقل على الجوال' : 'Mobile navigation'}
            className="2xl:hidden h-full overflow-y-auto border-s border-[#173125] bg-[#07110D] px-4 py-5 space-y-3 shadow-2xl"
          >
            {/* Main Mode Dual Switcher */}
            <div className="grid grid-cols-2 gap-2 pb-2 border-b border-[#173125]">
              <button
                onClick={() => {
                  setViewMode('forest');
                  setIsMobileNavOpen(false);
                }}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold ${
                  viewMode === 'forest'
                    ? 'bg-[#173125] border-[#B89A5A] text-[#D2BB82]'
                    : 'bg-[#0B1712] border-[#173125] text-[#89977C]'
                }`}
              >
                <TreePine className="w-4 h-4" />
                <span>{t.nav.forest}</span>
              </button>
              <button
                onClick={() => {
                  setViewMode('library');
                  setIsMobileNavOpen(false);
                }}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold ${
                  viewMode === 'library'
                    ? 'bg-[#173125] border-[#B89A5A] text-[#D2BB82]'
                    : 'bg-[#0B1712] border-[#173125] text-[#89977C]'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>{t.nav.library}</span>
              </button>
            </div>

            {/* Navigation Links Grid */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setViewMode('discover');
                  setIsMobileNavOpen(false);
                }}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-[#0B1712] border border-[#173125] text-xs text-[#E8E0CF] hover:bg-[#10231A]"
              >
                <Compass className="w-4 h-4 text-[#B89A5A]" />
                <span>{t.nav.discover}</span>
              </button>
              <button
                onClick={() => {
                  setViewMode('paths');
                  setIsMobileNavOpen(false);
                }}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-[#0B1712] border border-[#173125] text-xs text-[#E8E0CF] hover:bg-[#10231A]"
              >
                <Sparkles className="w-4 h-4 text-[#89977C]" />
                <span>{t.nav.paths}</span>
              </button>
              <button
                onClick={() => {
                  setViewMode('map');
                  setIsMobileNavOpen(false);
                }}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-[#0B1712] border border-[#173125] text-xs text-[#E8E0CF] hover:bg-[#10231A]"
              >
                <Map className="w-4 h-4 text-[#D2BB82]" />
                <span>{t.nav.map}</span>
              </button>
              <button
                onClick={() => {
                  setViewMode('my-library');
                  setIsMobileNavOpen(false);
                }}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-[#0B1712] border border-[#173125] text-xs text-[#E8E0CF] hover:bg-[#10231A]"
              >
                <BookmarkCheck className="w-4 h-4 text-[#89977C]" />
                <span>{t.nav.myLibrary} ({savedBookIds.length})</span>
              </button>
              <button
                onClick={() => {
                  setViewMode('community');
                  setIsMobileNavOpen(false);
                }}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-[#0B1712] border border-[#173125] text-xs text-[#E8E0CF] hover:bg-[#10231A]"
              >
                <Users className="w-4 h-4 text-[#89977C]" />
                <span>{t.nav.community}</span>
              </button>
              <button
                onClick={() => {
                  setViewMode('admin');
                  setIsMobileNavOpen(false);
                }}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-[#173125]/80 border border-[#B89A5A]/50 text-xs text-[#D2BB82] font-semibold"
              >
                <ShieldAlert className="w-4 h-4 text-[#B89A5A]" />
                <span>{t.nav.admin}</span>
              </button>
            </div>

            {/* Quick Mobile Tool Triggers */}
            <div className="pt-2 border-t border-[#173125] flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  setReadingRitualOpen(true);
                  setIsMobileNavOpen(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#10231A] border border-[#173125] text-xs font-semibold text-[#D2BB82] flex items-center justify-center gap-1.5"
              >
                <Flame className="w-4 h-4 text-[#B89A5A]" />
                <span>{t.reader.ritual}</span>
              </button>
              <button
                onClick={() => {
                  setQuoteStudioOpen(true);
                  setIsMobileNavOpen(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#10231A] border border-[#173125] text-xs font-semibold text-[#E8E0CF] flex items-center justify-center gap-1.5"
              >
                <Quote className="w-4 h-4 text-[#89977C]" />
                <span>{t.quotes.studio}</span>
              </button>
            </div>
          </motion.nav>
          </AccessibleDialog>
        )}
      </AnimatePresence>
    </header>
  );
};
