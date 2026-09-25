# PaperKid
### Understand the idea, not just a shorter abstract.

[![CI](https://github.com/AshleyLi-shiya/Open-PaperKid/actions/workflows/ci.yml/badge.svg)](https://github.com/AshleyLi-shiya/Open-PaperKid/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An open-source Chrome paper-reading assistant for curious readers outside their field.
Get a plain-language explanation, then ask about the part that still doesn't make sense.

**Free software, not free cloud inference:** bring your own model API key (provider fees may apply), or use a local Ollama model. A running backend is required.

[Install & read your first paper](docs/QUICKSTART.md) · [中文上手](docs/QUICKSTART.md#中文上手) · [Privacy](PRIVACY.md) · [Report a confusing explanation](https://github.com/AshleyLi-shiya/Open-PaperKid/issues)

## What it helps you understand

- **The problem:** what are the researchers trying to fix?
- **The old way:** what did people try before?
- **The new idea:** how does it work, step by step?
- **The evidence:** what happened, and what remains uncertain?

Choose **summarize in English** or **中文总结**. Only your selected language is generated.
The explanation aims for everyday words and short sentences suitable for ages 8–10.
This is a writing goal, not a validated reading-age guarantee. Check important claims against the paper.

## Read, ask, check

1. Open an arXiv abstract page, or upload a text-based PDF through the extension popup.
2. Choose a summary language.
3. Ask a question, then follow up: “Why does that help?”
4. Check the retrieved excerpts below the answer.

The panel keeps the last three completed question/answer pairs while it stays open.
Switching papers or clearing the chat resets them. Each answer shows whether it used semantic retrieval,
keyword matches, or only the abstract. Excerpts are supporting context, not verified claim-by-claim citations.

## Why use PaperKid?

- Read alongside your paper in a Chrome side panel.
- Choose your model provider or an OpenAI-compatible endpoint.
- Run the backend yourself; use local Ollama inference if desired.
- Inspect and change the code under the MIT license.

This is not a claim of better accuracy than ChatPDF or other assistants.
If you want a hosted tool with no setup, the current self-hosted workflow may not fit you.

## First-time setup

Requires **Node.js 20+**, Chrome, and either a provider API key or a running Ollama model.

```sh
git clone https://github.com/AshleyLi-shiya/Open-PaperKid.git
cd Open-PaperKid/server
npm ci
npm run build
npm start
```

Leave that terminal running. In Chrome, open `chrome://extensions`, enable Developer mode,
click **Load unpacked**, and select the repository's **chrome-extension** folder.

Open the extension's **Options**, configure the provider, and run **Send a test request**.
The **Backend API URL** is `http://localhost:5174`; the **Provider Base URL** is a separate setting.
For custom providers, enter a model available to your account rather than assuming the suggested model is available.

Then open an arXiv abstract page or upload a local PDF. See the [step-by-step guide and troubleshooting](docs/QUICKSTART.md).

## Supported connections

OpenAI · Anthropic · DeepSeek · Qwen · Kimi · GLM · Ollama

An OpenAI-compatible chat endpoint does not necessarily support embeddings.
If semantic retrieval fails, PaperKid tries keyword matching against the paper text.
If nothing matches, it uses only the abstract and labels that limitation.

## Current limits

- Manual Chrome installation and a running backend are required.
- Summaries use selected, budget-limited excerpts, not an exhaustive review of every page.
- PDF text extraction can struggle with scanned pages, formulas, tables and multi-column layouts; no OCR is included.
- Simple explanations can still be wrong or omit nuance. This is a reading aid, not a replacement for the paper.
- No live-model quality benchmark or independently validated reading-age result is published yet.
- The backend has no user authentication. Keep it private; do not expose it directly to the public internet.

## Data and cost

Your API key is stored in Chrome and sent through your configured backend to your selected provider.
The backend does not intentionally persist keys. Cloud providers receive paper excerpts, questions and recent conversation context.
Uploaded PDFs and extracted text are stored on your backend. Local-only model processing requires a local endpoint.
There is no built-in analytics or PaperKid subscription. See [Privacy](PRIVACY.md).

## Help make explanations better

Bring a paper you actually want to understand. Tell us:
1. Which explanation helped something click?
2. Which sentence was still confusing or inaccurate?
3. What would make you use this again?

Please include the paper link, model and language, but **never post API keys or private papers**.
See [the evaluation checklist](docs/EVALUATION.md) for a reproducible comparison.

## For developers

The existing architecture stays small: a plain JavaScript MV3 extension, a Node/TypeScript backend,
JSON-on-disk paper storage and an in-memory retrieval index.

- [Architecture](docs/ARCHITECTURE.md)
- [CLI and advanced setup](docs/SETUP.md)
- [Deployment](docs/DEPLOY.md) — review authentication and network access before hosting.
- [Tests](docs/TESTING.md)
- [Contributing](CONTRIBUTING.md)

```sh
cd server
npm ci
npm test
```

## 中文说明

PaperKid 想做的不是“把论文缩短”，而是帮你弄懂其中的原理。支持 Chrome 侧边栏、本地 PDF 上传、
中英文单语言总结和连续追问。配置页面默认英文，可切换中文。

软件免费开源，但云模型 API 可能收费；也可以使用本地 Ollama。
目前需要自己启动后端并手动加载扩展，不是免安装的在线服务。
讲解以 8–10 岁读者能理解的日常表达为目标，但尚未通过真实读者测试验证，重要结论请核对原文。

使用云端模型时，论文片段和问题会发给所选服务商，并非“内容永不离开本机”。
[中文安装步骤](docs/QUICKSTART.md#中文上手) · [隐私说明](PRIVACY.md)

## License
MIT — see [LICENSE](LICENSE).
