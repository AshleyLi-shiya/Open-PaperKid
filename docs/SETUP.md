# 快速上手

PaperKid v0.2 起采用 **BYOK**(用户自带 Key)模式。服务端**永不**保存你的 API Key,Key 只在你浏览器的 `chrome.storage.local` 里。

## 三种用户路径

### 路径 A:Chrome 扩展 + 你自己的后端(最常见)

```bash
# 1. 启动后端(选其一)
cd server && npm install && npm run dev        # 开发
# 或 docker compose up -d                       # 容器

# 2. 加载扩展
# chrome://extensions → 开发者模式 → 加载已解压的扩展程序 → 选 chrome-extension/

# 3. 设置 Provider 和 Key
# 右键扩展图标 → 选项 → 选 OpenAI → 填 sk-xxx → 测一次 ping

# 4. 使用
# 打开 arxiv.org/abs/xxxx.xxx → 右下角 📘 PaperKid 总结 → 侧边栏看结果
```

### 路径 B:命令行(开发者友好)

```bash
cd server
npm install

export OPENAI_API_KEY=sk-xxx

# 总结
node --import tsx src/cli.ts summarize --arxiv 2406.01234 --lang both

# 问答
node --import tsx src/cli.ts ask --arxiv 2406.01234 --question "本文的核心贡献是什么？"

# 翻译全文
node --import tsx src/cli.ts translate --arxiv 2406.01234 --target zh

# 切换 provider
node --import tsx src/cli.ts summarize --arxiv 2406.01234 --provider anthropic --api-key sk-ant-xxx --model claude-3-5-sonnet-latest

# 验证
node --import tsx src/cli.ts validate --provider openai
```

### 路径 C:完全本地、零费用(Ollama)

```bash
# 1. 装 Ollama:https://ollama.com
ollama serve &
ollama pull qwen2.5:7b
ollama pull nomic-embed-text

# 2. 启动 PaperKid
cd server && npm install && npm run dev

# 3. 扩展设置里
# Provider = Ollama
# Base URL = http://127.0.0.1:11434
# API Key = (留空)
# Model = qwen2.5:7b
```

## 各 Provider 获取 Key

| Provider | 申请地址 | 默认模型 | 备注 |
|----------|---------|---------|------|
| OpenAI | <https://platform.openai.com/api-keys> | `gpt-4o-mini` | 性价比最高 |
| Anthropic | <https://console.anthropic.com/> | `claude-3-5-sonnet-latest` | 长上下文友好 |
| DeepSeek | <https://platform.deepseek.com/> | `deepseek-chat` | 中文场景便宜 |
| Ollama | (本地) | `qwen2.5:7b` | 零费用、零网络 |

## 配置项(.env,可选)

`server/.env`(从 `.env.example` 复制):

```bash
PORT=5174                  # 监听端口
STORAGE_DIR=./.paperkid-data   # 论文存储位置
MAX_PDF_PAGES=40           # 单篇最大页数(防止误上传超长文档)
MAX_CHUNK_TOKENS=800       # RAG 切分粒度
```

**默认你不需要设任何 LLM Provider 的环境变量**——Key 由扩展从 chrome.storage.local 发过来。

如果你想用 CLI 或测试时强制用某个 provider,设对应的环境变量:

```bash
OPENAI_API_KEY=sk-xxx          # CLI fallback
ANTHROPIC_API_KEY=sk-ant-xxx
DEEPSEEK_API_KEY=sk-xxx
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

## 故障排查

| 现象 | 可能原因 | 解决 |
|------|----------|------|
| 弹窗显示"无法连接" | 后端没启动 / 端口错 | `curl localhost:5174/api/health` |
| 显示"未配置 API Key" | 扩展设置里没填 | 右键扩展 → 选项 → 填 Key |
| 总结/翻译内容为英文 | 模型中文能力弱 | 改用 `qwen2.5:7b`(Ollama)或 `gpt-4o-mini` |
| 问答答非所问 | 嵌入模型没拉 | Ollama: `ollama pull nomic-embed-text`;OpenAI: 自动 |
| Ollama 报"connection refused" | Ollama 没启动 | `ollama serve` |
| 翻译/总结超时 | 论文太长 | 默认 `MAX_PDF_PAGES=40`,调大或拆章节 |

## 下一站

- 想部署到云?看 [DEPLOY.md](DEPLOY.md)
- 想改 prompt 风格?看 [PROMPTS.md](PROMPTS.md)
- 想了解安全模型?看 [SECURITY.md](SECURITY.md) 和 [PRIVACY.md](PRIVACY.md)
- 想贡献?看 [CONTRIBUTING.md](../CONTRIBUTING.md)