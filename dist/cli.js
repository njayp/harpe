import { parseArgs } from 'node:util';
import { extract } from './index.js';
const HELP = `Usage: harpe <pdf> [--strategy auto|outline|font] [--titles-only]

Prints the extracted Document as JSON to stdout (default), or a tab-separated
slug/title/page summary with --titles-only.
`;
function parseStrategy(v) {
    if (v === undefined || v === 'auto' || v === 'outline' || v === 'font')
        return v;
    throw new Error(`--strategy must be auto|outline|font (got ${v})`);
}
export async function run(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        options: {
            strategy: { type: 'string' },
            'titles-only': { type: 'boolean', default: false },
            help: { type: 'boolean', short: 'h', default: false },
        },
        allowPositionals: true,
    });
    if (values.help || positionals.length === 0) {
        process.stdout.write(HELP);
        if (!values.help)
            process.exit(1);
        return;
    }
    const doc = await extract(positionals[0], { strategy: parseStrategy(values.strategy) });
    if (values['titles-only']) {
        for (const s of doc.sections) {
            process.stdout.write(`${s.slug}\t${s.title}\t${s.pageStart}-${s.pageEnd}\n`);
        }
        return;
    }
    process.stdout.write(`${JSON.stringify(doc, null, 2)}\n`);
}
//# sourceMappingURL=cli.js.map