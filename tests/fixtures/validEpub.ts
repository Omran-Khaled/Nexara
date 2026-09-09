export interface EpubFixtureEntry {
  name: string;
  body: Buffer;
}

function localHeader(name: Buffer, body: Buffer): Buffer {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt32LE(0, 10);
  header.writeUInt32LE(0, 14);
  header.writeUInt32LE(body.length, 18);
  header.writeUInt32LE(body.length, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  return header;
}

function centralHeader(name: Buffer, body: Buffer, offset: number): Buffer {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt32LE(0, 12);
  header.writeUInt32LE(0, 16);
  header.writeUInt32LE(body.length, 20);
  header.writeUInt32LE(body.length, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(offset, 42);
  return header;
}

/** Builds a minimal stored (uncompressed) EPUB ZIP that satisfies the EPUB mimetype ordering rule. */
export function validEpub(entries: EpubFixtureEntry[] = [{ name: 'OEBPS/content.xhtml', body: Buffer.from('<html><body>Test EPUB</body></html>') }]): Buffer {
  const all = [{ name: 'mimetype', body: Buffer.from('application/epub+zip', 'ascii') }, ...entries];
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const entry of all) {
    const name = Buffer.from(entry.name, 'utf8');
    const local = Buffer.concat([localHeader(name, entry.body), name, entry.body]);
    localParts.push(local);
    centralParts.push(Buffer.concat([centralHeader(name, entry.body, offset), name]));
    offset += local.length;
  }
  const central = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(all.length, 8);
  eocd.writeUInt16LE(all.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, central, eocd]);
}
