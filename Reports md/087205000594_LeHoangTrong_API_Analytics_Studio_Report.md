# Báo cáo kiểm thử API Gateway, Analytics Service và Studio Service

**Sinh viên:** LeHoangTrong  
**MSSV:** 087205000594  
**Môn học:** Kiểm thử phần mềm  
**Dự án:** MuTraPro System Testing  
**Phạm vi phụ trách:** `api-gateway`, `analytics-service`, `studio-service`  
**Công cụ:** Postman Collection, Newman CI, GitHub Actions, Jira  
**Nguồn kiểm thử:** `postman/Presentation.postman_collection.json`  
**Ngày cập nhật:** 29/06/2026

---

## 1. Tóm tắt phạm vi kiểm thử

Báo cáo này trình bày phần kiểm thử API cho ba service được phụ trách trong hệ thống MuTraPro.

| Service | Mục tiêu kiểm thử | Request hiện có trong collection |
|---|---|---:|
| `api-gateway` | Health check, proxy analytics, regression route alias report | 4 |
| `analytics-service` | Đăng nhập admin, dashboard stats, reports overview | 3 |
| `studio-service` | Đăng nhập role, danh sách studio, trạng thái studio, booking flow | 12 |

Các kỹ thuật kiểm thử được áp dụng:

- **EP - Equivalence Partitioning:** chia dữ liệu thành lớp hợp lệ và không hợp lệ.
- **BVA - Boundary Value Analysis:** kiểm tra các giá trị biên của token, id, status và thời gian đặt lịch.
- **RBAC:** kiểm tra phân quyền theo role `admin`, `studio_admin`, `artist`.
- **Regression:** kiểm thử lại lỗi đã fix, đặc biệt route alias `KAN-76`.
- **Flow test:** kiểm thử chuỗi nghiệp vụ đặt lịch studio.

---

## 2. Cấu trúc request trong Postman Collection

### 2.1. API Gateway

| STT | Request | Method | Endpoint | Auth | Mục tiêu |
|---:|---|---|---|---|---|
| 1 | `Gateway Health` | GET | `{{baseUrl}}/health` | No Auth | Kiểm tra API Gateway đang chạy |
| 2 | `All Services Health` | GET | `{{baseUrl}}/health/all` | No Auth | Kiểm tra tổng hợp trạng thái các service |
| 3 | `Proxy Analytics Reports Overview` | GET | `{{baseUrl}}/analytics/reports/overview` | Bearer `{{admin_token}}` | Kiểm tra gateway proxy đúng sang analytics |
| 4 | `Reports Alias - Fixed KAN-76` | GET | `{{baseUrl}}/reports/overview` | Bearer `{{admin_token}}` | Regression lỗi route alias `/reports/overview` |

### 2.2. Analytics Service

| STT | Request | Method | Endpoint | Auth | Mục tiêu |
|---:|---|---|---|---|---|
| 1 | `Login Admin` | POST | `{{baseUrl}}/auth/login` | No Auth | Lấy `admin_token` để kiểm thử analytics |
| 2 | `Dashboard Stats` | GET | `{{baseUrl}}/analytics/stats` | Bearer `{{admin_token}}` | Kiểm tra dữ liệu thống kê dashboard |
| 3 | `Reports Overview` | GET | `{{baseUrl}}/analytics/reports/overview` | Bearer `{{admin_token}}` | Kiểm tra báo cáo tổng quan |

### 2.3. Studio Service

