FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/node ./src/node
COPY src/MobileLmStudio/wwwroot ./src/MobileLmStudio/wwwroot
COPY src/MobileLmStudio/appsettings.json ./appsettings.json

VOLUME ["/data"]

EXPOSE 5080

ENV NODE_ENV=production

CMD ["node", "src/node/server.js"]
