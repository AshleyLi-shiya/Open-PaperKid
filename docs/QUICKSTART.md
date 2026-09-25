# Read your first paper

PaperKid currently needs a running backend and a manually loaded Chrome extension.
You do not need to modify the code, but you do need Node.js 20+ and a terminal.
Cloud API fees are separate from this free software. Keep the backend private.

## 1. Download and start

Use Git, or choose **Code → Download ZIP** on the repository and extract it.
Open a terminal in the extracted repository's `server` folder:

```sh
npm ci
npm run build
npm start
```

Leave the terminal running. Open `http://localhost:5174/api/health` in your browser.
You should see JSON containing `"status":"ok"`.

## 2. Load Chrome extension

1. Enter `chrome://extensions` in Chrome's address bar.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select **chrome-extension** inside the repository (not the entire repository).
5. Pin PaperKid from Chrome's extensions menu if desired.

## 3. Configure and test

Right-click PaperKid's icon → **Options**.

| Setting | What to enter |
| --- | --- |
| Backend API URL | `http://localhost:5174` for the backend started above |
| Provider | Your model provider, or Ollama for local inference |
| Provider Base URL | Only the provider's API endpoint; this is not the backend URL |
| Model | A model available on your account; suggestions are not availability guarantees |
| API key | Your provider's key; leave blank for local Ollama |

Click **Save**, then **Send a test request**. A connection test can use billable API tokens.
For an OpenAI-compatible endpoint, use its documented base URL and exact model ID.
For local Ollama, start Ollama and pull a chat model first; enter its model name and
`http://127.0.0.1:11434` as the provider URL. Embeddings are optional: keyword retrieval works without them.

## 4. Read and ask

Open an arXiv abstract page and click PaperKid's button. After import, choose
**summarize in English** or **中文总结**. Alternatively, open the extension popup and upload a local PDF.
Use a text-based PDF first; scanned pages require OCR that PaperKid does not provide.

Ask a specific question, then try “Why does that help?” The panel uses the last three completed turns, with long messages shortened to fit the model context.
Check each answer's source excerpts and retrieval label. **Abstract only** means no matching body text was found.
**Clear history** or switching papers resets the conversation; closing the panel also loses its chat history.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Cannot reach backend | Keep the server terminal open; visit the health URL above |
| Connection test fails | Check provider URL, key, model access and account quota |
| Summaries work but semantic retrieval does not | Your provider may lack the expected embedding API; keyword fallback is available |
| No text / incomplete paper | Try a text-based PDF; compare extracted source excerpts with the original |
| Changes are not visible | Rebuild and restart the backend; click Reload in `chrome://extensions` and reopen the panel |

Never paste keys into an issue. Share error text only after removing credentials and private content.

## 中文上手

1. 仓库页面选择 **Code → Download ZIP** 并解压，或使用 Git 克隆。
2. 安装 Node.js 20+，在项目的 `server` 目录依次运行 `npm ci`、`npm run build`、`npm start`，保持终端开启。
3. 打开 `http://localhost:5174/api/health`，确认返回 `status: ok`。
4. Chrome 打开 `chrome://extensions`，开启开发者模式，选择“加载已解压的扩展程序”，选中项目的 `chrome-extension` 文件夹。
5. 右键插件图标进入 Options，可以把 Language 切换为简体中文。
6. 后端地址保留 `http://localhost:5174`；服务商 Base URL 填模型接口地址，二者不要混淆。
7. 填入服务商、可用模型和 API Key，保存并测试。云 API 可能收费；本地 Ollama 无需 Key。
8. 导入 arXiv 论文或在弹窗上传文本型 PDF，点击所需语言的总结按钮。
9. 支持最近三轮连续追问；切换论文、清空或关闭侧边栏会清除对话上下文。请留意“关键词匹配”或“仅依据摘要”的提示。

软件免费开源，不代表云模型调用免费。云端模型会接收论文片段和问题；不要公开暴露无鉴权的后端。
