# harpe

PDF → in-memory sections. A small TypeScript library (with a companion dev CLI) that reads a PDF and returns a `Document` of titled, paginated sections. It does **not** persist, embed, or call any external service — that's the consumer's job.

## Install

```sh
npm install harpe
```

## Library

```ts
import { extract } from 'harpe';

const doc = await extract('handbook.pdf');
// doc: { source, title?, strategy: 'outline' | 'font', sections: Section[] }
// Section: { slug, title, text, pageStart, pageEnd, level? }
```

`strategy: 'auto'` (the default) reads the PDF's bookmark outline when it has ≥2 resolvable entries; otherwise it falls back to a font-size heuristic that auto-tunes the heading-vs-body ratio against per-section length targets.

```ts
type ExtractOptions = {
  strategy?: 'auto' | 'outline' | 'font'; // default 'auto'
  ratio?: number;                          // pin the font-path threshold
  isContinuation?: (text: string) => boolean; // override wrapped-heading merge rule
  minSectionChars?: number;                // sanity-check floor; default 200
  targetSectionChars?: number;             // adaptive-tuning target; default 1500
};
```

`extractFromBuffer(buf, source, opts?)` is the same but takes raw bytes.

## CLI

Development helper, not the product:

```sh
harpe path/to.pdf                                # full Document as JSON
harpe path/to.pdf --titles-only                  # tab-separated slug/title/pages
harpe path/to.pdf --strategy outline|font|auto   # force a strategy
```

## Limitations

- Text-based PDFs only — no OCR for image-only scans.
- Outline path requires resolvable destinations; PDFs with broken outlines fall through to the font heuristic.

## Develop

```sh
npm install
npm run build     # tsc → dist/
npm test          # vitest, runs against the two PDFs in docs/
npm run lint
npm run smoke     # CLI smoke against both fixtures
```
