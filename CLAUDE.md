UPDATE THIS FILE (CLAUDE.md) AND README.md AS NEEDED

## Before Committing

- Run `npm run build` and ensure the project builds successfully and dist gets committed

## Claude-Code Plan Guidelines

**Context:** Explain why this change is needed — the problem, what prompted it, and the intended outcome.
**Reuse:** Search for existing functions, utilities, and patterns before proposing new code. List any reused code with file paths.
**Simplicity:** Follow existing patterns, conventions, and tech stack. Avoid unnecessary abstractions — don't add new helpers, layers, or files when existing ones suffice.
**Completeness:** Include absolute file paths with line numbers, a "Critical Files" section, and a testing strategy where applicable.
**Verification:** Include concrete steps to verify changes end-to-end using available tools (e.g. emulator curl, `npm test`, `grep`, build commands) — not manual inspection alone.

## Coding Guidelines

- **small files** — keep files under 400 lines and focused on a single responsibility
- **DRY** — don't repeat yourself
- **YAGNI** — you ain't gonna need it
- **KISS** — keep it simple
- **less is more** — prefer simplicity and elegance; remove unnecessary code
- **test behavior** — prefer testing behavior over implementation details
- **log levels** — errors: something failed that shouldn't have; warnings: degraded or misconfigured; info: normal operations worth noting
- **run the linter** — after edits to .ts/.tsx files run `npm run lint`; fix any errors (use `npm run lint:fix` for mechanical fixes) before declaring a task complete
- **writes via Functions** — never write to Firestore from the browser; add a Function endpoint and call it via `apiSend`. Every collection's write rule must be `allow write: if false`.
