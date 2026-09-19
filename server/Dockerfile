# syntax=docker/dockerfile:1.7

# Build from the repository root so we can include both `server/` and `shared/`.
# Example:
#   cd Open-PaperKid
#   docker build -t open-paperkid-server -f server/Dockerfile .

# ---- Stage 1: build ----
FROM node:20-alpine AS build
WORKDIR /app

# 1. Install server dependencies
COPY server/package.json server/package-lock.json* ./server/
WORKDIR /app/server
RUN npm ci || npm install

# 2. Copy source files
WORKDIR /app
COPY server/tsconfig.json ./server/
COPY server/src ./server/src
COPY shared ./shared

# 3. Compile TypeScript
WORKDIR /app/server
RUN npm run build

# ---- Stage 2: runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY server/package.json server/package-lock.json* ./server/
WORKDIR /app/server
RUN npm ci --omit=dev || npm install --omit=dev

WORKDIR /app
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/shared ./shared

EXPOSE 5174
VOLUME ["/data"]
ENV STORAGE_DIR=/data

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:5174/api/health || exit 1

USER node
CMD ["node", "server/dist/server/src/index.js"]
