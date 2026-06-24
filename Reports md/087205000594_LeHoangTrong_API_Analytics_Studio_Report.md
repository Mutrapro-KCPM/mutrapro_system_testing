# Bao cao kiem thu API Gateway, Analytics Service va Studio Service

**Sinh vien:** LeHoangTrong  
**MSSV:** 08720500594  
**Mon hoc:** Kiem thu phan mem  
**Chu de:** Phan hoach lop tuong duong, phan tich gia tri bien, thiet ke test case va kiem thu API tu dong  
**Du an:** MuTraPro System Testing  
**Pham vi:** `api-gateway`, `analytics-service`, `studio-service`  
**Cong cu kiem thu tu dong:** Postman Collection, Newman CI, Jira  
**Nguon doi chieu:** `services/api-gateway`, `services/analytics-service`, `services/studio-service`, `shared/middleware`, `postman/Presentation.postman_collection.json`

---

## Muc luc

1. [Tom tat pham vi kiem thu](#1-tom-tat-pham-vi-kiem-thu)
2. [Cau 1. Xac dinh lop tuong duong](#2-cau-1-xac-dinh-lop-tuong-duong)
3. [Cau 2. Phan tich gia tri bien](#3-cau-2-phan-tich-gia-tri-bien)
4. [Cau 3. Thiet ke test case](#4-cau-3-thiet-ke-test-case)
5. [Cau 4. Trien khai kiem thu tu dong bang Postman](#5-cau-4-trien-khai-kiem-thu-tu-dong-bang-postman)
6. [Ket luan](#6-ket-luan)

---

## 1. Tom tat pham vi kiem thu

MuTraPro duoc xay dung theo kien truc microservice. Bao cao nay tap trung vao ba thanh phan do sinh vien phu trach:

| Service | File chinh | Chuc nang duoc kiem thu |
|---|---|---|
| `api-gateway` | `services/api-gateway/index.js` | Health check gateway, health check tong hop, proxy den analytics va regression alias reports |
| `analytics-service` | `services/analytics-service/index.js` | Dashboard statistics, reports overview, xac thuc JWT va phan quyen admin/coordinator |
| `studio-service` | `services/studio-service/index.js` | Danh sach studio, dat lich, xem/confirm/reject/cancel booking, cap nhat trang thai studio |

### 1.1. Endpoint chinh cua API Gateway

| Method | Endpoint | Muc dich | Dieu kien bao ve |
|---|---|---|---|
| `GET` | `/api/health` | Kiem tra API Gateway dang hoat dong | Public |
| `GET` | `/api/health/all` | Tong hop trang thai cac service core | Public |
| `GET` | `/api/analytics/stats` | Proxy dashboard stats den analytics-service | Can token role `admin` hoac `coordinator` |
| `GET` | `/api/analytics/reports/overview` | Proxy reports overview den analytics-service | Can token role `admin` hoac `coordinator` |
| `GET` | `/api/reports/overview` | Alias reports qua gateway | Can token role `admin` hoac `coordinator` |
| `ALL` | `/api/studio/*` | Proxy request den studio-service | Tuy endpoint studio |

`GET /api/health/all` kiem tra sau service: `auth`, `order`, `task`, `file`, `studio`, `notification`.

### 1.2. Endpoint chinh cua Analytics Service

| Method | Endpoint qua gateway | Muc dich | Dieu kien bao ve |
|---|---|---|---|
| `GET` | `/analytics/stats` | Lay du lieu dashboard | JWT hop le, role `admin` hoac `coordinator` |
| `GET` | `/analytics/reports/overview` | Lay report tong quan | JWT hop le, role `admin` hoac `coordinator` |
| `GET` | `/reports/overview` | Alias qua API Gateway | JWT hop le, role `admin` hoac `coordinator` |

Hai endpoint analytics dung chung ham `getDashboardStats`. Neu bang report chua co du lieu, service tra ve:

```json
{
  "totalRevenue": 0,
  "totalOrders": 0,
  "orderStats": []
}
```

### 1.3. Endpoint chinh cua Studio Service

| Method | Endpoint qua gateway | Muc dich | Dieu kien bao ve |
|---|---|---|---|
| `GET` | `/studio/studios` | Lay danh sach studio | Public |
| `POST` | `/studio/bookings` | Tao booking moi | Role `artist`, `studio_admin` hoac `admin` |
| `GET` | `/studio/bookings/order/:orderId` | Lay booking theo order | Internal/public theo code hien tai |
| `GET` | `/studio/bookings/all` | Lay tat ca booking dang scheduled | Chi role `studio_admin` |
| `POST` | `/studio/bookings/:id/confirm` | Xac nhan booking | Role `studio_admin` hoac `admin` |
| `POST` | `/studio/bookings/:id/reject` | Tu choi booking | Role `studio_admin` hoac `admin` |
| `POST` | `/studio/bookings/:id/cancel` | Huy booking | Owner artist, `studio_admin` hoac `admin` |
| `PUT` | `/studio/studios/:id/status` | Cap nhat trang thai studio | Chi role `studio_admin` |

---

## 2. Cau 1. Xac dinh lop tuong duong

### 2.1. Lop tuong duong cho API Gateway

| Nhom du lieu/hanh vi | Lop hop le | Tag | Lop khong hop le | Tag |
|---|---|---|---|---|
| Gateway health | Gateway dang chay va tra JSON dung shape | GW-V1 | Gateway khong khoi dong/khong phan hoi | GW-X1 |
| All services health | Sau service core deu truy cap duoc | GW-V2 | Mot hoac nhieu service unreachable | GW-X2 |
| Route proxy | Prefix thuoc danh sach route da cau hinh | GW-V3 | Route/prefix khong ton tai | GW-X3 |
| Reports route | `/analytics/reports/overview` va alias `/reports/overview` cung den dung handler | GW-V4 | Alias bi cat sai prefix thanh `/overview` | GW-X4 |
| Authorization duoc forward | Bearer token hop le duoc chuyen den downstream | GW-V5 | Thieu token, token sai hoac het han | GW-X5, GW-X6 |
| Downstream response | Gateway giu dung status/body/header can thiet | GW-V6 | Downstream loi ket noi, gateway tra `502` | GW-X7 |

### 2.2. Lop tuong duong cho Analytics Service

| Nhom du lieu | Lop hop le | Tag | Lop khong hop le | Tag |
|---|---|---|---|---|
| Bearer token | JWT hop le, chua het han | AN-V1 | Thieu token, token sai/het han | AN-X1, AN-X2 |
| Role truy cap | `admin`, `coordinator` | AN-V2 | `artist`, `customer`, `studio_admin` | AN-X3 |
| Report ton tai | DB co `dashboard_stats`, JSON dung shape | AN-V3 | Row khong ton tai hoac JSON sai shape | AN-X4 |
| Report chua co du lieu | `totalRevenue=0`, `totalOrders=0`, `orderStats=[]` | AN-V4 | Thieu field hoac `orderStats` khong phai array | AN-X5 |
| Reports endpoint | `/stats`, `/reports/overview`, alias gateway | AN-V5 | Route sai/khong ton tai | AN-X6 |

### 2.3. Lop tuong duong cho Studio Service

| Nhom du lieu | Lop hop le | Tag | Lop khong hop le | Tag |
|---|---|---|---|---|
| Role tao booking | `artist`, `studio_admin`, `admin` | ST-V1 | Token thieu/sai hoac role khong duoc phep | ST-X1, ST-X2 |
| Truong bat buoc booking | Co `studio_id`, `order_id`, `start_time`, `end_time` | ST-V2 | Thieu mot hoac nhieu truong | ST-X3 |
| Dinh dang thoi gian | Chuoi parse duoc thanh Date | ST-V3 | Ngay sai dinh dang | ST-X4 |
| Quan he thoi gian | `start_time < end_time`, start o tuong lai | ST-V4 | Start bang/sau end, hoac start trong qua khu | ST-X5, ST-X6 |
| Studio dat lich | Studio ton tai va status `available` | ST-V5 | Studio khong ton tai hoac status khac `available` | ST-X7, ST-X8 |
| Khung gio dat lich | Khong giao voi booking `scheduled` | ST-V6 | Co booking giao nhau | ST-X9 |
| Xem tat ca booking | Token role `studio_admin` | ST-V7 | Role `artist` hoac role khac | ST-X10 |
| Confirm/Reject | Booking ton tai, role `studio_admin`/`admin` | ST-V8 | Booking khong ton tai hoac sai role | ST-X11, ST-X12 |
| Cancel | Owner artist hoac role admin | ST-V9 | Khong phai owner va khong phai admin | ST-X13 |
| Studio status | `available`, `booked`, `maintenance` | ST-V10 | Gia tri ngoai enum | ST-X14 |
| ID tren path | So nguyen duong va record ton tai | ST-V11 | ID sai dinh dang, ID khong ton tai | ST-X15, ST-X16 |

---

## 3. Cau 2. Phan tich gia tri bien

### 3.1. Gia tri bien API Gateway va Analytics

| Tham so/ket qua | Mien hop le | Gia tri kiem thu | Ky vong | Tag |
|---|---|---|---|---|
| So service trong health/all | 6 service cau hinh | `0`, `1`, `6`; mot service unreachable | Du 6 service co status; service loi duoc ghi `error` | GW-B1..GW-B4 |
| Bearer token | JWT hop le | Thieu, invalid, artist, coordinator, admin | `401`, `401`, `403`, `200`, `200` | AN-B1..AN-B5 |
| `totalOrders` | So khong am | `0`, `1`, so duong lon hon | `0` hop le khi chua co report; so duong hop le khi co du lieu | AN-B6..AN-B8 |
| `totalRevenue` | So khong am | `0`, gia tri duong | Field ton tai va co kieu so | AN-B9, AN-B10 |
| `orderStats` | Array | `[]`, array mot phan tu, nhieu phan tu | Luon la array | AN-B11..AN-B13 |

### 3.2. Gia tri bien Studio Service

| Tham so | Mien hop le | Gia tri kiem thu | Ky vong | Tag |
|---|---|---|---|---|
| `studio_id` | ID studio ton tai | `0`, `1`, `{{studioId}}`, `999999` | ID ton tai hop le; `999999` tra `404` | ST-B1..ST-B4 |
| `bookingId` | ID booking ton tai | Rong, ID vua tao, `999999` | Rong bi pre-request chan; ID ton tai tra `200`; `999999` tra `404` | ST-B5..ST-B7 |
| Start so voi hien tai | Start phai o tuong lai | Qua khu, bang gan hien tai, tuong lai | Qua khu tra `400`; tuong lai hop le | ST-B8..ST-B10 |
| End so voi start | `end > start` | End truoc start, bang start, sau start 1 gio | Hai gia tri dau tra `400`; gia tri sau hop le | ST-B11..ST-B13 |
| Giao nhau lich | Khong overlap booking scheduled | Ket thuc bang start cu, giao mot phan, trung toan bo | Bien tiep giap hop le; giao nhau tra `409` | ST-B14..ST-B16 |
| `status` studio | Enum 3 gia tri | `available`, `booked`, `maintenance`, `invalid` | Ba enum tra `200`; invalid tra `400` | ST-B17..ST-B20 |
| `orderId` path | ID order co booking | `0`, ID ton tai, `999999` | ID co booking tra `200`; khong co booking tra `404` | ST-B21..ST-B23 |

---

## 4. Cau 3. Thiet ke test case

### 4.1. Test case API Gateway

| TC | Method/Endpoint | Muc tieu | Ket qua mong doi | Tu dong hoa | Tag |
|---:|---|---|---|---|---|
| GW-TC01 | `GET /health` | Kiem tra gateway dang chay | `200`, `success=true`, service `api-gateway` | Co | GW-V1 |
| GW-TC02 | `GET /health/all` | Kiem tra tong hop service | `200`, co auth/order/task/file/studio/notification | Co | GW-V2 |
| GW-TC03 | `GET /analytics/reports/overview` | Kiem tra proxy analytics bang admin | `200`, report dung shape | Co | GW-V3, GW-V5 |
| GW-TC04 | `GET /reports/overview` | Kiem tra alias reports sau fix KAN-76 | `200`, report dung shape | Co | GW-V4 |
| GW-TC05 | `GET /reports/overview` khong token | Kiem tra gateway forward auth requirement | `401` | Gian tiep | GW-X5 |
| GW-TC06 | `GET /reports/overview` token artist | Kiem tra gateway giu ket qua RBAC downstream | `403` | Gian tiep | GW-X6 |
| GW-TC07 | Downstream analytics khong phan hoi | Kiem tra proxy failure | `502`, message proxy failed | De xuat | GW-X7 |

### 4.2. Test case Analytics Service

| TC | Method/Endpoint | Muc tieu | Input chinh | Ket qua mong doi | Tag |
|---:|---|---|---|---|---|
| AN-TC01 | `GET /analytics/stats` | Admin xem dashboard | `{{admin_token}}` | `200`, dung report shape | AN-V1, AN-V2 |
| AN-TC02 | `GET /analytics/reports/overview` | Admin xem overview | `{{admin_token}}` | `200`, dung report shape | AN-V5 |
| AN-TC03 | `GET /analytics/stats` | Coordinator duoc phep | `{{coordinator_token}}` | `200` | AN-V2 |
| AN-TC04 | `GET /analytics/stats` | Artist bi chan | `{{artist_token}}` | `403` | AN-X3 |
| AN-TC05 | `GET /analytics/stats` | Thieu Bearer token | No Auth | `401`, `success=false` | AN-X1 |
| AN-TC06 | `GET /analytics/stats` | Token khong hop le | `{{invalid_token}}` | `401`, `success=false` | AN-X2 |
| AN-TC07 | `GET /analytics/stats` | Report chua co du lieu | Bang report khong co row | `200`, totals bang `0`, stats rong | AN-V4 |
| AN-TC08 | Hai endpoint analytics | Doi chieu shape | Dashboard va overview | Cung co `totalRevenue`, `totalOrders`, `orderStats` | AN-V3, AN-V5 |
| AN-TC09 | `GET /reports/overview` | Regression alias gateway | Admin token | `200`, khong con route `/overview` sai | AN-V5, AN-X6 |

### 4.3. Test case Studio Service

#### 4.3.1. Danh sach studio va tao booking

| TC | Muc tieu | Input chinh | Ket qua mong doi | Tu dong hoa | Tag |
|---:|---|---|---|---|---|
| ST-TC01 | Lay danh sach studio | `GET /studio/studios`, No Auth | `200`, payload la array | Co | ST-V5 |
| ST-TC02 | Tao booking hop le | Artist token, studio available, gio tuong lai | `201`, luu `bookingId` | Co | ST-V1..ST-V6 |
| ST-TC03 | Tao booking thieu field | Thieu cac field bat buoc | `400` | Co | ST-X3 |
| ST-TC04 | Tao booking trong qua khu | Start/end o qua khu | `400` | Co | ST-X6 |
| ST-TC05 | Ngay sai dinh dang | `start_time=invalid-date` | `400` | De xuat | ST-X4 |
| ST-TC06 | End bang start | Hai moc thoi gian bang nhau | `400` | De xuat | ST-X5, ST-B12 |
| ST-TC07 | End truoc start | End nho hon start | `400` | De xuat | ST-X5, ST-B11 |
| ST-TC08 | Studio khong ton tai | `studio_id=999999` | `404` | Co | ST-X7 |
| ST-TC09 | Studio maintenance | Studio status `maintenance` | `400`, studio khong san sang | Gian tiep | ST-X8 |
| ST-TC10 | Khung gio trung | Hai booking giao nhau | `409` | Da quan sat | ST-X9 |

#### 4.3.2. RBAC va vong doi booking

| TC | Method/Endpoint | Muc tieu | Ket qua mong doi | Tu dong hoa | Tag |
|---:|---|---|---|---|---|
| ST-TC11 | `GET /bookings/all` | Studio admin xem booking | `200`, array | Co | ST-V7 |
| ST-TC12 | `GET /bookings/all` | Artist bi chan | `403` | Co | ST-X10 |
| ST-TC13 | `POST /bookings/:id/confirm` | Confirm booking hop le | `200`, `success=true` | Co | ST-V8 |
| ST-TC14 | `POST /bookings/999999/confirm` | Confirm booking khong ton tai | `404` | Co | ST-X11 |
| ST-TC15 | `POST /bookings/:id/reject` | Reject booking hop le | `200`, `success=true` | Co | ST-V8 |
| ST-TC16 | `POST /bookings/999999/reject` | Reject booking khong ton tai | `404` | De xuat | ST-X11 |
| ST-TC17 | `POST /bookings/:id/cancel` | Artist owner huy booking | `200`, `success=true` | Co | ST-V9 |
| ST-TC18 | `POST /bookings/:id/cancel` | Artist khac huy booking | `403` | Da quan sat | ST-X13 |
| ST-TC19 | `POST /bookings/999999/cancel` | Huy booking khong ton tai | `404` | De xuat | ST-X11 |
| ST-TC20 | Pre-request action | Khong co `bookingId` | Dung request, bao `Missing bookingId` | Co | ST-B5 |

#### 4.3.3. Cap nhat trang thai studio

| TC | Method/Endpoint | Muc tieu | Input chinh | Ket qua mong doi | Tag |
|---:|---|---|---|---|---|
| ST-TC21 | `PUT /studios/:id/status` | Chuyen available | `status=available` | `200` | ST-V10 |
| ST-TC22 | `PUT /studios/:id/status` | Chuyen maintenance | `status=maintenance` | `200` | ST-V10 |
| ST-TC23 | `PUT /studios/:id/status` | Reset available sau maintenance | `status=available` | `200` | ST-V10 |
| ST-TC24 | `PUT /studios/:id/status` | Status ngoai enum | `status=invalid` | `400` | ST-X14 |
| ST-TC25 | `PUT /studios/999999/status` | Studio khong ton tai | Status hop le | `404` | ST-X16 |
| ST-TC26 | `PUT /studios/:id/status` | Artist cap nhat status | Artist token | `403` | ST-X12 |

### 4.4. Test flow va regression lien service

| TC | Flow | Ket qua mong doi |
|---:|---|---|
| FL-TC01 | Login Admin -> Gateway Reports Proxy -> Reports Alias | Ca hai reports `200`, cung response shape |
| FL-TC02 | Login Coordinator -> Analytics Stats | Login `200`, analytics `200` |
| FL-TC03 | Login Artist -> Prepare Booking Time -> Create Booking | Tao booking `201`, luu `bookingId` |
| FL-TC04 | Login Studio Admin -> Get All -> Confirm -> Reject | Moi action dung status mong doi va `success=true` |
| FL-TC05 | Create Booking -> Cancel bang artist owner | Cancel `200` |
| FL-TC06 | Maintenance -> Reset Available -> Create Booking | Reset `200`, create `201`; khong de state lam hong lan CI sau |
| FL-TC07 | Regression KAN-76 | `/analytics/reports/overview` va `/reports/overview` deu `200` |

### 4.5. Nhan xet ve do bao phu

| Tieu chi | Ket qua |
|---|---|
| API Gateway smoke test | Dat: gateway health va all-services health |
| API Gateway routing | Dat: analytics proxy va alias regression KAN-76 |
| Analytics happy path | Dat: stats va reports overview bang admin/coordinator |
| Analytics auth/RBAC | Dat: no token, invalid token, artist forbidden, coordinator allowed |
| Analytics response contract | Dat: `totalRevenue`, `totalOrders`, `orderStats` |
| Studio happy path | Dat: list, create, all bookings, confirm, reject, cancel, status update |
| Studio auth/RBAC | Dat: artist forbidden voi all bookings, owner cancel, token theo role |
| Studio validation | Dat: missing fields, past time, invalid status |
| Studio not found | Dat: studio, booking confirm va booking create voi studio khong ton tai |
| State cleanup | Dat: reset studio ve `available`, sinh thoi gian booking moi |
| Case de xuat bo sung | Date sai format, end <= start, reject/cancel not found, artist update status, downstream 502 |

---

## 5. Cau 4. Trien khai kiem thu tu dong bang Postman

### 5.1. File Postman su dung

| File | Vai tro |
|---|---|
| `postman/Presentation.postman_collection.json` | Collection chua smoke, happy path, negative, RBAC va regression |
| `postman/MutraPro Local.postman_environment.json` | Chua `baseUrl`, token theo role, studio/order/booking ID va thoi gian test |
| `tests/fixtures/upload-test.mp3` | Fixture dung trong collection tong; khong thuoc ba service cua bao cao nhung can cho Newman toan bo collection |

### 5.2. Bien moi truong quan trong

| Bien | Muc dich |
|---|---|
| `baseUrl` | Gateway base URL, vi du `http://localhost:3007/api` |
| `admin_token`, `admin_id` | Truy cap analytics voi role admin |
| `coordinator_token`, `coordinator_id` | Kiem thu role coordinator duoc phep |
| `artist_token`, `artist_id` | Tao va huy booking cua artist |
| `studio_admin_token`, `studio_admin_id` | Xem/action booking va cap nhat studio status |
| `invalid_token` | Kiem thu token khong hop le |
| `studioId`, `orderId`, `bookingId` | Lien ket du lieu studio booking flow |
| `studio_booking_start_time`, `studio_booking_end_time` | Thoi gian tuong lai duoc sinh moi cho booking |

Khong dung token hard-code hoac bien chung `token` cho cac request moi. Token duoc luu rieng theo role de tranh request nay ghi de token cua request khac.

### 5.3. Cau truc folder Postman

```text
Presentation
`-- api
    |-- api-gateway
    |   |-- Gateway Health
    |   |-- All Services Health
    |   |-- Proxy Analytics Reports Overview
    |   `-- Reports Alias - Fixed KAN-76
    |-- analytics-service
    |   |-- Login Admin
    |   |-- Dashboard Stats
    |   `-- Reports Overview
    |-- studio-service
    |   |-- Login Studio Admin
    |   |-- Login Artist
    |   |-- Get Studios
    |   |-- Update Studio Status - Available
    |   |-- Update Studio Status - Maintenance
    |   |-- Update Studio Status - Reset Available
    |   |-- Prepare Booking Time
    |   |-- Create Booking
    |   |-- Get All Bookings
    |   |-- Confirm Booking
    |   |-- Reject Booking
    |   `-- Cancel Booking
    `-- My Scope - Analytics Gateway Studio
        |-- 00 - Setup
        |-- 01 - API Gateway
        |-- 02 - Analytics Service
        |-- 03 - Studio Service
        `-- 04 - Negative & RBAC
```

Folder service chinh dung de smoke/happy path. Folder `04 - Negative & RBAC` giu cac case loi de folder chinh khong co qua nhieu request.

### 5.4. Assertion chinh

Analytics va reports kiem tra ca HTTP status va response contract:

```js
pm.test("HTTP 200", () => pm.response.to.have.status(200));

const json = pm.response.json();
const payload = json.data?.data || json.data || json;

pm.test("Report shape is valid", () => {
  pm.expect(payload).to.have.property("totalRevenue");
  pm.expect(payload).to.have.property("totalOrders");
  pm.expect(payload).to.have.property("orderStats");
  pm.expect(payload.orderStats).to.be.an("array");
});
```

Create Booking luu ID cho request sau:

```js
pm.test("HTTP 201", () => pm.response.to.have.status(201));

const json = pm.response.json();
const payload = json.data || json;
const bookingId = payload.id || payload.bookingId;

pm.test("Booking created and id saved", () => {
  pm.expect(bookingId).to.exist;
});

if (bookingId) {
  pm.environment.set("bookingId", String(bookingId));
  pm.collectionVariables.set("bookingId", String(bookingId));
}
```

Confirm, Reject va Cancel co guard de chan false failure do thieu ID:

```js
const bookingId =
  pm.environment.get("bookingId") ||
  pm.collectionVariables.get("bookingId");

if (!bookingId) {
  throw new Error("Missing bookingId: run Create Booking first.");
}
```

Action booking kiem tra `success=true`, khong chi kiem tra `message`, vi error response cung co the co message:

```js
pm.test("HTTP 200", () => pm.response.to.have.status(200));

const json = pm.response.json();
pm.test("Action success", () => {
  pm.expect(json.success).to.eql(true);
});
```

### 5.5. Lien he test case voi code

| Nhom test | Code lien quan | Hanh vi duoc xac minh |
|---|---|---|
| Gateway health | `api-gateway/index.js` | Response health va tong hop trang thai downstream |
| Gateway proxy/alias | `api-gateway/index.js` | Forward request, giu status/header/body va route reports dung prefix |
| Analytics auth/RBAC | `analytics-service/index.js`, `shared/middleware/auth.js` | JWT va role admin/coordinator |
| Analytics report | `analytics-service/index.js` | Doc `report_dashboard`, fallback report rong, contract response |
| Studio create booking | `studio-service/index.js` | Required fields, date validation, studio availability, overlap, insert DB |
| Studio action booking | `studio-service/index.js` | Role, owner, not found, confirm/reject/cancel |
| Studio status | `studio-service/index.js`, validation middleware | Enum status, ID validation, not found va notification broadcast |

### 5.6. Bug va regression da ghi nhan

Trong qua trinh test da phat hien bug:

```text
KAN-76 - Reports alias /reports/overview route sai sang /overview
```

Buoc tai hien:

1. Login Admin de lay `admin_token`.
2. Goi `GET /analytics/reports/overview`: `200`.
3. Goi `GET /reports/overview`: truoc khi fix tra `404 Route not found - /overview`.

Sau khi API Gateway sua route, request duoc doi thanh `Reports Alias - Fixed KAN-76` va duoc dua vao regression. Expected hien tai la `200` va response shape giong endpoint analytics chinh.

### 5.7. Thu tu regression chinh

```text
1. Login Admin
2. Login Studio Admin
3. Login Coordinator
4. Login Artist
5. Gateway Health
6. All Services Health
7. Proxy Analytics Reports Overview
8. Reports Alias - Fixed KAN-76
9. Dashboard Stats
10. Reports Overview
11. Get Studios
12. Update Studio Status - Available
13. Update Studio Status - Maintenance
14. Update Studio Status - Reset Available
15. Prepare Booking Time
16. Create Booking
17. Get All Bookings
18. Confirm Booking
19. Reject Booking
20. Cancel Booking
21. Negative & RBAC cases
```

`Prepare Booking Time` sinh thoi gian moi va `Reset Available` dua studio ve trang thai san sang. Hai buoc nay giup lan chay Newman sau khong bi phu thuoc du lieu cu.

---

## 6. Ket luan

Bao cao da tong hop pham vi kiem thu cho `api-gateway`, `analytics-service` va `studio-service` dua tren source code, Postman collection va nhat ky test cua du an.

- `api-gateway` da co smoke test, health tong hop, analytics proxy va regression alias reports.
- `analytics-service` da duoc kiem thu happy path, JWT, RBAC va response contract voi role admin/coordinator/artist.
- `studio-service` da co bo test cho danh sach studio, create booking, booking lifecycle, update status, validation, RBAC va not-found.
- Collection da chuan hoa token theo role, sinh du lieu thoi gian dong, luu `bookingId` va kiem tra `success=true` de tranh false pass.
- Bug routing KAN-76 da duoc phat hien bang so sanh endpoint chinh va alias, sau do dua vao regression.
- Cac gia tri bien quan trong da duoc bao phu: token thieu/sai, role hop le/khong hop le, ID ton tai/khong ton tai, thoi gian qua khu, quan he start/end, status enum va booking overlap.

Mot so test nen bo sung de tang do bao phu: ngay sai dinh dang, end bang/truc start, reject/cancel booking khong ton tai, artist cap nhat studio status va gateway downstream `502`. Nhin chung, bo test hien tai da bao phu cac nhom smoke, happy path, auth/RBAC, validation, not-found, stateful flow va regression quan trong cua ba service.
