import { Book, ReadingProgress } from '../types';
import { BRAND_CONFIG } from '../config/brand';

export interface RecommendationScore {
  book: Book;
  totalScore: number;
  breakdown: {
    genreScore: number;
    authorScore: number;
    historyScore: number;
    themeScore: number;
    coReadScore: number;
    editorialScore: number;
    popularityScore: number;
  };
  reason: string;
  reasonAr: string;
}

/**
 * Deterministic recommendation scoring engine with transparent signal weights.
 */
export function getRecommendationsForBook(
  targetBook: Book,
  allBooks: Book[],
  userHistory: ReadingProgress[] = [],
  limit = 4
): RecommendationScore[] {
  if (!targetBook || !allBooks || allBooks.length === 0) return [];

  const weights = BRAND_CONFIG.recommendationWeights;
  const historyBookIds = new Set((userHistory || []).map((h) => h.bookId));

  const targetGenres = targetBook.genres || [];
  const targetThemes = targetBook.themes || [];
  const targetCategories = targetBook.categories || [];

  const scores: RecommendationScore[] = allBooks
    .filter((b) => b && b.id !== targetBook.id)
    .map((candidate) => {
      const candidateGenres = candidate.genres || [];
      const candidateThemes = candidate.themes || [];
      const candidateCategories = candidate.categories || [];

      // 1. Genre Similarity (25%)
      const sharedGenres = candidateGenres.filter((g) => targetGenres.includes(g));
      const genreScore = targetGenres.length > 0 ? (sharedGenres.length / targetGenres.length) * 100 : 0;

      // 2. Author Similarity (20%)
      const authorScore = candidate.authorId === targetBook.authorId ? 100 : candidate.authorName === targetBook.authorName ? 80 : 0;

      // 3. Reading History alignment (15%)
      // If the user hasn't read this candidate yet, but it connects with books they finished
      const isUnread = !historyBookIds.has(candidate.id);
      const historyScore = isUnread ? 85 : 30;

      // 4. Theme & Forest Region Similarity (15%)
      const sharedThemes = candidateThemes.filter((t) => targetThemes.includes(t));
      const regionMatch = candidate.forestRegion === targetBook.forestRegion ? 30 : 0;
      const themeScore = Math.min(100, (sharedThemes.length * 35) + regionMatch);

      // 5. Co-Read behavior (10%)
      // Deterministic affinity based on rating proximity & category overlap
      const sharedCategories = candidateCategories.filter((c) => targetCategories.includes(c));
      const coReadScore = (sharedCategories.length * 40) + ((candidate.rating || 0) >= 4.5 ? 20 : 0);

      // 6. Editorial Curation (10%)
      const editorialScore = candidate.editorialPick ? 100 : candidate.featured ? 70 : 30;

      // 7. Popularity (5%)
      const maxPopularity = 10000;
      const popularityScore = Math.min(100, (((candidate.readsCount || 0) + (candidate.downloadsCount || 0)) / maxPopularity) * 100);

      const totalScore =
        genreScore * weights.genreSimilarity +
        authorScore * weights.authorSimilarity +
        historyScore * weights.readingHistory +
        themeScore * weights.themeSimilarity +
        coReadScore * weights.coReadBehavior +
        editorialScore * weights.editorialCuration +
        popularityScore * weights.popularity;

      // Deterministic explanation
      let reason = 'Shares deep thematic harmony and category resonance.';
      let reasonAr = 'يشترك في الانسجام الفكري والعمق السردي مع هذا العمل.';

      if (authorScore === 100) {
        reason = `Another seminal masterpiece by ${candidate.authorName}.`;
        reasonAr = `عمل أدبي رفيع آخر لنفس المؤلف ${candidate.authorNameAr || candidate.authorName}.`;
      } else if (sharedGenres.length >= 2) {
        reason = `Explores interconnected literary conventions in ${sharedGenres.join(', ')}.`;
        reasonAr = `يستكشف التقاليد الأدبية المترابطة في ${(candidate.genresAr || candidate.genres || []).slice(0, 2).join(' و ')}.`;
      } else if (candidate.forestRegion === targetBook.forestRegion) {
        reason = `Located in the same forest grove (${candidate.forestRegion}).`;
        reasonAr = `يقع في نفس إقليم الغابة (${candidate.forestRegion}).`;
      }

      return {
        book: candidate,
        totalScore: Math.round(totalScore),
        breakdown: {
          genreScore: Math.round(genreScore),
          authorScore: Math.round(authorScore),
          historyScore: Math.round(historyScore),
          themeScore: Math.round(themeScore),
          coReadScore: Math.round(coReadScore),
          editorialScore: Math.round(editorialScore),
          popularityScore: Math.round(popularityScore),
        },
        reason,
        reasonAr,
      };
    });

  scores.sort((a, b) => b.totalScore - a.totalScore);
  return scores.slice(0, limit);
}

/**
 * Deterministic "Wander" algorithm for unexpected literary serendipity.
 */
export function getWanderBook(
  allBooks: Book[],
  userHistory: ReadingProgress[] = [],
  seed: number = Date.now()
): { book: Book; reason: string; reasonAr: string } {
  if (!allBooks || allBooks.length === 0) {
    return {
      book: {} as Book,
      reason: 'A journey into literary serenity begins here.',
      reasonAr: 'تبدأ رحلة السكينة الأدبية من هنا.',
    };
  }

  const historyIds = new Set((userHistory || []).map((h) => h.bookId));
  // Prioritize unread or hidden gems
  const candidates = allBooks.filter((b) => !historyIds.has(b.id));
  const pool = candidates.length > 0 ? candidates : allBooks;

  // Normalize the timestamp first: multiplying a full epoch timestamp exceeds
  // JavaScript's safe integer range and can make successive wander requests repeat.
  const normalizedSeed = Math.abs(Math.trunc(seed)) % 233280;
  const index = ((normalizedSeed * 9301 + 49297) % 233280) % pool.length;
  const selected = pool[index] || pool[0];

  let reason = 'Selected from an untrodden path in the forest for its unique perspective and rich prose.';
  let reasonAr = 'تم اختياره من مسار غير مطروق في الغابة لفرادته الفكرية وعمقه الأدبي.';

  if (selected?.hiddenGem) {
    reason = 'A hidden gem preserved in the library archives waiting to be rediscovered.';
    reasonAr = 'جوهرة مخفية محفوظة في أرشيف المكتبة تنتظر من يعيد اكتشافها.';
  } else if (selected?.readingDifficulty === 'Scholar') {
    reason = 'A profound philosophical inquiry chosen to expand your literary horizon.';
    reasonAr = 'بحث فلسفي عميق تم اختياره لتوسيع آفاقك الأدبية والتأملية.';
  }

  return { book: selected, reason, reasonAr };
}
