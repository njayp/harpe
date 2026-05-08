import type { Line, OutlineEntry } from './types.js';
export declare function loadPdf(pdfPath: string): Promise<Uint8Array>;
export declare function extractLines(data: Uint8Array): Promise<{
    lines: Line[];
    pageCount: number;
    title?: string;
    outline: OutlineEntry[];
}>;
//# sourceMappingURL=pdf.d.ts.map