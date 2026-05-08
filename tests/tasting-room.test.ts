import { beforeAll, describe, expect, it } from 'vitest';
import { extract } from '../src/index.js';
import type { Document } from '../src/types.js';

const TASTING = 'docs/hearst.ranch.winery.tasting.room.guide.1.pdf';

describe('tasting-room fixture (outline path)', () => {
  let doc: Document;
  beforeAll(async () => {
    doc = await extract(TASTING);
  });

  it('selects the outline strategy under defaults', () => {
    expect(doc.strategy).toBe('outline');
    expect(doc.sections.length).toBeGreaterThanOrEqual(15);
    expect(doc.sections.length).toBeLessThanOrEqual(40);
  });

  it('surfaces known outline titles', () => {
    const titles = doc.sections.map((s) => s.title);
    expect(titles.some((t) => t.includes('Tock'))).toBe(true);
    expect(titles.some((t) => t.includes('Responsible Alcohol Service'))).toBe(true);
  });

  it('covers the document with monotonic, non-overlapping page ranges', () => {
    expect(doc.sections[0]?.pageStart).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < doc.sections.length; i++) {
      const prev = doc.sections[i - 1]!;
      const cur = doc.sections[i]!;
      expect(cur.pageStart).toBeGreaterThan(prev.pageStart);
      expect(cur.pageStart).toBeGreaterThanOrEqual(prev.pageEnd);
    }
  });

  it('produces sections under the forced font strategy', async () => {
    const fontDoc = await extract(TASTING, { strategy: 'font' });
    expect(fontDoc.strategy).toBe('font');
    expect(fontDoc.sections.length).toBeGreaterThan(0);
    const short = fontDoc.sections.filter((s) => s.text.length < 100).length;
    expect(short / fontDoc.sections.length).toBeLessThan(0.5);
  });

  it('forced outline strategy matches auto-default', async () => {
    const forced = await extract(TASTING, { strategy: 'outline' });
    expect(forced.sections.map((s) => s.slug)).toEqual(doc.sections.map((s) => s.slug));
  });

  it('snapshots outline section titles', () => {
    expect(doc.sections.map((s) => s.title)).toMatchSnapshot();
  });
});
