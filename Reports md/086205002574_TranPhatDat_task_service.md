# Bao cao kiem thu chuc nang task-service

## 1. Thong tin bai toan

Pham vi kiem thu trong bao cao nay dua tren cac file trong project MuTraPro:

- `services/task-service/index.js`
- `shared/middleware/validation.js`
- `shared/middleware/auth.js`
- `services/api-gateway/index.js`
- `init-scripts/init.sql`
- `web-app/src/api/taskApi.js`
- `docs/API_DOCUMENTATION.md`
- `postman/Presentation.postman_collection.json`
- `postman/MutraPro Local.postman_environment.json`

Base URL dung trong Postman:

```text
http://localhost:3007/api
```

Service duoc kiem thu:

| Service | Chuc nang chinh | Endpoint qua API Gateway |
|---|---|---|
| `task-service` | Phan cong task cho chuyen vien, cap nhat trang thai task, lay task theo order/chuyen vien, mo lai task khi khach yeu cau sua | `/tasks/...` |

Bang du lieu chinh:

```sql
task(
  id,
  order_id,
  assigned_to,
  specialist_role,
  status,
  revision_comment,
  assigned_at,
  deadline,
  completed_at
)
```

Cac trang thai hop le cua task:

```text
assigned, in_progress, revision_requested, done
```

Cac vai tro chuyen vien hop le:

```text
transcriber, arranger, artist
```

### Gia dinh

- Kiem thu duoc thiet ke theo API thuc te trong code va collection Postman hien co.
- Cac request chay qua API Gateway tai port `3007`.
- `task-service` noi bo chay tai port `3003`, nhung nguoi dung/Postman goi qua `/api/tasks`.
- Cac request tao va cap nhat task can token hop le theo `Authorization: Bearer <token>`.
- `POST /tasks` chi cho phep role `coordinator`.
- `PUT /tasks/:id/status` cho phep nguoi duoc giao task, `admin`, hoac `coordinator`.
- `GET /tasks/specialist/:specialistId` cho phep chinh specialist do, `admin`, hoac `coordinator`.
- `GET /tasks/order/:orderId` va `POST /tasks/order/:orderId/re-open` la cac API noi bo/ho tro theo code hien tai.
- Cac loi DB, RabbitMQ, notification-service hoac order-service khong san sang duoc xem la loi moi truong, khong phai loi nghiep vu cua test case.
- Trong body Postman tao task co `title` va `description`, nhung code `task-service` hien tai chi su dung `order_id`, `assigned_to`, `specialist_role`, `deadline`.

---

## 2. Cau 1 - Phan hoach lop tuong duong

### 2.1. Tao task

Endpoint:

```text
POST /tasks
```

Body Postman hien co:

```json
{
  "order_id": "{{task_order_id}}",
  "assigned_to": 5,
  "specialist_role": "artist",
  "title": "Task test cua Dat",
  "description": "Kiem tra task service",
  "deadline": "2026-06-30"
}
```

| Dieu kien | Lop hop le | Tag | Lop khong hop le | Tag |
|---|---|---|---|---|
| Token | Bearer token hop le | V_CREATE_TOKEN | Thieu token hoac token sai | I_CREATE_TOKEN |
| Role | User co role `coordinator` | V_CREATE_ROLE | Role khac `coordinator` | I_CREATE_ROLE |
| `order_id` | So nguyen >= 1 | V_CREATE_ORDER_ID | Thieu, khong phai so nguyen, nho hon 1 | I_CREATE_ORDER_ID |
| `assigned_to` | So nguyen >= 1 | V_CREATE_ASSIGNED_TO | Thieu, khong phai so nguyen, nho hon 1 | I_CREATE_ASSIGNED_TO |
| `specialist_role` | `transcriber`, `arranger`, `artist` | V_CREATE_SPECIALIST_ROLE | Gia tri ngoai enum | I_CREATE_SPECIALIST_ROLE |
| `deadline` | Dung dinh dang ISO 8601 | V_CREATE_DEADLINE | Thieu hoac sai dinh dang ngay | I_CREATE_DEADLINE |
| Task dang xu ly cua order | Chua co task status `assigned`, `in_progress`, `revision_requested` | V_CREATE_NO_ACTIVE_TASK | Da co task dang xu ly | I_CREATE_DUP_ACTIVE |

### 2.2. Cap nhat trang thai task

Endpoint:

```text
PUT /tasks/:id/status
```

Body Postman hien co:

