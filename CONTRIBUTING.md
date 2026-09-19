# Contributing to Open-PaperKid

Thanks for your interest! Open-PaperKid is intentionally small and friendly to first-time contributors.

## Development setup

```bash
git clone https://github.com/AshleyLi-shiya/Open-PaperKid.git
cd Open-PaperKid
cd server && npm install && npm run dev   # backend at :5174
cd ../chrome-extension                     # open chrome://extensions → load unpacked
```

## Project layout

| Folder | What | Stack |
|--------|------|-------|
| `server/` | Backend API | Node 20, TypeScript, Express, pdf-parse, arxiv |
| `chrome-extension/` | Browser extension | Vanilla JS (no build step), Manifest V3 |
| `shared/` | Types shared by both | TypeScript only |
| `docs/` | Documentation | Markdown |

## Code style

- TypeScript strict mode.
- 2-space indent.
- Use `import type` for type-only imports.
- No `any` in `server/src/services/` (the rest is more lenient).
- Run `npm run typecheck` in `server/` before committing.

## How to add a new LLM provider

1. Open `server/src/services/llm.ts`.
2. Add a new entry to `PROVIDERS` (id, label, recommendedModel, etc.).
3. Add the id to `PROVIDER_ORDER`.
4. Add a new client class implementing `LlmClient`.
5. Add the case in `createClientFor()`.
6. If the API is OpenAI-compatible, you may be able to reuse `OpenAICompatClient` with a different `baseUrl`.

That's it. The Chrome extension's options page automatically picks up the new provider via `GET /api/providers`.

## How to add a new paper source (e.g. OpenReview, biorxiv)

1. Open `server/src/services/`.
2. Create a new `<source>.ts` module exporting `search<Source>(...)` and `download<Source>(...)`.
3. Add a route in `server/src/routes/papers.ts` (e.g. `POST /api/papers/ingest-openreview`).

## How to improve the simple-language prompts

See `docs/PROMPTS.md` for the existing tunables. To experiment with a new prompt:

1. Edit `server/src/prompts/index.ts`.
2. Re-test with `node --import tsx server/src/cli.ts summarize --arxiv <id> --lang both`.
3. Compare before/after side by side.

## How to add a Chrome extension feature

The extension has **no build step**. Edit files directly under `chrome-extension/` and reload the extension in `chrome://extensions`.

| Want to add… | Touch these files |
|--------------|-------------------|
| New button on popup | `popup/popup.html` + `popup/popup.js` |
| New side-panel section | `sidepanel/sidepanel.html` + `sidepanel/sidepanel.js` |
| New paper site (e.g. NeurIPS proceedings) | `content/contentScript.js` + `manifest.json` `content_scripts.matches` |
| New API endpoint to call | `lib/apiClient.js` |

## How to deploy your fork

See `docs/DEPLOY.md`. The Docker / Fly.io / Railway setups should work without changes.

## Pull request checklist

- [ ] `npm run typecheck` passes in `server/`.
- [ ] New dependencies added to `server/package.json` are pinned to exact versions.
- [ ] If you change a server route, update `docs/SETUP.md` API table.
- [ ] If you change user-facing behavior, update `README.md`.
- [ ] No API keys in tests, fixtures, or commits.

## Community guidelines

Be kind. We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Short version: assume good faith, no harassment, accept feedback gracefully.