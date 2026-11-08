FROM node:26-alpine

WORKDIR /app


COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

RUN npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=8080
ENV API_TARGET=http://161.104.105.76:8000
EXPOSE 8080

USER node

CMD ["node", "server.js"]
