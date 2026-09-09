/**
 * Deterministic offline fixture for the P3 "live" Gutenberg ingestion gate.
 *
 * The production-shaped pipeline (MongoMemoryReplSet + repositories + service
 * wiring + byte-for-byte checksum publish) must run identically on every
 * developer machine and CI runner. The only nondeterministic part of the old
 * test was the third-party HTTP hop (gutendex.com + gutenberg.org), which is
 * frequently rate-limited or refused from datacenter IPs (GitHub Actions),
 * even though the same requests succeed from residential ISPs.
 *
 * This fixture therefore injects a controlled `fetchFn` (the same seam the
 * server already accepts) that serves the canonical Gutendex/Gutenberg
 * payloads for eBook #11 (Alice's Adventures in Wonderland, public domain in
 * the United States). The gateway/downloader code paths — URL construction,
 * rights verification, format handling, size caps, redirect budget, chapter
 * extraction — are exercised exactly as before; only the flaky host is faked.
 *
 * Run the real-network mode explicitly with:
 *   NEXARA_LIVE_INGESTION_NETWORK=1 pnpm run test:p3:live
 */

const GUTENDEX_BOOK_11_URL = "https://gutendex.com/books/11";
const GUTENBERG_FILE_11_URL = "https://www.gutenberg.org/ebooks/11.txt.utf-8";

/** Public-domain text of Project Gutenberg eBook #11 (Alice in Wonderland), two paragraphs. */
export const GUTENBERG_BOOK_11_TEXT = `Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, "and what is the use of a book," thought Alice, "without pictures or conversations?" So she was considering in her own mind whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.

There was nothing so very remarkable in that, nor did Alice think it at all remarkable; but when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then hurried on, Alice started to her feet, for it flashed across her mind that she had seen the Rabbit with a waistcoat-pocket and a watch in it before; and, burning with curiosity, she ran across the field after it, and was just in time to see it pop down a large rabbit-hole under the hedge.

Down, down, down she went, and the hole was just large enough for her; the well was very deep, and the fall seemed to take her a long, long time, but she fell very slowly, for the wind was strong against her, so that she had time to look about her as she fell, and to notice the cupboards and the fireplace and the maps and pictures that hung upon pegs, and the very small rabbit-hole that led straight down into the deep dark earth below.`;

const GUTENDEX_BOOK_11: Record<string, unknown> = {
  id: 11,
  title: "Alice's Adventures in Wonderland",
  authors: [{ name: "Carroll, Lewis" }],
  subjects: ["Children's literature", "Fantasy"],
  languages: ["en"],
  copyright: false,
  formats: {
    "text/plain; charset=utf-8": GUTENBERG_FILE_11_URL,
    "image/jpeg": "https://www.gutenberg.org/cache/epub/11/pg11.cover.medium.jpg",
  },
};

function fixtureResponse(body: string, contentType: string, status = 200): Response {
  const bytes = Buffer.from(body, "utf8");
  return new Response(bytes, {
    status,
    headers: {
      "content-type": contentType,
      "content-length": String(bytes.byteLength),
    },
  });
}

/**
 * Returns a fetch-compatible function that serves the canonical Gutendex and
 * Gutenberg payloads for eBook #11 and nothing else (404 otherwise, so an
 * unexpected request fails loudly instead of passing silently).
 */
export function createGutenbergFixtureFetch(): typeof fetch {
  return (async (input: string | URL | Request): Promise<Response> => {
    const url = input instanceof URL ? input.toString() : typeof input === "string" ? input : input.url;
    if (url === GUTENDEX_BOOK_11_URL) return fixtureResponse(JSON.stringify(GUTENDEX_BOOK_11), "application/json");
    if (url === GUTENBERG_FILE_11_URL) return fixtureResponse(GUTENBERG_BOOK_11_TEXT, "text/plain; charset=utf-8");
    return fixtureResponse(JSON.stringify({ detail: `unexpected fixture URL: ${url}` }), "application/json", 404);
  }) as typeof fetch;
}