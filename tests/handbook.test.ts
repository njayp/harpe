import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { extract, extractFromBuffer } from '../src/index.js';
import type { Document } from '../src/types.js';

const HANDBOOK = 'docs/Hearst_Ranch_Winery_Employee_Handbook_529776_en.1.pdf';
const HANDBOOK_BOOKMARKED = 'docs/Hearst_Ranch_Winery_Employee_Handbook_bookmarked.pdf';
const numericCompare = new Intl.Collator(undefined, { numeric: true }).compare;

describe('handbook fixture (font path)', () => {
  let doc: Document;
  beforeAll(async () => {
    doc = await extract(HANDBOOK);
  });

  it('returns sections under default options', () => {
    expect(doc.strategy).toBe('font');
    expect(doc.sections.length).toBeGreaterThanOrEqual(50);
    expect(doc.sections.length).toBeLessThanOrEqual(200);
  });

  it('does not produce stray fragmented headings', () => {
    for (const s of doc.sections) {
      expect(s.title).not.toBe('and Related');
    }
    const numbered = doc.sections.filter((s) => /^\d+(\.\d+)+/.test(s.title));
    expect(numbered.length).toBeGreaterThan(20);
  });

  it('keeps the majority of sections above the fragmentation floor', () => {
    const short = doc.sections.filter((s) => s.text.length < 100).length;
    expect(short / doc.sections.length).toBeLessThan(0.25);
  });

  it('emits monotonic page ranges', () => {
    for (let i = 1; i < doc.sections.length; i++) {
      const prev = doc.sections[i - 1]!;
      const cur = doc.sections[i]!;
      expect(cur.pageStart).toBeGreaterThanOrEqual(prev.pageStart);
    }
  });

  it('orders numbered slugs numerically', () => {
    const numbered = doc.sections
      .map((s) => s.slug)
      .filter((slug) => /^\d+(-\d+)+/.test(slug));
    for (let i = 1; i < numbered.length; i++) {
      expect(numericCompare(numbered[i - 1]!, numbered[i]!)).toBeLessThanOrEqual(0);
    }
  });

  it('snapshots section titles', () => {
    expect(doc.sections.map((s) => s.title)).toMatchSnapshot();
  });

  it('honors caller-provided ratio + isContinuation overrides', async () => {
    const overridden = await extract(HANDBOOK, {
      ratio: 1.3,
      isContinuation: (text) => !/^\d+(\.\d+)+/.test(text),
    });
    expect(overridden.strategy).toBe('font');
    expect(overridden.sections.length).toBeGreaterThanOrEqual(50);
    const numbered = overridden.sections.filter((s) => /^\d+(\.\d+)+/.test(s.title));
    expect(numbered.length).toBeGreaterThan(20);
  });
});

describe('handbook fixture (outline path, bookmarked copy)', () => {
  let doc: Document;
  beforeAll(async () => {
    doc = await extract(HANDBOOK_BOOKMARKED);
  });

  it('auto-selects outline when bookmarks are present', () => {
    expect(doc.strategy).toBe('outline');
  });

  it('keeps consecutive same-page bookmarks with distinct titles', () => {
    expect(doc.sections.length).toBeGreaterThanOrEqual(80);
    const titles = doc.sections.map((s) => s.title);
    for (const re of [
      /^2\.1\b.*About the Company/,
      /^2\.2\b.*Ethics Code/,
      /^2\.3\b.*Mission Statement/,
      /^3\.1\b.*Accommodations for Pregnancy/,
      /^3\.3\b.*Disability Accommodation/,
      /^3\.8\b.*Religious Accommodation/,
    ]) {
      expect(titles.some((t) => re.test(t))).toBe(true);
    }
  });

  it('emits monotonic page ranges (same-page entries allowed)', () => {
    for (let i = 1; i < doc.sections.length; i++) {
      const prev = doc.sections[i - 1]!;
      const cur = doc.sections[i]!;
      expect(cur.pageStart).toBeGreaterThanOrEqual(prev.pageStart);
    }
  });

  it('snapshots bookmarked outline titles', () => {
    expect(doc.sections.map((s) => s.title)).toMatchSnapshot();
  });
});

describe('pdfjs worker registration', () => {
  it('registers WorkerMessageHandler on globalThis so bundled consumers skip the dynamic-import path', async () => {
    // The static import in src/pdf.ts assigns globalThis.pdfjsWorker. This is
    // the pin that prevents pdfjs-dist from falling through to its
    // `await import(workerSrc)` branch in a bundled (esbuild / webpack) build.
    await import('../src/index.js');
    const reg = (globalThis as { pdfjsWorker?: { WorkerMessageHandler?: unknown } }).pdfjsWorker;
    expect(reg).toBeDefined();
    expect(typeof reg?.WorkerMessageHandler).toBe('function');
  });
});

describe('extractFromBuffer input shapes', () => {
  it('accepts a Node Buffer (pdfjs-dist would otherwise reject it)', async () => {
    const buf = await readFile(HANDBOOK);
    const doc = await extractFromBuffer(buf, HANDBOOK);
    expect(doc.sections.length).toBeGreaterThan(0);
  });

  it('accepts a Uint8Array view over a pooled ArrayBuffer (e.g. Buffer.subarray)', async () => {
    const buf = await readFile(HANDBOOK);
    // Force a partial-buffer view by allocating extra and slicing back.
    const padded = Buffer.allocUnsafe(buf.byteLength + 32);
    buf.copy(padded, 16);
    const view = new Uint8Array(padded.buffer, padded.byteOffset + 16, buf.byteLength);
    expect(view.byteLength).not.toBe(view.buffer.byteLength);
    const doc = await extractFromBuffer(view, HANDBOOK);
    expect(doc.sections.length).toBeGreaterThan(0);
  });
});
