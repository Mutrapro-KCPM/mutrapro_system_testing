FROM node:18-alpine

WORKDIR /app

COPY services/task-service/package*.json ./

RUN npm install

COPY shared ./shared

COPY services/task-service/ .

CMD ["node", "index.js"]