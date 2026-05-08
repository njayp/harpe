import type { Document, ExtractOptions } from './types.js';
export type { Document, ExtractOptions, Section } from './types.js';
export declare function extract(pdfPath: string, opts?: ExtractOptions): Promise<Document>;
export declare function extractFromBuffer(data: Uint8Array, source: string, opts?: ExtractOptions): Promise<Document>;
//# sourceMappingURL=index.d.ts.map