| STT | Request | Method | Endpoint | Auth | Mục tiêu |
|---:|---|---|---|---|---|
| 1 | `Login Studio Admin` | POST | `{{baseUrl}}/auth/login` | No Auth | Lấy `studio_admin_token` |
| 2 | `Login Artist` | POST | `{{baseUrl}}/auth/login` | No Auth | Lấy `artist_token` |
| 3 | `Get Studios` | GET | `{{baseUrl}}/studio/studios` | No Auth | Lấy danh sách phòng thu |
| 4 | `Update Studio Status - Available` | PUT | `{{baseUrl}}/studio/studios/{{studioId}}/status` | Bearer `{{studio_admin_token}}` | Chuyển studio sang `available` |
| 5 | `Update Studio Status - Maintenance` | PUT | `{{baseUrl}}/studio/studios/{{studioId}}/status` | Bearer `{{studio_admin_token}}` | Chuyển studio sang `maintenance` |
| 6 | `Update Studio Status - Reset Available` | PUT | `{{baseUrl}}/studio/studios/{{studioId}}/status` | Bearer `{{studio_admin_token}}` | Reset studio về `available` |
| 7 | `Prepare Booking Time` | GET | `{{baseUrl}}/health` | No Auth | Sinh biến thời gian booking hợp lệ |
| 8 | `Create Booking` | POST | `{{baseUrl}}/studio/bookings` | Bearer `{{artist_token}}` | Tạo booking và lưu `bookingId` |
| 9 | `Get All Bookings` | GET | `{{baseUrl}}/studio/bookings/all` | Bearer `{{studio_admin_token}}` | Studio admin xem danh sách booking |
| 10 | `Confirm Booking` | POST | `{{baseUrl}}/studio/bookings/{{bookingId}}/confirm` | Bearer `{{studio_admin_token}}` | Xác nhận booking |
| 11 | `Reject Booking` | POST | `{{baseUrl}}/studio/bookings/{{bookingId}}/reject` | Bearer `{{studio_admin_token}}` | Từ chối booking |
| 12 | `Cancel Booking` | POST | `{{baseUrl}}/studio/bookings/{{bookingId}}/cancel` | Bearer `{{studio_admin_token}}` | Hủy booking |

---

## 3. Phân hoạch lớp tương đương

### 3.1. API Gateway

| Nhóm kiểm thử | Lớp hợp lệ | Lớp không hợp lệ | Kỳ vọng |
|---|---|---|---|
| Health endpoint | `/health`, `/health/all` tồn tại | Sai path hoặc service không chạy | Hợp lệ trả `200`, sai path trả `404` |
| Proxy route | Route `/analytics/reports/overview` được forward đúng | Downstream sai route hoặc không tồn tại | Hợp lệ trả dữ liệu report |
| Reports alias | `/reports/overview` forward đúng sang analytics | Alias bị cắt sai prefix thành `/overview` | Hợp lệ trả `200` |
| Token khi proxy | Bearer token admin hợp lệ | Thiếu token, token sai, token hết hạn | Hợp lệ trả `200`, không hợp lệ trả `401/403` |
| Response shape | Có `totalRevenue`, `totalOrders`, `orderStats` | Thiếu field hoặc sai kiểu dữ liệu | Assertion phát hiện lỗi |

### 3.2. Analytics Service

| Nhóm kiểm thử | Lớp hợp lệ | Lớp không hợp lệ | Kỳ vọng |
|---|---|---|---|
| Đăng nhập admin | Email/password đúng | Sai email, sai password, thiếu field | Hợp lệ trả token |
| Token truy cập analytics | Token role `admin` hoặc `coordinator` | Không token, invalid token, token role không đủ quyền | `200`, `401`, `403` tương ứng |
| Dashboard stats | Response có đủ field thống kê | Thiếu `totalRevenue`, `totalOrders`, `orderStats` | Assertion bắt lỗi shape |
| Reports overview | Report tồn tại hoặc dữ liệu rỗng hợp lệ | Route sai hoặc dữ liệu sai shape | `200` với shape hợp lệ |
| Dữ liệu rỗng | `totalRevenue=0`, `totalOrders=0`, `orderStats=[]` | Field null/sai kiểu | Vẫn hợp lệ nếu đúng kiểu |

### 3.3. Studio Service

| Nhóm kiểm thử | Lớp hợp lệ | Lớp không hợp lệ | Kỳ vọng |
|---|---|---|---|
| Role đăng nhập | `studio_admin`, `artist` | Sai tài khoản, sai mật khẩu, role không đúng | Login hợp lệ trả token và role đúng |
| Danh sách studio | Endpoint trả mảng studio | Service lỗi hoặc response không phải array | `200`, payload là array |
| Cập nhật trạng thái | `available`, `maintenance`, `booked` | Status ngoài enum, thiếu status | Hợp lệ `200`, không hợp lệ `400` |
| Studio ID | ID tồn tại | ID không tồn tại, ID sai định dạng | Tồn tại `200`, không tồn tại `404` |
| Tạo booking | Đủ `studio_id`, `order_id`, `start_time`, `end_time` | Thiếu field, studio không tồn tại, thời gian quá khứ | Hợp lệ `201`, lỗi `400/404` |
| Thời gian booking | Start ở tương lai, end sau start | Start quá khứ, end trước hoặc bằng start | Hợp lệ tạo booking, lỗi validation |
| Booking lifecycle | Booking tồn tại và đúng trạng thái | Booking không tồn tại, thiếu `bookingId` | Confirm/reject/cancel hợp lệ trả `200` |
| RBAC booking | Artist tạo booking, studio admin xử lý booking | Role không đủ quyền hoặc token sai | `200/201`, `401/403` |

