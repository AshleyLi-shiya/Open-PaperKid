# Open-PaperKid

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/AshleyLi-shiya/Open-PaperKid/actions/workflows/ci.yml/badge.svg)](https://github.com/AshleyLi-shiya/Open-PaperKid/actions/workflows/ci.yml)
[![Docker](https://img.shields.io/badge/Docker-open--paperkid--server-blue?logo=docker)](docs/DEPLOY.md)

> **Open-PaperKid** — 开源双语论文助手，让 arxiv 论文变成“小学生都能懂”。
>
> **Open-PaperKid** — an open-source bilingual paper assistant that turns arxiv papers into explanations a middle-schooler can understand.

- 🎯 **BYOK**：默认 OpenAI（ChatGPT），用户自带 API Key，**没有任何收费项**
- 🌐 **7 个 Provider**：OpenAI / Anthropic / DeepSeek / 通义千问 / Kimi / 智谱 GLM / Ollama 本地
- 🈶 **双语总结**：每次同时输出中文 + 英文两版
- 🧒 **简单语言**：小学高年级能读懂，术语自动带白话注解
- 💬 **可问答**：RAG 检索 + 带引用回答，不知道就直说不知道
- 🧩 **Chrome 扩展**：arxiv / OpenReview / Hugging Face Papers 页面右下角一键总结
- 📚 **本地 PDF**：支持本地上传与私有部署
- 🔐 **零隐私泄露**：API Key 只存在浏览器 `chrome.storage.local`，服务端永不记录
- 🪪 **MIT 开源**：可审计、可修改、可商用

---

## 快速开始（Quick Start）

```bash
# 1. 克隆仓库
# 1. Clone the repo
git clone https://github.com/AshleyLi-shiya/Open-PaperKid.git
cd Open-PaperKid

# 2. 启动后端（Node 20+）
# 2. Start the backend (Node 20+)
cd server && npm install && npm run dev

# 3. 安装 Chrome 扩展
# 3. Install the Chrome extension
# chrome://extensions → 开发者模式 / Developer mode → 加载已解压的扩展程序 / Load unpacked → 选 chrome-extension/

# 4. 在扩展设置页填入你的 API Key（默认 OpenAI，可切换其他 Provider）
# 4. Enter your API key in the extension settings (default OpenAI, switchable)

# 5. 打开任意 arxiv 论文页，点右下角 📘 图标
# 5. Open any arxiv paper and click the 📘 icon at the bottom-right
```

更详细的上手、命令行与 Docker 部署见 [docs/SETUP.md](docs/SETUP.md)。

For detailed setup, CLI and Docker deployment, see [docs/SETUP.md](docs/SETUP.md).

---

## 与 ChatPaper 的差异

| 维度 | ChatPaper | Open-PaperKid |
|------|-----------|---------------|
| 默认 LLM | OpenAI 必填 | OpenAI 默认，可切换 |
| 输出语言 | 中文 | **中英双语** |
| 语言风格 | 学术风 | **小学高年级易懂** |
| 交互 | 单向总结 | **总结 + RAG 问答** |
| 形态 | CLI / Flask / Docker | **CLI / REST / Docker / Chrome 扩展** |
| 收费 | 网页版有付费入口 | **完全免费，BYOK** |
| License | AGPL | **MIT** |
| 翻译 | 仅中→英 | **中↔英双向** |

---

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

> **注意**：RAG 问答需要 Embedding。OpenAI 与 Ollama 原生支持 Embedding；其他中文 Provider 目前主要用于总结/翻译，问答时请改用 OpenAI 或 Ollama 作为 Embedding 来源。

---

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

每次请求需要以下 headers（Chrome 扩展会自动带上）：

```
X-Paperkid-Provider: openai | anthropic | deepseek | qwen | kimi | glm | ollama
X-Paperkid-Api-Key:  sk-xxx          # 商业 Provider 必填
X-Paperkid-Base-Url: https://...     # 可选，用于 Ollama 或自定义代理
X-Paperkid-Model:    gpt-4o-mini     # 可选，留空使用推荐模型
```

---

## 项目结构

```
Open-PaperKid/
├── README.md              # 你正在看的 / You are reading it
├── LICENSE                # MIT
├── docker-compose.yml     # 本地一键起服务（可选 Ollama）
├── .github/workflows/     # CI
├── docs/                  # 架构、上手、部署、隐私、安全
├── shared/types.ts        # 前后端共享类型
├── server/                # Node + TypeScript 后端
│   ├── src/
│   │   ├── index.ts       # Express 入口（CORS、限流、健康检查）
│   │   ├── cli.ts         # 命令行工具
│   │   ├── config.ts
│   │   ├── prompts/       # ⭐ 双语简单语言 prompt
│   │   ├── routes/        # REST API
│   │   ├── services/
│   │   │   ├── llm.ts          # ⭐ 多 Provider 注册中心
│   │   │   ├── providerContext.ts  # 请求级 Provider 解析
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
└── chrome-extension/      # MV3，无需构建
    ├── manifest.json
    ├── popup/             # 弹窗
    ├── sidepanel/         # 侧边栏（问答 UI）
    ├── options/           # ⭐ 设置页（Provider + Key）
    ├── content/           # 注入 arxiv 等页面
    └── background/        # service worker
```

---

## 隐私与安全

Open-PaperKid 采用 **BYOK（Bring Your Own Key）** 设计：

- API Key 只存储在浏览器 `chrome.storage.local`，**服务端不持久化、不打印日志**。
- 服务端日志已脱敏，错误信息自动剥离 `sk-...` 等令牌。
- 上传的论文保存在你自己的服务端 `./.open-paperkid-data`，不会传到任何第三方。

详见 [PRIVACY.md](PRIVACY.md) 与 [SECURITY.md](SECURITY.md)。

---

## 贡献

欢迎 Issue 与 PR！请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 与 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

---

## License

MIT — 详见 [LICENSE](LICENSE)。

---

# English

## Quick Start

The fastest way to try Open-PaperKid:

```bash
git clone https://github.com/AshleyLi-shiya/Open-PaperKid.git
cd Open-PaperKid/server
npm install
npm run dev
```

Then load `chrome-extension/` as an unpacked extension, enter your API key in the settings page, and open any arxiv paper.

## Supported Providers

- **OpenAI** (`gpt-4o-mini`, etc.)
- **Anthropic** (`claude-3-5-sonnet-latest`, etc.)
- **DeepSeek** (`deepseek-chat`, etc.)
- **Qwen** (`qwen-plus-latest`, etc.)
- **Kimi** (`moonshot-v1-8k`, etc.)
- **Zhipu GLM** (`glm-4-flash`, etc.)
- **Ollama** (local, free)

Default provider is **OpenAI**. Users supply their own API keys; Open-PaperKid does not charge anything.

## REST API Headers

Every request that needs an LLM must include:

```
X-Paperkid-Provider: openai | anthropic | deepseek | qwen | kimi | glm | ollama
X-Paperkid-Api-Key:  sk-xxx
X-Paperkid-Base-Url: optional
X-Paperkid-Model:    optional
```

## Privacy & Security

Open-PaperKid is BYOK:

- API keys live only in your browser (`chrome.storage.local`).
- The server never persists or logs keys.
- Papers are stored on your own server at `./.open-paperkid-data`.

See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

MIT — see [LICENSE](LICENSE).
