# Hướng dẫn quy trình làm việc nhóm (Team Workflow) với CI/CD Jenkins

Tài liệu này hướng dẫn các thành viên trong nhóm cách lấy code, phát triển, và kích hoạt quy trình tự động triển khai (Deploy) thông qua Jenkins cho môn **Kiểm chứng phần mềm (KCPM)**.

---

## 1. Mô hình hoạt động chung

Nhóm chúng ta đang sử dụng mô hình **CI/CD tập trung**:
- **Trưởng nhóm (hoặc người giữ máy chủ Jenkins)**: Đã cài đặt sẵn Jenkins và cấu hình Webhook (thông qua `smee.io`). Máy này đóng vai trò là Server chung.
- **Các thành viên (Dev/QA)**: Không cần cài đặt Jenkins trên máy cá nhân! Các bạn chỉ cần viết code, viết kịch bản test (Postman, Selenium...), và đẩy (push) lên GitHub. Hệ thống sẽ tự động làm phần còn lại.

---

## 2. Quy trình làm việc của thành viên (Dev / QA)

### Bước 1: Kéo code mới nhất về máy
Mở Terminal / Git Bash và chạy:
```bash
git clone https://github.com/Mutrapro-KCPM/mutrapro_system_testing.git
cd mutrapro_system_testing
git checkout dev
git pull origin dev
```

### Bước 2: Chạy hệ thống dưới máy Local (Tùy chọn)
Nếu bạn muốn chạy thử ứng dụng trên máy tính của mình để viết Test Script, bạn chỉ cần dùng Docker (không cần Jenkins):
```bash
#chạy terminal 2 với lệnh 
npx smee-client --url https://smee.io/6FiZDsf2Zv9uvyby --target "http://127.0.0.1:8080/github-webhook/?smee=1"
###để jenkinss của thể kết nối được với github
# Đảm bảo Docker Desktop đang chạy
docker compose up -d --build
```
Hệ thống sẽ tự tạo Database (user: `mutrapro_app`, pass: `123456`) và khởi chạy toàn bộ vi dịch vụ.
- Web App: `http://localhost:3000`
- Nifi: `http://localhost:9090`

Khi test xong, bạn có thể tắt bằng lệnh:
```bash
docker compose down
```

### Bước 3: Đẩy code và Tự động Deploy (CI/CD)
Sau khi bạn viết xong code/test script, hãy commit và push lên nhánh `dev` của GitHub:

```bash
git add .
git commit -m "feat: thêm kịch bản test đăng nhập bằng Postman"
git push origin dev
```

**Ngay sau khi bạn nhấn Enter để push:**
1. GitHub sẽ gửi một tín hiệu Webhook ngầm đến máy chủ Jenkins của nhóm.
2. Jenkins sẽ tự động thức dậy, thực hiện các bước:
   - Kéo code mới nhất của bạn về.
   - Xóa bỏ hoàn toàn Database cũ (để môi trường test luôn sạch sẽ 100%).
   - Build lại toàn bộ Docker Images có chứa code mới của bạn.
   - Deploy hệ thống lên máy chủ Jenkins.
   - Quét Health Check để đảm bảo các dịch vụ (Database, Auth, Api-Gateway...) đều hoạt động màu xanh (Healthy).

### Bước 4: Kiểm tra kết quả
- Hệ thống thực tế sẽ chạy trên địa chỉ IP/Domain của máy chủ Jenkins (hãy hỏi Trưởng nhóm để lấy link truy cập Web App đang chạy thật).
- Nếu Trưởng nhóm cung cấp tài khoản Jenkins, bạn có thể truy cập vào Dashboard của Jenkins, nhấn vào Pipeline `#Build_Number` và xem **Console Output** để biết code của mình đã được deploy thành công (Màu xanh) hay thất bại (Màu đỏ).

---

## 3. Lưu ý quan trọng cho nhóm

1. **Không sửa `init.sql` và `Dockerfile` nếu không cần thiết:** Môi trường đã được tối ưu hóa để chạy tự động hoàn hảo (khắc phục lỗi Docker-in-Docker). Tránh chỉnh sửa các file hạ tầng nếu không hiểu rõ.
2. **Luôn đợi Health Check:** Sau khi hệ thống khởi động, MySQL cần khoảng 30-40 giây để khởi tạo hoàn chỉnh. Nếu viết code Auto Test (Selenium), hãy thêm lệnh `sleep` hoặc cơ chế chờ server phản hồi trước khi bắt đầu test.
3. **Database luôn bị reset:** Mỗi lần có người push code mới lên GitHub, Jenkins sẽ XÓA SẠCH dữ liệu MySQL để tạo môi trường test mới. Đừng lưu trữ dữ liệu quan trọng trực tiếp trên môi trường này mà không có kịch bản tạo dữ liệu tự động.
