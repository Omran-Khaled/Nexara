import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const assetsDirectory = join(process.cwd(), 'dist', 'assets');
const assets = await readdir(assetsDirectory);
const entryName = assets.find((asset) => /^index-.*\.js$/.test(asset));
assert.ok(entryName, 'Production build must expose a single initial index JavaScript entry.');
const entry = await readFile(join(assetsDirectory, entryName));
const rawBytes = entry.length;
const gzipBytes = gzipSync(entry).length;

// Derived from the P13 before/after measurements: 898,348 -> 662,503 raw and 251,164 -> 193,682 gzip bytes.
assert.ok(rawBytes <= 700_000, `Initial entry regressed above the measured P13 raw-byte guardrail: ${rawBytes}.`);
assert.ok(gzipBytes <= 210_000, `Initial entry regressed above the measured P13 gzip-byte guardrail: ${gzipBytes}.`);
const lazyChunks = ['ReadingEngine', 'AdminDashboard', 'CommunityView', 'MyLibraryView', 'BookDetailModal'];
for (const name of lazyChunks) assert.ok(assets.some((asset) => asset.startsWith(`${name}-`) && asset.endsWith('.js')), `${name} must remain a separately emitted lazy chunk.`);
console.log(JSON.stringify({ p13: 'performance bundle gate passed', entry: entryName, rawBytes, gzipBytes, lazyChunks }));
