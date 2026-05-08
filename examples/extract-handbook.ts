// Usage: npm --workspace functions run extract-handbook
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { chunkByHeading, extractLines, findPdf, writeChunks } from './lib/pdf-chunks.js';

const databaseId = process.env.FIRESTORE_DATABASE_ID ?? 'vino';

async function main(): Promise<void> {
  const pdfPath = findPdf('Hearst_Ranch_Winery_Employee_Handbook_');
  console.log(`extracting ${pdfPath}`);
  const lines = await extractLines(pdfPath);
  console.log(`extracted ${lines.length} non-empty lines`);

  // Continuation lines from the handbook always lack a "1.2.3" section number;
  // section starts always have one. Use that to disambiguate wrap-continuation
  // from a real new section (e.g. heading "...and Related" wrapping to
  // "Medical Conditions").
  const chunks = chunkByHeading(lines, {
    ratio: 1.3,
    isContinuation: (text) => !/^\d+(\.\d+)+/.test(text),
  });
  console.log(`\nchunks (${chunks.length}):`);
  for (const c of chunks) {
    console.log(`  ${c.slug.padEnd(40)} ${c.text.length.toString().padStart(5)} chars  ${c.title}`);
  }

  admin.initializeApp();
  const db = getFirestore(databaseId);
  await writeChunks(db, 'handbook', 'Employee Handbook', chunks);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
