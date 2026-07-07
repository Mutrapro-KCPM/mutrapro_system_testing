# Báo cáo kiểm thử Whitebox - API Gateway, Analytics Service, Studio Service

**Họ và tên:** Lê Hoàng Trọng  
**MSSV:** 087205000594  
**Ngày cập nhật:** 07/07/2026  
**Dự án:** MuTraPro System Testing  
**Loại kiểm thử:** Whitebox / Unit test / API handler test  

## 1. Mục tiêu kiểm thử

Báo cáo này mô tả phần kiểm thử whitebox cho 3 service trong hệ thống MuTraPro:

- `api-gateway`
- `analytics-service`
- `studio-service`

Mục tiêu chính:

- Kiểm tra trực tiếp logic xử lý trong source code của từng service.
- Kiểm tra các nhánh xử lý thành công, lỗi dữ liệu, lỗi phân quyền và lỗi dependency bên ngoài.
- Mock các dependency như database, service nội bộ và HTTP client để test chạy độc lập.
- Đo coverage bằng Jest để đánh giá mức độ bao phủ dòng lệnh, function và branch.

## 2. Công cụ và thư viện sử dụng

| Công cụ | Mục đích |
| --- | --- |
| Jest | Framework chạy unit test và sinh coverage |
| Supertest | Gửi request trực tiếp vào Express app |
| jest.mock | Mock dependency bên ngoài |
| node-fetch mock | Mock health check từ API Gateway đến service khác |
| mysql2/promise mock | Mock database cho Analytics và Studio |
| axios mock | Mock notification-service trong Studio |
| jsonwebtoken | Tạo JWT giả lập role khi test phân quyền |

## 3. Cấu trúc test đã bổ sung

```text
services/
  api-gateway/
    jest.config.js
    package.json
    tests/unit/gateway.test.js
    coverage/lcov.info

  analytics-service/
    jest.config.js
    package.json
    tests/unit/analytics.test.js
    coverage/lcov.info

  studio-service/
    jest.config.js
    package.json
    tests/unit/studio.test.js
    coverage/lcov.info
```

Các service đều đã có script test:

```json
"test": "jest --coverage"
```

Các file `jest.config.js` đều dùng cấu hình:

```js
module.exports = {
  testMatch: ['**/tests/unit/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/']
};
```

## 4. Điều chỉnh code để hỗ trợ whitebox

Để test bằng Supertest không tự mở server thật, các service đã được chuẩn hóa theo mẫu:

```js
if (require.main === module) {
  app.listen(PORT, () => {
    // log service startup
  });
}

module.exports = app;
```

Ý nghĩa:

- Khi chạy service bằng `node index.js`, server vẫn hoạt động bình thường.
- Khi Jest `require('../../index')`, app được import để test mà không chiếm port.
- Supertest có thể gửi request trực tiếp vào Express app.

## 5. Whitebox cho API Gateway

### 5.1 File test

```text
services/api-gateway/tests/unit/gateway.test.js
```

### 5.2 Dependency được mock

```js
jest.mock('node-fetch');
```

Mock `node-fetch` giúp kiểm tra logic `/api/health/all` mà không cần gọi thật đến các service:

- auth-service
- order-service
- task-service
- file-service
- studio-service
- notification-service

### 5.3 Test case chính

| Mã | Endpoint | Mục tiêu | Kết quả mong đợi |
| --- | --- | --- | --- |
| GATE-WB-01 | `GET /api/health` | Kiểm tra health check gateway | HTTP 200, `success = true`, service là `api-gateway` |
| GATE-WB-02 | `GET /api/health/all` | Tất cả service trả `ok` | HTTP 200, đủ trạng thái của 6 service |
| GATE-WB-03 | `GET /api/health/all` | Một service unreachable | HTTP 200, service lỗi có `status = error` |

### 5.4 Nhánh logic được kiểm thử

- Nhánh health check nội bộ gateway.
- Nhánh gọi thành công đến các service con.
- Nhánh catch lỗi khi service con không truy cập được.
- Nhánh tổng hợp kết quả health check trả về client.

## 6. Whitebox cho Analytics Service

