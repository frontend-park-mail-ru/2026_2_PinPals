FROM node:26-alpine

WORKDIR /app


COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build:templates

RUN npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

USER node

CMD ["node", "server.js"]