```json
{
  "status": "in_progress"
}
```

| Dieu kien | Lop hop le | Tag | Lop khong hop le | Tag |
|---|---|---|---|---|
| `:id` | So nguyen >= 1 | V_STATUS_ID | `0`, so am, chuoi khong phai so | I_STATUS_ID |
| Token | Bearer token hop le | V_STATUS_TOKEN | Thieu token hoac token sai | I_STATUS_TOKEN |
| Quyen truy cap | Owner task, `admin`, hoac `coordinator` | V_STATUS_PERMISSION | User khong phai owner va khong co role hop le | I_STATUS_PERMISSION |
| Task ton tai | Co record trong bang `task` | V_STATUS_EXISTS | Khong tim thay task | I_STATUS_NOT_FOUND |
| `status` | `assigned`, `in_progress`, `revision_requested`, `done` | V_STATUS_VALUE | Gia tri khac enum | I_STATUS_VALUE |
| `coordinatorId` | Co the co khi `status = done` de gui thong bao | V_STATUS_COORDINATOR_ID | Thieu `coordinatorId` van cap nhat duoc, nhung khong gui notify cho coordinator | B_STATUS_NO_COORDINATOR |

### 2.3. Lay task gan nhat theo order

Endpoint:

```text
GET /tasks/order/:orderId
```

| Dieu kien | Lop hop le | Tag | Lop khong hop le | Tag |
|---|---|---|---|---|
| `:orderId` | Order ID co task trong DB | V_GET_ORDER_FOUND | Order ID khong co task | I_GET_ORDER_NOT_FOUND |
| Sap xep task | Lay task moi nhat theo `assigned_at DESC LIMIT 1` | V_GET_ORDER_LATEST | Neu du lieu sap xep sai thi tra nham task cu | I_GET_ORDER_LATEST |

### 2.4. Mo lai task theo order

Endpoint:

```text
POST /tasks/order/:orderId/re-open
```

Body:

```json
{
  "comment": "Khach hang yeu cau chinh sua lai san pham."
}
```

| Dieu kien | Lop hop le | Tag | Lop khong hop le | Tag |
|---|---|---|---|---|
| `:orderId` | So hop le, parse duoc thanh number | V_REOPEN_ORDER_ID | Thieu hoac khong phai so | I_REOPEN_ORDER_ID |
| `comment` | Chuoi sau trim khac rong | V_REOPEN_COMMENT | Thieu, rong, chi co khoang trang | I_REOPEN_COMMENT |
| Task cua order | Co task moi nhat cho order | V_REOPEN_TASK_FOUND | Khong tim thay task | I_REOPEN_TASK_NOT_FOUND |
| Trang thai task | Task dang `done` hoac `assigned` | V_REOPEN_STATUS | Task khong o trang thai hop le de mo lai | I_REOPEN_STATUS |

### 2.5. Lay danh sach task cua chuyen vien

Endpoint:

```text
GET /tasks/specialist/:specialistId
```

| Dieu kien | Lop hop le | Tag | Lop khong hop le | Tag |
|---|---|---|---|---|
| Token | Bearer token hop le | V_LIST_TOKEN | Thieu token hoac token sai | I_LIST_TOKEN |
| Quyen truy cap | Chinh specialist do, `admin`, hoac `coordinator` | V_LIST_PERMISSION | User khong du quyen | I_LIST_PERMISSION |
| `:specialistId` | ID co task hoac khong co task | V_LIST_SPECIALIST_ID | ID khong hop le ve nghiep vu/phu thuoc DB | I_LIST_SPECIALIST_ID |
| Ket qua rong | Khong co task thi tra `[]` | V_LIST_EMPTY | Tra loi hoac sai schema khi khong co task | I_LIST_EMPTY |
| Lam giau du lieu | Lay duoc `description` tu order-service | V_LIST_ENRICHED | Khong lay duoc order thi fallback `Order description unavailable.` | B_LIST_ENRICH_FALLBACK |

---

## 3. Cau 2 - Phan tich gia tri bien

### 3.1. Bien dau vao dang so

| Bien dau vao | Mien hop le | Gia tri bien hop le | Gia tri ngoai bien | Tag |
|---|---|---|---|---|
| `order_id` khi tao task | So nguyen >= 1 | 1 | 0, -1, `abc`, rong | B_CREATE_ORDER_ID |
| `assigned_to` | So nguyen >= 1 | 1 | 0, -1, `abc`, rong | B_CREATE_ASSIGNED_TO |
| `:id` khi cap nhat status | So nguyen >= 1 | 1 | 0, -1, `abc` | B_STATUS_ID |
| `:orderId` khi re-open | Parse duoc thanh number | 1 | `abc`, rong | B_REOPEN_ORDER_ID |
| `:specialistId` | ID nguoi dung trong he thong | 1, 5 | 0, ID khong ton tai | B_LIST_SPECIALIST_ID |