### 6.1 File test

```text
services/analytics-service/tests/unit/analytics.test.js
```

### 6.2 Dependency được mock

```js
jest.mock('mysql2/promise');
jest.mock('../../shared/logger');
```

Mock database giúp test logic báo cáo mà không cần kết nối MySQL thật.

### 6.3 Test case chính

| Mã | Endpoint | Mục tiêu | Kết quả mong đợi |
| --- | --- | --- | --- |
| AN-WB-01 | `GET /health` | Kiểm tra health check | HTTP 200, service là `analytics-service` |
| AN-WB-02 | `GET /stats` | Không truyền token | HTTP 401 |
| AN-WB-03 | `GET /stats` | Role không hợp lệ | HTTP 403 |
| AN-WB-04 | `GET /stats` | DB chưa có report | HTTP 200, data mặc định |
| AN-WB-05 | `GET /stats` | DB có `report_dashboard` | HTTP 200, trả đúng dữ liệu trong `json_value` |
| AN-WB-06 | `GET /reports/overview` | Không truyền token | HTTP 401 |
| AN-WB-07 | `GET /reports/overview` | Admin xem khi DB rỗng | HTTP 200, data mặc định |

### 6.4 Nhánh logic được kiểm thử

- Nhánh health check.
- Nhánh authentication thiếu token.
- Nhánh authorization sai role.
- Nhánh database không có dữ liệu báo cáo.
- Nhánh database có dữ liệu báo cáo.
- Nhánh dùng chung handler giữa `/stats` và `/reports/overview`.

## 7. Whitebox cho Studio Service

### 7.1 File test

```text
services/studio-service/tests/unit/studio.test.js
```

### 7.2 Dependency được mock

```js
jest.mock('mysql2/promise');
jest.mock('axios');
jest.mock('../../shared/logger');
```

Mock database và notification giúp kiểm thử logic booking/studio độc lập với MySQL và notification-service.

### 7.3 Test case chính

| Mã | Endpoint | Mục tiêu | Kết quả mong đợi |
| --- | --- | --- | --- |
| STU-WB-01 | `GET /health` | Kiểm tra health check | HTTP 200 |
| STU-WB-02 | `GET /studios` | Lấy danh sách studio | HTTP 200, trả danh sách studio |
| STU-WB-03 | `POST /bookings` | Thiếu token | HTTP 401 |
| STU-WB-04 | `POST /bookings` | Role không hợp lệ | HTTP 403 |
| STU-WB-05 | `POST /bookings` | Thiếu field bắt buộc | HTTP 400 |
| STU-WB-06 | `POST /bookings` | `startTime >= endTime` | HTTP 400 |
| STU-WB-07 | `POST /bookings` | Đặt lịch trong quá khứ | HTTP 400 |
| STU-WB-08 | `POST /bookings` | Studio không tồn tại | HTTP 404 |
| STU-WB-09 | `POST /bookings` | Studio không available | HTTP 400 |
| STU-WB-10 | `POST /bookings` | Trùng lịch booking | HTTP 409 |
| STU-WB-11 | `POST /bookings` | Tạo booking thành công | HTTP 201 |
| STU-WB-12 | `GET /bookings/order/:orderId` | Không tìm thấy booking | HTTP 404 |
| STU-WB-13 | `GET /bookings/order/:orderId` | Tìm thấy booking | HTTP 200 |
| STU-WB-14 | `POST /bookings/:id/confirm` | Booking không tồn tại | HTTP 404 |
| STU-WB-15 | `POST /bookings/:id/confirm` | Booking bị conflict | HTTP 409 |
| STU-WB-16 | `POST /bookings/:id/confirm` | Confirm thành công | HTTP 200 |
| STU-WB-17 | `POST /bookings/:id/reject` | Booking không tồn tại | HTTP 404 |
| STU-WB-18 | `POST /bookings/:id/reject` | Reject thành công | HTTP 200 |
| STU-WB-19 | `POST /bookings/:id/cancel` | Không phải owner/admin | HTTP 403 |
| STU-WB-20 | `POST /bookings/:id/cancel` | Owner cancel thành công | HTTP 200 |
| STU-WB-21 | `PUT /studios/:id/status` | Status không hợp lệ | HTTP 400 |
| STU-WB-22 | `PUT /studios/:id/status` | Studio không tồn tại | HTTP 404 |
| STU-WB-23 | `PUT /studios/:id/status` | Cập nhật status thành công | HTTP 200 |

