FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=8080
ENV AUTH_API_TARGET=http://auth_service:8000
ENV PIN_API_TARGET=http://pin_service:8000
ENV USER_API_TARGET=http://user_service:8000
EXPOSE 8080

USER node
CMD ["node", "server.js"]