### 3.2. Bien dau vao dang enum/ngay/chuoi

| Bien dau vao | Mien hop le theo code | Gia tri hop le | Gia tri khong hop le | Tag |
|---|---|---|---|---|
| `specialist_role` | `transcriber`, `arranger`, `artist` | `artist` | `manager`, `customer`, rong | B_CREATE_SPECIALIST_ROLE |
| `deadline` | ISO 8601 | `2026-06-30`, `2026-06-30T00:00:00.000Z` | `30/06/2026`, `abc`, rong | B_CREATE_DEADLINE |
| `status` | `assigned`, `in_progress`, `revision_requested`, `done` | `in_progress`, `done` | `completed`, `cancelled`, rong | B_STATUS_VALUE |
| `comment` khi re-open | Chuoi sau trim khac rong | `"Can sua lai file"` | `""`, `"   "`, thieu field | B_REOPEN_COMMENT |
| `Authorization` | `Bearer <jwt>` hop le | Token vua login | Thieu, sai prefix, token het han/sai chu ky | B_AUTH_TOKEN |

---

## 4. Cau 3 - Thiet ke test case

### 4.1. Cac test case da co trong Postman flow

| STT | Ten test case | Endpoint | Body/Input chinh | Ket qua mong doi | Tag duoc bao phu |
|---:|---|---|---|---|---|
| 1 | Login coordinator | `POST /auth/login` | `email = dpv@mutrapro.com`, `password = Admin@123` | HTTP 200, luu `coordinator_token` | V_CREATE_TOKEN, V_CREATE_ROLE |
| 2 | Register customer phu tro cho order | `POST /auth/register` | Email dong `task.customer.${Date.now()}@mutrapro.test` | HTTP 201, luu `task_customer_email` | Du lieu phu tro |
| 3 | Login customer phu tro | `POST /auth/login` | `{{task_customer_email}}`, `{{default_password}}` | HTTP 200, luu `customer_token`, `customer_id` | Du lieu phu tro |
| 4 | Tao order phu tro cho task | `POST /orders` | `service_type = recording`, `description = Fresh order for task service test` | HTTP 201, luu `task_order_id` | V_CREATE_ORDER_ID |
| 5 | Tao task thanh cong | `POST /tasks` | `order_id = {{task_order_id}}`, `assigned_to = 5`, `specialist_role = artist`, `deadline = 2026-06-30` | HTTP 201, response co `id`, luu `taskId` | V_CREATE_TOKEN, V_CREATE_ROLE, V_CREATE_ORDER_ID, V_CREATE_ASSIGNED_TO, V_CREATE_SPECIALIST_ROLE, V_CREATE_DEADLINE, V_CREATE_NO_ACTIVE_TASK |
| 6 | Lay task theo order | `GET /tasks/order/{{task_order_id}}` | `task_order_id` vua tao | HTTP 200, `order_id` trong response khop order vua tao | V_GET_ORDER_FOUND, V_GET_ORDER_LATEST |
| 7 | Cap nhat task sang in_progress | `PUT /tasks/{{taskId}}/status` | `status = in_progress` | HTTP 200, message `Task status updated`; order-service duoc goi cap nhat order sang `in_progress` neu service san sang | V_STATUS_ID, V_STATUS_VALUE |
| 8 | Lay task theo specialist | `GET /tasks/specialist/5` | Specialist ID `5` | HTTP 200, tra danh sach task cua user 5 hoac `[]` | V_LIST_SPECIALIST_ID, V_LIST_EMPTY, V_LIST_ENRICHED |

### 4.2. Cac test case nen bo sung de phu lop khong hop le

