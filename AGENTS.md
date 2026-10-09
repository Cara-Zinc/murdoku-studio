# Repository Guidelines

## Project Structure & Module Organization

The application lives in `murdoku-studio/`. `server.py` serves the UI and converts PDFs using Poppler. Browser code is in `public/`: `app.js` manages interaction, `engine.js` defines puzzle rules and validation, `solver-worker.js` runs bounded searches, `pdf.js` handles alignment and grid detection, and `storage.js` manages IndexedDB. `demo.js` contains an original practice puzzle. `index.html`, `styles.css`, and `favicon.svg` provide the interface.

Tests live in `murdoku-studio/tests/`. Generate sample PDFs with `tests/pdf_fixture.py`; generated verification images belong in the repository-level `output/` directory. Keep imported user documents and personal saves out of source control.

## Build, Test, and Development Commands

Run these commands from `murdoku-studio/`:

- `python3 server.py --port 8000`: serve the application at `http://127.0.0.1:8000`.
- `npm run check`: check JavaScript syntax and compile the Python server.
- `npm test`: run JavaScript rule tests and Python PDF/HTTP tests.
- `node tests/engine.test.mjs`: display individual JavaScript test results.
- `python3 tests/pdf_fixture.py`: generate an original two-page PDF for import testing.

Use Python 3.10+, Node.js 20+ for tests, and Poppler utilities (`pdfinfo`, `pdftoppm`, `pdftotext`). There is no bundler or runtime npm dependency.

## Coding Style & Naming Conventions

Use native JavaScript ES modules, camelCase functions, and two-space indentation for expanded blocks. Python uses four spaces and snake_case. Match nearby code; no formatter or linter is configured. Keep rules and validation independent of DOM operations. Use `textContent` for imported text, and keep user-facing labels in Chinese.

## Testing Guidelines

Use `node:test` and Python `unittest`. Name tests `*.test.mjs` and `test_*.py`. Cover rule changes, malformed imports, and persistence-sensitive moves. No numeric coverage threshold is configured. Exercise PDF import, undo/redo, refresh recovery, page switching, and mobile layouts in a browser when possible; report unavailable checks accurately.

## Commit & Pull Request Guidelines

No accessible Git history establishes a commit convention. Use short imperative summaries, such as `Fix candidate restoration after moving suspects`. PRs should describe behavior, list verification commands, link relevant issues, and include screenshots for visible changes. Disclose parser limitations and migration effects on saved games. Never treat unverified clues or an incomplete search as a validated solution.
