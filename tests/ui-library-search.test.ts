import assert from 'node:assert/strict';
import { matchesQuery, searchBooks } from '../src/lib/searchEngine';
import { getWanderBook } from '../src/lib/recommendations';
import { p14Book } from './p14.shared';

const frankenstein = p14Book({
  id: 'ui-frankenstein',
  title: 'Frankenstein',
  titleAr: 'فرانكنشتاين',
  authorName: 'Mary Shelley',
  authorNameAr: 'ماري شيلي',
  description: 'A scientist creates life.',
  descriptionAr: 'عالم يخلق حياة.',
});
const dorian = p14Book({
  id: 'ui-dorian',
  title: 'The Picture of Dorian Gray',
  titleAr: 'صورة دوريان غراي',
  authorName: 'Oscar Wilde',
  authorNameAr: 'أوسكار وايلد',
  description: 'A portrait absorbs corruption.',
  descriptionAr: 'لوحة تمتص الفساد.',
});

assert.equal(matchesQuery('Frankenstein', dorian.title, dorian.titleAr), false, 'English text must not match an unrelated Arabic-only normalization.');
assert.equal(matchesQuery('فرانكنشتاين', dorian.title, dorian.titleAr), false, 'Arabic text must not match an unrelated English-only normalization.');
assert.deepEqual(searchBooks([dorian, frankenstein], { query: 'Frankenstein', sortBy: 'title' }).map((book) => book.id), ['ui-frankenstein']);
assert.deepEqual(searchBooks([dorian, frankenstein], { query: 'فرانكنشتاين', sortBy: 'title' }).map((book) => book.id), ['ui-frankenstein']);

const pride = p14Book({
  id: 'ui-pride',
  title: 'Pride and Prejudice',
  titleAr: 'كبرياء وتحامل',
  authorName: 'Jane Austen',
  authorNameAr: 'جين أوستن',
});
const firstWander = getWanderBook([dorian, frankenstein, pride], [], 100);
const secondWander = getWanderBook([dorian, frankenstein, pride], [], 101);
assert.notEqual(firstWander.book.id, secondWander.book.id, 'Sequential wander seeds must rotate to a different book when multiple books are available.');

console.log('UI library search and wander regression checks passed.');
