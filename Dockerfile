# ── build stage ─────────────────────────────────────────────────────────────
# Installs build tools so native addons (better-sqlite3) compile on any arch,
# including Raspberry Pi (linux/arm64, linux/arm/v7).
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# ── runtime stage ────────────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules

COPY src/node ./src/node
COPY src/MobileLmStudio/wwwroot ./src/MobileLmStudio/wwwroot
COPY src/MobileLmStudio/appsettings.json ./appsettings.json

VOLUME ["/data"]

EXPOSE 5080

ENV NODE_ENV=production

CMD ["node", "src/node/server.js"]
