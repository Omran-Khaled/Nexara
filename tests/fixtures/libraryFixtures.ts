import { Author, Book, ReadingPath, Review, Achievement } from '../../src/types';

export const INITIAL_AUTHORS: Author[] = [
  {
    id: 'author-dostoevsky',
    name: 'Fyodor Dostoevsky',
    nameAr: 'فيودور دوستويفسكي',
    slug: 'fyodor-dostoevsky',
    avatar: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&q=80',
    birthYear: 1821,
    deathYear: 1881,
    era: '19th Century Realism & Existentialism',
    eraAr: 'الواقعية والفلسفة الوجودية في القرن التاسع عشر',
    country: 'Russia',
    countryAr: 'روسيا',
    bio: 'One of the greatest psychological novelists in world literature, exploring the deepest recesses of the human soul, moral conflict, guilt, redemption, and spiritual freedom.',
    bioAr: 'أحد أعظم رواد الرواية النفسية في الأدب العالمي، سبر أغوار النفس البشرية والصراع الأخلاقي والحرية والذنب والخلاص.',
    timeline: [
      { year: 1821, event: 'Born in Moscow', eventAr: 'ولد في موسكو' },
      { year: 1846, event: 'Published Poor Folk to critical acclaim', eventAr: 'نشر روايته الأولى "المساكين"' },
      { year: 1849, event: 'Arrested and exiled to Siberia', eventAr: 'اعتقل ونفي إلى سيبيريا مع الأشغال الشاقة' },
      { year: 1866, event: 'Published Crime and Punishment', eventAr: 'نشر تحفته الخالدة "الجريمة والعقاب"' },
      { year: 1880, event: 'Completed The Brothers Karamazov', eventAr: 'أتم كتابة "الإخوة كارامازوف"' },
    ],
    languages: ['ru', 'en', 'ar', 'fr'],
    relatedAuthorIds: ['author-tolstoy', 'author-kafka', 'author-nietzsche'],
    followersCount: 14200,
  },
  {
    id: 'author-mahfouz',
    name: 'Naguib Mahfouz',
    nameAr: 'نجيب محفوظ',
    slug: 'naguib-mahfouz',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
    birthYear: 1911,
    deathYear: 2006,
    era: 'Modern Arabic Literature & Realism',
    eraAr: 'الأدب العربي الحديث والواقعية الرمزية',
    country: 'Egypt',
    countryAr: 'مصر',
    bio: 'Nobel Laureate in Literature (1988), master chronicler of Cairo alleyways, existential journeys, and the human search for justice, meaning, and time.',
    bioAr: 'أديب نوبل العربي (١٩٨٨)، ومؤرخ الحارة القاهرية والبحث الإنساني الخالد عن العدل والمعنى والحرية.',
    timeline: [
      { year: 1911, event: 'Born in Gamaleya, Cairo', eventAr: 'ولد في حي الجمالية بالقاهرة' },
      { year: 1956, event: 'Published the Cairo Trilogy', eventAr: 'نشر ثلاثيته الشهيرة (بين القصرين، قصر الشوق، السكرية)' },
      { year: 1959, event: 'Serialized Children of Gebelawi', eventAr: 'نشر رواية أولاد حارتنا' },
      { year: 1988, event: 'Awarded Nobel Prize in Literature', eventAr: 'نال جائزة نوبل في الأدب كأول كاتب عربي' },
    ],
    languages: ['ar', 'en', 'fr'],
    relatedAuthorIds: ['author-darwish', 'author-gibran', 'author-dostoevsky'],
    followersCount: 18900,
  },
  {
    id: 'author-ibnkhaldun',
    name: 'Ibn Khaldun',
    nameAr: 'عبد الرحمن بن خلدون',
    slug: 'ibn-khaldun',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80',
    birthYear: 1332,
    deathYear: 1406,
    era: 'Classical Islamic Golden Age & Sociology',
    eraAr: 'العصر الإسلامي الوسيط ومؤسس علم العمران البشري',
    country: 'Tunisia / Andalusia',
    countryAr: 'تونس / الأندلس',
    bio: 'The father of historiography, sociology, and economics. His Muqaddimah established the scientific study of civilization and social cohesion (Asabiyyah).',
    bioAr: 'مؤسس علم الاجتماع (العمران البشري) وفلسفة التاريخ، وضع في مقدمته الأسس العلمية لدراسة تطور الدول والعصبية والحضارات.',
    timeline: [
      { year: 1332, event: 'Born in Tunis into an Andalusian scholar family', eventAr: 'ولد في تونس لأسرة أندلسية عريقة' },
      { year: 1377, event: 'Wrote the Muqaddimah at Qal’at Ibn Salama', eventAr: 'ألّف المقدمة في قلعة ابن سلامة' },
      { year: 1401, event: 'Met Tamerlane in Damascus', eventAr: 'التقى بتيمورلنك عند أسوار دمشق' },
    ],
    languages: ['ar', 'en', 'fr'],
    relatedAuthorIds: ['author-jahiz', 'author-spinoza', 'author-nietzsche'],
    followersCount: 11500,
  },
  {
    id: 'author-mutanabbi',
    name: 'Al-Mutanabbi',
    nameAr: 'أبو الطيب المتنبي',
    slug: 'al-mutanabbi',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80',
    birthYear: 915,
    deathYear: 965,
    era: 'Abbasid Classical Poetry',
    eraAr: 'العصر العباسي الذهبي',
    country: 'Iraq / Syria',
    countryAr: 'العراق / بلاد الشام',
    bio: 'Unquestionably the towering poet of the Arabic language, whose soaring verse encapsulated human ambition, wisdom, pride, and philosophical courage.',
    bioAr: 'شاعر العرب الأكبر الذي ملأ الدنيا وشغل الناس، تجسدت في قصائده عزة النفس، والحكمة، والبلاغة الفذة، وعنفوان الطموح.',
    timeline: [
      { year: 915, event: 'Born in Kufa, Iraq', eventAr: 'ولد في الكوفة بالعراق' },
      { year: 948, event: 'Joined court of Sayf al-Dawla in Aleppo', eventAr: 'التحق ببلاط سيف الدولة الحمداني في حلب' },
      { year: 965, event: 'Departed while reciting his immortal poetry', eventAr: 'استشهد وهو ينشد بيته الخالد: الخيل والليل والبيداء تعرفني' },
    ],
    languages: ['ar', 'en'],
    relatedAuthorIds: ['author-rumi', 'author-darwish', 'author-jahiz'],
    followersCount: 22400,
  },
  {
    id: 'author-kafka',
    name: 'Franz Kafka',
    nameAr: 'فرانتس كافكا',
    slug: 'franz-kafka',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80',
    birthYear: 1883,
    deathYear: 1924,
    era: '20th Century Modernism & Absurdism',
    eraAr: 'الحداثة والرمزية والعبثية في القرن العشرين',
    country: 'Czech Republic / Austria',
    countryAr: 'التشيك / النمسا',
    bio: 'Iconic visionary who rendered modern alienation, bureaucratic labyrinth, and existential perplexity into surreal masterpieces.',
    bioAr: 'صاحب الرؤية الفريدة التي جسدت غربة الإنسان الحديث، والمتاهات البيروقراطية، والمفارقات الوجودية الصادمة.',
    timeline: [
      { year: 1883, event: 'Born in Prague', eventAr: 'ولد في براغ' },
      { year: 1915, event: 'Published The Metamorphosis', eventAr: 'نشر "التحول / المسخ"' },
      { year: 1925, event: 'Posthumous publication of The Trial', eventAr: 'نشرت روايته "المحاكمة" بعد رحيله' },
    ],
    languages: ['de', 'en', 'ar', 'fr'],
    relatedAuthorIds: ['author-dostoevsky', 'author-woolf', 'author-nietzsche'],
    followersCount: 16800,
  },
  {
    id: 'author-gibran',
    name: 'Khalil Gibran',
    nameAr: 'جبران خليل جبران',
    slug: 'khalil-gibran',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80',
    birthYear: 1883,
    deathYear: 1931,
    era: 'Mahjar Literary Movement & Mystical Romanticism',
    eraAr: 'مدرسة المهجر والرومانسية الصوفية',
    country: 'Lebanon / USA',
    countryAr: 'لبنان / الولايات المتحدة',
    bio: 'Lebanese-American poet, philosopher, and visual artist whose lyrical prose bridges Eastern spiritual wisdom and Western universal humanity.',
    bioAr: 'أديب وشاعر وفيلسوف لبناني مهجري، جسد في نصوصه الشفافة جسراً روحياً بين حكمة الشرق وعالمية المشاعر الإنسانية.',
    timeline: [
      { year: 1883, event: 'Born in Bcharre, Mount Lebanon', eventAr: 'ولد في بشري، جبل لبنان' },
      { year: 1920, event: 'Founded the Pen League (Al-Rabitah al-Qalamiyyah)', eventAr: 'أسس الرابطة القلمية في نيويورك' },
      { year: 1923, event: 'Published The Prophet, translated to 100+ languages', eventAr: 'نشر كتاب "النبي" الذي تُرجم لأكثر من مائة لغة' },
    ],
    languages: ['ar', 'en', 'fr'],
    relatedAuthorIds: ['author-rumi', 'author-darwish', 'author-mahfouz'],
    followersCount: 20100,
  },
  {
    id: 'author-nietzsche',
    name: 'Friedrich Nietzsche',
    nameAr: 'فريدريك نيتشه',
    slug: 'friedrich-nietzsche',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80',
    birthYear: 1844,
    deathYear: 1900,
    era: 'Continental Philosophy & Nihilism',
    eraAr: 'الفلسفة القارية ونقد الميتافيزيقا',
    country: 'Germany',
    countryAr: 'ألمانيا',
    bio: 'Profound and provocative thinker who reshaped modern philosophy, questioning conventional morality, celebrating will to create, and crafting poetic philosophical dialogues.',
    bioAr: 'فيلسوف الشك والجرأة الفكرية، فكك المنظومات الأخلاقية التقليدية وألهم الفكر المعاصر بأسلوبه الشعري الملحمي في هكذا تكلم زرادشت.',
    timeline: [
      { year: 1844, event: 'Born in Röcken, Saxony', eventAr: 'ولد في روكن' },
      { year: 1883, event: 'Published Thus Spoke Zarathustra', eventAr: 'نشر كتابه الأيقوني "هكذا تكلم زرادشت"' },
      { year: 1886, event: 'Published Beyond Good and Evil', eventAr: 'نشر "ما وراء الخير والشر"' },
    ],
    languages: ['de', 'en', 'ar', 'fr'],
    relatedAuthorIds: ['author-dostoevsky', 'author-spinoza', 'author-kafka'],
    followersCount: 15400,
  },
  {
    id: 'author-rumi',
    name: 'Jalal al-Din Rumi',
    nameAr: 'جلال الدين الرومي',
    slug: 'jalal-al-din-rumi',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&q=80',
    birthYear: 1207,
    deathYear: 1273,
    era: 'Sufi Mysticism & Universal Poetry',
    eraAr: 'التصوف والفلسفة الإشراقية والشعر العالمي',
    country: 'Balkh / Konya',
    countryAr: 'بلخ / قونية',
    bio: 'Universal Sufi poet of divine love, transcendent unity, compassion, and the soul’s journey of return.',
    bioAr: 'عاشق الحقيقة وسلطان العارفين، تجاوزت قصائده حدود الجغرافيا واللغات لتخاطب جوهر الروح والتوق إلى المحبة المطلقة.',
    timeline: [
      { year: 1207, event: 'Born in Balkh', eventAr: 'ولد في بلخ' },
      { year: 1244, event: 'Encountered Shams of Tabriz', eventAr: 'التقى بمرشده الروحي شمس التبريزي' },
      { year: 1273, event: 'Completed the monumental Masnavi', eventAr: 'أتم كتاب "المثنوي" المعنوي' },
    ],
    languages: ['fa', 'ar', 'en'],
    relatedAuthorIds: ['author-gibran', 'author-mutanabbi', 'author-darwish'],
    followersCount: 26000,
  },
  {
    id: 'author-ibn-al-muqaffa',
    name: 'Ibn al-Muqaffa',
    nameAr: 'عبد الله بن المقفع',
    slug: 'ibn-al-muqaffa',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80',
    birthYear: 724,
    deathYear: 759,
    era: 'Abbasid Classical Prose & Allegory',
    eraAr: 'العصر العباسي الأول ورائد النثر العربي البليغ',
    country: 'Persia / Iraq',
    countryAr: 'فارس / العراق',
    bio: 'Pioneer of artistic Arabic prose, moral fables, and political allegories. He masterfully translated and elevated Kalila and Dimna.',
    bioAr: 'رائد النثر الأدبي العربي وصاحب الأسلوب السلس البليغ، خلد حكايات كليلة ودمنة في ثوب عربي مشرق جمع بين السياسة والحكمة.',
    timeline: [
      { year: 724, event: 'Born in Basra/Firuzabad', eventAr: 'ولد في البصرة/جور' },
      { year: 750, event: 'Rendered Kalila and Dimna into monumental Arabic prose', eventAr: 'ترجم وصاغ كليلة ودمنة بأسلوب عربي فذ' },
      { year: 758, event: 'Wrote Al-Adab al-Kabir and Al-Adab al-Saghir', eventAr: 'صنّف كتابي الأدب الكبير والأدب الصغير' },
    ],
    languages: ['ar', 'fa'],
    relatedAuthorIds: ['author-jahiz', 'author-ibnkhaldun'],
    followersCount: 16800,
  },
  {
    id: 'author-ibn-hazm',
    name: 'Ibn Hazm al-Andalusi',
    nameAr: 'ابن حزم الأندلسي',
    slug: 'ibn-hazm',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
    birthYear: 994,
    deathYear: 1064,
    era: 'Andalusian Golden Age & Psychology of Love',
    eraAr: 'الأندلس الزاهرة وفلسفة الأخلاق وعلم النفس الوجداني',
    country: 'Andalusia (Cordoba)',
    countryAr: 'الأندلس (قرطبة)',
    bio: 'Polymath of Cordoba, philosopher, historian, and poet who authored The Ring of the Dove, the finest treatise on human love and companionship.',
    bioAr: 'إمام قرطبة الموسوعي وفقيهها وفيلسوفها، صاحب كتاب "طوق الحمامة" الذي يعد أعذب وأدق دراسة نفسية وأدبية في الحب ومقاماته.',
    timeline: [
      { year: 994, event: 'Born in Cordoba', eventAr: 'ولد في قرطبة' },
      { year: 1022, event: 'Authored The Ring of the Dove in Jativa', eventAr: 'ألّف "طوق الحمامة في الألفة والأُلاّف" في شاطبة' },
      { year: 1050, event: 'Completed his monumental comparative religion treatise Al-Fisal', eventAr: 'أتم كتابه الضخم "الفصل في الملل والأهواء والنحل"' },
    ],
    languages: ['ar', 'es', 'en'],
    relatedAuthorIds: ['author-ibnkhaldun', 'author-al-maarri'],
    followersCount: 19300,
  },
  {
    id: 'author-cervantes',
    name: 'Miguel de Cervantes',
    nameAr: 'ميغيل دي ثيربانتس',
    slug: 'miguel-de-cervantes',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80',
    birthYear: 1547,
    deathYear: 1616,
    era: 'Spanish Golden Age & Modern Novel',
    eraAr: 'العصر الذهبي الإسباني وولادة الرواية الحديثة',
    country: 'Spain',
    countryAr: 'إسبانيا',
    bio: 'The father of the modern novel whose masterpiece Don Quixote explores human idealism, chivalry, reality, and comedy.',
    bioAr: 'أبو الرواية الحديثة وصاحب "دون كيخوته"، سبر التناقض البشري بين المثالية المجنحة والواقع اليومي بأسلوب فكاهي وإنساني ساحر.',
    timeline: [
      { year: 1547, event: 'Born in Alcalá de Henares', eventAr: 'ولد في ألكالا دي إيناريس' },
      { year: 1605, event: 'Published Don Quixote Part I', eventAr: 'نشر الجزء الأول من "دون كيخوته"' },
      { year: 1615, event: 'Published Don Quixote Part II', eventAr: 'نشر الجزء الثاني وحقق شهرة عالمية' },
    ],
    languages: ['es', 'en', 'ar', 'fr'],
    relatedAuthorIds: ['author-dostoevsky', 'author-kafka'],
    followersCount: 21500,
  },
  {
    id: 'author-plato',
    name: 'Plato',
    nameAr: 'أفلاطون',
    slug: 'plato',
    avatar: 'https://images.unsplash.com/photo-1532012164546-f432f2e3edd4?w=400&q=80',
    birthYear: -427,
    deathYear: -347,
    era: 'Classical Greek Philosophy',
    eraAr: 'الفلسفة اليونانية الكلاسيكية وتأسيس الفكر الغربي',
    country: 'Greece (Athens)',
    countryAr: 'اليونان (أثينا)',
    bio: 'Founder of the Academy in Athens, author of philosophical dialogues exploring justice, beauty, knowledge, the forms, and the ideal state.',
    bioAr: 'مؤسس أكاديمية أثينا وصاحب المحاورات الفلسفية الخالدة، أسس لمفاهيم العدل، ومثل الكهف، وعالم المثل، والمدينة الفاضلة.',
    timeline: [
      { year: -427, event: 'Born in Athens', eventAr: 'ولد في أثينا' },
      { year: -387, event: 'Founded the Academy', eventAr: 'أسس أكاديمية أثينا كأول صرح علمي' },
      { year: -375, event: 'Completed The Republic', eventAr: 'أتم محاورة الجمهورية' },
    ],
    languages: ['el', 'en', 'ar', 'fr'],
    relatedAuthorIds: ['author-ibnkhaldun', 'author-nietzsche'],
    followersCount: 31000,
  },
];

