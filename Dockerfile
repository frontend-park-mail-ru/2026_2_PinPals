FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY . .
RUN npm install && npm run build && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=8080
ENV API_TARGET=http://localhost:8002
EXPOSE 8080

USER node
CMD ["node", "server.js"]