# 架构

## 总览

Open-PaperKid 拆成两块可独立运行的代码:**后端服务**（Node + TypeScript）和 **Chrome 扩展**（MV3，无构建步骤）。两者通过 HTTP / REST 通信。

```
┌──────────────────────────────────────────────────────────────┐
│                  Chrome 扩展（用户机器）                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  popup   │  │ sidepanel│  │ options  │  │ content  │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │             │             │           │
│       └─────────────┴──────┬──────┴─────────────┘           │
│                       │                                      │
│                       ▼                                      │
│              ┌──────────────────┐                             │
│              │  chrome.storage  │  ← API Key 永远只在这里      │
│              │   .local (Key)   │                             │
│              └────────┬─────────┘                             │
│                       │  X-Paperkid-Provider / Api-Key / Model│
└───────────────────────┼──────────────────────────────────────┘
                        │ HTTP REST
                        ▼
┌──────────────────────────────────────────────────────────────┐
│                Open-PaperKid 后端（用户机器或云）                  │
│                                                              │
│   ┌──────────┐   ┌──────────────┐   ┌──────────────────┐   │
│   │ Express  │──▶│ ProviderContext│──▶│ LLM 客户端        │   │
│   │ + CORS   │   │ (每请求新建)   │   │ Ollama / OpenAI  │   │
│   │ + 限流   │   │ Key 不持久化   │   │ / Anthropic /    │   │
│   └────┬─────┘   └──────────────┘   │ DeepSeek / Qwen  │   │
│        │                            │ / Kimi / GLM     │   │
│        │                            └──────────────────┘   │
│        ▼                                                    │
│   ┌─────────────┐  ┌──────────┐  ┌────────────┐             │
│   │ pdfParser   │  │   RAG    │  │  Prompts   │             │
│   │ (pdf-parse) │  │(内存向量)│  │(双语简单语)│             │
│   └─────────────┘  └──────────┘  └────────────┘             │
│                                                              │
│   ┌──────────────────────────────────────────────────┐      │
│   │  Storage (.open-paperkid-data/papers/...)            │      │
│   └──────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────┘
                        │
                        ▼ HTTPS
                ┌───────────────────┐
                │  LLM Provider     │
                │ (OpenAI/Claude/   │
                │  DeepSeek/Ollama) │
                └───────────────────┘
```

## v0.2 关键变化(BYOK 重构)

| 旧版 (v0.1) | 新版 (v0.2) |
|--------------|-------------|
| 服务端从 `apikey.ini` / 环境变量读 Key | 服务端**完全不持有 Key**,从 header 读 |
| 单 provider(OpenAI) | 多 provider 注册中心(OpenAI/Anthropic/DeepSeek/Qwen/Kimi/GLM/Ollama) |
| 单一 `llm` 全局实例 | 每个请求一个 `LlmClient`(`providerContext.ts`) |
| 用户改 Key 需要重启服务 | 用户在扩展设置页改 Key,**立即生效**,无重启 |
| CORS 开放 | CORS 锁定到扩展 origin + 用户配置的 https 域 |
| 无错误脱敏 | `safeErrorMessage` 自动剥离 `sk-...` token |

## 关键模块

### `server/src/services/llm.ts`
- **Provider 注册中心**:`PROVIDERS` 字典描述每个 provider 的 id、推荐模型、是否需要 Key、默认 base URL
- **三个 client 实现**:`OpenAICompatClient`(覆盖 OpenAI / DeepSeek / Qwen / Kimi / GLM / 任意 OpenAI 兼容代理)、`AnthropicClient`、`OllamaClient`
- **`resolveProvider()`**:从原始输入规范化 Provider 配置
- **`createClientFor()`**:工厂方法,返回 `LlmClient`
- **`validateProvider()`**:做一个最小 ping,验证 Key 是否有效

### `server/src/services/providerContext.ts`
- **`providerFromRequest(req)`**:从 `X-Paperkid-*` headers 解析出 provider + client
- **`safeErrorMessage(e)`**:从错误信息中剥离 `sk-...` 和 `Bearer ...`,确保日志和响应不含 Key

### `server/src/prompts/index.ts`
- 所有 prompt 集中在一处
- `SIMPLE_LANGUAGE_RULES`:术语带白话注解、限制句长、禁用营销腔
- 三类任务 prompt:**summary / translate / qa**,中英双语版本

### `server/src/services/rag.ts`
- 内存向量索引(cosine),零外部依赖
- 大规模可换成 sqlite-vss / qdrant,接口不变

### `server/src/index.ts`
- CORS 锁定(chrome-extension: / moz-extension: / loopback / https)
- 每 IP 60 req/min 限流(内存)
- 隐私脱敏的请求日志
- 统一错误处理,**永不**回显 stack trace

### Chrome 扩展

| 文件 | 作用 |
|------|------|
| `manifest.json` | MV3 清单,声明 permissions / host_permissions |
| `popup/` | 工具栏弹窗,检测当前 arxiv id,一键总结 |
| `options/` | 设置页:Provider + Key + 模型 + 测试连通性 |
| `sidepanel/` | 侧边栏,承载问答 UI、翻译结果、双语总结 |
| `content/contentScript.js` | 注入 arxiv / OpenReview / HF Papers 页面,加浮动按钮 |
| `background/background.js` | service worker,跨组件状态管理 + 右键菜单 |
| `lib/apiClient.js` | 统一 fetch wrapper,**自动**从 chrome.storage 取 Key 并写到 header |

## 数据流

### 总结(双语)
```
popup 点击 → 后端读取 PDF → 切章节 → 拼 prompt → 调用 LLM → 输出 JSON →
解析、清洗 → 渲染到侧边栏(中文 + 英文)
```

### 问答
```
用户问题 → 嵌入 → 检索 top-k chunks → 拼上下文 →
喂 LLM → 带 [来源] 返回答案
```

### 翻译
```
逐章节翻译 → 长章节分段 → 拼接 → 返回结构化结果
```

## 为什么这样设计

| 决策 | 原因 |
|------|------|
| BYOK | API Key 不离开用户浏览器,服务端无多账号隔离压力,合规简单 |
| Provider 工厂 + 单一 LlmClient 接口 | 加新 provider(比如 Gemini、Cohere、国产开源 API)只需 20 行 |
| Chrome 扩展无构建步骤 | 直接加载目录即可,降低贡献门槛、易于审计 |
| 内存向量索引 | 个人使用规模够用;大规模可平滑替换 |
| CORS 锁定 | 防止服务端被滥用做 LLM 代理 |
| 错误脱敏 | 即使日志/响应被记录,也不会泄露 Key |

## 不做什么(明确边界)

- ❌ 不做论文质量评判 / 评分
- ❌ 不做自动投稿、自动审稿
- ❌ 不存储用户上传的 PDF 到任何云端
- ❌ 不做账号系统
- ❌ 不收集 telemetry / analytics
- ❌ 不暴露任何"我的论文库"端点(用户的所有数据都在用户机器上)