import { Book } from '../types';

/**
 * Normalizes Arabic text by stripping diacritics, unifying Alef variations,
 * and normalizing Taa Marbuta / Alif Maqsura.
 */
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    // Remove diacritics (tashkeel, harakat, tanween)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Normalize Alef variations (أ, إ, آ -> ا)
    .replace(/[أإآ]/g, 'ا')
    // Normalize Taa Marbuta (ة -> ه)
    .replace(/ة/g, 'ه')
    // Normalize Alif Maqsura (ى -> ي)
    .replace(/ى/g, 'ي')
    // Normalize Persian/Urdu Kaf and Yeh if present
    .replace(/ک/g, 'ك')
    .replace(/ی/g, 'ي')
    .trim()
    .toLowerCase();
}

/**
 * Normalizes English text for token matching.
 */
export function normalizeEnglishText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** `String.prototype.includes('')` is always true, so cross-script search must guard empty normalizations. */
function includesNonEmpty(haystack: string, needle: string): boolean {
  return needle.length > 0 && haystack.includes(needle);
}

/**
 * Transliteration dictionary linking Arabic & Latin forms of authors/literary terms.
 */
const TRANSLITERATION_MAP: Record<string, string[]> = {
  dostoevsky: ['دوستويفسكي', 'دستويفسكي', 'فيودور', 'dostoyevsky', 'fyodor dostoevsky'],
  mahfouz: ['محفوظ', 'نجيب محفوظ', 'naguib mahfouz', 'naguib'],
  ibnkhaldun: ['ابن خلدون', 'عبدالرحمن بن خلدون', 'ibn khaldun', 'ibn khaldoun'],
  mutanabbi: ['المتنبي', 'ابو الطيب المتنبي', 'al-mutanabbi', 'al mutanabbi'],
  kafka: ['كافكا', 'فرانتس كافكا', 'franz kafka'],
  woolf: ['وولف', 'فرجينيا وولف', 'virginia woolf'],
  gibran: ['جبران', 'جبران خليل جبران', 'khalil gibran', 'kahlil gibran'],
  tolstoy: ['تولستوي', 'ليو تولستوي', 'leo tolstoy', 'lev tolstoy'],
  nietzsche: ['نيتشه', 'فريدريك نيتشه', 'friedrich nietzsche'],
  rumi: ['رومي', 'جلال الدين الرومي', 'jalal al-din rumi', 'mevlana'],
  jahiz: ['الجاحظ', 'ابو عثمان الجاحظ', 'al-jahiz'],
  austen: ['اوستن', 'جين اوستن', 'jane austen'],
  darwish: ['درويش', 'محمود درويش', 'mahmoud darwish'],
  averroes: ['ابن رشد', 'ابوالوليد بن رشد', 'averroes', 'ibn rushd'],
  spinoza: ['سبينوزا', 'باروخ سبينوزا', 'baruch spinoza'],
};

/**
 * Checks if query matches target with transliteration and bilingual awareness.
 */
export function matchesQuery(query: string, ...targets: (string | undefined)[]): boolean {
  if (!query || !query.trim()) return true;

  const rawQuery = query.trim().toLowerCase();
  const normArQuery = normalizeArabicText(rawQuery);
  const normEnQuery = normalizeEnglishText(rawQuery);

  for (const target of targets) {
    if (!target) continue;
    const targetNormAr = normalizeArabicText(target);
    const targetNormEn = normalizeEnglishText(target);

    if (
      target.toLowerCase().includes(rawQuery) ||
      includesNonEmpty(targetNormAr, normArQuery) ||
      includesNonEmpty(targetNormEn, normEnQuery)
    ) {
      return true;
    }
  }

  for (const key of Object.keys(TRANSLITERATION_MAP)) {
    const cluster = [key, ...TRANSLITERATION_MAP[key]];
    const queryMatchesCluster = cluster.some((term) => {
      const termNormAr = normalizeArabicText(term);
      const termNormEn = normalizeEnglishText(term);
      return (
        includesNonEmpty(termNormAr, normArQuery) ||
        includesNonEmpty(termNormEn, normEnQuery) ||
        includesNonEmpty(normArQuery, termNormAr) ||
        includesNonEmpty(normEnQuery, termNormEn)
      );
    });

    if (queryMatchesCluster) {
      for (const target of targets) {
        if (!target) continue;
        const targetNormAr = normalizeArabicText(target);
        const targetNormEn = normalizeEnglishText(target);
        const targetMatchesCluster = cluster.some((term) => {
          const termNormAr = normalizeArabicText(term);
          const termNormEn = normalizeEnglishText(term);
          return includesNonEmpty(targetNormAr, termNormAr) || includesNonEmpty(targetNormEn, termNormEn);
        });
        if (targetMatchesCluster) return true;
      }
    }
  }

  return false;
}

/**
 * Filters a list of books based on multi-faceted parameters.
 */
export function searchBooks(
  books: Book[],
  params: {
    query?: string;
    genre?: string;
    category?: string;
    language?: string;
    authorId?: string;
    yearMin?: number;
    yearMax?: number;
    rightsStatus?: string;
    difficulty?: string;
    regionId?: string;
    sortBy?: 'popular' | 'newest' | 'rating' | 'downloads' | 'title' | 'recent';
  }
): Book[] {
  let filtered = books.filter((book) => {
    // Text search query matching title, author, description, genres, themes, ISBN
    if (params.query && params.query.trim()) {
      const editionsIsbns = book.editions.map((e) => e.isbn).filter(Boolean);
      const isMatch = matchesQuery(
        params.query,
        book.title,
        book.titleAr,
        book.authorName,
        book.authorNameAr,
        book.description,
        book.descriptionAr,
        ...book.genres,
        ...book.genresAr,
        ...book.categories,
        ...book.categoriesAr,
        ...book.themes,
        ...book.themesAr,
        ...editionsIsbns
      );
      if (!isMatch) return false;
    }

    if (params.genre && params.genre !== 'All' && !book.genres.includes(params.genre) && !book.genresAr.includes(params.genre)) {
      return false;
    }

    if (params.category && params.category !== 'All' && !book.categories.includes(params.category) && !book.categoriesAr.includes(params.category)) {
      return false;
    }

    if (params.language && params.language !== 'All' && book.primaryLanguage !== params.language && !book.editions.some(e => e.language === params.language)) {
      return false;
    }

    if (params.authorId && params.authorId !== 'All' && book.authorId !== params.authorId) {
      return false;
    }

    if (params.rightsStatus && params.rightsStatus !== 'All' && !book.editions.some(e => e.rightsStatus === params.rightsStatus)) {
      return false;
    }

    if (params.difficulty && params.difficulty !== 'All' && book.readingDifficulty !== params.difficulty) {
      return false;
    }

    if (params.regionId && params.regionId !== 'all' && book.forestRegion !== params.regionId) {
      return false;
    }

    if (params.yearMin && book.publicationYear < params.yearMin) return false;
    if (params.yearMax && book.publicationYear > params.yearMax) return false;

    return true;
  });

  switch (params.sortBy) {
    case 'popular':
      filtered.sort((a, b) => b.readsCount + b.downloadsCount - (a.readsCount + a.downloadsCount));
      break;
    case 'newest':
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case 'rating':
      filtered.sort((a, b) => b.rating - a.rating);
      break;
    case 'downloads':
      filtered.sort((a, b) => b.downloadsCount - a.downloadsCount);
      break;
    case 'title':
      filtered.sort((a, b) => a.title.localeCompare(b.title));
      break;
    default:
      filtered.sort((a, b) => b.rating - a.rating);
  }

  return filtered;
}
