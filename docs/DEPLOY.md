# 部署指南

Open-PaperKid 后端可以部署到几乎任何支持 Node 20+ 的平台。**前端的 Chrome 扩展始终由用户本地安装**(不需要你部署)。

## 选择平台

| 场景 | 推荐 | 一键链接 |
|------|------|----------|
| 只想自己用 | 本机 `npm run dev` | - |
| 部署给小圈子(< 100 人) | **Fly.io**(免费额度够用) | [![Deploy on Fly.io](https://img.shields.io/badge/Deploy-Fly.io-blueviolet)](https://fly.io/launch/?docker-image=ghcr.io/AshleyLi-shiya/open-paperkid) |
| 公开上线(预期多人) | **Railway**(按用量付费) | [![Deploy on Railway](https://img.shields.io/badge/Deploy-Railway-railway)](https://railway.app/template/...) |
| 企业内 / 完全可控 | **自己的服务器 + Docker Compose** | 见下文 |
| 高并发 | Kubernetes | 见下文 |

---

## 1. 本地 Docker Compose(开发自用)

```bash
docker compose up -d
# 等几分钟让 Ollama 拉模型
docker exec -it open-paperkid-ollama ollama pull qwen2.5:7b
docker exec -it open-paperkid-ollama ollama pull nomic-embed-text
```

后端跑在 `http://localhost:5174`。

---

## 2. Fly.io(推荐用于小圈子分享)

Fly.io 提供免费额度,**适合 1-50 人的小团队**。Open-PaperKid BYOK 模式下,服务端不需要 GPU。

```bash
# 安装 flyctl: https://fly.io/docs/hands-on/install-flyctl/
fly launch --copy-config --name open-paperkid-YOURNAME
fly deploy
```

`fly.toml` 已包含默认配置。需要的环境变量:

```
PORT=8080                       # Fly 强制 8080
STORAGE_DIR=/data               # 持久卷
```

把 `/data` 挂到 Fly persistent volume:

```toml
# fly.toml
[mounts]
  source = "open_paperkid_data"
  destination = "/data"
```

**注意**:不要在 Fly 上设置 `OPENAI_API_KEY` 等环境变量——Open-PaperKid 是 BYOK,Key 由用户在扩展里填。如果你错误地把 Key 放进环境变量,服务端会忽略它(每次请求从 header 读),所以无大碍。

---

## 3. Railway

```bash
# 一键从 GitHub 部署
# railway.app/new → Deploy from GitHub → 选 Open-PaperKid 仓库
```

Railway 会自动检测 Dockerfile 并部署。挂载 volume:

```
STORAGE_DIR=/data
# 在 Railway dashboard 上 Add Volume → mount at /data
```

---

## 4. 自有服务器 / Docker

```bash
git clone https://github.com/AshleyLi-shiya/Open-PaperKid.git
cd Open-PaperKid
docker build -t open-paperkid-server -f server/Dockerfile .
docker run -d \
  --name open-paperkid \
  -p 5174:5174 \
  -v open-paperkid-data:/data \
  -e PORT=5174 \
  -e STORAGE_DIR=/data \
  --restart unless-stopped \
  open-paperkid-server
```

反向代理建议(nginx 示例):

```nginx
server {
  listen 443 ssl http2;
  server_name open-paperkid.example.com;

  ssl_certificate /etc/letsencrypt/live/open-paperkid.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/open-paperkid.example.com/privkey.pem;

  client_max_body_size 25m;  # PDF base64 上传需要

  location / {
    proxy_pass http://127.0.0.1:5174;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;  # 长论文翻译需要
  }
}
```

---

## 5. Kubernetes

最小化部署(`open-paperkid-deployment.yaml`):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: open-paperkid
spec:
  replicas: 2
  selector:
    matchLabels:
      app: open-paperkid
  template:
    metadata:
      labels:
        app: open-paperkid
    spec:
      containers:
        - name: open-paperkid
          image: ghcr.io/AshleyLi-shiya/open-paperkid:latest
          ports:
            - containerPort: 5174
          env:
            - name: PORT
              value: "5174"
            - name: STORAGE_DIR
              value: "/data"
          volumeMounts:
            - mountPath: /data
              name: open-paperkid-data
          readinessProbe:
            httpGet:
              path: /api/health
              port: 5174
            initialDelaySeconds: 5
            periodSeconds: 10
      volumes:
        - name: open-paperkid-data
          persistentVolumeClaim:
            claimName: open-paperkid-data
---
apiVersion: v1
kind: Service
metadata:
  name: open-paperkid
spec:
  selector:
    app: open-paperkid
  ports:
    - port: 80
      targetPort: 5174
```

---

## 反向代理 + Cloudflare(可选)

把 Open-PaperKid 部署在 `open-paperkid.example.com`,Cloudflare 在前面提供:
- HTTPS
- DDoS 防护
- 缓存静态资源(本项目几乎全 API,缓存意义不大)

确保 Cloudflare 不要把 `x-paperkid-*` headers 过滤掉(默认会保留)。

---

## 健康检查

```
GET /api/health
→ { "status":"ok", "version":"0.2.0", "providers":[...] }
```

建议在 K8s / Railway / Fly 都配 readiness 探针指向此端点。

---

## 升级

```bash
git pull
docker compose pull && docker compose up -d
# or
fly deploy
# or
railway up
```

数据在挂载卷里,升级不会丢。