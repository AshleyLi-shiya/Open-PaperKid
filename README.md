# Open-PaperKid

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/AshleyLi-shiya/Open-PaperKid/actions/workflows/ci.yml/badge.svg)](https://github.com/AshleyLi-shiya/Open-PaperKid/actions/workflows/ci.yml)
[![Docker](https://img.shields.io/badge/Docker-open--paperkid--server-blue?logo=docker)](docs/DEPLOY.md)

<p>
<details open>
<summary><b>English</b></summary>

<br>

Open-PaperKid is an open-source bilingual paper assistant that turns arxiv papers into explanations a middle-schooler can understand.

## ✨ Key Features

- 🎯 **BYOK (Bring Your Own Key)** — defaults to OpenAI (ChatGPT). No paid tiers, no hidden fees.
- 🌐 **7 Providers** — OpenAI / Anthropic / DeepSeek / Qwen / Kimi (Moonshot) / Zhipu GLM / Ollama (local)
- 🈶 **Choose your summary language** — click “summarize in English” or “中文总结” to generate only that language, explained for ages 8–10. Settings default to English, with a saved Chinese language option.
- 🧒 **Simple Language** — written so a 5th-grader can follow, with plain-language glosses for jargon
- 💬 **Ask Questions** — RAG-grounded Q&A with citations; says "I don't know" when it doesn't know
- 🧩 **Chrome Extension** — one-click summary on arxiv / OpenReview / Hugging Face Papers pages
- 📚 **Local PDFs** — upload your own PDFs; fully self-hostable
- 🔐 **Privacy First** — API keys live only in your browser's local storage; the server never persists or logs them
- 🪪 **MIT Licensed** — auditable, modifiable, commercial-friendly

## Quick Start

Runtime fixes and repeatable smoke tests are documented in [docs/TESTING.md](docs/TESTING.md).

```bash
# 1. Clone the repo
git clone https://github.com/AshleyLi-shiya/Open-PaperKid.git
cd Open-PaperKid

# 2. Start the backend (Node 20+)
cd server && npm install && npm run dev

# 3. Install the Chrome extension
# chrome://extensions → Developer mode → Load unpacked → select chrome-extension/

# 4. Enter your API key in the extension settings
#    (OpenAI by default, switchable to other providers)

# 5. Open any arxiv paper and click the 📘 icon at the bottom-right
```

For detailed setup, CLI and Docker deployment, see [docs/SETUP.md](docs/SETUP.md).

## Supported Providers

| Provider | Type | API Key | Recommended Model |
|----------|------|---------|-------------------|
| **OpenAI** | Cloud | ✅ | `gpt-4o-mini` |
| **Anthropic** | Cloud | ✅ | `claude-3-5-sonnet-latest` |
| **DeepSeek** | Cloud | ✅ | `deepseek-chat` |
| **Qwen** | Cloud | ✅ | `qwen-plus-latest` |
| **Kimi (Moonshot)** | Cloud | ✅ | `moonshot-v1-8k` |
| **Zhipu GLM** | Cloud | ✅ | `glm-4-flash` |
| **Ollama** | Local, free | ❌ | `qwen2.5:7b` |

> **Note:** RAG Q&A requires embeddings. OpenAI and Ollama natively support embeddings; other providers are best used for summarization/translation.

## REST API

```
GET    /api/health                    # health check
GET    /api/providers                 # list supported providers
POST   /api/providers/validate        # test provider connectivity
GET    /api/papers                    # list ingested papers
POST   /api/papers/ingest             { arxivId | filePath }
POST   /api/papers/ingest-local-upload { filename, b64 }
POST   /api/papers/:id/summarize      { language: zh | en | both }
POST   /api/papers/:id/translate      { targetLanguage: zh | en }
POST   /api/papers/:id/ask            { question, language }
DELETE /api/papers/:id
```

Every LLM request must include these headers (the Chrome extension sends them automatically):

```
X-Paperkid-Provider: openai | anthropic | deepseek | qwen | kimi | glm | ollama
X-Paperkid-Api-Key:  sk-xxx          # required for cloud providers
X-Paperkid-Base-Url: https://...     # optional, for Ollama or custom proxies
X-Paperkid-Model:    gpt-4o-mini     # optional, falls back to recommended model
```

## Project Structure

```
Open-PaperKid/
├── README.md              # you are here
├── LICENSE                # MIT
├── docker-compose.yml     # one-command local deployment (optional Ollama)
├── .github/workflows/     # CI
├── docs/                  # architecture, setup, deployment, privacy, security
├── shared/types.ts        # shared types between server and extension
├── server/                # Node + TypeScript backend
│   ├── src/
│   │   ├── index.ts       # Express entry (CORS, rate limit, health check)
│   │   ├── cli.ts         # CLI tool
│   │   ├── config.ts
│   │   ├── prompts/       # ⭐ bilingual simple-language prompts
│   │   ├── routes/        # REST API
│   │   ├── services/
│   │   │   ├── llm.ts          # ⭐ multi-provider registry
│   │   │   ├── providerContext.ts  # per-request provider resolution
│   │   │   ├── pdfParser.ts
│   │   │   ├── arxiv.ts
│   │   │   ├── rag.ts
│   │   │   ├── summarize.ts
│   │   │   ├── translate.ts
│   │   │   ├── qa.ts
│   │   │   └── storage.ts
│   │   └── utils/
│   ├── Dockerfile
│   └── package.json
└── chrome-extension/      # MV3, no build step
    ├── manifest.json
    ├── popup/             # popup
    ├── sidepanel/         # side panel (Q&A UI)
    ├── options/           # ⭐ settings (provider + key)
    ├── content/           # injected into arxiv etc.
    └── background/        # service worker
```

## Privacy & Security

Open-PaperKid is BYOK by design:

- API keys live only in your browser (`chrome.storage.local`); the server never persists or logs them.
- Server logs are sanitized — `sk-...` tokens are stripped from error messages.
- Uploaded papers stay on your own server at `./.open-paperkid-data`.

See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

## Contributing

Issues and PRs are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first.

## License

MIT — see [LICENSE](LICENSE).

</details>

<details>
<summary><b>中文说明</b></summary>

<br>

Open-PaperKid 是一个开源双语论文助手，让 arxiv 论文变成"小学生都能懂"的讲解。

## ✨ 核心特点

- 🎯 **BYOK 自带钥匙**：默认 OpenAI（ChatGPT），用户自带 API Key，**没有任何收费项**
- 🌐 **7 个 Provider**：OpenAI / Anthropic / DeepSeek / 通义千问 / Kimi / 智谱 GLM / Ollama 本地
- 🈶 **选择总结语言**：英文按钮在前，点击 “summarize in English” 或“中文总结”后，只生成所选语言，用面向 8–10 岁孩子的日常语言解释。配置页默认英文，可切换并保存中文偏好。
- 🧒 **简单语言**：小学高年级能读懂，术语自动带白话注解
- 💬 **可问答**：RAG 检索 + 带引用回答，不知道就直说不知道
- 🧩 **Chrome 扩展**：arxiv / OpenReview / Hugging Face Papers 页面右下角一键总结
- 📚 **本地 PDF**：支持本地上传与私有部署
- 🔐 **零隐私泄露**：API Key 只存在浏览器 `chrome.storage.local`，服务端永不记录
- 🪪 **MIT 开源**：可审计、可修改、可商用

## 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/AshleyLi-shiya/Open-PaperKid.git
cd Open-PaperKid

# 2. 启动后端（Node 20+）
cd server && npm install && npm run dev

# 3. 安装 Chrome 扩展
# chrome://extensions → 开发者模式 → 加载已解压的扩展程序 → 选 chrome-extension/

# 4. 在扩展设置页填入你的 API Key（默认 OpenAI，可切换其他 Provider）

# 5. 打开任意 arxiv 论文页，点右下角 📘 图标
```

更详细的上手、命令行与 Docker 部署见 [docs/SETUP.md](docs/SETUP.md)。

## 支持的模型 Provider

| Provider | 类型 | 需要 API Key | 推荐模型 |
|----------|------|--------------|----------|
| **OpenAI** | 商业 | ✅ | `gpt-4o-mini` |
| **Anthropic** | 商业 | ✅ | `claude-3-5-sonnet-latest` |
| **DeepSeek** | 商业 | ✅ | `deepseek-chat` |
| **通义千问 Qwen** | 商业 | ✅ | `qwen-plus-latest` |
| **Kimi (Moonshot)** | 商业 | ✅ | `moonshot-v1-8k` |
| **智谱 GLM** | 商业 | ✅ | `glm-4-flash` |
| **Ollama** | 本地免费 | ❌ | `qwen2.5:7b` |

> **注意**：RAG 问答需要 Embedding。OpenAI 与 Ollama 原生支持 Embedding；其他 Provider 目前主要用于总结/翻译。

## REST API

```
GET    /api/health                    # 健康检查
GET    /api/providers                 # 列出支持的 Provider
POST   /api/providers/validate        # 测试 Provider 连通性
GET    /api/papers                    # 已导入的论文列表
POST   /api/papers/ingest             { arxivId | filePath }
POST   /api/papers/ingest-local-upload { filename, b64 }
POST   /api/papers/:id/summarize      { language: zh | en | both }
POST   /api/papers/:id/translate      { targetLanguage: zh | en }
POST   /api/papers/:id/ask            { question, language }
DELETE /api/papers/:id
```

每次 LLM 请求需要以下 headers（Chrome 扩展会自动带上）：

```
X-Paperkid-Provider: openai | anthropic | deepseek | qwen | kimi | glm | ollama
X-Paperkid-Api-Key:  sk-xxx          # 商业 Provider 必填
X-Paperkid-Base-Url: https://...     # 可选，用于 Ollama 或自定义代理
X-Paperkid-Model:    gpt-4o-mini     # 可选，留空使用推荐模型
```

## 隐私与安全

Open-PaperKid 采用 **BYOK（Bring Your Own Key）** 设计：

- API Key 只存储在浏览器 `chrome.storage.local`，**服务端不持久化、不打印日志**。
- 服务端日志已脱敏，错误信息自动剥离 `sk-...` 等令牌。
- 上传的论文保存在你自己的服务端 `./.open-paperkid-data`，不会传到任何第三方。

详见 [PRIVACY.md](PRIVACY.md) 与 [SECURITY.md](SECURITY.md)。

## 贡献

欢迎 Issue 与 PR！请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 与 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## License

MIT — 详见 [LICENSE](LICENSE)。

</details>
</p>
