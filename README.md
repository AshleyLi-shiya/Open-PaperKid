# PaperKid

> **Bilingual simple-language paper assistant.** Open-source · BYOK · MIT

把 arxiv 论文变成"小学高年级能听懂的总结"——双语输出，支持中英互译、可问答，可以装到 Chrome 浏览器里直接读，也可以命令行 / REST API 调用。

- 🎯 **默认 ChatGPT**(OpenAI),用户填自己的 API Key,**不收任何费用**
- 🌐 **支持 4 个 Provider**:OpenAI / Anthropic / DeepSeek / Ollama(本地免费)
- 🈶 **双语总结**:每次都同时输出中文 + 英文两版
- 🧒 **简单语言**:小学高年级能听懂,术语带白话注解
- 💬 **可问答**:基于 RAG,带引用,不知道就说不知道
- 🧩 **Chrome 扩展**:arxiv / OpenReview / HF Papers 页面右下角一键总结
- 📚 **本地 PDF**:本地文件也可以丢进去
- 🔐 **零隐私泄露**:Key 只在你的浏览器里,服务端**永不记录**
- 🪪 **开源**:MIT License,你可以审计、修改、部署

## 与 ChatPaper 的对比

| 维度 | ChatPaper | PaperKid |
|------|-----------|----------|
| 默认 LLM | OpenAI 必填 Key | OpenAI 默认(可换) |
| 输出语言 | 中文 | **中英双语** |
| 总结语言风格 | 学术风 | **小学高年级** |
| 交互 | 单向总结 | 单向 + **RAG 问答** |
| 形态 | CLI / Flask / Docker | CLI / REST / Docker / **Chrome 扩展** |
| 收费项 | 网页版付费入口 | **零付费** |
| License | AGPL (v3.0+) | **MIT** |
| 论文源 | arxiv + Scholar + 本地 | arxiv + 本地(可扩展) |
| 翻译 | 仅中→英 | **中↔英双向** |

## 快速开始(用户视角)

```bash
# 1. 安装 Ollama(可选,本地免费路径)
ollama serve
ollama pull qwen2.5:7b
ollama pull nomic-embed-text

# 2. 启动后端
cd server && npm install && npm run dev

# 3. 装 Chrome 扩展
# chrome://extensions → 开发者模式 → 加载 chrome-extension/

# 4. 在扩展设置页填 API Key(默认 OpenAI,可换)
# 5. 打开 arxiv 论文页,点右下角 📘 PaperKid 总结
```

详细:[docs/SETUP.md](docs/SETUP.md)

## 给开发者:快速部署上线

| 场景 | 推荐 | 文档 |
|------|------|------|
| 自己机器 | Docker Compose | [DEPLOY.md](DEPLOY.md#docker-compose) |
| 朋友用 | Fly.io 一键 | [DEPLOY.md](DEPLOY.md#flyio) |
| 公开多人 | Railway | [DEPLOY.md](DEPLOY.md#railway) |
| 完全可控 | Kubernetes / 自有服务器 | [DEPLOY.md](DEPLOY.md#kubernetes) |

## REST API 概览

```
GET    /api/health                    # 健康检查
GET    /api/providers                 # 列出支持的 Provider
POST   /api/providers/validate        # 测试 Provider 连通性
GET    /api/papers                    # 已导入的论文
POST   /api/papers/ingest             { arxivId | filePath }
POST   /api/papers/ingest-local-upload { filename, b64 }
POST   /api/papers/:id/summarize      { language }
POST   /api/papers/:id/translate      { targetLanguage }
POST   /api/papers/:id/ask            { question, language }
DELETE /api/papers/:id
```

每次请求需要这些 headers(扩展自动发送):

```
X-Paperkid-Provider: openai | anthropic | deepseek | ollama
X-Paperkid-Api-Key:  sk-xxx          # 仅 Anthropic/OpenAI/DeepSeek 需要
X-Paperkid-Base-Url: https://...     # 可选,Ollama / 自定义代理
X-Paperkid-Model:    gpt-4o-mini     # 可选,留空用推荐
```

## 项目结构

```
paperkid/
├── README.md              # 你正在看的
├── LICENSE                # MIT
├── docker-compose.yml     # 本地一键起服务(可选 Ollama)
├── .github/workflows/     # CI
├── docs/                  # 架构、上手、部署、隐私、安全
├── shared/types.ts        # 前后端共享类型
├── server/                # Node + TypeScript 后端
│   ├── src/
│   │   ├── index.ts       # Express 入口(含 CORS、限流、健康检查)
│   │   ├── cli.ts         # 命令行
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
└── chrome-extension/      # MV3,无构建步骤
    ├── manifest.json
    ├── popup/             # 弹窗
    ├── sidepanel/         # 侧边栏(承载问答 UI)
    ├── options/           # ⭐ 设置页(Provider + Key)
    ├── content/           # 注入 arxiv 等页面
    └── background/        # service worker
```

## 隐私与安全

PaperKid 是 BYOK 设计:
- **API Key 只在你的浏览器 chrome.storage.local** 里,服务端**从不持久化**,**从不写日志**。
- 服务端日志里的 provider header 已脱敏,错误信息自动剥离 `sk-...` 类令牌。
- 上传的论文存在你自己的服务端 `./.paperkid-data`,不会传到任何第三方。

详见:[PRIVACY.md](PRIVACY.md)、[SECURITY.md](SECURITY.md)

## License

MIT — 见 [LICENSE](LICENSE)。欢迎二次开发、衍生项目、二次分发。

## Star History

如果 PaperKid 对你有帮助,右上角点个 ⭐ 让我们知道!