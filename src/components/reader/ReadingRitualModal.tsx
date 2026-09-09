import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { translations } from '../../i18n/translations';
import { SoundscapeType } from '../../types';
import confetti from 'canvas-confetti';
import { Flame, Play, Pause, RotateCcw, X, Volume2 } from 'lucide-react';
import { motion } from 'motion/react';

export const ReadingRitualModal: React.FC = () => {
  const {
    isReadingRitualOpen,
    setReadingRitualOpen,
    language,
    activeSoundscape,
    setSoundscape,
    addToast,
  } = useAppStore();

  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [secondsRemaining, setSecondsRemaining] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const t = translations[language];
  const isAr = language === 'ar';

  useEffect(() => {
    setSecondsRemaining(selectedMinutes * 60);
    setIsActive(false);
    setIsCompleted(false);
  }, [selectedMinutes]);

  useEffect(() => {
    let interval: any = null;
    if (isActive && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => prev - 1);
      }, 1000);
    } else if (secondsRemaining === 0 && isActive) {
      setIsActive(false);
      setIsCompleted(true);
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
      addToast(
        'Reading ritual completed! Peace be upon your reflections.',
        'اكتمل طقس القراءة الهادئة! بارك الله في فكرك ووقتك.',
        'success'
      );
    }
    return () => clearInterval(interval);
  }, [isActive, secondsRemaining, addToast]);

  if (!isReadingRitualOpen) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const progressPercent = ((selectedMinutes * 60 - secondsRemaining) / (selectedMinutes * 60)) * 100;

  const soundscapes: { type: SoundscapeType; label: string; labelAr: string }[] = [
    { type: 'rain', label: 'Rain', labelAr: 'مطر' },
    { type: 'night-forest', label: 'Night Forest', labelAr: 'ليل' },
    { type: 'fireplace', label: 'Fireplace', labelAr: 'موقد' },
    { type: 'silence', label: 'Silence', labelAr: 'صمت' },
  ];

  return (
    <div
      id="reading-ritual-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={() => setReadingRitualOpen(false)}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        className="w-full max-w-md bg-[#0B1712] border border-[#B89A5A]/50 rounded-3xl p-6 sm:p-8 text-[#E8E0CF] shadow-2xl space-y-6 text-center relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-radial from-[#B89A5A]/10 to-transparent blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={() => setReadingRitualOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-[#07110D] text-[#89977C] hover:text-[#E8E0CF] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-xs font-mono uppercase tracking-widest text-[#B89A5A]">
            <Flame className="w-4 h-4 text-[#D2BB82]" />
            <span>{t.ritual.title}</span>
          </div>
          <h3 className="font-literary text-xl font-bold">
            {isAr ? 'خلوة القراءة العميقة' : 'Mindful Reading Sanctuary'}
          </h3>
          <p className="text-xs text-[#89977C]">
            {isAr
              ? 'خصص وقتاً هادئاً بدون مقاطعة للانغماس في عوالم الكلمة والفكر.'
              : 'Immerse yourself without distraction in uninterrupted literary reflection.'}
          </p>
        </div>

        {/* Duration Selection Pills */}
        <div className="flex items-center justify-center gap-2">
          {[15, 25, 45, 60].map((mins) => (
            <button
              key={mins}
              disabled={isActive}
              onClick={() => setSelectedMinutes(mins)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition-all border ${
                selectedMinutes === mins
                  ? 'bg-[#173125] border-[#B89A5A] text-[#D2BB82] font-bold shadow'
                  : 'bg-[#07110D] border-[#173125] text-[#89977C] hover:text-[#E8E0CF]'
              }`}
            >
              {mins}m
            </button>
          ))}
        </div>

        {/* Circular Animated Progress Timer Display */}
        <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="44"
              className="text-[#173125]"
              strokeWidth="6"
              stroke="currentColor"
              fill="transparent"
            />
            <circle
              cx="50"
              cy="50"
              r="44"
              className="text-[#B89A5A]"
              strokeWidth="6"
              strokeDasharray={276.46}
              strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-[#E8E0CF]">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
            <span className="text-[10px] text-[#89977C] font-mono mt-1">
              {isActive ? (isAr ? 'جلسة نشطة...' : 'In deep focus') : isCompleted ? (isAr ? 'مكتمل' : 'Complete') : (isAr ? 'جاهز' : 'Ready')}
            </span>
          </div>
        </div>

        {/* Ambient Soundscape Selection */}
        <div className="space-y-2">
          <span className="text-xs text-[#89977C] flex items-center justify-center gap-1">
            <Volume2 className="w-3.5 h-3.5 text-[#B89A5A]" />
            <span>{isAr ? 'المؤثرات الصوتية الطبيعية:' : 'Ambient Soundscape:'}</span>
          </span>
          <div className="flex items-center justify-center gap-2">
            {soundscapes.map((s) => (
              <button
                key={s.type}
                onClick={() => setSoundscape(s.type)}
                className={`px-3 py-1 rounded-lg text-xs transition-colors border ${
                  activeSoundscape === s.type
                    ? 'bg-[#173125] border-[#B89A5A] text-[#D2BB82] font-semibold'
                    : 'bg-[#07110D] border-[#173125] text-[#89977C] hover:text-[#E8E0CF]'
                }`}
              >
                {isAr ? s.labelAr : s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Timer Control Buttons */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => {
              setSecondsRemaining(selectedMinutes * 60);
              setIsActive(false);
              setIsCompleted(false);
            }}
            className="p-3 rounded-2xl bg-[#07110D] border border-[#173125] text-[#89977C] hover:text-[#E8E0CF] transition-colors"
            title="Reset"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsActive(!isActive)}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-[#B89A5A] hover:bg-[#D2BB82] text-[#07110D] font-bold text-sm transition-colors shadow-lg"
          >
            {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-[#07110D]" />}
            <span>{isActive ? (isAr ? 'إيقاف مؤقت' : 'Pause') : (isAr ? 'بدء الطقس' : 'Begin Ritual')}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
