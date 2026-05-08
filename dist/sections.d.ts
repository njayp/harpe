import type { ExtractOptions, Line, OutlineEntry, Section } from './types.js';
export declare const DEFAULT_MIN_SECTION_CHARS = 200;
export declare const DEFAULT_TARGET_SECTION_CHARS = 1500;
export declare function squish(text: string): string;
export declare function slugify(title: string): string;
export declare function uniqueSlugs(titles: string[]): string[];
export declare function bodyFontSize(lines: Line[]): number;
type FontChunk = {
    title: string;
    pageStart: number;
    lines: Line[];
};
export declare function detectHeadings(lines: Line[], ratio: number, body: number, isContinuation?: (text: string) => boolean): FontChunk[];
export declare function scoreSections(sections: Section[], minSectionChars: number, targetSectionChars: number): number;
export declare function byFont(lines: Line[], pageCount: number, opts?: ExtractOptions): Section[];
export declare function byOutline(lines: Line[], outline: OutlineEntry[], pageCount: number): Section[];
export declare function sanityCheck(sections: Section[], minSectionChars: number): void;
export declare function shouldUseOutline(outline: OutlineEntry[]): boolean;
export {};
//# sourceMappingURL=sections.d.ts.map