---

## 4. Phân tích giá trị biên

### 4.1. API Gateway và Analytics

| Tham số / điều kiện | Giá trị biên | Kỳ vọng |
|---|---|---|
| Health route | `/health`, `/health/all`, `/health/invalid` | Route hợp lệ `200`, route sai `404` |
| Số service trong `/health/all` | 0 service lỗi, 1 service lỗi, tất cả service OK | Response thể hiện đúng trạng thái từng service |
| Token | Rỗng, invalid, hết hạn, admin hợp lệ | `401` với token rỗng/sai, `200` với admin |
| `totalRevenue` | `0`, số dương | Field tồn tại và là number |
| `totalOrders` | `0`, `1`, số lớn hơn | Field tồn tại và là number |
| `orderStats` | `[]`, mảng một phần tử, mảng nhiều phần tử | Luôn là array |

### 4.2. Studio Service

| Tham số | Giá trị biên | Kỳ vọng |
|---|---|---|
| `studioId` | `0`, `{{studioId}}`, `999999` | ID hợp lệ xử lý được, ID không tồn tại trả `404` |
| `bookingId` | Rỗng, ID vừa tạo, `999999` | Rỗng bị pre-request chặn, ID hợp lệ trả `200`, ID không tồn tại `404` |
| `status` | `available`, `maintenance`, `booked`, `invalid_status` | Ba enum hợp lệ, invalid trả `400` |
| `start_time` | Quá khứ, hiện tại, tương lai xa | Quá khứ bị từ chối, tương lai hợp lệ |
| `end_time` | Trước start, bằng start, sau start | Trước/bằng start bị từ chối |
| Booking overlap | Không trùng, trùng một phần, trùng hoàn toàn | Không trùng hợp lệ, trùng lịch bị từ chối |
| Token | Không token, invalid token, artist token, studio admin token | `401`, `401`, tạo booking `201`, xử lý booking `200` |

---

## 5. Thiet ke test case

Phan nay duoc chia thanh hai nhom de khop voi Postman Collection hien tai:

- **Da trien khai trong Postman:** la cac request dang co that trong `Presentation.postman_collection.json`.
- **De xuat mo rong:** la cac case EP/BVA/RBAC nen bo sung neu can tang do phu, khong tinh la request da co tren `main`.

### 5.1. Test case API Gateway da trien khai

| TC | Request trong Postman | Method/Endpoint | Muc tieu | Expected |
|---:|---|---|---|---|
| GW-TC01 | `Gateway Health` | `GET /health` | Kiem tra API Gateway hoat dong | `200` |
| GW-TC02 | `All Services Health` | `GET /health/all` | Kiem tra tong hop trang thai service | `200` |
| GW-TC03 | `Proxy Analytics Reports Overview` | `GET /analytics/reports/overview` | Kiem tra gateway proxy dung sang analytics | `200`, co `totalRevenue`, `totalOrders`, `orderStats` |
| GW-TC04 | `Reports Alias - Fixed KAN-76` | `GET /reports/overview` | Regression loi alias reports KAN-76 | `200`, report dung shape |

### 5.2. Test case Analytics Service da trien khai

| TC | Request trong Postman | Method/Endpoint | Muc tieu | Expected |
|---:|---|---|---|---|
| AN-TC01 | `Login Admin` | `POST /auth/login` | Lay `admin_token` cho analytics | `200`, co token, role `admin` |
| AN-TC02 | `Dashboard Stats` | `GET /analytics/stats` | Kiem tra dashboard statistics | `200`, co `totalRevenue`, `totalOrders`, `orderStats` |
| AN-TC03 | `Reports Overview` | `GET /analytics/reports/overview` | Kiem tra bao cao tong quan | `200`, report dung shape |

