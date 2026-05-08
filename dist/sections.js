const DEFAULT_RATIOS = [1.2, 1.25, 1.3, 1.35, 1.4];
export const DEFAULT_MIN_SECTION_CHARS = 200;
export const DEFAULT_TARGET_SECTION_CHARS = 1500;
export function squish(text) {
    return text.replace(/\s+/g, ' ').trim();
}
export function slugify(title) {
    return title
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
export function uniqueSlugs(titles) {
    const counts = new Map();
    return titles.map((t) => {
        const base = slugify(t) || 'section';
        const n = (counts.get(base) ?? 0) + 1;
        counts.set(base, n);
        return n === 1 ? base : `${base}-${n}`;
    });
}
export function bodyFontSize(lines) {
    const buckets = new Map();
    for (const l of lines) {
        const k = Math.round(l.fontSize * 10) / 10;
        buckets.set(k, (buckets.get(k) ?? 0) + l.text.length);
    }
    let bestSize = 0;
    let bestWeight = -1;
    for (const [size, weight] of buckets) {
        if (weight > bestWeight) {
            bestWeight = weight;
            bestSize = size;
        }
    }
    return bestSize;
}
export function detectHeadings(lines, ratio, body, isContinuation) {
    const threshold = body * ratio;
    const chunks = [];
    let current = null;
    let prevHeading = null;
    for (const line of lines) {
        const isHeading = line.fontSize >= threshold;
        if (isHeading) {
            if (current &&
                prevHeading &&
                isContinuationLine(line, prevHeading, isContinuation)) {
                current.title = squish(`${current.title} ${line.text}`);
                prevHeading = line;
                continue;
            }
            current = { title: line.text, pageStart: line.page, lines: [] };
            chunks.push(current);
            prevHeading = line;
        }
        else if (current) {
            current.lines.push(line);
        }
    }
    return chunks;
}
function isContinuationLine(line, prev, callerRule) {
    if (callerRule)
        return callerRule(line.text);
    if (line.page !== prev.page)
        return false;
    const dy = prev.y - line.y;
    if (dy <= 0)
        return false;
    return dy < line.fontSize * 2.0;
}
function chunkLengths(chunks) {
    return chunks.map((c) => {
        let len = 0;
        for (const l of c.lines)
            len += l.text.length + 1;
        return Math.max(0, len - 1);
    });
}
function chunksToSections(chunks, pageCount) {
    const slugs = uniqueSlugs(chunks.map((c) => c.title));
    return chunks.map((c, i) => {
        const text = c.lines.map((l) => l.text).join('\n').trim();
        const next = chunks[i + 1];
        const pageEnd = next ? Math.max(c.pageStart, next.pageStart - 1) : pageCount;
        return {
            slug: slugs[i],
            title: c.title,
            text,
            pageStart: c.pageStart,
            pageEnd,
        };
    });
}
export function scoreSections(sections, minSectionChars, targetSectionChars) {
    if (sections.length === 0)
        return -Infinity;
    return scoreLengths(sections.map((s) => s.text.length), minSectionChars, targetSectionChars);
}
function scoreLengths(lengths, minSectionChars, targetSectionChars) {
    if (lengths.length === 0)
        return -Infinity;
    const floor = minSectionChars / 2;
    let totalLen = 0;
    let fragments = 0;
    for (const len of lengths) {
        totalLen += len;
        if (len < floor)
            fragments++;
    }
    const avgLen = totalLen / lengths.length;
    const fragRate = fragments / lengths.length;
    return -Math.abs(avgLen - targetSectionChars) - fragRate * 1000;
}
export function byFont(lines, pageCount, opts = {}) {
    const body = bodyFontSize(lines);
    if (body <= 0)
        return [];
    const minSectionChars = opts.minSectionChars ?? DEFAULT_MIN_SECTION_CHARS;
    const targetSectionChars = opts.targetSectionChars ?? DEFAULT_TARGET_SECTION_CHARS;
    if (typeof opts.ratio === 'number') {
        return chunksToSections(detectHeadings(lines, opts.ratio, body, opts.isContinuation), pageCount);
    }
    let best = { score: -Infinity, chunks: [] };
    for (const ratio of DEFAULT_RATIOS) {
        const chunks = detectHeadings(lines, ratio, body, opts.isContinuation);
        const score = scoreLengths(chunkLengths(chunks), minSectionChars, targetSectionChars);
        if (score > best.score)
            best = { score, chunks };
    }
    return chunksToSections(best.chunks, pageCount);
}
export function byOutline(lines, outline, pageCount) {
    const entries = dedupeOutline(outline);
    if (entries.length === 0)
        return [];
    const slugs = uniqueSlugs(entries.map((e) => e.title));
    const linesByPage = groupLinesByPage(lines);
    return entries.map((entry, i) => {
        const next = entries[i + 1];
        const pageStart = entry.pageNumber;
        const pageEndExclusive = next ? next.pageNumber : pageCount + 1;
        const pageEnd = Math.max(pageStart, pageEndExclusive - 1);
        const text = collectText(linesByPage, pageStart, pageEndExclusive);
        return {
            slug: slugs[i],
            title: entry.title,
            text,
            pageStart,
            pageEnd,
            level: entry.level,
        };
    });
}
function dedupeOutline(outline) {
    const out = [];
    for (const entry of outline) {
        const last = out[out.length - 1];
        if (last && entry.pageNumber === last.pageNumber)
            continue;
        out.push(entry);
    }
    return out;
}
function groupLinesByPage(lines) {
    const map = new Map();
    for (const line of lines) {
        let arr = map.get(line.page);
        if (!arr) {
            arr = [];
            map.set(line.page, arr);
        }
        arr.push(line);
    }
    return map;
}
function collectText(linesByPage, start, endExclusive) {
    const parts = [];
    for (let p = start; p < endExclusive; p++) {
        const pageLines = linesByPage.get(p);
        if (!pageLines)
            continue;
        for (const line of pageLines)
            parts.push(line.text);
    }
    return parts.join('\n').trim();
}
export function sanityCheck(sections, minSectionChars) {
    if (sections.length === 0) {
        throw new Error('section detection produced 0 sections — likely miscalibrated');
    }
    const floor = minSectionChars / 2;
    const tooShort = sections.filter((s) => s.text.length < floor);
    if (tooShort.length > sections.length / 2) {
        throw new Error(`${tooShort.length}/${sections.length} sections fell below ${floor} chars — heuristic likely fragmenting`);
    }
}
export function shouldUseOutline(outline) {
    return dedupeOutline(outline).length >= 2;
}
//# sourceMappingURL=sections.js.map