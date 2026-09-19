# Privacy Policy

_Last updated: 2026-09-19_

Open-PaperKid is an open-source, BYOK (Bring Your Own Key) paper assistant. This document explains what data we collect and what we don't.

## TL;DR

- ✅ Your **API key** stays in your browser only.
- ✅ Your **papers** stay on **your** server only.
- ❌ We have **no central server**, **no telemetry**, **no analytics**.
- ❌ We have **no user accounts** and **no email collection**.

## What lives where

| Data | Where |
|------|-------|
| API key (`sk-…`) | Your browser's `chrome.storage.local` only. Never sent anywhere except your configured Open-PaperKid server as a per-request header. |
| Paper PDFs you upload | Your local Open-PaperKid server (`.open-paperkid-data/pdfs/`). |
| Extracted text + RAG vectors | Your local Open-PaperKid server (`.open-paperkid-data/papers/`). |
| Summaries / Q&A history | Your local Open-PaperKid server (`.open-paperkid-data/papers/<id>/`). |
| LLM API calls | Sent from your server to your chosen provider (OpenAI / Anthropic / DeepSeek / Ollama). Subject to that provider's own privacy policy. |

## What the Open-PaperKid server logs

By default, the server logs:

- HTTP method + path
- Response status code
- Latency in milliseconds
- Provider name (e.g. `openai`) — never the key

It does **not** log:
- Request bodies (which may contain paper content or questions)
- API keys
- Paper IDs in association with users (we don't know who you are)

## Subprocessors

When you use a hosted provider (OpenAI / Anthropic / DeepSeek), they become a subprocessor of your data. Their privacy policies apply to the data they receive:

- [OpenAI Privacy Policy](https://openai.com/privacy)
- [Anthropic Privacy Policy](https://www.anthropic.com/privacy)
- [DeepSeek Privacy Policy](https://www.deepseek.com/privacy)

If you use Ollama (local), no third party receives your data.

## Chrome extension permissions

The extension requests these permissions, used only as described:

- `storage` — store your API key and preferences locally.
- `sidePanel` — show the Q&A UI alongside paper pages.
- `contextMenus` — "Summarize with Open-PaperKid" right-click menu on arxiv links.
- `activeTab`, `scripting` — inject the summarize button on paper pages.
- Host permissions for `arxiv.org`, `openreview.net`, `huggingface.co/papers`, `localhost`, `127.0.0.1` — for fetching pages and talking to your local server.

The extension does **not**:
- Read your browsing history outside the paper pages you visit.
- Send data to any server other than the one you configure.

## Your rights

Because we have no central server:
- **No "delete my account"** — there is no account.
- **No data export from us** — all your data is on your own disk. You can `rm -rf .open-paperkid-data` at any time.
- **No data portability from us** — same as above.

## Children's privacy

Open-PaperKid does not knowingly target children under 13. Since we collect no data, COPPA / GDPR-K compliance is achieved by construction.

## Changes to this policy

This is an open-source project. Any change to this policy will be:

1. Committed to this repository with a clear commit message.
2. Listed in the GitHub Releases.
3. Effective on the date noted at the top of this file.

## Contact

For privacy questions, open a GitHub issue or email lishiyaya@gmail.com.