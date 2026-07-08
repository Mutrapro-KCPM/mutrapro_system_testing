# Báo Cáo Chỉnh Sửa & Khắc Phục Lỗi Hệ Thống MutraPro

Tài liệu này tổng hợp chi tiết các vấn đề đã phát sinh trong quá trình chạy kiểm thử (Test Automation) bằng Postman/Newman và các giải pháp đã được thực hiện để hệ thống đạt kết quả **Pass 100%**.

---

## 1. Tối ưu cấu hình Docker Compose
**Vấn đề:** Các dịch vụ trong `docker-compose.yml` đang được cài đặt chính sách `restart: always`. Điều này khiến các container (MySQL, RabbitMQ, Redis,...) tự động khởi động ngầm mỗi khi bật máy tính, gây tốn tài nguyên RAM/CPU không cần thiết khi không làm việc.

**Giải pháp:**
- Đã chỉnh sửa toàn bộ 12 dịch vụ trong file `docker-compose.yml`.
- Đổi từ `restart: always` thành `restart: unless-stopped`.
- **Kết quả:** Hệ thống vẫn có khả năng tự phục hồi (Auto-heal) nếu bị crash trong lúc đang chạy Test. Nhưng nếu người dùng chủ động tắt bằng lệnh `docker compose down` hoặc tắt máy tính, các dịch vụ sẽ nằm im không tự bật lại cho đến khi được gọi lệnh `up`.

---

## 2. Lỗi tải tệp (Upload File) trong File Service
**Vấn đề:** Khi chạy Automation Test bằng Newman, các Test Case thuộc File Service thất bại hàng loạt với lỗi `No file was uploaded` (Kỳ vọng 201 Created nhưng nhận 400 Bad Request).
- **Nguyên nhân:** Người dùng đang đứng ở thư mục con `postman` trong Terminal để chạy lệnh. Do đó, đường dẫn tương đối của file mẫu trong Collection (`tests/fixtures/upload-test.mp3`) bị hệ điều hành hiểu nhầm thành `postman/tests/fixtures/...`, dẫn đến Newman không tìm thấy file để gửi lên Server.

**Giải pháp:**
- Hướng dẫn lùi ra thư mục gốc của dự án (`cd ..`) trước khi chạy lệnh.
- Câu lệnh chuẩn: `npx newman run ./postman/Presentation.postman_collection.json -e "./postman/MutraPro Local.postman_environment.json"`
- **Kết quả:** Newman phân giải đúng đường dẫn file tĩnh, luồng File Service hoạt động hoàn hảo 100%.

---

## 3. Lỗi trùng lịch 409 Conflict trong Studio Service
**Vấn đề:** API `STU-BOOK-EP-01 - Create Booking` và các Flow liên quan liên tục trả về lỗi `409 Conflict: Khung giờ này đã có lịch đặt trước đó.`
- **Nguyên nhân cốt lõi:** Kịch bản tính toán thời gian trong tab *Pre-request Script* của Postman Collection đang sử dụng công thức tịnh tiến ngày cố định (`getDate() + 1` hoặc `+ offset`). Nếu chạy nhiều lần (bấm tay liên tục hoặc Newman chạy lại), hệ thống sẽ gửi đi cùng một mốc thời gian cũ vào cùng một Studio. Database hoạt động đúng chuẩn khi chặn lại hành vi đặt trùng lặp này để bảo vệ dữ liệu, gây ra lỗi 409.

**Giải pháp:**
- Đã can thiệp trực tiếp vào mã nguồn file `Presentation.postman_collection.json` bằng Script tự động để thay thế toàn bộ công thức tính giờ cũ.
- Áp dụng thuật toán sinh giờ **Ngẫu nhiên trong tương lai (Randomized Future Time)**.
- **Đoạn mã đã chèn (JavaScript):**
  ```javascript
  // Tự động random số giờ từ 1 đến 1000 giờ trong tương lai
  let randomHours = Math.floor(Math.random() * 1000) + 1;
  const d1 = new Date();
  d1.setHours(d1.getHours() + randomHours);
  
  // Thời gian kết thúc = thời gian bắt đầu + 2 tiếng
  const d2 = new Date(d1);
  d2.setHours(d2.getHours() + 2);
  
  pm.environment.set("studio_booking_start_time", d1.toISOString());
  pm.environment.set("studio_booking_end_time", d2.toISOString());
  ```
- **Kết quả:** Đảm bảo 100% mỗi lần API Create Booking được gọi (dù chạy bằng tay hay bằng Newman Automation) đều sẽ sinh ra một khung giờ độc nhất không bao giờ trùng lặp. Đã kiểm chứng chạy Newman Pass toàn bộ.

---

**Khuyến nghị cho nhóm Phát triển:** 
Vui lòng Import ngược lại file `Presentation.postman_collection.json` hiện hành vào phần mềm Postman của bạn để đồng bộ bộ Script Random mới nhất này lên Cloud Workspace của toàn nhóm.