| STT | Ten test case | Endpoint | Body/Input chinh | Ket qua mong doi | Tag duoc bao phu |
|---:|---|---|---|---|---|
| 9 | Tao task thieu token | `POST /tasks` | Khong gui Authorization | HTTP 401 | I_CREATE_TOKEN |
| 10 | Tao task bang role khong phai coordinator | `POST /tasks` | Token customer/specialist | HTTP 403 | I_CREATE_ROLE |
| 11 | Tao task voi `order_id = 0` | `POST /tasks` | `order_id = 0` | HTTP 400, validation error | I_CREATE_ORDER_ID, B_CREATE_ORDER_ID |
| 12 | Tao task voi `assigned_to = 0` | `POST /tasks` | `assigned_to = 0` | HTTP 400, validation error | I_CREATE_ASSIGNED_TO, B_CREATE_ASSIGNED_TO |
| 13 | Tao task voi specialist role sai | `POST /tasks` | `specialist_role = "manager"` | HTTP 400, validation error | I_CREATE_SPECIALIST_ROLE, B_CREATE_SPECIALIST_ROLE |
| 14 | Tao task voi deadline sai dinh dang | `POST /tasks` | `deadline = "30/06/2026"` | HTTP 400, validation error | I_CREATE_DEADLINE, B_CREATE_DEADLINE |
| 15 | Tao task trung order dang xu ly | `POST /tasks` | Dung lai `order_id` da co task `assigned/in_progress/revision_requested` | HTTP 409, message `Don hang nay da co task dang xu ly.` | I_CREATE_DUP_ACTIVE |
| 16 | Cap nhat status thieu token | `PUT /tasks/{{taskId}}/status` | Khong gui Authorization | HTTP 401 | I_STATUS_TOKEN |
| 17 | Cap nhat status voi id sai | `PUT /tasks/abc/status` | `status = in_progress` | HTTP 400, validation error | I_STATUS_ID, B_STATUS_ID |
| 18 | Cap nhat status task khong ton tai | `PUT /tasks/999999/status` | `status = in_progress` | HTTP 404, message `Khong tim thay task.` | I_STATUS_NOT_FOUND |
| 19 | Cap nhat status khong hop le | `PUT /tasks/{{taskId}}/status` | `status = completed` | HTTP 400, message `Trang thai task khong hop le.` | I_STATUS_VALUE, B_STATUS_VALUE |
| 20 | Cap nhat status bang user khong du quyen | `PUT /tasks/{{taskId}}/status` | Token user khong phai owner/admin/coordinator | HTTP 403 | I_STATUS_PERMISSION |
| 21 | Lay task theo order khong co task | `GET /tasks/order/999999` | Order ID khong co task | HTTP 404, message `Khong tim thay task cho don hang nay.` | I_GET_ORDER_NOT_FOUND |
| 22 | Re-open task voi orderId sai | `POST /tasks/order/abc/re-open` | `comment = "Can sua"` | HTTP 400 | I_REOPEN_ORDER_ID, B_REOPEN_ORDER_ID |
| 23 | Re-open task thieu comment | `POST /tasks/order/{{task_order_id}}/re-open` | `comment = ""` | HTTP 400, message yeu cau nhap noi dung chinh sua | I_REOPEN_COMMENT, B_REOPEN_COMMENT |
| 24 | Re-open order khong co task | `POST /tasks/order/999999/re-open` | `comment = "Can sua"` | HTTP 500/loi handler tuy AppError trong async path, log khong tim thay task | I_REOPEN_TASK_NOT_FOUND |
| 25 | Lay task specialist thieu token | `GET /tasks/specialist/5` | Khong gui Authorization | HTTP 401 | I_LIST_TOKEN |
| 26 | Lay task specialist bang user khong du quyen | `GET /tasks/specialist/5` | Token user khong phai owner/admin/coordinator | HTTP 403 | I_LIST_PERMISSION |
| 27 | Lay task specialist khong co task | `GET /tasks/specialist/{{specialistId}}` | Specialist hop le nhung chua co task | HTTP 200, response `[]` | V_LIST_EMPTY |

### 4.3. Nhan xet ve do bao phu

Bo test Postman hien tai da bao phu:

- Luong thanh cong tao task: coordinator login, tao order phu tro, tao task va luu `taskId`.
- Luong doc task theo order vua tao.
- Luong cap nhat status sang `in_progress`.
- Luong lay danh sach task theo specialist.
- Mot phan kiem thu tich hop voi `auth-service`, `order-service`, `notification-service` thong qua token, order ID va notify.

Cac vung nen bo sung:

- Test thieu/sai token cho cac endpoint can xac thuc.
- Test role khong du quyen khi tao task va cap nhat task.
- Test validation cho `order_id`, `assigned_to`, `specialist_role`, `deadline`, `status`.
- Test trung task dang xu ly tren cung mot order de xac nhan HTTP 409.
- Test re-open task voi comment rong, order sai va task khong o trang thai hop le.
- Test response `[]` cua `GET /tasks/specialist/:specialistId` khi chuyen vien chua co task.

