# Sử dụng base image Node.js
FROM node:20-alpine

ENV NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_FACTOR=2 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=10000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000

# Đặt thư mục làm việc trong container
WORKDIR /app

# Sao chép package.json và package-lock.json từ đúng vị trí của nó
COPY services/studio-service/package*.json ./

# Cài đặt dependencies
RUN npm install

# Sao chép thư mục shared từ gốc vào
COPY shared ./shared

# Sao chép toàn bộ code của auth-service vào
COPY services/studio-service/ .

# Lệnh để khởi động service
CMD ["node", "index.js"]
