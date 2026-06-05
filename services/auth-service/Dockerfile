# syntax=docker/dockerfile:1.7
FROM node:20-alpine

ENV NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_FACTOR=2 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=10000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000

WORKDIR /app

COPY services/auth-service/package*.json ./

RUN apk add --no-cache wget
RUN --mount=type=cache,id=mutrapro-npm,target=/root/.npm npm ci --omit=dev

COPY shared ./shared
COPY services/auth-service/ .

CMD ["node", "index.js"]
