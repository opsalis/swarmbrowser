FROM node:22-slim AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json *.ts ./
RUN npx tsc

FROM node:22-slim
# Install Chromium
RUN apt-get update && apt-get install -y \
  chromium \
  fonts-liberation \
  fonts-noto-color-emoji \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdrm2 \
  libgbm1 \
  libnss3 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  --no-install-recommends && \
  rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 3500
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