export const INITIAL_BOOKS: Book[] = [
  {
    id: 'book-crime-punishment',
    workId: 'work-crime-punishment',
    slug: 'crime-and-punishment',
    title: 'Crime and Punishment',
    titleAr: 'الجريمة والعقاب',
    originalTitle: 'Преступление и наказание',
    authorId: 'author-dostoevsky',
    authorName: 'Fyodor Dostoevsky',
    authorNameAr: 'فيودور دوستويفسكي',
    coverImage: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&q=80',
    description: 'Raskolnikov, an impoverished student in St. Petersburg, commits a heinous murder convinced he is above the law, only to be engulfed in feverish psychological torment, spiritual trial, and redemption.',
    descriptionAr: 'يقرر الطالب الفقير راسكولنيكوف ارتكاب جريمة قتل مبرراً ذلك بنظرية التفوق البشري، لكنه يغرق في عذاب الضمير وصراع نفسي وجودي عميق يقوده نحو التوبة والخلاص.',
    genres: ['Psychological Fiction', 'Classics', 'Philosophical', 'Drama'],
    genresAr: ['رواية نفسية', 'كلاسيكيات', 'أدب فلسفي', 'دراما'],
    categories: ['Literature', 'Philosophy', 'Classics'],
    categoriesAr: ['الأدب العالمي', 'الفلسفة', 'كلاسيكيات'],
    themes: ['Guilt & Redemption', 'Existential Solitude', 'Morality', 'Justice'],
    themesAr: ['الذنب والخلاص', 'العزلة الوجودية', 'الأخلاق والضمير', 'العدالة'],
    moods: ['Dark', 'Intellectual', 'Melancholic', 'Reflective'],
    rating: 4.9,
    ratingsCount: 4120,
    reviewsCount: 320,
    downloadsCount: 14850,
    readsCount: 28400,
    featured: true,
    hiddenGem: false,
    editorialPick: true,
    forestRegion: 'midnight-library',
    forestCoords: { x: 72, y: 55 },
    readingDifficulty: 'Demanding',
    primaryLanguage: 'en',
    publicationYear: 1866,
    contentAvailability: 'PREVIEW',
    workflowStatus: 'PUBLISHED',
    createdAt: '2026-01-10T12:00:00Z',
    updatedAt: '2026-08-01T10:00:00Z',
    editions: [
      {
        id: 'ed-cp-en-1',
        isbn: '978-0140449136',
        language: 'en',
        languageName: 'English Edition',
        languageNameAr: 'الطبعة الإنجليزية الكلاسيكية',
        publisher: 'Penguin Classics',
        publicationYear: 2003,
        translator: 'David McDuff',
        pageCount: 671,
        estimatedMinutes: 840,
        rightsStatus: 'PUBLIC_DOMAIN',
        licenseType: 'Creative Commons Public Domain Mark 1.0',
        source: 'Standard Ebooks / Project Gutenberg Archive',
        attribution: 'Original work published 1866. Translation in Public Domain.',
        files: [
          { id: 'f-cp-en-pdf', format: 'PDF', sizeBytes: 3200000, sizeFormatted: '3.2 MB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
          { id: 'f-cp-en-html', format: 'HTML', sizeBytes: 1100000, sizeFormatted: '1.1 MB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
          { id: 'f-cp-en-txt', format: 'TXT', sizeBytes: 780000, sizeFormatted: '780 KB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
        ],
      },
      {
        id: 'ed-cp-ar-1',
        isbn: '978-9770281923',
        language: 'ar',
        languageName: 'Arabic Edition',
        languageNameAr: 'طبعة المترجم سامي الدروبي المعتمدة',
        publisher: 'دار التنوير',
        publicationYear: 2014,
        translator: 'Sami Al-Droubi',
        translatorAr: 'د. سامي الدروبي',
        pageCount: 780,
        estimatedMinutes: 920,
        rightsStatus: 'PUBLIC_DOMAIN',
        licenseType: 'Public Domain Translation Archive',
        source: 'دار التنوير للطباعة والنشر والتوزيع',
        attribution: 'ترجمة د. سامي الدروبي الخالدة عن الروسية مباشرة.',
        files: [
          { id: 'f-cp-ar-pdf', format: 'PDF', sizeBytes: 4100000, sizeFormatted: '4.1 MB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
          { id: 'f-cp-ar-html', format: 'HTML', sizeBytes: 1400000, sizeFormatted: '1.4 MB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
        ],
      },
    ],
    chapters: [
      {
        id: 'ch-cp-1',
        title: 'Part I — Chapter I: The Threshold of Petersburg',
        titleAr: 'الجزء الأول — الفصل الأول: على عتبة بطرسبورغ',
        pageNumber: 1,
        content: `On an exceptionally hot evening early in July a young man came out of the garret in which he lodged in S. Place and walked slowly, as though in hesitation, towards K. bridge.

He had successfully avoided meeting his landlady on the stairs. His garret was under the roof of a high, five-storied house and was more like a cupboard than a room. The landlady who provided him with room, dinners, and attendance, lived on the floor below, and every time he went out he was obliged to pass her kitchen, the door of which invariably stood open.

"I want to attempt a thing like that and am frightened by these trifles," he thought, with an odd smile. "Hm... yes, all is in a man's hands and he lets it all slip from cowardice, that's an axiom. It would be interesting to know what it is men are most afraid of. Taking a new step, uttering a new word is what they fear most."

The heat in the street was terrible: and the airlessness, the bustle and the plaster, scaffolding, bricks, and dust, and that special Petersburg stench produced an agonizing impression on the young man's already overwrought nerves.`,
        contentAr: `في مطلع شهر تموز، في ساعة من أشد ساعات المساء قيظاً، خرج شاب من غرفته الصغيرة البائسة الكائنة تحت سقف منزل شاهق في حارة «س»، ومشى بخطوات متمهلة متثاقلة، كأنه يتردد، قاصداً جسر «ك».

وكان قد أفلح في تجنب لقاء صاحبته على الدرج؛ فقد كانت غرفته أشبه بخزانة منها بحجرة سكنية. وكانت صاحبته التي تؤجره الغرفة وتقدم له الطعام تقيم في الطابق الأسفل، فكان يضطر في كل خروج إلى المرور بباب مطبخها المفتوح دائماً.

وفكر في نفسه وهو يبتسم ابتسامة غريبة: "أنا أريد أن أقدم على أمر كهذا، وأخاف من هذه التوافه والترهات! أجل، إن كل شيء في قبضة الإنسان، ولكنه يترك كل شيء يفلت من يده لمجرد الجبن... تلك حقيقة بديهية. ترى ما الذي يخشاه الناس أكثر من أي شيء آخر؟ إنهم يخافون اتخاذ خطوة جديدة، أو النطق بكلمة جديدة لم يألفوها!"

كان القيظ في الشارع خانقاً، وكان الغبار والرائحة المنبعثة من المباني المتهدمة تزيد من توتر أعصاب الشاب المنهكة أصلاً.`,
      },
      {
        id: 'ch-cp-2',
        title: 'Part I — Chapter II: The Tavern Confession',
        titleAr: 'الجزء الأول — الفصل الثاني: حانة المنسيين واعتراف مارميلادوف',
        pageNumber: 28,
        content: `Raskolnikov was not used to crowds, and, as we said before, he avoided society of every sort, more especially of late. But now all at once he felt a desire to be in the company of other men. Something new seemed to be taking place within him, and with it he felt a sort of thirst for company.

He sat down in a dark corner of the tavern. At a table near him sat a retired civil clerk, Marmeladov, whose eyes shone with drunken eloquence:

"Honoured sir," Marmeladov began, addressing him solemnly. "Poverty is no vice, that is a true saying. Yet destitution, sir, destitution is a vice! In poverty you may still retain the nobility of your inborn feelings, but in destitution nobody ever does. Do you understand, sir, what it means when you have nowhere else to go?"`,
        contentAr: `لم يكن راسكولنيكوف معتاداً على الزحام، وكان يتجنب كل لقاء بالناس، لا سيما في الآونة الأخيرة. ولكنه شعر فجأة برغبة غريبة في أن يكون بين البشر، كأن شيئاً جديداً يحدث في أعماقه، مصحوباً بظمأ جارف إلى الرفقة.

جلس في ركن مظلم من الحانة، وكان على مقربة منه موظف حكومي متقاعد يُدعى مارميلادوف، تشع عيناه بوهج حزين:

"سيدي الفاضل،" بادر مارميلادوف مخاطباً إياه بصوت متهدج: "الفقر ليس رذيلة، هذا حق لا مراء فيه. لكن الإملاق المدقع يا سيدي، الإملاق رذيلة! في الفقر قد تحتفظ بنبل مشاعرك الفطرية، أما في الإملاق فلا أحد يستطيع ذلك أبداً. هل تفهم يا سيدي معنى أن لا يجد المرء مكاناً يذهب إليه؟"`,
      },
    ],
  },
  {
    id: 'book-the-prophet',
    workId: 'work-the-prophet',
    slug: 'the-prophet',
    title: 'The Prophet',
    titleAr: 'النبي',
    originalTitle: 'The Prophet',
    authorId: 'author-gibran',
    authorName: 'Khalil Gibran',
    authorNameAr: 'جبران خليل جبران',
    coverImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&q=80',
    description: 'Almustafa, the chosen and beloved prophet, prepares to board a ship home after twelve years in the city of Orphalese, imparting profound, poetic wisdom on love, marriage, children, work, freedom, pain, and death.',
    descriptionAr: 'المصطفى، النبي المختار والمحبوب، يتأهب لركوب السفينة العائدة إلى موطنه بعد اثني عشر عاماً في مدينة أورفاليس، فيجيب الناس بحكمة شعرية خالدة عن المحبة، الزواج، الأبناء، العمل، الحرية، والألم.',
    genres: ['Poetry', 'Philosophy', 'Spiritual', 'Classics'],
    genresAr: ['شعر', 'فلسفة روحية', 'تصوف', 'كلاسيكيات'],
    categories: ['Poetry', 'Philosophy', 'Spirituality'],
    categoriesAr: ['الشعر', 'الفلسفة', 'الروحانيات'],
    themes: ['Love & Freedom', 'Work as Love Made Visible', 'Transcendence', 'Human Unity'],
    themesAr: ['المحبة والحرية', 'العمل تجسيد للمحبة', 'الوحدة الإنسانية', 'التأمل'],
    moods: ['Calm', 'Hopeful', 'Romantic', 'Reflective'],
    rating: 4.95,
    ratingsCount: 5600,
    reviewsCount: 480,
    downloadsCount: 22100,
    readsCount: 43000,
    featured: true,
    hiddenGem: false,
    editorialPick: true,
    forestRegion: 'poetry',
    forestCoords: { x: 82, y: 30 },
    readingDifficulty: 'Accessible',
    primaryLanguage: 'en',
    publicationYear: 1923,
    contentAvailability: 'PREVIEW',
    workflowStatus: 'PUBLISHED',
    createdAt: '2026-01-05T12:00:00Z',
    updatedAt: '2026-08-05T10:00:00Z',
    editions: [
      {
        id: 'ed-tp-en-1',
        isbn: '978-0394404479',
        language: 'en',
        languageName: 'English Original',
        languageNameAr: 'النص الأصلي بالإنجليزية',
        publisher: 'Alfred A. Knopf Heritage',
        publicationYear: 1923,
        pageCount: 128,
        estimatedMinutes: 90,
        rightsStatus: 'PUBLIC_DOMAIN',
        licenseType: 'Public Domain Mark 1.0',
        source: 'Library of Congress Archive',
        attribution: 'Published 1923. In Public Domain worldwide.',
        files: [
          { id: 'f-tp-en-pdf', format: 'PDF', sizeBytes: 1500000, sizeFormatted: '1.5 MB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
          { id: 'f-tp-en-html', format: 'HTML', sizeBytes: 450000, sizeFormatted: '450 KB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
          { id: 'f-tp-en-txt', format: 'TXT', sizeBytes: 120000, sizeFormatted: '120 KB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
        ],
      },
      {
        id: 'ed-tp-ar-1',
        isbn: '978-9953890203',
        language: 'ar',
        languageName: 'Arabic Translation by Mikhail Naimy',
        languageNameAr: 'الترجمة العربية بقلم ميخائيل نعيمة وجميل جبر',
        publisher: 'دار صادر',
        publicationYear: 1958,
        translator: 'Mikhail Naimy',
        translatorAr: 'ميخائيل نعيمة',
        pageCount: 140,
        estimatedMinutes: 100,
        rightsStatus: 'PUBLIC_DOMAIN',
        licenseType: 'Open Public Domain',
        source: 'مؤسسة هنداوي / أرشيف الأدب المهجري',
        attribution: 'صادر ومتاح للملكية العامة كأثر تراثي إنساني.',
        files: [
          { id: 'f-tp-ar-pdf', format: 'PDF', sizeBytes: 1800000, sizeFormatted: '1.8 MB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
          { id: 'f-tp-ar-html', format: 'HTML', sizeBytes: 520000, sizeFormatted: '520 KB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
        ],
      },
    ],
    chapters: [
      {
        id: 'ch-tp-1',
        title: 'The Coming of the Ship & On Love',
        titleAr: 'قدوم السفينة — وفي المحبة',
        pageNumber: 1,
        content: `Almustafa, the chosen and the beloved, who was a dawn unto his own day, had waited twelve years in the city of Orphalese for his ship that was to return and bear him back to the isle of his birth.

And in the twelfth year, on the seventh day of Ielool, the month of reaping, he climbed the hill without the city walls and looked seaward; and he beheld his ship coming with the mist.

Then Almitra the seeress spoke: "Speak to us of Love."
And he raised his head and looked upon the people, and there fell a stillness upon them. And with a great voice he said:

"When love beckons to you, follow him, though his ways are hard and steep.
And when his wings enfold you yield to him, though the sword hidden among his pinions may wound you.
Love gives naught but itself and takes naught but from itself.
Love possesses not nor would it be possessed;
For love is sufficient unto love."`,
        contentAr: `المصطفى، المختار الحبيب، الذي كان فجراً لنهاره، قد انتظر اثني عشر عاماً في مدينة أورفاليس سفينته التي ترجعه إلى الجزيرة التي وُلد فيها.

وفي العام الثاني عشر، في اليوم السابع من أيلول، شهر الحصاد، صعد إلى التل الكائن خارج أسوار المدينة وتطلع نحو البحر؛ فرأى سفينته تقبل مع الضباب.

وحينئذٍ دنت منه المطرة العرافة وقالت: "حدثنا عن المحبة."
فرفع رأسه وتطلع إلى الناس، وخيم عليهم صمت عميق. فقال بصوت جهير:

"إذا أشارت المحبة إليكم فاتبعوها، وإن كانت مسالكها وعرة وشائكة.
وإذا بسطت عليكم جناحيها فاستسلموا لها، وإن جرحكم السيف المستور بين قوادمها.
المحبة لا تعطي إلا ذاتها، ولا تأخذ إلا من ذاتها.
المحبة لا تملك، ولا تريد أن تُملَك؛
لأن المحبة كافية للمحبة."`,
      },
      {
        id: 'ch-tp-2',
        title: 'On Work and Giving',
        titleAr: 'في العمل والعطاء',
        pageNumber: 24,
        content: `Then a ploughman said: "Speak to us of Work."
And he answered and said:

"You work that you may keep pace with the earth and the soul of the earth.
For to be idle is to become a stranger unto the seasons, and to step out of life's procession, that marches in majesty and proud submission towards the infinite.

When you work you are a flute through whose heart the whispering of the hours turns to music.
And what is it to work with love?
It is to weave the cloth with threads drawn from your heart, even as if your beloved were to wear that cloth.
It is to build a house with affection, even as if your beloved were to dwell in that house.
Work is love made visible."`,
        contentAr: `ثم دنا منه حراث وقال: "حدثنا عن العمل."
فأجاب وقال:

"إنكم تعملون لتسايروا الأرض ونفس الأرض؛
لأن الكسل يجعلكم غرباء عن الفصول، وخارجين من موكب الحياة الزاحف في جلال وخضوع نحو اللانهاية.

وحين تعملون، تكونون مزماراً يتحول همس الساعات في قلبه إلى موسيقى عذبة.
وما هو العمل المقرون بالمحبة؟
هو أن تنسجوا الثوب بخيوط مسحوبة من قلوبكم، كأن حبيبكم هو الذي سيرتدي ذلك الثوب.
هو أن تبنوا الدار بمودة، كأن حبيبكم هو الذي سيسكن تلك الدار.
العمل هو المحبة وقد تجسدت في الوجود."`,
      },
    ],
  },
  {
    id: 'book-muqaddimah',
    workId: 'work-muqaddimah',
    slug: 'the-muqaddimah',
    title: 'The Muqaddimah: An Introduction to History',
    titleAr: 'مقدمة ابن خلدون: ديوان العبر',
    originalTitle: 'مقدمة ابن خلدون',
    authorId: 'author-ibnkhaldun',
    authorName: 'Ibn Khaldun',
    authorNameAr: 'عبد الرحمن بن خلدون',
    coverImage: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=600&q=80',
    description: 'The monumental foundational treatise that established the scientific philosophy of history, sociology, statecraft, economics, urbanization, and civilizational lifecycles.',
    descriptionAr: 'العمل التأسيسي الخالد الذي أرسى قواعد علم الاجتماع البشري وفلسفة التاريخ، وشرح نواميس العمران ونشأة الدول وأطوارها وعوامل انهيار الحضارات ونظرية العصبية.',
    genres: ['Philosophy', 'Sociology', 'History', 'Classics'],
    genresAr: ['فلسفة', 'علم الاجتماع', 'تاريخ', 'كلاسيكيات'],
    categories: ['History', 'Philosophy', 'Social Sciences'],
    categoriesAr: ['التاريخ', 'الفلسفة', 'العلوم الاجتماعية'],
    themes: ['Social Cohesion (Asabiyyah)', 'Rise & Fall of Civilizations', 'Human Nature', 'Economics & Labor'],
    themesAr: ['العصبية والعمران', 'أطوار الدول وانهيار الحضارات', 'الطبيعة البشرية', 'الصنائع والمعاش'],
    moods: ['Intellectual', 'Reflective', 'Curious'],
    rating: 4.92,
    ratingsCount: 3890,
    reviewsCount: 290,
    downloadsCount: 18200,
    readsCount: 31000,
    featured: true,
    hiddenGem: false,
    editorialPick: true,
    forestRegion: 'philosophy',
    forestCoords: { x: 22, y: 25 },
    readingDifficulty: 'Scholar',
    primaryLanguage: 'ar',
    publicationYear: 1377,
    contentAvailability: 'PREVIEW',
    workflowStatus: 'PUBLISHED',
    createdAt: '2026-01-08T12:00:00Z',
    updatedAt: '2026-08-03T10:00:00Z',
    editions: [
      {
        id: 'ed-muq-ar-1',
        isbn: '978-9770154821',
        language: 'ar',
        languageName: 'Arabic Heritage Critical Edition',
        languageNameAr: 'طبعة دار الشعب التراثية المحققة',
        publisher: 'دار الكتب العلمية',
        publicationYear: 2012,
        pageCount: 580,
        estimatedMinutes: 800,
        rightsStatus: 'PUBLIC_DOMAIN',
        licenseType: 'Public Domain Islamic Heritage',
        source: 'مخطوطات دار الكتب والوثائق القومية',
        attribution: 'كتاب تراثي عربي كلاسيكي غير خاضع لقيود الحقوق الفكرية المعاصرة.',
        files: [
          { id: 'f-muq-ar-pdf', format: 'PDF', sizeBytes: 5200000, sizeFormatted: '5.2 MB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
          { id: 'f-muq-ar-html', format: 'HTML', sizeBytes: 1900000, sizeFormatted: '1.9 MB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
          { id: 'f-muq-ar-txt', format: 'TXT', sizeBytes: 920000, sizeFormatted: '920 KB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
        ],
      },
      {
        id: 'ed-muq-en-1',
        isbn: '978-0691166285',
        language: 'en',
        languageName: 'English Translation by Franz Rosenthal',
        languageNameAr: 'الترجمة الإنجليزية المعتمدة للمستشرق فرانز روزنتال',
        publisher: 'Princeton University Press',
        publicationYear: 1958,
        translator: 'Franz Rosenthal',
        pageCount: 496,
        estimatedMinutes: 750,
        rightsStatus: 'OPEN_ACCESS',
        licenseType: 'Open Educational Heritage License',
        source: 'Bollingen Series / Princeton University',
        attribution: 'Translated by Franz Rosenthal. Open Access for non-commercial educational reading.',
        files: [
          { id: 'f-muq-en-pdf', format: 'PDF', sizeBytes: 4800000, sizeFormatted: '4.8 MB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
        ],
      },
    ],
    chapters: [
      {
        id: 'ch-muq-1',
        title: 'Introduction on Historiography & Human Social Organization',
        titleAr: 'المقدمة في فضل علم التاريخ والاجتماع الإنساني',
        pageNumber: 1,
        content: `اعلم أن فن التاريخ فن عزيز المذهب، جم الفوائد، شريف الغاية؛ إذ هو يوقفنا على أحوال الماضين من الأمم في أخلاقهم، والأنبياء في سيرهم، والملوك في دولهم وسياستهم، حتى تتم فائدة الاقتداء في ذلك لمن يرومه في أحوال الدين والدنيا.

فهو محتاج إلى مآخذ متعددة، ومعارف متنوعة، وحسن نظر وتثبت؛ يفضيان بصاحبهما إلى الحق، وينكبان به عن المزلات والمغالط؛ لأن الأخبار إذا اعتُمد فيها على مجرد النقل ولم تُحكّم أصول العادة وقواعد السياسة وطبيعة العمران، قلما يؤمن معها العثار وقدم الزلل.

والسبب في ذلك أن الإنسان مدني بالطبع؛ أي لا بد له من الاجتماع الذي هو مدنية في اصطلاحهم، وهو معنى العمران.`,
        contentAr: `اعلم أن فن التاريخ فن عزيز المذهب، جم الفوائد، شريف الغاية؛ إذ هو يوقفنا على أحوال الماضين من الأمم في أخلاقهم، والأنبياء في سيرهم، والملوك في دولهم وسياستهم، حتى تتم فائدة الاقتداء في ذلك لمن يرومه في أحوال الدين والدنيا.

فهو محتاج إلى مآخذ متعددة، ومعارف متنوعة، وحسن نظر وتثبت؛ يفضيان بصاحبهما إلى الحق، وينكبان به عن المزلات والمغالط؛ لأن الأخبار إذا اعتُمد فيها على مجرد النقل ولم تُحكّم أصول العادة وقواعد السياسة وطبيعة العمران، قلما يؤمن معها العثار وقدم الزلل.

والسبب في ذلك أن الإنسان مدني بالطبع؛ أي لا بد له من الاجتماع الذي هو مدنية في اصطلاحهم، وهو معنى العمران.`,
      },
      {
        id: 'ch-muq-2',
        title: 'On Asabiyyah and the Lifecycle of Dynasties',
        titleAr: 'في أن الملك والدول إنما تحصل بالقبيل والعصبية',
        pageNumber: 42,
        content: `إن الغاية التي تجري إليها العصبية هي الملك؛ وذلك أن النعرة والتناصر لا يكونان إلا لأمر يقتضيه التغلب، والتغلب هو الملك. فإذا بلغت العصبية غايتها في التغلب، استقر لصاحبها الملك وسلطان القهر.

ثم اعلم أن الدول لها أعمار طبيعية كالأشخاص، وتمر بخمسة أطوار:
طور الظفر والاستيلاء، ثم طور الاستبداد والانفراد، ثم طور الفراغ والدعة لتحصيل ثمرات الملك، ثم طور القنوع والمسالمة، ثم طور الإسراف والتبذير والانقراض؛ وفيه تسقط الدولة وتؤول إلى الزوال.`,
        contentAr: `إن الغاية التي تجري إليها العصبية هي الملك؛ وذلك أن النعرة والتناصر لا يكونان إلا لأمر يقتضيه التغلب، والتغلب هو الملك. فإذا بلغت العصبية غايتها في التغلب، استقر لصاحبها الملك وسلطان القهر.

ثم اعلم أن الدول لها أعمار طبيعية كالأشخاص، وتمر بخمسة أطوار:
طور الظفر والاستيلاء، ثم طور الاستبداد والانفراد، ثم طور الفراغ والدعة لتحصيل ثمرات الملك، ثم طور القنوع والمسالمة، ثم طور الإسراف والتبذير والانقراض؛ وفيه تسقط الدولة وتؤول إلى الزوال.`,
      },
    ],
  },
  {
    id: 'book-zarathustra',
    workId: 'work-zarathustra',
    slug: 'thus-spoke-zarathustra',
    title: 'Thus Spoke Zarathustra',
    titleAr: 'هكذا تكلم زرادشت',
    originalTitle: 'Also sprach Zarathustra',
    authorId: 'author-nietzsche',
    authorName: 'Friedrich Nietzsche',
    authorNameAr: 'فريدريك نيتشه',
    coverImage: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=600&q=80',
    description: 'A philosophical manifesto written in magnificent poetic prose, following the solitary prophet Zarathustra descending from his mountain to teach self-overcoming and the eternal recurrence.',
    descriptionAr: 'بيان فلسفي ملحمي صيغ بلغة شعرية فذة، يروي نزول زرادشت من عزلته في الجبل بعد عشر سنوات ليعلم الناس تجاوز الذات والارتقاء بالإرادة الإنسانية.',
    genres: ['Philosophy', 'Poetry', 'Classics'],
    genresAr: ['فلسفة', 'شعر ملحمي', 'كلاسيكيات'],
    categories: ['Philosophy', 'Literature'],
    categoriesAr: ['الفلسفة', 'الأدب العالمي'],
    themes: ['Self-Overcoming', 'Will to Create', 'Eternal Recurrence', 'Solitude & Wisdom'],
    themesAr: ['تجاوز الذات', 'إرادة الخلق', 'العود الأبدي', 'العزلة والحكمة'],
    moods: ['Intellectual', 'Dark', 'Adventurous', 'Reflective'],
    rating: 4.86,
    ratingsCount: 3200,
    reviewsCount: 240,
    downloadsCount: 12400,
    readsCount: 22000,
    featured: false,
    hiddenGem: true,
    editorialPick: true,
    forestRegion: 'philosophy',
    forestCoords: { x: 18, y: 15 },
    readingDifficulty: 'Demanding',
    primaryLanguage: 'de',
    publicationYear: 1883,
    contentAvailability: 'PREVIEW',
    workflowStatus: 'PUBLISHED',
    createdAt: '2026-01-15T12:00:00Z',
    updatedAt: '2026-08-02T10:00:00Z',
    editions: [
      {
        id: 'ed-tsz-en-1',
        isbn: '978-0140441185',
        language: 'en',
        languageName: 'English Translation by Thomas Common',
        languageNameAr: 'الترجمة الإنجليزية الكلاسيكية',
        publisher: 'Modern Library',
        publicationYear: 1917,
        pageCount: 352,
        estimatedMinutes: 480,
        rightsStatus: 'PUBLIC_DOMAIN',
        licenseType: 'Public Domain Mark 1.0',
        source: 'Standard Ebooks Archive',
        attribution: 'Translated by Thomas Common (1909). In Public Domain.',
        files: [
          { id: 'f-tsz-en-pdf', format: 'PDF', sizeBytes: 2100000, sizeFormatted: '2.1 MB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
          { id: 'f-tsz-en-html', format: 'HTML', sizeBytes: 850000, sizeFormatted: '850 KB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
        ],
      },
      {
        id: 'ed-tsz-ar-1',
        isbn: '978-9953441818',
        language: 'ar',
        languageName: 'Arabic Translation by Felix Fares',
        languageNameAr: 'ترجمة الأستاذ فليكس فارس الشهيرة',
        publisher: 'دار الآفاق الجديدة',
        publicationYear: 1938,
        translator: 'Felix Fares',
        translatorAr: 'فليكس فارس',
        pageCount: 410,
        estimatedMinutes: 520,
        rightsStatus: 'PUBLIC_DOMAIN',
        licenseType: 'Public Domain Arabic Translation',
        source: 'مكتبة التراث الحديث',
        attribution: 'ترجمة فليكس فارس الأدبية البديعة (١٩٣٨).',
        files: [
          { id: 'f-tsz-ar-pdf', format: 'PDF', sizeBytes: 2900000, sizeFormatted: '2.9 MB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
        ],
      },
    ],
    chapters: [
      {
        id: 'ch-tsz-1',
        title: "Zarathustra's Prologue",
        titleAr: 'مقدمة زرادشت: النزول من الجبل',
        pageNumber: 1,
        content: `When Zarathustra was thirty years old, he left his home and the lake of his home, and went into the mountains. There he enjoyed his spirit and his solitude, and for ten years did not weary of it.

But at last his heart changed—and one morning he rose with the dawn, stepped before the sun, and spoke thus unto it:

"Thou great star! What would be thy happiness if thou hadst not those for whom thou shinest!
For ten years hast thou climbed here unto my cave: thou wouldst have wearied of thy light and of the journey, had it not been for me, mine eagle, and my serpent.
Lo! I am weary of my wisdom, like the bee that hath gathered too much honey; I need hands outstretched to take it.
Therefore must I descend into the deep: as thou doest in the evening, when thou goest behind the sea, and bestowest light also on the underworld, thou exuberant star!"`,
        contentAr: `لما بلغ زرادشت الثلاثين من عمره، فارق موطنه وبحيرة موطنه، وصعد إلى الجبال. وهناك استمتع بروحه وعزلته، ولم يمل من ذلك طوال عشر سنوات.

ولكن في النهاية تحول قلبه—ونهض ذات صباح مع الفجر، ووقف قبالة الشمس، وخاطبها هكذا:

"أيها الكوكب العظيم! أين كانت سعادتك لولا أولئك الذين تُشرق عليهم؟
لقد صعدت إلى كهفي هذا عشر سنين: وكنت ستسأم من نورك ومسارك هذا لولاي أنا ونسري وثعباني.
إنني قد سئمت من فرط حكمتي، كالنحلة التي جمعت شهداً يفوق طاقتها؛ وإنني بحاجة إلى أيدٍ تمتد لتأخذها!
ولذا يجب عليّ أن أنحدر إلى الأعماق: كما تفعلين أنت في المساء حين تهبطين وراء البحر لتلقي بنورك على العالم السفلي، أيتها الشعلة الفياضة!"`,
      },
    ],
  },
  {
    id: 'book-metamorphosis',
    workId: 'work-metamorphosis',
    slug: 'the-metamorphosis',
    title: 'The Metamorphosis',
    titleAr: 'التحول (المسخ)',
    originalTitle: 'Die Verwandlung',
    authorId: 'author-kafka',
    authorName: 'Franz Kafka',
    authorNameAr: 'فرانتس كافكا',
    coverImage: 'https://images.unsplash.com/photo-1507842229451-9f01079ca4b5?w=600&q=80',
    description: 'Gregor Samsa wakes one morning from troubled dreams to find himself transformed into a monstrous insect, sparking an agonizing tragedy of family alienation and economic abandonment.',
    descriptionAr: 'يستيقظ غريغور سامسا ذات صباح من أحلام مضطربة ليجد نفسه قد تحول في فراشه إلى حشرة عملاقة، لتبدأ مأساة الاغتراب الأسري والرفض الاجتماعي البارد.',
    genres: ['Absurdist Fiction', 'Classics', 'Psychological'],
    genresAr: ['أدب العبث', 'كلاسيكيات', 'رواية نفسية'],
    categories: ['Literature', 'Novels'],
    categoriesAr: ['الأدب العالمي', 'روايات قصيرة'],
    themes: ['Alienation', 'Family Duty & Rejection', 'Identity', 'Absurdity of Existence'],
    themesAr: ['الغربة الوجودية', 'الواجب الأسري والخذلان', 'أزمة الهوية'],
    moods: ['Dark', 'Melancholic', 'Reflective'],
    rating: 4.88,
    ratingsCount: 4900,
    reviewsCount: 390,
    downloadsCount: 16500,
    readsCount: 33000,
    featured: true,
    hiddenGem: false,
    editorialPick: true,
    forestRegion: 'midnight-library',
    forestCoords: { x: 62, y: 65 },
    readingDifficulty: 'Moderate',
    primaryLanguage: 'de',
    publicationYear: 1915,
    contentAvailability: 'PREVIEW',
    workflowStatus: 'PUBLISHED',
    createdAt: '2026-01-12T12:00:00Z',
    updatedAt: '2026-08-04T10:00:00Z',
    editions: [
      {
        id: 'ed-meta-en-1',
        isbn: '978-0486290386',
        language: 'en',
        languageName: 'English Translation by Ian Johnston',
        languageNameAr: 'الترجمة الإنجليزية المفتوحة',
        publisher: 'Dover Thrift Edition',
        publicationYear: 1996,
        translator: 'Ian Johnston',
        pageCount: 96,
        estimatedMinutes: 80,
        rightsStatus: 'PUBLIC_DOMAIN',
        licenseType: 'Public Domain Mark 1.0',
        source: 'Project Gutenberg Archive',
        attribution: 'Original German published 1915. In Public Domain.',
        files: [
          { id: 'f-meta-en-pdf', format: 'PDF', sizeBytes: 950000, sizeFormatted: '950 KB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
          { id: 'f-meta-en-html', format: 'HTML', sizeBytes: 320000, sizeFormatted: '320 KB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
        ],
      },
      {
        id: 'ed-meta-ar-1',
        isbn: '978-9770932014',
        language: 'ar',
        languageName: 'Arabic Edition',
        languageNameAr: 'الترجمة العربية بقلم د. مصطفى ماهر',
        publisher: 'دار الشروق',
        publicationYear: 2008,
        translator: 'Dr. Moustafa Maher',
        translatorAr: 'د. مصطفى ماهر',
        pageCount: 110,
        estimatedMinutes: 90,
        rightsStatus: 'RESTRICTED',
        licenseType: 'Copyright Reserved (Publisher Agreement)',
        source: 'دار الشروق للنشر والتوزيع',
        attribution: 'حقوق النشر والتوزيع محفوظة لدار الشروق. للقراءة والمعاينة الأكاديمية داخل المنصة فقط، والتحميل المباشر مقيد.',
        files: [
          { id: 'f-meta-ar-sample', format: 'HTML', sizeBytes: 150000, sizeFormatted: '150 KB', downloadAllowed: false, readingAllowed: true, offlineAllowed: false },
        ],
      },
    ],
    chapters: [
      {
        id: 'ch-meta-1',
        title: 'Chapter I: The Transformation',
        titleAr: 'الفصل الأول: الاستيقاظ والتحول',
        pageNumber: 1,
        content: `One morning, when Gregor Samsa woke from troubled dreams, he found himself transformed in his bed into a horrible vermin. He lay on his armour-like back, and if he lifted his head a little he could see his brown belly, slightly domed and divided by arches into stiff sections.

"What's happened to me?" he thought. It wasn't a dream. His room, a proper human room although a little too small, lay peacefully between its four familiar walls.

Gregor then turned to look out the window at the dull weather. Drops of rain could be heard hitting the pane, which made him feel quite sad. "How about if I sleep a little bit longer and forget all this nonsense," he thought, but that was something he was unable to do because he was used to sleeping on his right, and in his present state couldn't get into that position.`,
        contentAr: `استيقظ غريغور سامسا ذات صباح من أحلام مضطربة، فوجد نفسه قد تحول في فراشه إلى حشرة بالغة الضخامة ومثيرة للاشمئزاز. كان مستلقياً على ظهره الصلب الشبيه بدرع واقٍ، وحين رفع رأسه قليلاً، رأى بطنه البني المقوس المقسم إلى حزوز غليظة مقببة.

وفكر في نفسه: "ما الذي حدث لي؟" لم يكن ذلك حلماً أبداً. كانت غرفته، وهي غرفة بشرية حقيقية وإن بدت ضيقة بعض الشيء، ترقد بهدوء بين جدرانها الأربعة المألوفة.

ثم التفت غريغور ينظر عبر النافذة إلى الجو الكئيب المعتم؛ وكانت قطرات المطر تُسمع وهي تصطدم بالزجاج الرقيق، مما أورثه حزناً غامراً. وفكر: "ماذا لو نمت قليلاً بعد ونسيت هذه الترهات كلها؟" لكن ذلك كان أمراً مستحيلاً؛ لأنه اعتاد النوم على جانبه الأيمن، وفي حالته الراهنة عجز تماماً عن اتخاذ ذلك الوضع.`,
      },
    ],
  },
  {
    id: 'book-palace-walk',
    workId: 'work-palace-walk',
    slug: 'palace-walk',
    title: 'Palace Walk (Bayn al-Qasrayn)',
    titleAr: 'بين القصرين (الثلاثية)',
    originalTitle: 'بين القصرين',
    authorId: 'author-mahfouz',
    authorName: 'Naguib Mahfouz',
    authorNameAr: 'نجيب محفوظ',
    coverImage: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=600&q=80',
    description: 'The monumental opening masterpiece of the Cairo Trilogy, depicting the family of patriarch Al-Sayyid Ahmad Abd al-Jawad against the turbulent backdrop of the 1919 Egyptian revolution.',
    descriptionAr: 'الجزء الأول الأيقوني من ثلاثية القاهرة الخالدة، يرسم ملامح أسرة السيد أحمد عبد الجواد وصراعات الأجيال بين التقاليد الصارمة والوعي الوطني المتفجر في ثورة ١٩١٩.',
    genres: ['Historical Fiction', 'Family Saga', 'Classics'],
    genresAr: ['رواية تاريخية', 'ملحمة عائلية', 'كلاسيكيات'],
    categories: ['Literature', 'Arabic Novels'],
    categoriesAr: ['الأدب العربي', 'روايات'],
    themes: ['Tradition vs Rebellion', 'Patriarchy', 'Cairo Alleyways', 'National Awakening'],
    themesAr: ['التقاليد والتمرد', 'سلطة الأب', 'الحارة المصرية', 'اليقظة الوطنية'],
    moods: ['Reflective', 'Melancholic', 'Intellectual'],
    rating: 4.94,
    ratingsCount: 6200,
    reviewsCount: 510,
    downloadsCount: 19800,
    readsCount: 41000,
    featured: true,
    hiddenGem: false,
    editorialPick: true,
    forestRegion: 'river-of-stories',
    forestCoords: { x: 35, y: 58 },
    readingDifficulty: 'Moderate',
    primaryLanguage: 'ar',
    publicationYear: 1956,
    contentAvailability: 'PREVIEW',
    workflowStatus: 'PUBLISHED',
    createdAt: '2026-01-02T12:00:00Z',
    updatedAt: '2026-08-01T10:00:00Z',
    editions: [
      {
        id: 'ed-pw-ar-1',
        isbn: '978-9770914041',
        language: 'ar',
        languageName: 'Arabic Original (Authorized Edition)',
        languageNameAr: 'الطبعة الأصلية المعتمدة لدار الشروق',
        publisher: 'دار الشروق',
        publicationYear: 2006,
        pageCount: 540,
        estimatedMinutes: 680,
        rightsStatus: 'LICENSED',
        licenseType: 'Exclusive Digital Reading License',
        source: 'مكتبة نجيب محفوظ الرسمية',
        attribution: 'مرخص رسمياً للمطالعة الرقمية في مكتبة نكسارا بموجب اتفاق الناشر.',
        files: [
          { id: 'f-pw-ar-pdf', format: 'PDF', sizeBytes: 3800000, sizeFormatted: '3.8 MB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
          { id: 'f-pw-ar-html', format: 'HTML', sizeBytes: 1200000, sizeFormatted: '1.2 MB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
        ],
      },
    ],
    chapters: [
      {
        id: 'ch-pw-1',
        title: 'Chapter I: The Midnight Awakening of Amina',
        titleAr: 'الفصل الأول: يقظة أمينة في جوف الليل',
        pageNumber: 1,
        content: `استيقظت أمينة في جوف الليل كعادتها لتنتظر عودة السيد. كان البيت غارقاً في سبات عميق، ولم يكن يُسمع إلا تكتكة الساعة الجدارية القديمة وصوت الريح العابرة في مشربيات حي الجمالية.

وقفت وراء المشربية ترقب الطريق المظلم، وهي تدرك أن خطوته إذا رنت على الحجارة ستبدد هذا الصمت، معلنة عودة صاحب البيت الذي تهابه وتحبه بقلب ملؤه الإجلال والرهبة.`,
        contentAr: `استيقظت أمينة في جوف الليل كعادتها لتنتظر عودة السيد. كان البيت غارقاً في سبات عميق، ولم يكن يُسمع إلا تكتكة الساعة الجدارية القديمة وصوت الريح العابرة في مشربيات حي الجمالية.

وقفت وراء المشربية ترقب الطريق المظلم، وهي تدرك أن خطوته إذا رنت على الحجارة ستبدد هذا الصمت، معلنة عودة صاحب البيت الذي تهابه وتحبه بقلب ملؤه الإجلال والرهبة.`,
      },
    ],
  },
  {
    id: 'book-diwan-mutanabbi',
    workId: 'work-diwan-mutanabbi',
    slug: 'diwan-al-mutanabbi',
    title: 'Diwan of Al-Mutanabbi',
    titleAr: 'ديوان أبي الطيب المتنبي',
    originalTitle: 'ديوان المتنبي',
    authorId: 'author-mutanabbi',
    authorName: 'Al-Mutanabbi',
    authorNameAr: 'أبو الطيب المتنبي',
    coverImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&q=80',
    description: 'The monumental collection of immortal classical Arabic poetry that has shaped Arab cultural consciousness, pride, chivalry, and eloquent wisdom for over a thousand years.',
    descriptionAr: 'ديوان شاعر العرب الأكبر، الذي صاغ عزة النفس والحكمة والفروسية في أبهى حللها البلاغية التي تتردد عبر القرون.',
    genres: ['Classical Poetry', 'Classics', 'Wisdom'],
    genresAr: ['شعر عربي كلاسيكي', 'كلاسيكيات', 'حكمة'],
    categories: ['Poetry', 'Arabic Heritage'],
    categoriesAr: ['الشعر', 'التراث العربي'],
    themes: ['Ambition & Pride', 'Time & Fate', 'Chivalry', 'Philosophical Eloquence'],
    themesAr: ['الطموح وعزة النفس', 'الدهر وصروف الزمان', 'الفروسية', 'الحكمة'],
    moods: ['Hopeful', 'Adventurous', 'Reflective'],
    rating: 4.98,
    ratingsCount: 7400,
    reviewsCount: 680,
    downloadsCount: 31000,
    readsCount: 52000,
    featured: true,
    hiddenGem: false,
    editorialPick: true,
    forestRegion: 'ancient-grove',
    forestCoords: { x: 52, y: 22 },
    readingDifficulty: 'Demanding',
    primaryLanguage: 'ar',
    publicationYear: 965,
    contentAvailability: 'PREVIEW',
    workflowStatus: 'PUBLISHED',
    createdAt: '2026-01-01T12:00:00Z',
    updatedAt: '2026-08-01T10:00:00Z',
    editions: [
      {
        id: 'ed-mut-ar-1',
        isbn: '978-9770172313',
        language: 'ar',
        languageName: 'Critical Edition with Al-Barquqi Commentary',
        languageNameAr: 'طبعة شرح البرقوقي المحققة',
        publisher: 'دار الكتاب العربي',
        publicationYear: 1938,
        pageCount: 720,
        estimatedMinutes: 900,
        rightsStatus: 'PUBLIC_DOMAIN',
        licenseType: 'Public Domain Classical Arabic Corpus',
        source: 'مخطوطات التراث العربي',
        attribution: 'تراث شعري إنساني متاح للملكية العامة دون قيود.',
        files: [
          { id: 'f-mut-ar-pdf', format: 'PDF', sizeBytes: 4500000, sizeFormatted: '4.5 MB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
          { id: 'f-mut-ar-html', format: 'HTML', sizeBytes: 1500000, sizeFormatted: '1.5 MB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
          { id: 'f-mut-ar-txt', format: 'TXT', sizeBytes: 810000, sizeFormatted: '810 KB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
        ],
      },
    ],
    chapters: [
      {
        id: 'ch-mut-1',
        title: 'On Ambition, Honor, and Wisdom',
        titleAr: 'في عزة النفس والهمة العالية وصروف الزمان',
        pageNumber: 1,
        content: `عَلى قَدْرِ أهْلِ العَزْم تأتي العَزائِمُ
وَتأتي علَى قَدْرِ الكِرامِ المَكارمُ

وَتَعْظُمُ في عَينِ الصّغيرِ صغارُها
وَتَصْغُرُ في عَينِ العَظيمِ العَظائِمُ

الخَيْلُ وَاللّيْلُ وَالبَيْداءُ تَعرِفُني
وَالسّيفُ وَالرّمحُ والقِرْطاسُ وَالقَلَمُ

صَحِبْتُ في الفَلَواتِ الوَحشَ مُنفرِداً
حتى تَعَجّبَ منّي القُورُ وَالأكَمُ

إذا غامَرْتَ في شَرَفٍ مَرُومٍ
فَلا تَقْنَعْ بما دُونَ النّجُومِ

فطَعْمُ المَوْتِ في أمْرٍ حَقِيرٍ
كطَعْمِ المَوْتِ في أمْرٍ عَظِيمِ`,
        contentAr: `عَلى قَدْرِ أهْلِ العَزْم تأتي العَزائِمُ
وَتأتي علَى قَدْرِ الكِرامِ المَكارمُ

وَتَعْظُمُ في عَينِ الصّغيرِ صغارُها
وَتَصْغُرُ في عَينِ العَظيمِ العَظائِمُ

الخَيْلُ وَاللّيْلُ وَالبَيْداءُ تَعرِفُني
وَالسّيفُ وَالرّمحُ والقِرْطاسُ وَالقَلَمُ

صَحِبْتُ في الفَلَواتِ الوَحشَ مُنفرِداً
حتى تَعَجّبَ منّي القُورُ وَالأكَمُ

إذا غامَرْتَ في شَرَفٍ مَرُومٍ
فَلا تَقْنَعْ بما دُونَ النّجُومِ

فطَعْمُ المَوْتِ في أمْرٍ حَقِيرٍ
كطَعْمِ المَوْتِ في أمْرٍ عَظِيمِ`,
      },
    ],
  },
  {
    id: 'book-masnavi',
    workId: 'work-masnavi',
    slug: 'the-masnavi',
    title: 'The Masnavi: Spiritual Couplets',
    titleAr: 'المثنوي: جلال الدين الرومي',
    originalTitle: 'مثنوی معنوی',
    authorId: 'author-rumi',
    authorName: 'Jalal al-Din Rumi',
    authorNameAr: 'جلال الدين الرومي',
    coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80',
    description: 'The monumental spiritual masterpiece of mystical parables, allegories, and spiritual dialogues exploring divine love, detachment, and the return of the human soul to its source.',
    descriptionAr: 'درة التصوف الإسلامي والشعر الإشراقي الخالد، يضم آلاف الحكايات والتمثيلات الرمزية التي تدور حول حنين الروح للمصدر الإلهي والمحبة الشاملة.',
    genres: ['Sufi Poetry', 'Spiritual', 'Philosophy', 'Classics'],
    genresAr: ['شعر صوفي', 'روحانيات', 'فلسفة إشراقية', 'كلاسيكيات'],
    categories: ['Poetry', 'Spirituality', 'Classics'],
    categoriesAr: ['الشعر', 'الروحانيات', 'التراث الإنساني'],
    themes: ['Divine Love', 'The Reed Flute (Ney)', 'Soul Return', 'Compassion'],
    themesAr: ['المحبة الإلهية', 'حنين الناي', 'رحلة الروح', 'التسامي'],
    moods: ['Calm', 'Hopeful', 'Romantic', 'Reflective'],
    rating: 4.96,
    ratingsCount: 5100,
    reviewsCount: 420,
    downloadsCount: 24000,
    readsCount: 46000,
    featured: true,
    hiddenGem: false,
    editorialPick: true,
    forestRegion: 'poetry',
    forestCoords: { x: 78, y: 38 },
    readingDifficulty: 'Moderate',
    primaryLanguage: 'fa',
    publicationYear: 1273,
    contentAvailability: 'PREVIEW',
    workflowStatus: 'PUBLISHED',
    createdAt: '2026-01-03T12:00:00Z',
    updatedAt: '2026-08-01T10:00:00Z',
    editions: [
      {
        id: 'ed-mas-ar-1',
        isbn: '978-9773082338',
        language: 'ar',
        languageName: 'Arabic Translation by Dr. Ibrahim Al-Desouqi Shita',
        languageNameAr: 'ترجمة د. إبراهيم الدسوقي شتا عن الفارسية',
        publisher: 'المجلس الأعلى للثقافة',
        publicationYear: 2001,
        translator: 'Dr. Ibrahim Al-Desouqi Shita',
        translatorAr: 'د. إبراهيم الدسوقي شتا',
        pageCount: 620,
        estimatedMinutes: 720,
        rightsStatus: 'PUBLIC_DOMAIN',
        licenseType: 'Public Domain Translation',
        source: 'المشروع القومي للترجمة',
        attribution: 'طبعة محققة ومتاحة للبحث والقراءة العامة.',
        files: [
          { id: 'f-mas-ar-pdf', format: 'PDF', sizeBytes: 3900000, sizeFormatted: '3.9 MB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
        ],
      },
    ],
    chapters: [
      {
        id: 'ch-mas-1',
        title: 'Song of the Reed',
        titleAr: 'أنشودة الناي وحنين الروح',
        pageNumber: 1,
        content: `استمع إلى هذا الناي كيف يروي حكايته، وكيف يشكو ألم الفراق:
يقول: منذ أن قطعت من منبت الغاب، والناس رجالاً ونساءً يبكون لنوحي وبكائي!

أريد صدراً مزقه الفراق إرباً، حتى أستطيع أن أبثه شرح ألم الاشتياق.
إن كل من يبقى بعيداً عن أصله، يبحث دائماً عن أيام وصاله القديمة.

أنا غدوت في كل جمع نائحاً، ورافقت المحزونين والمسرورين معاً.
وظن كل إنسان أنه أصبح لي صديقاً حميماً، لكن أحداً لم يفتش عما في باطني من أسرار!`,
        contentAr: `استمع إلى هذا الناي كيف يروي حكايته، وكيف يشكو ألم الفراق:
يقول: منذ أن قطعت من منبت الغاب، والناس رجالاً ونساءً يبكون لنوحي وبكائي!

أريد صدراً مزقه الفراق إرباً، حتى أستطيع أن أبثه شرح ألم الاشتياق.
إن كل من يبقى بعيداً عن أصله، يبحث دائماً عن أيام وصاله القديمة.

أنا غدوت في كل جمع نائحاً، ورافقت المحزونين والمسرورين معاً.
وظن كل إنسان أنه أصبح لي صديقاً حميماً، لكن أحداً لم يفتش عما في باطني من أسرار!`,
      },
    ],
  },
  {
    id: 'book-kalila-dimna',
    workId: 'work-kalila-dimna',
    slug: 'kalila-and-dimna',
    title: 'Kalila and Dimna: Fables of Wisdom',
    titleAr: 'كليلة ودمنة: حكايات الحكمة والسياسة',
    originalTitle: 'كليلة ودمنة',
    authorId: 'author-ibn-al-muqaffa',
    authorName: 'Ibn al-Muqaffa',
    authorNameAr: 'عبد الله بن المقفع',
    coverImage: 'https://images.unsplash.com/photo-1476275466078-4007374efbbe?w=600&q=80',
    description: 'The monumental collection of animal fables conveying timeless political wisdom, moral virtue, diplomacy, friendship, and caution in human governance.',
    descriptionAr: 'تحفة النثر العربي الخالدة ومجمع الحكمة السياسية والأخلاقية، تروي على ألسنة الطير والحيوان أسرار الصداقة، والوفاء، والحذر، وتدبير الملك وشؤون الحياة.',
    genres: ['Allegory', 'Fables', 'Classics', 'Wisdom', 'Philosophy'],
    genresAr: ['حكايات رمزية', 'كلاسيكيات الأدب', 'أمثال وحكم', 'فلسفة وسياسة'],
    categories: ['Literature', 'Philosophy', 'Folklore'],
    categoriesAr: ['الأدب العربي', 'الفلسفة والحكمة', 'التراث'],
    themes: ['Wisdom in Governance', 'True Friendship vs Deceit', 'Fate and Prudence'],
    themesAr: ['حكمة الحكم وتدبير الدول', 'الصداقة الصادقة مقابل المكر', 'الحذر والتعقل'],
    moods: ['Reflective', 'Playful', 'Intellectual', 'Timeless'],
    rating: 4.96,
    ratingsCount: 3890,
    reviewsCount: 310,
    downloadsCount: 19400,
    readsCount: 36000,
    featured: true,
    hiddenGem: false,
    editorialPick: true,
    forestRegion: 'ancient-grove',
    forestCoords: { x: 55, y: 70 },
    readingDifficulty: 'Accessible',
    primaryLanguage: 'ar',
    publicationYear: 750,
    contentAvailability: 'PREVIEW',
    workflowStatus: 'PUBLISHED',
    createdAt: '2026-01-01T12:00:00Z',
    updatedAt: '2026-08-10T10:00:00Z',
    editions: [
      {
        id: 'ed-kd-ar-1',
        isbn: '978-9770281999',
        language: 'ar',
        languageName: 'Classical Arabic Edition',
        languageNameAr: 'طبعة التراث المحققة والكاملة',
        publisher: 'دار الشروق التراثية',
        publicationYear: 2012,
        pageCount: 340,
        estimatedMinutes: 380,
        rightsStatus: 'PUBLIC_DOMAIN',
        licenseType: 'Public Domain Open Cultural Heritage',
        source: 'المكتبة الوطنية للتراث العربي',
        attribution: 'نص محقق عن أقدم المخطوطات الأندلسية والمملوكية.',
        files: [
          { id: 'f-kd-ar-pdf', format: 'PDF', sizeBytes: 2800000, sizeFormatted: '2.8 MB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
          { id: 'f-kd-ar-html', format: 'HTML', sizeBytes: 950000, sizeFormatted: '950 KB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
          { id: 'f-kd-ar-txt', format: 'TXT', sizeBytes: 420000, sizeFormatted: '420 KB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
        ],
      },
    ],
    chapters: [
      {
        id: 'ch-kd-1',
        title: 'Introduction: The Purpose of Allegory and Wisdom',
        titleAr: 'مقدمة الكتاب: مقاصد الأمثال ومراتب الحكمة',
        pageNumber: 1,
        content: `Ibn al-Muqaffa said: The purpose of placing wisdom into the mouths of beasts and birds is twofold: first, to delight the minds of seekers with engaging narratives, and second, to impart deep moral discernment to kings and philosophers.

For wisdom is like a precious jewel concealed beneath a stone; only those who possess the patience to dig and the clarity to examine will behold its true radiance.

Let the reader of this book not stop at the external appearance of the fable, but plunge into the inner ocean of its meaning.`,
        contentAr: `قال عبد الله بن المقفع: إن واضعي هذه الأمثال على ألسنة البهائم والسباع والطير قصدوا بها غرضين جليلين:
أحدهما: استمالة قلوب الخاصة والعامة بالنوادر اللطيفة والقصص المستطابة.
والآخر: بث الحكمة وتدبير السياسة في نفوس الحكماء والملوك ومن يطلب الفضيلة.

وإن مثل هذا الكتاب كمثل الجوهرة الثمينة المودعة في الصخرة الصماء؛ لا ينالها إلا من صبر على نقبها، وأمعن النظر في استخراجها، ولم يقنع بظاهر القشرة دون لباب الثمرة.

فينبغي للناظر في كتابنا هذا ألا يقف عند ظاهر الحكاية، بل يغوص في بحر معانيها، ويلتمس منها مرآة لنفسه وزاداً لعقله في معترك الحياة.`,
      },
      {
        id: 'ch-kd-2',
        title: 'The Chapter of the Lion and the Ox (Shatraba)',
        titleAr: 'باب الأسد والثور (شتربة): عهد الألفة ومكائد الدسيسة',
        pageNumber: 35,
        content: `Dabshalim the King said to Bidpai the Philosopher: "Tell me now the story of two companions who loved one another, until a deceitful schemer sowed discord between them."

Bidpai answered: "When two brothers in soul are united by virtue, no calamity can shatter their bond—save when they lend their ears to the whispers of envy."`,
        contentAr: `قال دبشليم الملك لبيدبا الفيلسوف: "اضرب لي مثل رجلين متصافيين، دخل بينهما خبيث نمام فقطع حبل ودادهما، وأورثهما العداوة والبغضاء."

قال الفيلسوف: "إذا ابتلي الأخوان الصادقان بقرين سوء ذي مكر وخديعة، يسعى بالنميمة ويزخرف القول، أفسد ما بينهما ولو كانا في منتهى المحبة والوفاء.

ومثل ذلك ما كان بين الأسد ملك السباع، والثور الطيب «شتربة»، حين جمعتهما الألفة الصادقة، حتى دخل بينهما دمنة الثعلب بغيرته ومكايده."`,
      },
    ],
  },
  {
    id: 'book-ring-of-dove',
    workId: 'work-ring-of-dove',
    slug: 'the-ring-of-the-dove',
    title: 'The Ring of the Dove: A Treatise on Love',
    titleAr: 'طوق الحمامة في الألفة والأُلاّف',
    originalTitle: 'طوق الحمامة في الألفة والأُلاّف',
    authorId: 'author-ibn-hazm',
    authorName: 'Ibn Hazm al-Andalusi',
    authorNameAr: 'ابن حزم الأندلسي',
    coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80',
    description: 'An immortal Andalusian masterpiece analyzing the psychological, spiritual, and philosophical nature of human love, intimacy, signs, jealousy, and fidelity.',
    descriptionAr: 'ديوان الأندلس الأدبي الخالد وأدق دراسة نفسية وتشريح وجداني للحب ومقاماته وأسراره، وعلاماته، ومسالك الوفاء والعفة بين المحبين.',
    genres: ['Psychology', 'Literature', 'Philosophy', 'Poetry', 'Classics'],
    genresAr: ['أدب أندلسي', 'فلسفة الحب', 'دراسات نفسية', 'شعر كلاسيكي'],
    categories: ['Literature', 'Philosophy', 'Psychology'],
    categoriesAr: ['الأدب الأندلسي', 'الفلسفة والوجدان', 'كلاسيكيات'],
    themes: ['Soul Affinity', 'Signs of Love', 'Fidelity and Honor', 'The Anatomy of Longing'],
    themesAr: ['تلاقي الأرواح', 'علامات المحبة الصادقة', 'الوفاء والعفة', 'تشريح الشوق'],
    moods: ['Romantic', 'Reflective', 'Poetic', 'Intimate'],
    rating: 4.97,
    ratingsCount: 4250,
    reviewsCount: 390,
    downloadsCount: 18200,
    readsCount: 31000,
    featured: true,
    hiddenGem: false,
    editorialPick: true,
    forestRegion: 'poetry',
    forestCoords: { x: 78, y: 40 },
    readingDifficulty: 'Accessible',
    primaryLanguage: 'ar',
    publicationYear: 1022,
    contentAvailability: 'PREVIEW',
    workflowStatus: 'PUBLISHED',
    createdAt: '2026-01-02T12:00:00Z',
    updatedAt: '2026-08-11T10:00:00Z',
    editions: [
      {
        id: 'ed-rh-ar-1',
        isbn: '978-9770281988',
        language: 'ar',
        languageName: 'Andalusian Heritage Edition',
        languageNameAr: 'طبعة المحقق د. الطاهر أحمد مكي',
        publisher: 'دار الهلال للطباعة والنشر',
        publicationYear: 2008,
        pageCount: 310,
        estimatedMinutes: 340,
        rightsStatus: 'PUBLIC_DOMAIN',
        licenseType: 'Public Domain Classical Text',
        source: 'مخطوطات قرطبة وشاطبة المحققة',
        attribution: 'تحقيق د. الطاهر أحمد مكي بديباجة نقدية شاملة.',
        files: [
          { id: 'f-rh-ar-pdf', format: 'PDF', sizeBytes: 2500000, sizeFormatted: '2.5 MB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
          { id: 'f-rh-ar-html', format: 'HTML', sizeBytes: 850000, sizeFormatted: '850 KB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
          { id: 'f-rh-ar-txt', format: 'TXT', sizeBytes: 380000, sizeFormatted: '380 KB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
        ],
      },
    ],
    chapters: [
      {
        id: 'ch-rh-1',
        title: 'Chapter I: The Nature of Love and the Affinity of Souls',
        titleAr: 'الباب الأول: في ماهية الحب وتلاقي الأرواح في عالم الملكوت',
        pageNumber: 1,
        content: `Ibn Hazm said: Love—may God exalt you—is neither denied by religion nor forbidden by the sacred law, for hearts are in the hand of the Almighty.

Love begins in jest, but its outcome is grave and earnest. It is an affinity of souls divided in the higher realm, seeking reunion in this earthly dwelling.

When two souls of identical noble temperaments encounter each other, recognition is instantaneous, and affection takes root without need of artifice.`,
        contentAr: `قال أبو محمد علي بن أحمد بن حزم الأندلسي: الحب - أعزك الله بطاعته - أوله هزل وآخره جد، دقت معانيه لجلالتها عن أن توصف، فلا تدرك حقيقتها إلا بالمعاناة.

وليس بمنكر في الديانة ولا بمحظور في الشريعة، إذ القلوب بيد الله عز وجل.

وإني لأعتقد أنه اتصال بين أجزاء النفوس المقسومة في هذه الخليقة في أصل عنصرها الرفيع، فإذا تقابل الشبيهان في هذا العالم الأرضي تمازجا، وانقدحت شرارة الألفة التي لا تخبو، لأن النفس تحن بطبعها إلى ما يشاكلها في عالم النور.`,
      },
      {
        id: 'ch-rh-2',
        title: 'Chapter II: The Signs of Love and the Language of the Eyes',
        titleAr: 'الباب الثاني: في علامات الحب ودلالات اللحظ والنظر',
        pageNumber: 22,
        content: `Among the unmistakable signs of love is the continuous gazing of the lover at the beloved: his eye follows her wherever she turns, moving with her movements.

Another sign is the sudden confusion when the beloved appears unexpectedly, the trembling of the voice, and the silence that falls upon a previously eloquent tongue.`,
        contentAr: `وللحب علامات يقفوها الفطن، ويهتدي إليها الذكي:
فأولها إدمان النظر، فإن العين باب النفس الشارع، وهي المنقبة عن سرائرها؛ فترى الناظر لا يطرف، يتحرك بحركة محبوبه، وينتقل بانتقاله، وينزوي بانزوائه.

ومنها الإقبال بالحديث، فما يكاد يقبل على أحد سواه ولو كثر الجالسون، ومنها اضطراب اللسان وسكون المفاجأة إذا برز المحبوب بغتة، حتى كأن البليغ قد عيي واللسن قد خرس!`,
      },
    ],
  },
  {
    id: 'book-republic',
    workId: 'work-republic',
    slug: 'the-republic',
    title: 'The Republic',
    titleAr: 'جمهورية أفلاطون: محاورات في العدل والمدينة الفاضلة',
    originalTitle: 'Πολιτεία',
    authorId: 'author-plato',
    authorName: 'Plato',
    authorNameAr: 'أفلاطون',
    coverImage: 'https://images.unsplash.com/photo-1532012164546-f432f2e3edd4?w=600&q=80',
    description: 'Plato’s magnum opus on the nature of justice, the harmony of the soul, the ideal state, philosopher-kings, and the immortal Allegory of the Cave.',
    descriptionAr: 'أم أمهات الفلسفة السياسية والأخلاقية، تبحث في ماهية العدالة وتناغم النفس الإنسانية، وحكم الفلاسفة، وتتضمن تمثيل الكهف الشهير لفهم الحقيقة والمعرفة.',
    genres: ['Philosophy', 'Politics', 'Classics', 'Ethics', 'Dialogue'],
    genresAr: ['فلسفة يونانية', 'فكر سياسي', 'محاورات سقراطية', 'كلاسيكيات'],
    categories: ['Philosophy', 'Politics', 'Ethics'],
    categoriesAr: ['الفلسفة', 'السياسة والأخلاق', 'كلاسيكيات'],
    themes: ['The Meaning of Justice', 'The Allegory of the Cave', 'The Tripartite Soul', 'Philosopher Kings'],
    themesAr: ['مفهوم العدالة المطلقة', 'رمزية الكهف والتحرر من الأوهام', 'قوى النفس الثلاث', 'الحاكم الفيلسوف'],
    moods: ['Intellectual', 'Demanding', 'Visionary', 'Epic'],
    rating: 4.94,
    ratingsCount: 5120,
    reviewsCount: 460,
    downloadsCount: 24500,
    readsCount: 49000,
    featured: true,
    hiddenGem: false,
    editorialPick: true,
    forestRegion: 'philosophy',
    forestCoords: { x: 30, y: 35 },
    readingDifficulty: 'Demanding',
    primaryLanguage: 'el',
    publicationYear: -375,
    contentAvailability: 'PREVIEW',
    workflowStatus: 'PUBLISHED',
    createdAt: '2026-01-01T12:00:00Z',
    updatedAt: '2026-08-12T10:00:00Z',
    editions: [
      {
        id: 'ed-rep-en-1',
        isbn: '978-0199535729',
        language: 'en',
        languageName: 'Oxford Classical Texts Edition',
        languageNameAr: 'طبعة بنجامين جويت الكلاسيكية المعتمدة',
        publisher: 'Oxford University Press',
        publicationYear: 1894,
        translator: 'Benjamin Jowett',
        pageCount: 440,
        estimatedMinutes: 520,
        rightsStatus: 'PUBLIC_DOMAIN',
        licenseType: 'Public Domain Mark 1.0',
        source: 'Project Gutenberg Archive / Perseus Digital Library',
        attribution: 'Jowett translation in public domain worldwide.',
        files: [
          { id: 'f-rep-en-pdf', format: 'PDF', sizeBytes: 3100000, sizeFormatted: '3.1 MB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
          { id: 'f-rep-en-html', format: 'HTML', sizeBytes: 1100000, sizeFormatted: '1.1 MB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
          { id: 'f-rep-en-txt', format: 'TXT', sizeBytes: 620000, sizeFormatted: '620 KB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
        ],
      },
      {
        id: 'ed-rep-ar-1',
        isbn: '978-9770281977',
        language: 'ar',
        languageName: 'Arabic Translation by Fouad Zakariya',
        languageNameAr: 'ترجمة د. فؤاد زكريا الفلسفية الموثقة',
        publisher: 'الهيئة المصرية العامة للكتاب',
        publicationYear: 2004,
        translator: 'Dr. Fouad Zakariya',
        translatorAr: 'د. فؤاد زكريا',
        pageCount: 520,
        estimatedMinutes: 600,
        rightsStatus: 'PUBLIC_DOMAIN',
        licenseType: 'Public Domain Heritage',
        source: 'دار الكتاب العربي للدراسات الفلسفية',
        attribution: 'ترجمة رائدة محققة بمقدمة تحليلية ضخمة.',
        files: [
          { id: 'f-rep-ar-pdf', format: 'PDF', sizeBytes: 3800000, sizeFormatted: '3.8 MB', downloadAllowed: true, readingAllowed: true, offlineAllowed: true },
        ],
      },
    ],
    chapters: [
      {
        id: 'ch-rep-1',
        title: 'Book I: The Inquiry into Justice and Thrasymachus’ Challenge',
        titleAr: 'الكتاب الأول: التساؤل عن العدالة وتحدي ثراسيماخوس',
        pageNumber: 1,
        content: `I went down yesterday to the Piraeus with Glaucon the son of Ariston, that I might offer up my prayers to the goddess...

Socrates: "Tell me, Cephalus, what do you consider to be the greatest blessing which you have reaped from your wealth?"

Cephalus spoke of peace of mind, but Thrasymachus burst in with fury: "Listen then! I proclaim that justice is nothing other than the advantage of the stronger!"

Socrates smiled calmly: "Let us examine this statement, for we are inquiring not into an ordinary matter, but into the way a human being ought to live."`,
        contentAr: `نزلت بالأمس إلى بيرايوس بصحبة غلوكون بن أرسطون، لأؤدي صلاتي للإلهة...

سقراط: "قل لي يا كيفالوس، ما هي أعظم بركة جنيتها من ثروتك الطائلة في شيخوختك؟"
أجاب كيفالوس بأنها راحة الضمير وسداد الديون قبل الرحيل.

هنا انفجر ثراسيماخوس في المجلس صائحاً: "اسمعوا إذن! أنا أعلن أن العدالة ليست سوى مصلحة الأقوى!"

فابتسم سقراط بهدوء وقال: "رويدك يا ثراسيماخوس، دعنا نفحص هذا القول فحصاً دقيقاً؛ فنحن لا نبحث في مسألة هينة، بل في الطريقة المثلى التي ينبغي أن يحيا بها الإنسان حياته."`,
      },
      {
        id: 'ch-rep-7',
        title: 'Book VII: The Allegory of the Cave and the Light of the Good',
        titleAr: 'الكتاب السابع: تمثيل الكهف العظيم ونور الحقيقة الساطع',
        pageNumber: 210,
        content: `"And now," I said, "let me show in a figure how far our nature is enlightened or unenlightened: Behold! Human beings living in an underground den, which has a mouth open towards the light...

Here they have been from childhood, chained by their legs and necks, seeing only shadows projected on the wall in front of them by the fire behind them.

To them, the truth would be literally nothing but the shadows of the images.

Now look what will happen if one of them is released and compelled suddenly to stand up, turn his neck, walk, and look up towards the light..."`,
        contentAr: `قال سقراط: "والآن، تأمل معي صورة توضح مقدار ما في طبيعتنا من نور أو جهل:
تخيل بشراً يعيشون في كهف عميق تحت الأرض، له مدخل متسع ينفذ منه النور...

قد قيدت أرجلهم وأعناقهم منذ الطفولة، بحيث لا يستطيعون الالتفات، ولا يرون إلا جدار الكهف المقابل لهم، وخلفهم نار تشتعل على مرتفع، وتمر أمامها أشياء وتماثيل تلقي بظلالها على الجدار.

أفلا يظن هؤلاء المساكين أن تلك الظلال المتراقصة هي الحقيقة الوحيدة في الوجود؟

فتأمل ما سيحدث لو فُك قيد أحدهم، وأُرغم فجأة على النهوض، والالتفات برأسه، والصعود نحو النور الخارجي الباهر... ألن تبهر عيناه في البداية حتى يعتاد رؤية الشمس بذاتها؟"`,
      },
    ],
  },
];

export const INITIAL_READING_PATHS: ReadingPath[] = [
  {
    id: 'path-philosophy-beginners',
    slug: 'beginners-path-into-philosophy',
    title: "Beginner's Path into Philosophy",
    titleAr: 'المدخل إلى الفلسفة والتفكير العميق',
    subtitle: 'From foundational sociology to existential inquiries.',
    subtitleAr: 'من أسس العمران البشري إلى الأسئلة الوجودية الكبرى.',
    description: 'A structured journey through timeless philosophical minds exploring social cohesion, human will, morality, and transcendence.',
    descriptionAr: 'رحلة منهجية عبر كبار مفكري التاريخ، تستكشف نواميس المجتمعات، وإرادة الإنسان، وأسس الأخلاق والتسامي الروحي.',
    coverImage: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=800&q=80',
    curator: 'Nexara Editorial Board',
    estimatedHours: 32,
    bookIds: ['book-muqaddimah', 'book-zarathustra', 'book-crime-punishment'],
    regionId: 'philosophy',
    order: 1,
  },
  {
    id: 'path-arabic-classics',
    slug: 'golden-age-of-arabic-literature',
    title: 'Treasures of Arabic Heritage',
    titleAr: 'كنوز التراث والأدب العربي الخالد',
    subtitle: 'Epic poetry, philosophical sociology, and modern realism.',
    subtitleAr: 'شعر الحكمة، وعلم العمران، والواقعية الروائية في الحارة العربية.',
    description: 'Immerse yourself in over a thousand years of Arabic eloquence, from Al-Mutanabbi’s roaring verse to Naguib Mahfouz’s Nobel masterpieces.',
    descriptionAr: 'انغمس في أكثر من ألف عام من البلاغة العربية، من قصائد المتنبي الصادحة إلى روايات نجيب محفوظ الحائزة على نوبل.',
    coverImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&q=80',
    curator: 'Prof. Tariq Al-Hashimi',
    estimatedHours: 45,
    bookIds: ['book-diwan-mutanabbi', 'book-the-prophet', 'book-palace-walk', 'book-muqaddimah'],
    regionId: 'ancient-grove',
    order: 2,
  },
  {
    id: 'path-existential-solitude',
    slug: 'existentialism-and-solitude',
    title: 'Existentialism & Solitude',
    titleAr: 'العزلة والبحث الوجودي عن المعنى',
    subtitle: 'Exploring the psychological depths and human freedom.',
    subtitleAr: 'استكشاف الأعماق النفسية وحرية الإنسان في مواجهة الاغتراب.',
    description: 'A profound exploration of modern alienation, guilt, transformation, and individual redemption.',
    descriptionAr: 'سياحة في أعماق الغربة الإنسانية الحديثة، والذنب، والتحول، والبحث الدؤوب عن الخلاص الفردي.',
    coverImage: 'https://images.unsplash.com/photo-1507842229451-9f01079ca4b5?w=800&q=80',
    curator: 'Elena Rostova',
    estimatedHours: 28,
    bookIds: ['book-metamorphosis', 'book-crime-punishment', 'book-zarathustra'],
    regionId: 'midnight-library',
    order: 3,
  },
  {
    id: 'path-mystic-verse',
    slug: 'poetry-through-the-ages',
    title: 'Poetry Through the Ages',
    titleAr: 'سياحة في فضاء الشعر الصوفي والإنساني',
    subtitle: 'From Rumi’s divine love to Gibran’s lyrical wisdom.',
    subtitleAr: 'من محبة الرومي الصوفية إلى حكمة جبران الشفافة.',
    description: 'Elevate the spirit with transcendental lyrical verses that celebrate universal compassion and eternal beauty.',
    descriptionAr: 'ارتقِ بروحك مع قصائد عابرة للزمان تحتفي بالمحبة الإلهية، والجمال الخالد، والكرامة الإنسانية.',
    coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80',
    curator: 'Nexara Poetry Collective',
    estimatedHours: 18,
    bookIds: ['book-the-prophet', 'book-masnavi', 'book-diwan-mutanabbi'],
    regionId: 'poetry',
    order: 4,
  },
];

export const INITIAL_REVIEWS: Review[] = [
  {
    id: 'rev-1',
    bookId: 'book-crime-punishment',
    userId: 'user-reader-1',
    userName: 'Kareem Mansour',
    userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&q=80',
    rating: 5,
    title: 'An unrivaled journey into the human soul',
    content: 'Dostoevsky does not merely describe psychological torment; he makes you live every agonizing heartbeat of Raskolnikov. A transformative reading experience that changes how you perceive morality.',
    createdAt: '2026-07-20T14:30:00Z',
    likes: 48,
    isVerifiedReader: true,
  },
  {
    id: 'rev-2',
    bookId: 'book-the-prophet',
    userId: 'user-reader-2',
    userName: 'Sarah Jenkins',
    userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80',
    rating: 5,
    title: 'Poetic nectar for the restless spirit',
    content: 'Gibran’s chapter On Work transformed how I approach my daily craft: "Work is love made visible." Every sentence deserves to be framed.',
    createdAt: '2026-07-28T09:15:00Z',
    likes: 62,
    isVerifiedReader: true,
  },
  {
    id: 'rev-3',
    bookId: 'book-muqaddimah',
    userId: 'user-reader-3',
    userName: 'د. يوسف الراجحي',
    userAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&q=80',
    rating: 5,
    title: 'عبقرية ابن خلدون تسبق عصرها بقرون',
    content: 'قراءة المقدمة باللغة العربية تجعلك تنبهر بدقة التحليل العلمي لنشأة وسقوط الدول. مفهوم العصبية والعمران البشري يفسر الواقع السياسي حتى يومنا هذا.',
    createdAt: '2026-08-02T18:00:00Z',
    likes: 85,
    isVerifiedReader: true,
  },
];

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'ach-first-chapter',
    title: 'First Step in the Grove',
    titleAr: 'الخطوة الأولى في الغابة',
    description: 'Began reading your first literary work on Nexara.',
    descriptionAr: 'بدأت قراءة أول عمل أدبي في مكتبة نكسارا.',
    iconName: 'Compass',
    unlockedAt: '2026-08-10T10:00:00Z',
    progress: 1,
    maxProgress: 1,
  },
  {
    id: 'ach-7-day-streak',
    title: 'Seven Day Reader',
    titleAr: 'قارئ الأيام السبعة',
    description: 'Maintained a calm daily reading ritual for 7 consecutive days.',
    descriptionAr: 'حافظت على طقس قراءة يومي هادئ لمدة ٧ أيام متتالية.',
    iconName: 'Flame',
    unlockedAt: '2026-08-14T20:00:00Z',
    progress: 7,
    maxProgress: 7,
  },
  {
    id: 'ach-night-reader',
    title: 'The Midnight Scholar',
    titleAr: 'ساهر منتصف الليل',
    description: 'Immersed in deep reading during quiet nocturnal hours.',
    descriptionAr: 'انغمست في القراءة الهادئة خلال ساعات الليل المتأخرة.',
    iconName: 'Moon',
    unlockedAt: '2026-08-15T01:30:00Z',
    progress: 1,
    maxProgress: 1,
  },
  {
    id: 'ach-poetry-wanderer',
    title: 'Poetry Wanderer',
    titleAr: 'طائف روضة الشعر',
    description: 'Explored verse across multiple eras and languages.',
    descriptionAr: 'استكشفت قصائد شعرية عبر عصور ولغات متعددة.',
    iconName: 'Feather',
    progress: 2,
    maxProgress: 3,
  },
  {
    id: 'ach-1000-pages',
    title: '1,000 Pages of Wisdom',
    titleAr: 'ألف صفحة من الحكمة',
    description: 'Read over 1,000 pages of classical and modern literature.',
    descriptionAr: 'قرأت أكثر من ١٠٠٠ صفحة من الأدب العالمي والفكر.',
    iconName: 'BookOpen',
    progress: 680,
    maxProgress: 1000,
  },
  {
    id: 'ach-quote-artisan',
    title: 'Quote Artisan',
    titleAr: 'صانع الاقتباسات الأدبية',
    description: 'Created and exported your first literary quote card.',
    descriptionAr: 'صممت وشاركت بطاقتك الأدبية الأولى من استوديو الاقتباسات.',
    iconName: 'Sparkles',
    unlockedAt: '2026-08-12T16:00:00Z',
    progress: 1,
    maxProgress: 1,
  },
];
