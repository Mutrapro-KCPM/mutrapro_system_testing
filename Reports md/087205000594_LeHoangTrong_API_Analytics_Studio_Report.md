# Báo Cáo Kiểm Thử - API Gateway, Analytics Service, Studio Service

**Họ và tên**: Lê Hoàng Trọng  
**MSSV**: 087205000594  

## 1. Phạm vi kiểm thử
Phạm vi kiểm thử tập trung vào 3 dịch vụ trong hệ thống MuTraPro:
- **api-gateway**: Kiểm tra endpoint sức khỏe (health), proxy route và đặc biệt là alias reports để fix lỗi KAN-76. *(Lưu ý: KAN-76 là lỗi gateway forward sai `/api/reports/overview` thành `/overview`, đã fix để forward đúng sang `/reports/overview`)*.
- **analytics-service**: Kiểm tra thống kê dashboard (dashboard stats) và báo cáo tổng quan (reports overview) với các role `admin` và `coordinator`.
- **studio-service**: Kiểm tra danh sách studio, cập nhật trạng thái studio, vòng đời đặt lịch (booking lifecycle) và phân quyền (RBAC).

## 2. Cấu trúc folder Postman mới
Cấu trúc Postman đã được chuẩn hóa thống nhất theo form chuẩn có các nhóm EP, BVA, RBAC / Negative và FlowTests.

- **api-gateway**
  - Kiểm tra sức khỏe (EP, BVA)
  - Proxy báo cáo (EP, Negative)
  - FlowTests - Gateway
- **analytics-service**
  - Set up
  - Thống kê Dashboard (EP, RBAC)
  - Báo cáo tổng quan (EP, RBAC)
  - FlowTests - Analytics
- **studio-service**
  - Set up
  - Danh sách Studio (EP, RBAC)
  - Cập nhật trạng thái Studio (EP, BVA)
  - Đặt lịch Studio (EP, BVA, Negative)
  - FlowTests - Studio

## 3. EP - Phân hoạch lớp tương đương (Equivalence Partitioning)
Các test case hợp lệ (Happy path) được thiết kế cho các chức năng chính:
- **api-gateway**: 
  - `GATE-HC-EP-01`, `GATE-HC-EP-02`: Trả về 200 cho health check.
  - `GATE-RPT-EP-01`, `GATE-RPT-EP-02`: Proxy qua analytics report, trả về đúng định dạng payload có `totalRevenue`, `totalOrders`, `orderStats`.
- **analytics-service**:
  - `AN-STATS-EP-01`, `AN-STATS-EP-02`: Trả về thống kê dashboard cho Admin và Coordinator.
  - `AN-RPT-EP-01`, `AN-RPT-EP-02`: Trả về báo cáo tổng quan cho Admin và Coordinator.
- **studio-service**:
  - `STU-LIST-EP-*`: Lấy danh sách studio và tất cả booking thành công.
  - `STU-STATUS-EP-*`: Cập nhật trạng thái studio sang `available` và `maintenance`.
  - `STU-BOOK-EP-*`: Các bước tạo booking, confirm, reject, và cancel booking.

## 4. BVA - Phân tích giá trị biên (Boundary Value Analysis)
Bao gồm các case biên hoặc không hợp lệ về mặt dữ liệu:
- **api-gateway**: `GATE-HC-BVA-01` (Invalid Path), `GATE-HC-BVA-02` (Wrong Method).
- **studio-service**: 
  - `STU-STATUS-BVA-*`: Trạng thái invalid (`invalid_status`), studio không tồn tại (`999999`), hoặc thiếu trường status.
  - `STU-BOOK-BVA-*`: Tạo booking bị thiếu các trường bắt buộc, thời gian start/end trong quá khứ, hoặc studio không tồn tại.

## 5. RBAC / Negative
Kiểm thử phân quyền truy cập và các trường hợp lỗi nghiệp vụ:
- **api-gateway**: Không có token (`401`), token không hợp lệ (`401`), sai đường dẫn proxy (`404`).
- **analytics-service**: Request không có token hoặc token không hợp lệ bị từ chối (`401`). Role Artist truy cập vào báo cáo bị từ chối (`403`).
- **studio-service**: Role Artist không có quyền xem tất cả bookings (`403`). Các thao tác confirm/reject/cancel trên booking không tồn tại (`404`). *Một số negative case dùng expected theo behavior hiện tại nếu API chưa validate chặt.*

## 6. FlowTests
Các luồng kiểm thử (Integration/Flow) để đảm bảo tính liên kết:
- **GATE-FLOW-01**: Gateway Reports Happy Path.
- **AN-FLOW-01**: Admin xem Dashboard và Reports.
- **STU-FLOW-01**: Luồng Create -> Confirm Booking.
- **STU-FLOW-02**: Luồng Create -> Reject Booking.
- **STU-FLOW-03**: Luồng Create -> Cancel Booking.

## 7. Thứ tự chạy test (Runner Order)
Thứ tự đề xuất để chạy Collection Runner nhằm đảm bảo setup data và biến môi trường chính xác:
1. analytics-service / Set up
2. studio-service / Set up
3. api-gateway / Kiểm tra sức khỏe / EP
4. api-gateway / Proxy báo cáo / EP
5. api-gateway / Kiểm tra sức khỏe / BVA
6. api-gateway / Proxy báo cáo / Negative
7. analytics-service / Thống kê Dashboard / EP
8. analytics-service / Báo cáo tổng quan / EP
9. analytics-service / Thống kê Dashboard / RBAC
10. analytics-service / Báo cáo tổng quan / RBAC
11. studio-service / Danh sách Studio / EP
12. studio-service / Cập nhật trạng thái Studio / EP
13. studio-service / Cập nhật trạng thái Studio / BVA
14. studio-service / Đặt lịch Studio / EP
15. studio-service / Đặt lịch Studio / BVA
16. studio-service / Đặt lịch Studio / Negative
17. api-gateway / FlowTests - Gateway
18. analytics-service / FlowTests - Analytics
19. studio-service / FlowTests - Studio

## 8. Kết quả đạt được
- Toàn bộ Postman collection JSON parse thành công và không bị hỏng cấu trúc.
- Request được chuẩn hóa tên đồng bộ và di chuyển vào đúng các folder quy định.
- Các script test cũ (HTTP status, schema shape) được bảo tồn và gắn đúng vào request.
- Các biến environment (`admin_token`, `coordinator_token`, `studio_admin_token`, `artist_token`, `bookingId`, v.v.) được sử dụng chuẩn xác qua các Pre-request và Test script.

## 9. Rủi ro / Ghi chú behavior hiện tại
- **KAN-76**: API Gateway trước đó forward sai path, nay đã khắc phục. Cần đảm bảo regression test sau mỗi lần deploy Gateway để tránh lặp lại lỗi này.
- **Validation**: Một số API chưa validate thật sự chặt chẽ, vì vậy các test case Negative đang assertion dựa trên HTTP status code thực tế của system behavior (có thể là `500` hoặc `400` thay vì `404`/`403` chuẩn REST). Sẽ cần refactor code backend sau nếu có yêu cầu chuẩn hóa status.
