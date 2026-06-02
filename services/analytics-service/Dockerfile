# File: services/analytics-service/Dockerfile (ĐÃ SỬA LỖI)

FROM node:20-alpine
ENV NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_FACTOR=2 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=10000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000
WORKDIR /app

# 1. Copy CHỈ file package.json của service này vào
COPY services/analytics-service/package*.json ./

# 2. Chạy npm install ĐỂ CÀI express, mysql2, v.v.
RUN npm install

# 3. Copy thư mục shared (vì index.js cần nó)
COPY shared ./shared

# 4. Copy code của service này (index.js)
COPY services/analytics-service/ .

EXPOSE 3008
CMD ["node", "index.js"]
