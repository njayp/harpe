import { extractLines, loadPdf } from './pdf.js';
import {
  DEFAULT_MIN_SECTION_CHARS,
  byFont,
  byOutline,
  sanityCheck,
  shouldUseOutline,
} from './sections.js';
import type { Document, ExtractOptions } from './types.js';

export type { Document, ExtractOptions, Section } from './types.js';

export async function extract(pdfPath: string, opts: ExtractOptions = {}): Promise<Document> {
  const data = await loadPdf(pdfPath);
  return extractFromBuffer(data, pdfPath, opts);
}

export async function extractFromBuffer(
  data: Uint8Array,
  source: string,
  opts: ExtractOptions = {},
): Promise<Document> {
  const { lines, pageCount, title, outline } = await extractLines(toCleanUint8Array(data));
  const strategy = opts.strategy ?? 'auto';
  const useOutline =
    strategy === 'outline' || (strategy === 'auto' && shouldUseOutline(outline));

  const sections = useOutline
    ? byOutline(lines, outline, pageCount)
    : byFont(lines, pageCount, opts);

  sanityCheck(sections, opts.minSectionChars ?? DEFAULT_MIN_SECTION_CHARS);

  return {
    source,
    title,
    sections,
    strategy: useOutline ? 'outline' : 'font',
  };
}

// pdfjs-dist (the underlying parser) rejects Node `Buffer` outright with
// `Please provide binary data as Uint8Array, rather than Buffer.`, and rejects
// Uint8Array views over a pooled ArrayBuffer (e.g. `Buffer.subarray(...)`) by
// silently re-copying them. Both are practical inputs for any Node consumer
// (busboy, fs.readFile). Normalize once, here, so callers can pass whatever
// they have and not eat the leaky abstraction.
function toCleanUint8Array(data: Uint8Array): Uint8Array {
  const isPlainFullView =
    data.constructor === Uint8Array && data.byteLength === data.buffer.byteLength;
  return isPlainFullView ? data : new Uint8Array(data);
}