### 5.3. Test case Studio Service da trien khai

| TC | Request trong Postman | Method/Endpoint | Muc tieu | Expected |
|---:|---|---|---|---|
| ST-TC01 | `Login Studio Admin` | `POST /auth/login` | Lay `studio_admin_token` | `200`, role `studio_admin` |
| ST-TC02 | `Login Artist` | `POST /auth/login` | Lay `artist_token` | `200`, role `artist` |
| ST-TC03 | `Get Studios` | `GET /studio/studios` | Lay danh sach studio | `200`, payload la array |
| ST-TC04 | `Update Studio Status - Available` | `PUT /studio/studios/{{studioId}}/status` | Chuyen studio sang `available` | `200`, co message |
| ST-TC05 | `Update Studio Status - Maintenance` | `PUT /studio/studios/{{studioId}}/status` | Chuyen studio sang `maintenance` | `200`, co message |
| ST-TC06 | `Update Studio Status - Reset Available` | `PUT /studio/studios/{{studioId}}/status` | Reset studio ve `available` truoc khi booking | `200`, co message |
| ST-TC07 | `Prepare Booking Time` | `GET /health` | Sinh `studio_booking_start_time` va `studio_booking_end_time` | `200`, bien thoi gian duoc luu |
| ST-TC08 | `Create Booking` | `POST /studio/bookings` | Artist tao booking hop le | `201`, luu `bookingId` |
| ST-TC09 | `Get All Bookings` | `GET /studio/bookings/all` | Studio admin xem tat ca booking | `200`, payload la array |
| ST-TC10 | `Confirm Booking` | `POST /studio/bookings/{{bookingId}}/confirm` | Studio admin xac nhan booking | `200`, `success=true` |
| ST-TC11 | `Reject Booking` | `POST /studio/bookings/{{bookingId}}/reject` | Studio admin tu choi booking | `200`, `success=true` |
| ST-TC12 | `Cancel Booking` | `POST /studio/bookings/{{bookingId}}/cancel` | Studio admin huy booking | `200`, `success=true` |

### 5.4. Test case de xuat mo rong EP/BVA/RBAC

Cac case duoi day chua bat buoc la request dang co trong collection tren `main`, nhung la phan mo rong hop ly neu can tang do phu kiem thu:

| Nhom | Case de xuat | Expected |
|---|---|---|
| API Gateway | Sai path health, sai alias reports, thieu token reports, invalid token reports | `404`, `401` |
| Analytics | No token, invalid token, artist forbidden, coordinator allowed | `401`, `401`, `403`, `200` |
| Studio Booking | Missing fields, past time, studio not found, booking not found | `400`, `400`, `404`, `404` |
| Studio RBAC | Artist xem all bookings, invalid token, no token | `403`, `401`, `401` |
| Studio Status | Missing status, invalid status, studio id khong ton tai | `400`, `400`, `404` |

## 6. Triển khai kiểm thử tự động bằng Postman

### 6.1. Biến môi trường sử dụng

| Biến | Mục đích |
|---|---|
| `baseUrl` | URL gốc qua API Gateway, ví dụ `http://localhost:3007/api` |
| `admin_token` | Token dùng cho analytics và reports qua gateway |
| `studio_admin_token` | Token dùng để cập nhật studio, xem booking, confirm/reject/cancel |
| `artist_token` | Token dùng để tạo booking |
| `studioId` | ID studio dùng cho status và booking |
| `orderId` | ID order dùng để tạo booking |
| `bookingId` | ID booking được lưu sau request `Create Booking` |
| `studio_booking_start_time` | Thời gian bắt đầu booking được sinh tự động |
| `studio_booking_end_time` | Thời gian kết thúc booking được sinh tự động |
| `invalid_token` | Token sai dùng cho negative/RBAC |

### 6.2. Assertion tiêu biểu

Analytics report shape:

```js
pm.test("HTTP 200", () => pm.response.to.have.status(200));

const json = pm.response.json();
const payload = json.data?.data || json.data || json;

pm.test("Reports overview shape is valid", () => {
  pm.expect(payload).to.have.property("totalRevenue");
  pm.expect(payload).to.have.property("totalOrders");
  pm.expect(payload).to.have.property("orderStats");
  pm.expect(payload.orderStats).to.be.an("array");
});
```

