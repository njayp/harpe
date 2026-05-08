export type Section = {
    slug: string;
    title: string;
    text: string;
    pageStart: number;
    pageEnd: number;
    level?: number;
};
export type Document = {
    source: string;
    title?: string;
    sections: Section[];
    strategy: 'outline' | 'font';
};
export type ExtractOptions = {
    strategy?: 'auto' | 'outline' | 'font';
    ratio?: number;
    isContinuation?: (text: string) => boolean;
    minSectionChars?: number;
    targetSectionChars?: number;
};
export type Line = {
    page: number;
    y: number;
    fontSize: number;
    text: string;
};
export type OutlineEntry = {
    title: string;
    pageNumber: number;
    level: number;
};
//# sourceMappingURL=types.d.ts.map