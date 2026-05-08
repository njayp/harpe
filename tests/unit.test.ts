import { describe, expect, it } from 'vitest';
import {
  bodyFontSize,
  detectHeadings,
  sanityCheck,
  scoreSections,
  slugify,
  uniqueSlugs,
} from '../src/sections.js';
import type { Line, Section } from '../src/types.js';

describe('slugify', () => {
  it('ASCII-folds and kebab-cases', () => {
    expect(slugify('Café')).toBe('cafe');
    expect(slugify('Hello, World!')).toBe('hello-world');
  });

  it('preserves numeric prefixes', () => {
    expect(slugify('1.2 Medical Conditions')).toBe('1-2-medical-conditions');
  });

  it('handles empty/punctuation-only input', () => {
    expect(slugify('---')).toBe('');
  });
});

describe('uniqueSlugs', () => {
  it('appends -2/-3 on collision', () => {
    expect(uniqueSlugs(['Intro', 'Intro', 'Other', 'Intro'])).toEqual([
      'intro',
      'intro-2',
      'other',
      'intro-3',
    ]);
  });

  it('falls back to "section" for empty slugs', () => {
    expect(uniqueSlugs(['---', '---'])).toEqual(['section', 'section-2']);
  });
});

describe('bodyFontSize', () => {
  it('returns the size with the most character coverage', () => {
    const lines: Line[] = [
      { page: 1, y: 100, fontSize: 18, text: 'Heading' },
      { page: 1, y: 80, fontSize: 11, text: 'a long paragraph of body copy that dominates char count' },
      { page: 1, y: 60, fontSize: 11, text: 'another body line that adds even more weight' },
      { page: 1, y: 40, fontSize: 18, text: 'Another Heading' },
    ];
    expect(bodyFontSize(lines)).toBeCloseTo(11, 1);
  });
});

describe('scoreSections', () => {
  it('returns -Infinity for empty section list', () => {
    expect(scoreSections([], 200, 1500)).toBe(-Infinity);
  });

  it('prefers sections close to target length over very short ones', () => {
    const close: Section[] = [section('a', 'A', 1500), section('b', 'B', 1500)];
    const fragmented: Section[] = Array.from({ length: 20 }, (_, i) =>
      section(`s-${i}`, `S${i}`, 50),
    );
    expect(scoreSections(close, 200, 1500)).toBeGreaterThan(
      scoreSections(fragmented, 200, 1500),
    );
  });
});

describe('detectHeadings', () => {
  it('starts a new chunk for each heading-sized line', () => {
    const lines: Line[] = [
      line(1, 800, 18, 'First Heading'),
      line(1, 780, 11, 'body line one'),
      line(1, 760, 11, 'body line two'),
      line(1, 740, 18, 'Second Heading'),
      line(1, 720, 11, 'body of second'),
    ];
    const chunks = detectHeadings(lines, 1.3, 11);
    expect(chunks.map((c) => c.title)).toEqual(['First Heading', 'Second Heading']);
    expect(chunks[0]?.lines).toHaveLength(2);
    expect(chunks[1]?.lines).toHaveLength(1);
  });

  it('merges a wrapped heading on the next line into one title', () => {
    const lines: Line[] = [
      line(1, 800, 18, 'Conditions'),
      line(1, 780, 18, 'and Related'),
      line(1, 760, 11, 'body line'),
    ];
    const chunks = detectHeadings(lines, 1.3, 11);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.title).toBe('Conditions and Related');
  });

  it('does not merge when the second heading is far below', () => {
    const lines: Line[] = [
      line(1, 800, 18, 'First Heading'),
      line(1, 600, 18, 'Second Heading'),
    ];
    const chunks = detectHeadings(lines, 1.3, 11);
    expect(chunks).toHaveLength(2);
  });

  it('respects caller-provided isContinuation rule', () => {
    const lines: Line[] = [
      line(1, 800, 18, '1.2 First'),
      line(1, 780, 18, 'and Related'),
      line(1, 760, 18, '1.3 Second'),
    ];
    const isCont = (text: string) => !/^\d+(\.\d+)+/.test(text);
    const chunks = detectHeadings(lines, 1.3, 11, isCont);
    expect(chunks.map((c) => c.title)).toEqual(['1.2 First and Related', '1.3 Second']);
  });
});

describe('sanityCheck', () => {
  it('throws on zero sections', () => {
    expect(() => sanityCheck([], 200)).toThrow();
  });

  it('throws when more than half the sections are below the floor', () => {
    const sections: Section[] = [
      section('a', 'A', 5),
      section('b', 'B', 5),
      section('c', 'C', 5),
      section('d', 'D', 1500),
    ];
    expect(() => sanityCheck(sections, 200)).toThrow();
  });

  it('passes when most sections meet the floor', () => {
    const sections: Section[] = [
      section('a', 'A', 1500),
      section('b', 'B', 1500),
      section('c', 'C', 50),
    ];
    expect(() => sanityCheck(sections, 200)).not.toThrow();
  });
});

function line(page: number, y: number, fontSize: number, text: string): Line {
  return { page, y, fontSize, text };
}

function section(slug: string, title: string, len: number): Section {
  return { slug, title, text: 'x'.repeat(len), pageStart: 1, pageEnd: 1 };
}
