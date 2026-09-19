# Changelog

All notable changes to Open-PaperKid are documented here. Open-PaperKid follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-09-19 — BYOK + Multi-provider + Production

### Added
- **BYOK architecture**: API key is now sent per-request via `X-Paperkid-Api-Key` header. Server never persists keys, never logs them.
- **Multi-provider**: OpenAI (default), Anthropic, DeepSeek, Ollama. User picks via extension options page.
- **`/api/providers` endpoint**: lists supported providers with metadata.
- **`/api/providers/validate` endpoint**: minimal-ping test for the user's chosen provider.
- **Chrome extension Options page** (`chrome-extension/options/`): provider dropdown, API key input, base URL, model selector, ping test button.
- **Production hardening**:
  - CORS locked down to chrome-extension: / moz-extension: / loopback / https.
  - Per-IP rate limiting (60 req/min).
  - Health endpoint returns version + storage status.
  - Centralized error handler strips `sk-...` tokens from all responses and logs.
  - `x-powered-by` header disabled.
- **Multi-stage Dockerfile** with healthcheck.
- **Deploy configs**:
  - `fly.toml` for Fly.io
  - `railway.toml` for Railway
- **CI**: GitHub Actions typecheck + extension syntax + docker build.
- **Production docs**: `DEPLOY.md`, `SECURITY.md`, `PRIVACY.md`, `CONTRIBUTING.md`.

### Changed
- Default LLM backend is now **OpenAI** (per "ChatGPT works best" feedback).
- `summarize`, `translate`, `qa` services now take a `ProviderContext` parameter.
- CLI now supports `--provider`, `--api-key`, `--base-url`, `--model` flags.
- README rewritten to reflect BYOK + multi-provider.

### Removed
- `server/.env` default no longer requires `OPENAI_API_KEY`. Set only if you want CLI fallback.
- `safeErrorMessage` removed key leakage from error responses.

## [0.1.0] - 2026-09-13 — Initial scaffold

### Added
- Single-provider (Ollama) backend with REST API.
- Chrome extension (popup + sidepanel + content script) for arxiv / OpenReview / HF papers.
- CLI for summarize / ask / translate / search.
- Bilingual simple-language prompts (Chinese + English).
- RAG-based paper Q&A with in-memory vector index.
- Basic Docker Compose for self-host with Ollama.
- `ARCHITECTURE.md`, `SETUP.md`, `PROMPTS.md`.

[Unreleased]: https://github.com/AshleyLi-shiya/Open-PaperKid/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/AshleyLi-shiya/Open-PaperKid/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/AshleyLi-shiya/Open-PaperKid/releases/tag/v0.1.0