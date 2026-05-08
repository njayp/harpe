import { readFile } from 'node:fs/promises';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — pdfjs-dist legacy build ships its own .mjs without published types.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { squish } from './sections.js';
async function openDocument(data) {
    // pdfjs-dist's loader accepts useWorkerFetch:false but the legacy build's typings
    // are loose — cast to any rather than re-declare every accepted flag.
    //
    // disableWorker:true forces the parser to run inline on the main thread.
    // Without it, pdfjs-dist tries to dynamically `import('pdf.worker.mjs')`
    // relative to its own resolved package path; that fails the moment harpe
    // is bundled into a single file (esbuild for Cloud Functions, webpack for
    // serverless platforms, etc.) because the worker file isn't on disk at
    // the expected location anymore. Server-side PDF parsing has no use for
    // a worker thread anyway.
    const loadingTask = pdfjs.getDocument({
        data,
        isEvalSupported: false,
        useWorkerFetch: false,
        disableWorker: true,
    });
    return loadingTask.promise;
}
export async function loadPdf(pdfPath) {
    const buf = await readFile(pdfPath);
    return new Uint8Array(buf);
}
export async function extractLines(data) {
    const doc = await openDocument(data);
    try {
        const [pageLines, outline, title] = await Promise.all([
            extractAllPages(doc),
            readOutline(doc),
            readTitle(doc),
        ]);
        return { lines: pageLines.flat(), pageCount: doc.numPages, title, outline };
    }
    finally {
        await doc.destroy();
    }
}
async function extractAllPages(doc) {
    const pageNums = Array.from({ length: doc.numPages }, (_, i) => i + 1);
    return Promise.all(pageNums.map(async (p) => {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        return itemsToLines(content.items, p);
    }));
}
function itemsToLines(items, page) {
    const grouped = new Map();
    for (const it of items) {
        const text = it.str;
        if (!text)
            continue;
        const t = it.transform;
        const fontSize = Math.hypot(t[2] ?? 0, t[3] ?? 0);
        const y = t[5] ?? 0;
        const key = `${Math.round(y)}`;
        const existing = grouped.get(key);
        if (existing) {
            existing.parts.push(text);
            if (fontSize > existing.fontSize)
                existing.fontSize = fontSize;
        }
        else {
            grouped.set(key, { y, fontSize, parts: [text] });
        }
    }
    const out = [];
    for (const { y, fontSize, parts } of grouped.values()) {
        const text = squish(parts.join(''));
        if (!text)
            continue;
        out.push({ page, y, fontSize, text });
    }
    out.sort((a, b) => b.y - a.y);
    return out;
}
async function readOutline(doc) {
    const raw = await doc.getOutline();
    if (!raw || raw.length === 0)
        return [];
    const out = [];
    await flatten(doc, raw, 0, out);
    return out;
}
async function flatten(doc, nodes, level, out) {
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
async function resolveDest(doc, dest) {
    let resolved = dest;
    if (typeof resolved === 'string') {
        resolved = await doc.getDestination(resolved);
    }
    if (!Array.isArray(resolved) || resolved.length === 0)
        return null;
    const ref = resolved[0];
    try {
        const idx = await doc.getPageIndex(ref);
        return idx + 1;
    }
    catch {
        return null;
    }
}
async function readTitle(doc) {
    try {
        const meta = await doc.getMetadata();
        const t = meta.info?.Title;
        return t && t.trim() ? t.trim() : undefined;
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=pdf.js.map