# Security Policy

## Threat model

PaperKid has two trust zones:

1. **Browser extension** — trusted. Holds the user's API key in `chrome.storage.local`. Runs in the user's browser, signs requests with the user's chosen provider key.
2. **Server** — semi-trusted. Receives API keys via `X-Paperkid-Api-Key` headers, uses them to call LLM providers, but **never persists them, never logs them, never writes them to disk**.

The user trusts that:
- The extension does not exfiltrate keys to anyone other than the configured server.
- The server does not log keys or paper content.

## What we promise

- ✅ The server logs **provider name** (e.g. `openai`), never the key.
- ✅ The server logs **request method + path + status + latency**, never request bodies that may contain paper content.
- ✅ Errors that bubble up to the client are **scrubbed of `sk-...` patterns** before sending (see `safeErrorMessage`).
- ✅ The server does **not** require any auth by default — it is intended to be self-hosted or used by a small trusted group.
- ✅ The extension stores keys in `chrome.storage.local` (per-extension local storage), not `sync` (which would sync across signed-in browsers).

## What we do NOT promise

- ❌ Multi-tenancy isolation. If you expose the server to the public internet, anyone can hit it and consume your provider quota. **Use rate limiting / auth gateway in front** (see "Hardening for public deployment" below).
- ❌ Tamper-proofness of the extension. A determined attacker who modifies the extension source can exfiltrate keys. We follow Chrome extension best practices (manifest V3, no remote code, no eval) to minimize the attack surface, but we cannot prevent source modification.
- ❌ Prompt injection safety in paper content. A malicious paper could include prompt-injection content that tries to manipulate the LLM. We mitigate by:
  - Treating paper content as **untrusted data**, not instructions.
  - Keeping the simple-language rule strict in `prompts/index.ts`.
  - Saying "I don't know" in QA when the answer is not in the paper.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security-sensitive bugs.

Email: lishiyaya@gmail.com. Please include:
- Steps to reproduce
- Affected versions
- Potential impact

We aim to acknowledge within 3 days and patch within 30 days for non-critical issues.

## Hardening for public deployment

If you intend to run a **public** PaperKid instance (i.e. strangers hit your URL), add at minimum:

1. **Reverse proxy with auth** — nginx basic auth, Cloudflare Access, OAuth proxy (e.g. oauth2-proxy), or your own login layer.
2. **Stronger rate limiting** — the in-process limiter in `index.ts` is per-IP and 60/min, which is too generous for hostile public traffic. Use a real solution (Cloudflare rate limiting rules, or a Redis-backed limiter).
3. **Disk quota** — PaperKid stores PDFs on disk. A malicious user could DoS you with 1GB uploads. Mount a small volume (1-5 GB) and run a cron that deletes old papers.
4. **No `OPENAI_API_KEY` in env** — keep BYOK strict; otherwise users might use your key and run up your bill.

## Dependency security

We use `npm audit` in CI. For production deployments:

```bash
npm audit --omit=dev
npm audit fix
```

We pin dependency versions in `package.json` (no `^` for security-sensitive packages in `dependencies/`). If you find a vulnerability, please report as above.

## Cryptography

PaperKid does not implement its own cryptography. It uses HTTPS for all browser-to-server and server-to-provider communication. Keys are stored in cleartext in `chrome.storage.local` (acceptable per Chrome's threat model — extension storage is isolated from web pages).

## Updates

Security patches will be released as patch versions (0.2.x). Watch the GitHub Releases page or enable "Watch → Custom" on the repository.