---

## 5. Cau 4 - Trien khai kiem thu tu dong

### 5.1. Cong cu su dung

Ngon ngu/script kiem thu: **Postman JavaScript test script**  
Cong cu chay thu cong: **Postman**  
Cong cu co the chay tu dong: **Newman**  
Collection:

```text
postman/Presentation.postman_collection.json
```

Environment:

```text
postman/MutraPro Local.postman_environment.json
```

### 5.2. Thu tu chay flow task-service trong Postman

```text
1. Login Coordinator
2. Register Customer For Task Order
3. Login Customer For Task Order
4. Create Order For Task Test
5. Create Task
6. Get Task By Order
7. Update Task Status
8. Get Tasks By Specialist
```

### 5.3. Vi du test script

#### Login coordinator

```javascript
pm.test('HTTP 200', function () {
  pm.expect(pm.response.code).to.eql(200);
});

const json = pm.response.json();
pm.environment.set('coordinator_token', json.token);
pm.environment.set('token', json.token);
pm.environment.set('userId', json.user?.id);

pm.test('Coordinator token saved', function () {
  pm.expect(pm.environment.get('coordinator_token')).to.not.be.empty;
});
```

#### Tao order phu tro cho task

```javascript
pm.test('HTTP 201', function () {
  pm.expect(pm.response.code).to.eql(201);
});

const json = pm.response.json();
const payload = json.data || json.order || json;
const id = payload.id || payload.orderId;

pm.expect(id, 'created order id').to.exist;
pm.environment.set('task_order_id', String(id));
pm.collectionVariables.set('task_order_id', String(id));
pm.variables.set('task_order_id', String(id));

pm.test('Task order ID saved', function () {
  pm.expect(pm.environment.get('task_order_id')).to.not.be.empty;
});
```

#### Tao task thanh cong

```javascript
pm.test('HTTP 201', function () {
  pm.expect(pm.response.code).to.eql(201);
});

const createTaskJson = pm.response.json();
const createTaskPayload = createTaskJson.data || createTaskJson;
pm.environment.set('taskId', String(createTaskPayload.id || createTaskPayload.taskId));

pm.test('Task ID saved', function () {
  pm.expect(pm.environment.get('taskId')).to.not.be.empty;
});
```

#### Lay task theo order

```javascript
pm.test('HTTP 200', function () {
  pm.expect(pm.response.code).to.eql(200);
});

const json = pm.response.json();
pm.test('Task belongs to created order', function () {
  pm.expect(String(json.order_id)).to.eql(String(pm.environment.get('task_order_id')));
});
```

#### Cap nhat status

```javascript
pm.test('HTTP 200', function () {
  pm.expect(pm.response.code).to.eql(200);
});

const json = pm.response.json();
pm.test('Task status updated message', function () {
  pm.expect(json.message || json.data?.message).to.match(/Task status updated/i);
});
```

#### Lay task theo specialist

```javascript
pm.test('HTTP 200', function () {
  pm.expect(pm.response.code).to.eql(200);
});

const json = pm.response.json();
const data = json.data || json;

pm.test('Response is array', function () {
  pm.expect(data).to.be.an('array');
});
```

### 5.4. Cach chay bang Newman

```bash
npx newman run postman/Presentation.postman_collection.json \
  -e "postman/MutraPro Local.postman_environment.json"
```

Neu chi muon chay rieng nhom `task-service`, co the chon folder `api/task-service` trong Postman Runner.

---

## 6. Ket luan

Phan `task-service` hien tai da co Postman flow kiem thu duoc luong nghiep vu chinh:

- Coordinator dang nhap va tao task cho order.
- Task duoc gan cho specialist theo `assigned_to`.
- Lay lai task theo `order_id` de xac nhan task vua tao.
- Cap nhat trang thai task sang `in_progress`.
- Lay danh sach task cua specialist.

Ve mat chat luong kiem thu, flow hien tai phu tot duong thanh cong, nhung con thieu cac case am tinh quan trong nhu thieu token, sai role, sai enum `specialist_role/status`, sai dinh dang `deadline`, trung task dang xu ly va re-open task voi comment khong hop le. Neu bo sung cac case nay vao Postman, bo test se bao phu day du hon ca validation dau vao, phan quyen va cac nhanh loi nghiep vu cua `task-service`.
