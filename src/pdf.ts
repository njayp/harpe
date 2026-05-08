import { readFile } from 'node:fs/promises';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — pdfjs-dist legacy build ships its own .mjs without published types.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — same untyped .mjs.
import { WorkerMessageHandler } from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import { squish } from './sections.js';
import type { Line, OutlineEntry } from './types.js';

// pdfjs-dist's main thread tries to spin up a fake worker by dynamically
// importing pdf.worker.mjs at runtime, which fails the moment harpe is
// bundled into a single file (esbuild for Cloud Functions, etc.) — the
// worker file isn't on disk at the path pdfjs resolves. Pre-registering
// `globalThis.pdfjsWorker.WorkerMessageHandler` makes pdfjs use this
// statically-imported copy instead of dynamic-importing one. See
// pdfjs-dist/legacy/build/pdf.mjs `_setupFakeWorkerGlobal` /
// `mainThreadWorkerMessageHandler` for the lookup.
(globalThis as { pdfjsWorker?: { WorkerMessageHandler: unknown } }).pdfjsWorker ??= {
  WorkerMessageHandler,
};

type PdfDoc = {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
  getOutline(): Promise<RawOutlineNode[] | null>;
  getDestination(name: string): Promise<unknown[] | null>;
  getPageIndex(ref: unknown): Promise<number>;
  getMetadata(): Promise<{ info?: { Title?: string } }>;
  destroy(): Promise<void>;
};

type PdfPage = {
  getTextContent(): Promise<{ items: TextItem[] }>;
};

type TextItem = {
  str: string;
  transform: number[];
  height?: number;
};

type RawOutlineNode = {
  title: string;
  dest: unknown;
  items?: RawOutlineNode[];
};

async function openDocument(data: Uint8Array): Promise<PdfDoc> {
  // pdfjs-dist's loader accepts useWorkerFetch:false but the legacy build's typings
  // are loose — cast to any rather than re-declare every accepted flag.
  const loadingTask = pdfjs.getDocument({
    data,
    isEvalSupported: false,
    useWorkerFetch: false,
  } as any);
  return loadingTask.promise as Promise<PdfDoc>;
}

export async function loadPdf(pdfPath: string): Promise<Uint8Array> {
  const buf = await readFile(pdfPath);
  return new Uint8Array(buf);
}

export async function extractLines(data: Uint8Array): Promise<{
  lines: Line[];
  pageCount: number;
  title?: string;
  outline: OutlineEntry[];
}> {
  const doc = await openDocument(data);
  try {
    const [pageLines, outline, title] = await Promise.all([
      extractAllPages(doc),
      readOutline(doc),
      readTitle(doc),
    ]);
    return { lines: pageLines.flat(), pageCount: doc.numPages, title, outline };
  } finally {
    await doc.destroy();
  }
}

async function extractAllPages(doc: PdfDoc): Promise<Line[][]> {
  const pageNums = Array.from({ length: doc.numPages }, (_, i) => i + 1);
  return Promise.all(
    pageNums.map(async (p) => {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      return itemsToLines(content.items, p);
    }),
  );
}

function itemsToLines(items: TextItem[], page: number): Line[] {
  const grouped = new Map<string, { y: number; fontSize: number; parts: string[] }>();
  for (const it of items) {
    const text = it.str;
    if (!text) continue;
    const t = it.transform;
    const fontSize = Math.hypot(t[2] ?? 0, t[3] ?? 0);
    const y = t[5] ?? 0;
    const key = `${Math.round(y)}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.parts.push(text);
      if (fontSize > existing.fontSize) existing.fontSize = fontSize;
    } else {
      grouped.set(key, { y, fontSize, parts: [text] });
    }
  }
  const out: Line[] = [];
  for (const { y, fontSize, parts } of grouped.values()) {
    const text = squish(parts.join(''));
    if (!text) continue;
    out.push({ page, y, fontSize, text });
  }
  out.sort((a, b) => b.y - a.y);
  return out;
}

async function readOutline(doc: PdfDoc): Promise<OutlineEntry[]> {
  const raw = await doc.getOutline();
  if (!raw || raw.length === 0) return [];
  const out: OutlineEntry[] = [];
  await flatten(doc, raw, 0, out);
  return out;
}

async function flatten(
  doc: PdfDoc,
  nodes: RawOutlineNode[],
  level: number,
  out: OutlineEntry[],
): Promise<void> {
  for (const node of nodes) {
    const pageNumber = await resolveDest(doc, node.dest);
    if (pageNumber !== null) {
      out.push({ title: squish(node.title), pageNumber, level });
    }
    if (node.items && node.items.length) {
      await flatten(doc, node.items, level + 1, out);
    }
  }
}

async function resolveDest(doc: PdfDoc, dest: unknown): Promise<number | null> {
  let resolved = dest;
  if (typeof resolved === 'string') {
    resolved = await doc.getDestination(resolved);
  }
  if (!Array.isArray(resolved) || resolved.length === 0) return null;
  const ref = resolved[0];
  try {
    const idx = await doc.getPageIndex(ref);
    return idx + 1;
  } catch {
    return null;
  }
}

async function readTitle(doc: PdfDoc): Promise<string | undefined> {
  try {
    const meta = await doc.getMetadata();
    const t = meta.info?.Title;
    return t && t.trim() ? t.trim() : undefined;
  } catch {
    return undefined;
  }
}
