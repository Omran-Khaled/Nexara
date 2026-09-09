import React, { useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { BookCard } from '../library/BookCard';
import { Sparkles, CloudMoon, Compass, Sun, Flame, Moon, Layers } from 'lucide-react';

interface MoodPortal {
  id: string;
  name: string;
  nameAr: string;
  desc: string;
  descAr: string;
  icon: React.ReactNode;
  themeMatches: string[];
  gradient: string;
}

export const MoodDiscovery: React.FC = () => {
  const { books, language } = useAppStore();
  const [selectedMoodId, setSelectedMoodId] = useState<string>('contemplative');

  const isAr = language === 'ar';

  const moods: MoodPortal[] = [
    {
      id: 'contemplative',
      name: 'Contemplative & Philosophical',
      nameAr: 'تأمل فلسفي عميق',
      desc: 'Solitary meditations on human existence, fate, and purpose.',
      descAr: 'تأملات انفرادية في معنى الوجود البشري، والمصير، والغاية.',
      icon: <Compass className="w-5 h-5 text-[#B89A5A]" />,
      themeMatches: ['Philosophy', 'Metaphysics', 'Free Will', 'Reason', 'Epistemology', 'Stoicism', 'Responsibility', 'Isolation', 'Conscience', 'Philosophical fiction'],
      gradient: 'from-[#173125] to-[#0B1712]',
    },
    {
      id: 'melancholic',
      name: 'Poetic Melancholy & Yearning',
      nameAr: 'شجن شاعري واشتياق',
      desc: 'Wistful verses, fleeting beauty, and sweet sorrow.',
      descAr: 'أشعار تحكي عن الجمال العابر، والحنين، والشجن العذب.',
      icon: <CloudMoon className="w-5 h-5 text-[#89977C]" />,
      themeMatches: ['Poetry', 'Longing', 'Nostalgia', 'Tragedy', 'Romanticism', 'Beauty', 'Isolation', 'Gothic', 'Romance', 'Aestheticism'],
      gradient: 'from-[#1E0F11] to-[#0B1712]',
    },
    {
      id: 'radiant',
      name: 'Radiant Awakening & Hope',
      nameAr: 'إشراق روحي ويقظة',
      desc: 'Uplifting revelations, ethical renewal, and spiritual dawn.',
      descAr: 'بصائر روحية، وتجدد أخلاقي، وبشائر الفجر الفكري.',
      icon: <Sun className="w-5 h-5 text-[#D2BB82]" />,
      themeMatches: ['Enlightenment', 'Ethics', 'Virtue', 'Nature', 'Transcendentalism', 'Humanism', 'Marriage', 'Love', 'First impressions'],
      gradient: 'from-[#231F10] to-[#0B1712]',
    },
    {
      id: 'mythic',
      name: 'Ancient Myth & Allegory',
      nameAr: 'ميثولوجيا ورموز أسطورية',
      desc: 'Timeless allegories of kings, heroes, gods, and sacred beasts.',
      descAr: 'رموز أسطورية، وملاحم الملوك والأبطال وعوالم الحكمة القديمة.',
      icon: <Layers className="w-5 h-5 text-[#B89A5A]" />,
      themeMatches: ['Mythology', 'Allegory', 'Epics', 'Folklore', 'Cosmology', 'Creation', 'Science fiction'],
      gradient: 'from-[#141D27] to-[#0B1712]',
    },
    {
      id: 'twilight',
      name: 'Midnight Solitude',
      nameAr: 'سكينة الغسق والهدوء',
      desc: 'Calm nocturnal essays and late-night philosophical wanderings.',
      descAr: 'مقالات ليلية هادئة وتأملات تسكن الروح في سكون الليل.',
      icon: <Moon className="w-5 h-5 text-[#687B61]" />,
      themeMatches: ['Solitude', 'Night', 'Introspection', 'Silence', 'Dreams', 'Isolation', 'Gothic'],
      gradient: 'from-[#10231A] to-[#07110D]',
    },
    {
      id: 'rebellious',
      name: 'Critique & Social Fire',
      nameAr: 'نقد اجتماعي وتمرد فكري',
      desc: 'Bold dissections of political order, justice, and human liberty.',
      descAr: 'تشريح جريء للأنظمة والعدالة وحرية الإنسان والكرامة.',
      icon: <Flame className="w-5 h-5 text-[#8B3A3A]" />,
      themeMatches: ['Justice', 'Politics', 'Liberty', 'Power', 'Society', 'Rebellion', 'Class', 'Social satire', 'Corruption'],
      gradient: 'from-[#2B1214] to-[#0B1712]',
    },
  ];

  const activeMood = moods.find((m) => m.id === selectedMoodId) || moods[0];

  const matchedBooks = books.filter((b) => {
    return (
      b.themes.some((t) => activeMood.themeMatches.includes(t)) ||
      b.genres.some((g) => activeMood.themeMatches.includes(g))
    );
  });

  return (
    <div id="mood-discovery-container" className="w-full space-y-6">
      
      {/* Header */}
      <div className="p-6 rounded-3xl bg-[#0B1712] border border-[#173125] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#B89A5A]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAr ? 'بوابات الإلهام والحالة المزاجية' : 'Atmospheric Mood Portals'}</span>
          </div>
          <h1 className="font-literary text-2xl sm:text-3xl font-bold text-[#E8E0CF]">
            {isAr ? 'اكتشف الكتب حسب نبضك وشعورك' : 'Literature by Temperament & Mood'}
          </h1>
          <p className="text-xs sm:text-sm text-[#89977C]">
            {isAr
              ? 'اختر الحالة الذهنية أو المزاجية التي تلائم لحظتك الحالية لتجد الأعمال الأنسب لروحك.'
              : 'Select the internal tone that resonates with your current state of mind to uncover aligned works.'}
          </p>
        </div>
      </div>

      {/* Mood Portals Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {moods.map((mood) => {
          const isSelected = mood.id === selectedMoodId;
          return (
            <button
              key={mood.id}
              onClick={() => setSelectedMoodId(mood.id)}
              className={`p-4 rounded-2xl border text-left transition-all duration-300 flex flex-col justify-between h-36 ${
                isSelected
                  ? `bg-gradient-to-br ${mood.gradient} border-[#B89A5A] shadow-xl ring-1 ring-[#B89A5A]/50`
                  : 'bg-[#0B1712] border-[#173125] hover:border-[#687B61]/60'
              }`}
            >
              <div className="p-2 rounded-xl bg-[#07110D]/70 border border-[#173125] w-fit">
                {mood.icon}
              </div>

              <div>
                <div className="text-xs font-bold text-[#E8E0CF] line-clamp-1">
                  {isAr ? mood.nameAr : mood.name}
                </div>
                <div className="text-[10px] text-[#89977C] line-clamp-1 mt-0.5">
                  {isAr ? mood.descAr : mood.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Mood Showcase */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold font-literary text-[#D2BB82]">
              {isAr ? activeMood.nameAr : activeMood.name}
            </span>
            <span className="text-xs text-[#89977C]">({matchedBooks.length} {isAr ? 'أعمال متطابقة' : 'works matched'})</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {matchedBooks.map((b) => (
            <BookCard key={b.id} book={b} viewMode="grid" />
          ))}
        </div>
      </div>
    </div>
  );
};
