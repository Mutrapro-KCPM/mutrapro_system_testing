# ----- Giai đoạn 1: Build ứng dụng React -----
# Sử dụng một image Node.js để build code
FROM node:20-alpine AS build

# Đặt thư mục làm việc bên trong container
WORKDIR /app

# Sao chép package.json và package-lock.json vào trước
COPY package*.json ./

# Cài đặt các thư viện cần thiết
RUN npm install

# Sao chép toàn bộ mã nguồn của web-app vào
COPY . .

# Chạy lệnh build để tạo ra các file tĩnh
RUN npm run build

# ----- Giai đoạn 2: Serve ứng dụng với Nginx -----
# Sử dụng một image Nginx siêu nhẹ để chạy web server
FROM nginx:stable-alpine

# Sao chép các file tĩnh đã được build từ giai đoạn 1 vào thư mục của Nginx
COPY --from=build /app/build /usr/share/nginx/html

# Xóa file cấu hình mặc định của Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Sao chép file cấu hình nginx của riêng mình vào
COPY nginx/nginx.conf /etc/nginx/conf.d

# Mở port 80 để bên ngoài có thể truy cập
EXPOSE 80

# Lệnh để khởi động Nginx
CMD ["nginx", "-g", "daemon off;"]