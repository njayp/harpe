import { extractLines, loadPdf } from './pdf.js';
import { DEFAULT_MIN_SECTION_CHARS, byFont, byOutline, sanityCheck, shouldUseOutline, } from './sections.js';
export async function extract(pdfPath, opts = {}) {
    const data = await loadPdf(pdfPath);
    return extractFromBuffer(data, pdfPath, opts);
}
export async function extractFromBuffer(data, source, opts = {}) {
    const { lines, pageCount, title, outline } = await extractLines(data);
    const strategy = opts.strategy ?? 'auto';
    const useOutline = strategy === 'outline' || (strategy === 'auto' && shouldUseOutline(outline));
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
//# sourceMappingURL=index.js.map