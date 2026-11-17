FROM node:22-alpine
RUN apk add --no-cache wget
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY dist ./dist
EXPOSE 8789
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8789/api/health || exit 1
CMD ["node", "dist/index.js"]