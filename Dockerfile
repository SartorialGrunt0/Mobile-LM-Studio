# ── build stage ─────────────────────────────────────────────────────────────
# Installs build tools so native addons (better-sqlite3) compile on any arch,
# and keeps the runtime compatible with onnxruntime-node for Kokoro.
FROM node:22-bookworm-slim AS builder

ARG ONNXRUNTIME_NODE_INSTALL_CUDA=skip
ENV ONNXRUNTIME_NODE_INSTALL_CUDA=${ONNXRUNTIME_NODE_INSTALL_CUDA}

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# ── runtime stage ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules

COPY src/node ./src/node
COPY src/MobileLmStudio/wwwroot ./src/MobileLmStudio/wwwroot
COPY src/MobileLmStudio/appsettings.json ./appsettings.json

VOLUME ["/data"]

EXPOSE 5080

ENV NODE_ENV=production

CMD ["node", "src/node/server.js"]
