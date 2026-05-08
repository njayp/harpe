// Usage:
//   npm --workspace functions run extract-tasting-room-guide -- --dry-run   # inspect chunks
//   npm --workspace functions run extract-tasting-room-guide                 # write to Firestore
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import {
  chunkByHeading,
  extractLines,
  findPdf,
  MIN_TEXT_CHARS,
  writeChunks,
} from './lib/pdf-chunks.js';

const databaseId = process.env.FIRESTORE_DATABASE_ID ?? 'vino';

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const pdfPath = findPdf('hearst.ranch.winery.tasting.room');
  console.log(`extracting ${pdfPath}`);
  const lines = await extractLines(pdfPath);
  console.log(`extracted ${lines.length} non-empty lines`);

  const chunks = chunkByHeading(lines, { ratio: 1.25 });
  console.log(`\nchunks (${chunks.length}):`);
  for (const c of chunks) {
    console.log(`  ${c.slug.padEnd(40)} ${c.text.length.toString().padStart(5)} chars  ${c.title}`);
    if (dryRun) {
      console.log(
        `    ${c.text.slice(0, 200).replace(/\n/g, ' ')}${c.text.length > 200 ? '…' : ''}`,
      );
    }
  }

  if (chunks.length === 0) {
    throw new Error('chunkByHeading produced 0 chunks — heading detection likely miscalibrated');
  }
  const tooShort = chunks.filter((c) => c.text.length < MIN_TEXT_CHARS / 2);
  if (tooShort.length > 0) {
    throw new Error(
      `${tooShort.length} chunks fell below ${MIN_TEXT_CHARS / 2} chars — heuristic likely fragmenting sections`,
    );
  }

  if (dryRun) {
    console.log('\n--dry-run: skipping Firestore write');
    return;
  }

  admin.initializeApp();
  const db = getFirestore(databaseId);
  await writeChunks(db, 'tasting-room-guide', 'Tasting Room Guide', chunks);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
