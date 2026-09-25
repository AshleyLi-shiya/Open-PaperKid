# Runtime verification

Run from `server/` with Node 20 or newer:

```sh
npm ci
npm run typecheck
npm test
npm start
```

`npm test` builds the production JavaScript, starts it with isolated temporary
storage, and exercises the HTTP API against a local mock Ollama service. It
covers health, provider validation, real PDF parsing/upload, bilingual summary
requests containing paper text, translation, retrieval with citations, graceful
fallback when query embeddings fail, listing and deletion. The base64 PDF
fixture is a generated one-page sample about plants, not a user document.

Extension tests execute manifest content scripts as classic JavaScript, check
click-to-side-panel delegation, queued import consumption, restoration after
service-worker restart, and cache invalidation after settings changes.

Language regression tests cover English settings defaults, persisted Chinese
selection without changing credentials, English-first summary buttons, import
without automatic generation, one-language rendering of legacy bilingual results,
and ignoring stale responses after switching languages. API tests verify exactly
one model call per single-language summary. Prompts target ages 8–10; mocked tests
do not establish actual model readability.

## Fixes covered

- Content scripts cannot use static ES-module imports. Paper-page clicks now
  ask the background worker to open the side panel immediately; the side panel
  performs the network work in the extension origin.
- Popup summaries and context-menu imports use the same queued import flow.
  Opening the side panel no longer waits for a potentially lengthy LLM request.
- Results survive worker suspension in `chrome.storage.session`, and the side
  panel restores them on load. Provider settings refresh when changed elsewhere.
- PDF bytes are copied to a plain `Uint8Array` before parsing, avoiding the
  legacy PDF.js/Node Buffer slice mismatch that caused valid uploads to fail.
- Single-line section headings and leading PDF blank lines no longer lose the
  abstract. Unstructured papers supply body text to the summary prompt.
- Q&A falls back to keyword matching over paper text when embeddings fail;
  only when no match is found does it use the abstract. The UI labels the mode.
- Follow-up questions include at most three completed turns. Tests cover
  clearing history, switching papers and ignoring stale replies.
- Retrieval indexes are isolated by embedding endpoint/model, validate vector
  dimensions, and are evicted on deletion. Unit tests cover model changes,
  malformed embeddings, Chinese keyword matching and section aliases.
- CI now runs the tests and fails on extension syntax errors.

## Verification limits

The local run passed on Node 24.19.0. CI is configured for Node 20. LLM responses
in these automated tests are deterministic mocks: they verify integration, not
the quality or live availability of any commercial model. No model API key was
provided or used. This run did not install the extension into a live Chrome
profile or execute a Docker build. For release acceptance, load the unpacked
extension, configure your provider, click a supported arXiv or Hugging Face
Papers page, reopen the panel, change settings, and upload a PDF.
