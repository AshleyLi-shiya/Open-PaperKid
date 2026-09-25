# Privacy and data flow

Updated: 2026-09-25

PaperKid is self-hosted software. There is no built-in analytics, central PaperKid account service or telemetry.
Your backend operator and selected model provider can process the data you send them.

## What is stored or transmitted?

| Data | Storage and transmission |
| --- | --- |
| API key and settings | Stored in Chrome local storage. The extension sends credentials to your configured backend, which forwards them to the selected provider. The backend does not intentionally persist keys. |
| Uploaded PDFs and extracted text | Stored on the configured backend under its storage directory. |
| Text used for generation or embeddings | Sent to the configured model endpoint. Cloud endpoints receive these excerpts. |
| Questions and recent conversation | Sent through the backend to the selected model provider. The open panel retains up to three completed turns for follow-ups. |
| Current paper and summary | Kept in Chrome session storage for panel restoration. |
| Retrieval vectors | Cached in backend memory, bounded to 32 paper/provider index entries. Rebuilt after restart. |

Model-provider retention and training policies depend on the endpoint and account you choose.
Self-hosting the backend does not make cloud inference local.
For local model processing, use a local Ollama endpoint; downloading papers and model weights still involves network access.

## Logs and deployment

The application does not intentionally log API keys or request bodies and includes error-redaction safeguards.
These are not a guarantee against all disclosure. A proxy, hosting provider or custom endpoint may have its own logs.

The backend has no user authentication or per-user storage isolation. Keep it on a private, trusted machine/network.
Do not expose it directly to the public internet. Remote deployments need authentication, HTTPS and restricted access.
Use a backend and model endpoint you trust.

## Your controls

- Clear your API key from extension settings.
- Clear the panel's conversation with **Clear history**; switching papers also clears it.
- Delete an imported paper through the backend API to remove its stored paper data and uploaded PDF copy.
- Clearing extension storage removes saved settings and session results. Keep a copy of any settings you need.
- Contact your model provider separately about data they received; local deletion cannot retract prior requests.

Do not put secrets, sensitive papers or personal information in public bug reports.
This project is a general-purpose reading aid, not a service designed specifically for children.

See the extension manifest for the exact browser permissions.
Questions: open a repository issue without including private data.
