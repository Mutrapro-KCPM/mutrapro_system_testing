FROM node:20-alpine

ENV NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_FACTOR=2 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=10000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000

WORKDIR /app

COPY services/task-service/package*.json ./

RUN npm install

COPY shared ./shared

COPY services/task-service/ .

CMD ["node", "index.js"]
