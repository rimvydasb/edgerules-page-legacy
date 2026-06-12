# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Vite + React (TypeScript) app that renders an interactive reference/playground for the EdgeRules language.
Content comes from Markdown files in `public/docs/` parsed at runtime. Examples are evaluated in-browser
via the EdgeRules WebAssembly module. Deployed to GitHub Pages: https://rimvydasb.github.io/edgerules-page-legacy/

## Commands

- Install: `npm install`
- Build (verify changes): `npm run build` — output in `dist/`
- Preview build: `npm run preview`
- Typecheck: `npm run typecheck` (`tsc --noEmit`)
- Test: `npm test` (Jest, runs files under `tests/**/*.test.ts`)
- Run a single test file: `npx jest tests/parseBaseExamples.test.ts`
- Dev server: `npm run dev` — **do not run this yourself**; use `npm run build` to verify code instead.
  `tests/devServerSmoke.test.ts` expects a dev server already running at `http://localhost:5173/edgerules-page-legacy/`
  (override with `EDGE_RULES_BASE_URL`), so it will fail without one.

## Architecture

### Markdown-driven content pipeline

- `src/content/pages.ts`: menu definition — each entry is either a content page (`contentReference` →
  a path under `public/`) or the special `{ type: 'playground' }` entry.
- `src/utils/parseBaseExamples.ts`:
  - `fetchMarkdown` — loads a markdown file, respecting the Vite base URL via `getBaseUrl()` (works in
    dev and on GitHub Pages).
  - `parseBaseExamplesMarkdown` — parses markdown into blocks: `#` sets page title, `##` section title,
    `###` section subtitle. Each fenced code block becomes one example (language tag optional; for
    `edgerules` blocks, leading/trailing blank lines inside the fence are trimmed). Text between a
    heading and the next code fence becomes the example description.
  - `mapBlocksToBaseExamples` — turns parsed blocks into `BaseExample` items with a slug `id` and a
    computed `title` (`Section · Subtitle`, or falls back to page title / `Example n`).
  - `fetchAndParseBaseExamples` — combines fetch + parse + map.
- `src/examples/types.ts`: shared `BaseExample` and `Example` types (`Example` adds `input`, `output`,
  `isError` for the editable/evaluated state).
- To add a new example: edit the relevant Markdown file under `public/docs/`; no rebuild needed in dev.
  To add a new page: create the Markdown file and register it in `src/content/pages.ts`.

### App shell and evaluation flow (`src/App.tsx`)

- Loads the markdown for the active page, converts each `BaseExample` into an `Example`, and renders two
  CodeMirror/`react-simple-code-editor` panes per example: editable input (left) and read-only output
  (right).
- WASM evaluation: when the module is ready, a single non-empty line uses `mod.DecisionEngine.evaluate`
  for the single-expression path; otherwise the full input is evaluated as a program. Errors (including
  linking-stage errors) are caught and rendered via `formatWasmResult` in the output panel.
- Playground tab (`type: 'playground'` page, `src/components/Playground.tsx`): seeded from
  `public/docs/PLAYGROUND.md`'s first code block. Supports sharing state via the `?h=` URL query param,
  compressed/decompressed with `lz-string` (`LZString.compressToEncodedURIComponent` /
  `decompressFromEncodedURIComponent`).

### WASM integration

- `index.html` loads a bootstrap module script that sets `window.__VITE_BASE_URL__` and dynamically loads
  `public/loader.js` (with cache-busting query params computed in `vite.config.js` from the WASM/JS file
  size+mtime).
- `loader.js` initializes the EdgeRules WASM module and exposes it as `window.__edgeRules`, then dispatches
  `edgerules-ready` (or `edgerules-error`) on `window`.
- `src/App.tsx` listens for these events, awaits `mod.ready`, and stores the module in a ref for all
  evaluation calls. All evaluation happens client-side in the browser.
- The WASM bundle (`public/pkg-web/`, plus `public/pkg-web-debug/`) is copied manually from the
  [main EdgeRules repo](https://github.com/rimvydasb/edgerules) after each release — it is not built by
  this repo's tooling.

### Deployment

- GitHub Actions (`.github/workflows/`) builds and deploys `main` to GitHub Pages on push.
- `base` in `vite.config.js` must match the GitHub Pages path (`/edgerules-page-legacy/`) — update both if the
  repo name or path changes.

## Code Style

- Indentation: 4 spaces.
- Maximum line length: 120 characters.
- TypeScript strict mode; prefer explicit types on public APIs.
- Keep components small and colocate related code.
- Avoid unnecessary dependencies; prefer Vite-native patterns. The markdown parser is intentionally simple
  — avoid adding heavy Markdown libraries unless necessary.
