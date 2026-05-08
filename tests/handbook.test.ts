import { beforeAll, describe, expect, it } from 'vitest';
import { extract } from '../src/index.js';
import type { Document } from '../src/types.js';

const HANDBOOK = 'docs/Hearst_Ranch_Winery_Employee_Handbook_529776_en.1.pdf';
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