### 7.4 Nhánh logic được kiểm thử

- Nhánh lấy danh sách studio.
- Nhánh validate token và role.
- Nhánh validate input khi đặt lịch.
- Nhánh kiểm tra thời gian đặt lịch.
- Nhánh kiểm tra studio tồn tại.
- Nhánh kiểm tra trạng thái studio.
- Nhánh kiểm tra conflict booking.
- Nhánh tạo booking thành công.
- Nhánh tìm booking theo order.
- Nhánh confirm/reject/cancel booking.
- Nhánh cập nhật trạng thái studio.

## 8. Kết quả coverage

Coverage được lấy từ file `coverage/lcov.info` của từng service sau khi chạy `npm test`.

| Service | Lines | Functions | Branches |
| --- | ---: | ---: | ---: |
| api-gateway | 34/39 - 87.18% | 3/7 - 42.86% | 7/15 - 46.67% |
| analytics-service | 80/100 - 80.00% | 13/17 - 76.47% | 30/57 - 52.63% |
| studio-service | 166/195 - 85.13% | 20/26 - 76.92% | 75/107 - 70.09% |

Nhận xét:

- `studio-service` có số lượng test case nhiều nhất vì nghiệp vụ booking có nhiều nhánh xử lý.
- `api-gateway` có line coverage cao, nhưng function/branch coverage còn thấp do các proxy route chưa được test sâu.
- `analytics-service` đã phủ các nhánh chính: thiếu token, sai role, DB rỗng và DB có dữ liệu.

## 9. Lệnh chạy kiểm thử

Chạy riêng từng service:

```bash
cd services/api-gateway
npm test
```

```bash
cd services/analytics-service
npm test
```

```bash
cd services/studio-service
npm test
```

Lưu kết quả ra file:

```bash
cd services/api-gateway
npm test > test_output.txt
```

```bash
cd services/analytics-service
npm test > test_output.txt
```

```bash
cd services/studio-service
npm test > test_output.txt
```

## 10. Đánh giá tổng quan

Các phần whitebox đã kiểm tra được những logic quan trọng nhất của 3 service:

- API Gateway: health check và tổng hợp trạng thái service.
- Analytics Service: phân quyền và đọc dữ liệu báo cáo từ database.
- Studio Service: quản lý studio, booking lifecycle, validate input và phân quyền.

Bộ test hiện tại giúp phát hiện sớm các lỗi khi sửa code backend, đặc biệt là:

- Lỗi thiếu token hoặc sai role.
- Lỗi truy vấn database trả dữ liệu rỗng.
- Lỗi xử lý booking trùng lịch.
- Lỗi cập nhật trạng thái không hợp lệ.
- Lỗi service con không phản hồi khi gateway health check.

## 11. Hạn chế và hướng mở rộng

Một số phần có thể bổ sung thêm trong các lần sau:

- Test sâu hơn cho các proxy route của `api-gateway`, ví dụ `/api/orders`, `/api/payments`, `/api/studio`, `/api/analytics`.
- Bổ sung test role `coordinator` cho `/reports/overview` trong `analytics-service`.
- Bổ sung test `GET /bookings/all` trong `studio-service`.
- Bổ sung test notification thành công/thất bại khi studio cập nhật trạng thái hoặc tạo booking.
- Lưu `test_output.txt` của từng service để làm bằng chứng chạy test trên CI hoặc local.

## 12. Kết luận

Whitebox test cho `api-gateway`, `analytics-service` và `studio-service` đã được triển khai bằng Jest và Supertest. Các test đã mock dependency bên ngoài để chạy độc lập, kiểm tra được các nhánh xử lý chính và sinh được coverage report. Bộ test này có thể dùng làm bằng chứng kiểm thử khi nộp báo cáo và khi upload lên GitHub.
