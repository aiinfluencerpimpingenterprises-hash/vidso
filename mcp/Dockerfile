# Vidso MCP server (Railway / Docker)
FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY src ./src
ENV NODE_ENV=production
ENV PORT=8787
EXPOSE 8787
CMD ["node", "src/index.js"]
