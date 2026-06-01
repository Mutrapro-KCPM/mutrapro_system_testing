# Sử dụng base image Node.js
FROM node:20-alpine

# Đặt thư mục làm việc trong container
WORKDIR /app

# Sao chép package.json và package-lock.json từ đúng vị trí của nó
COPY services/file-service/package*.json ./

# Cài đặt dependencies
RUN npm install

# Sao chép thư mục shared từ gốc vào
COPY shared ./shared

# Sao chép toàn bộ code của auth-service vào
COPY services/file-service/ .

# Lệnh để khởi động service
CMD ["node", "index.js"]