Studio create booking:

```js
pm.test("HTTP 201", () => pm.response.to.have.status(201));

const json = pm.response.json();

pm.test("Booking created and id saved", () => {
  pm.expect(json.id).to.exist;
  pm.environment.set("bookingId", String(json.id));
});
```

Studio action guard:

```js
const bookingId =
  pm.environment.get("bookingId") ||
  pm.collectionVariables.get("bookingId");

if (!bookingId) {
  throw new Error("Missing bookingId: run Create Booking first.");
}

pm.environment.set("bookingId", String(bookingId));
```

### 6.3. Thứ tự chạy regression đề xuất

```text
1. analytics-service / Login Admin
2. studio-service / Login Studio Admin
3. studio-service / Login Artist
4. api-gateway / Gateway Health
5. api-gateway / All Services Health
6. api-gateway / Proxy Analytics Reports Overview
7. api-gateway / Reports Alias - Fixed KAN-76
8. analytics-service / Dashboard Stats
9. analytics-service / Reports Overview
10. studio-service / Get Studios
11. studio-service / Update Studio Status - Available
12. studio-service / Update Studio Status - Maintenance
13. studio-service / Update Studio Status - Reset Available
14. studio-service / Prepare Booking Time
15. studio-service / Create Booking
16. studio-service / Get All Bookings
17. studio-service / Confirm Booking
18. studio-service / Prepare Booking Time
19. studio-service / Create Booking
20. studio-service / Reject Booking
21. studio-service / Prepare Booking Time
22. studio-service / Create Booking
23. studio-service / Cancel Booking
```

Lưu ý: cần chạy `Prepare Booking Time` trước mỗi lần `Create Booking` để tránh lỗi trùng khung giờ.

---

## 7. Kết quả và nhận xét

### 7.1. Kết quả đạt được

- Đã kiểm thử các request chính của `api-gateway`, `analytics-service`, `studio-service`.
- Đã xác nhận route alias `GET /reports/overview` hoạt động sau lỗi `KAN-76`.
- Đã kiểm tra response shape của analytics gồm `totalRevenue`, `totalOrders`, `orderStats`.
- Đã kiểm tra studio booking flow gồm tạo booking, xác nhận, từ chối và hủy.
- Đã bổ sung cơ chế lưu biến tự động như `admin_token`, `studio_admin_token`, `artist_token`, `bookingId`.
- Đã chuẩn hóa cách reset studio về `available` trước khi tạo booking để giảm lỗi regression.

### 7.2. Rủi ro còn lại

| Rủi ro | Ảnh hưởng | Hướng xử lý |
|---|---|---|
| Token hết hạn khi chạy lại sau nhiều ngày | Request protected trả `401` | Chạy lại các request login trước regression |
| Booking dùng lại khung giờ cũ | `Create Booking` có thể fail do trùng lịch | Luôn chạy `Prepare Booking Time` trước khi tạo booking |
| Studio đang ở trạng thái `maintenance` | Không tạo được booking | Chạy `Update Studio Status - Reset Available` |
| Một số negative/RBAC chưa nằm trực tiếp trong folder chính trên main | Báo cáo có thể thiếu minh chứng tự động nếu không mở rộng collection | Có thể bổ sung thêm folder `BVA`, `RBAC`, `Negative` sau |
| API trả response shape không thống nhất giữa các service | Assertion dễ sai nếu test cứng `success=true` | Viết assertion theo shape thực tế từng endpoint |

---

## 8. Kết luận

Phần kiểm thử do sinh viên phụ trách đã bao phủ các luồng quan trọng của `api-gateway`, `analytics-service` và `studio-service`. Các test tập trung vào health check, proxy route, dữ liệu thống kê, report overview, phân quyền token, trạng thái studio và vòng đời booking.

Về mặt kỹ thuật kiểm thử, báo cáo đã áp dụng phân hoạch lớp tương đương, phân tích giá trị biên, kiểm thử phân quyền và regression test. Postman Collection được dùng để tự động hóa quá trình kiểm thử, kết hợp biến môi trường để lưu token, id booking và thời gian đặt lịch. Các request này có thể tiếp tục chạy bằng Newman CI để phát hiện lỗi hồi quy trong những lần cập nhật code tiếp theo.
