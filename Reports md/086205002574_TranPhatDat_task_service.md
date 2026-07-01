# Báo cáo kiểm thử chức năng task-service

## 1. Phạm vi kiểm thử task-service

Phạm vi kiểm thử trong báo cáo này dựa trên các file trong project MuTraPro:

- `services/task-service/index.js`
- `shared/middleware/validation.js`
- `shared/middleware/auth.js`
- `services/api-gateway/index.js`
- `init-scripts/init.sql`
- `web-app/src/api/taskApi.js`
- `docs/API_DOCUMENTATION.md`
- `postman/Presentation.postman_collection.json`
- `postman/MutraPro Local.postman_environment.json`

Base URL dùng trong Postman:
`http://localhost:3007/api`

Service được kiểm thử:
- `task-service`: Phân công task cho chuyên viên, cập nhật trạng thái task, lấy task theo order/chuyên viên, mở lại task khi khách yêu cầu sửa.

## 2. Cấu trúc folder Postman mới

Cấu trúc folder API cho `task-service` đã được chuẩn hóa theo định dạng tiếng Việt và chia thành các nhóm nhỏ để dễ quản lý:

```text
task-service
├─ Set up
│  ├─ TASK-SETUP-01 - Login Coordinator
│  ├─ TASK-SETUP-02 - Login Artist
│  ├─ TASK-SETUP-03 - Register Customer For Task Order
│  ├─ TASK-SETUP-04 - Login Customer For Task Order
│  └─ TASK-SETUP-05 - Create Order For Task Test
├─ Tạo và cập nhật Task
│  ├─ EP
│  │  ├─ TASK-EP-01 - Create Task
│  │  └─ TASK-EP-02 - Update Task Status
│  ├─ BVA
│  │  ├─ TASK-BVA-01 - Create Task Missing Fields
│  │  ├─ TASK-BVA-02 - Update Task Invalid Status
│  │  └─ TASK-BVA-03 - Update Task Not Found
│  └─ RBAC / Negative
│     ├─ TASK-NEG-01 - Create Task No Token
│     └─ TASK-NEG-02 - Create Task Invalid Token
├─ Truy xuất Task
│  ├─ EP
│  │  ├─ TASK-QUERY-EP-01 - Get Task By Order
│  │  └─ TASK-QUERY-EP-02 - Get Tasks By Specialist
│  ├─ BVA
│  │  ├─ TASK-QUERY-BVA-01 - Get Task By Order Not Found
│  │  └─ TASK-QUERY-BVA-02 - Get Tasks By Specialist Not Found
│  └─ RBAC / Negative
└─ FlowTests - Task
   ├─ TASK-FLOW-01 - Login Coordinator
   ├─ TASK-FLOW-02 - Login Artist
   ├─ TASK-FLOW-03 - Register Customer For Task Order
   ├─ TASK-FLOW-04 - Login Customer For Task Order
   ├─ TASK-FLOW-05 - Create Order For Task Test
   ├─ TASK-FLOW-06 - Create Task
   ├─ TASK-FLOW-07 - Get Task By Order
   ├─ TASK-FLOW-08 - Update Task Status
   └─ TASK-FLOW-09 - Get Tasks By Specialist
```

## 3. EP - phân hoạch lớp tương đương

| STT | Tên test case | Endpoint | Body/Input chính | Kết quả mong đợi |
|---:|---|---|---|---|
| 1 | TASK-EP-01 - Create Task | `POST /tasks` | `order_id`, `assigned_to`, `specialist_role`, `deadline` hợp lệ | HTTP 201 |
| 2 | TASK-EP-02 - Update Task Status | `PUT /tasks/:taskId/status` | `status = in_progress` | HTTP 200 |
| 3 | TASK-QUERY-EP-01 - Get Task By Order | `GET /tasks/order/:orderId` | `orderId` hợp lệ có task | HTTP 200 |
| 4 | TASK-QUERY-EP-02 - Get Tasks By Specialist | `GET /tasks/specialist/:specialistId` | `specialistId` hợp lệ | HTTP 200 |

## 4. BVA - phân tích giá trị biên

| STT | Tên test case | Endpoint | Body/Input chính | Kết quả mong đợi |
|---:|---|---|---|---|
| 1 | TASK-BVA-01 - Create Task Missing Fields | `POST /tasks` | `{}` (Thiếu các trường bắt buộc) | HTTP 400 |
| 2 | TASK-BVA-02 - Update Task Invalid Status | `PUT /tasks/:taskId/status` | `status = invalid_status` | HTTP 400 |
| 3 | TASK-BVA-03 - Update Task Not Found | `PUT /tasks/999999/status` | `status = in_progress` với ID không tồn tại | HTTP 404 |
| 4 | TASK-QUERY-BVA-01 - Get Task By Order Not Found | `GET /tasks/order/999999` | Order ID không có task | HTTP 404 / 200 (*) |
| 5 | TASK-QUERY-BVA-02 - Get Tasks By Specialist Not Found| `GET /tasks/specialist/999999`| Specialist ID không có task | HTTP 404 / 200 (*) |

## 5. RBAC / Negative

| STT | Tên test case | Endpoint | Body/Input chính | Kết quả mong đợi |
|---:|---|---|---|---|
| 1 | TASK-NEG-01 - Create Task No Token | `POST /tasks` | Không gửi Authorization | HTTP 401 |
| 2 | TASK-NEG-02 - Create Task Invalid Token | `POST /tasks` | Gửi Invalid Token | HTTP 401 |

## 6. FlowTests - Task

Luồng kiểm thử tổng hợp mô phỏng kịch bản thực tế:

1. `TASK-FLOW-01` - Login Coordinator (HTTP 200)
2. `TASK-FLOW-02` - Login Artist (HTTP 200)
3. `TASK-FLOW-03` - Register Customer For Task Order (HTTP 201)
4. `TASK-FLOW-04` - Login Customer For Task Order (HTTP 200)
5. `TASK-FLOW-05` - Create Order For Task Test (HTTP 201)
6. `TASK-FLOW-06` - Create Task (HTTP 201)
7. `TASK-FLOW-07` - Get Task By Order (HTTP 200)
8. `TASK-FLOW-08` - Update Task Status (HTTP 200)
9. `TASK-FLOW-09` - Get Tasks By Specialist (HTTP 200)

## 7. Thứ tự chạy test

Khi chạy tự động (Postman Runner hoặc Newman), cần tuân thủ thứ tự chạy thư mục như sau để đảm bảo dữ liệu phụ thuộc:
1. `task-service / Set up`
2. `task-service / Tạo và cập nhật Task / EP`
3. `task-service / Truy xuất Task / EP`
4. `task-service / Tạo và cập nhật Task / BVA`
5. `task-service / Tạo và cập nhật Task / RBAC / Negative`
6. `task-service / Truy xuất Task / BVA`
7. `task-service / FlowTests - Task`

## 8. Ghi chú behavior hiện tại

(*) **Lưu ý đối với trường hợp Not Found khi truy xuất danh sách:**
- Nếu hệ thống trả về HTTP `200` với body chứa mảng rỗng `[]` thay vì HTTP `404` cho các case truy xuất theo Order ID (`Get Task By Order Not Found`) hoặc Specialist ID (`Get Tasks By Specialist Not Found`), điều này có nghĩa là hệ thống ngầm định rằng "không có task" là một danh sách rỗng hợp lệ chứ không phải là lỗi tìm kiếm tài nguyên.
