FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY dist ./dist
EXPOSE 8789
CMD ["node", "dist/index.js"]