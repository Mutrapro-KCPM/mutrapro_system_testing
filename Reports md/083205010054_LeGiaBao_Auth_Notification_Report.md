# Bao cao kiem thu chuc nang auth-service va notification-service

**Mon hoc:** Kiem thu phan mem  
**Chu de:** Phan hoach lop tuong duong, phan tich gia tri bien, thiet ke test case va kiem thu API tu dong  
**Du an:** MuTraPro System Testing  
**Pham vi:** `auth-service`, `notification-service`  
**Cong cu kiem thu tu dong:** Postman Collection  
**Nguon doi chieu:** `services/auth-service`, `services/notification-service`, `shared/middleware`, `init-scripts/init.sql`, `postman/Presentation.postman_collection.json`

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

He thong MuTraPro duoc tach thanh nhieu microservice. Bao cao nay tap trung vao 2 service:

| Service | File chinh | Chuc nang duoc kiem thu |
|---|---|---|
| `auth-service` | `services/auth-service/index.js` | Dang ky, dang nhap, xac thuc token, phan quyen theo role, doi mat khau, lay thong tin user, admin CRUD user |
| `notification-service` | `services/notification-service/index.js` | Health check, tao notification, lay danh sach notification, danh dau da doc, dang ky FCM device, gui realtime/push notification |

### 1.1. Cac endpoint chinh cua auth-service

| Method | Endpoint qua gateway | Muc dich | Dieu kien bao ve |
|---|---|---|---|
| `POST` | `/auth/register` | Dang ky user moi | Public, co validation body |
| `POST` | `/auth/login` | Dang nhap va cap JWT | Public, co validation body |
| `GET` | `/auth/verify` | Kiem tra token hop le | Can Bearer token |
| `GET` | `/auth/users/specialists?role=...` | Lay danh sach chuyen vien | Can token va role `coordinator` |
| `PUT` | `/auth/users/:id` | Cap nhat ten profile | Chi dung user do duoc sua |
| `PUT` | `/auth/users/:id/password` | Doi mat khau | Chi dung user do duoc doi |
| `GET` | `/auth/users/:id` | Lay thong tin co ban cua user | Internal/public theo code hien tai, co validate id |
| `GET` | `/auth/users/by-role/:role` | Lay danh sach id theo role | Internal/public theo code hien tai |
| `GET` | `/auth/admin/users` | Admin lay tat ca user | Can role `admin` |
| `POST` | `/auth/admin/users` | Admin tao user | Can role `admin`, co validation body |
| `PUT` | `/auth/admin/users/:id` | Admin cap nhat user | Can role `admin`, chan admin tu sua chinh minh |
| `DELETE` | `/auth/admin/users/:id` | Admin xoa mem user | Can role `admin`, chan admin tu xoa chinh minh |

### 1.2. Cac endpoint chinh cua notification-service

| Method | Endpoint qua gateway | Muc dich | Dieu kien bao ve |
|---|---|---|---|
| `GET` | `/notifications/health` | Health check service | Public |
| `POST` | `/notifications/send` | Luu notification vao database | Public/internal theo code hien tai |
| `GET` | `/notifications?page=&limit=` | Lay notification cua user hien tai | Can Bearer token |
| `PATCH` | `/notifications/:id/read` | Danh dau notification da doc | Owner hoac role `admin` |
| `POST` | `/notifications/register-device` | Dang ky FCM token thiet bi | Public theo code hien tai |
| `POST` | `/notifications/notify` | Gui realtime notification hoac push khi user offline | Public/internal theo code hien tai |

---

## 2. Cau 1. Xac dinh lop tuong duong

### 2.1. Lop tuong duong cho auth-service

| Nhom du lieu | Lop hop le | Tag | Lop khong hop le | Tag |
|---|---|---|---|---|
| `name` khi register | Chuoi khong rong, do dai `2..100` | AU-V1 | Rong, thieu, do dai `<2`, do dai `>100` | AU-X1, AU-X2, AU-X3 |
| `email` khi register/login | Email dung dinh dang, chua bi trung khi register | AU-V2 | Sai dinh dang, rong/thieu, email da ton tai khi register, email khong ton tai khi login | AU-X4, AU-X5, AU-X6, AU-X7 |
| `password` khi register | Chuoi khong rong, do dai `>=6` | AU-V3 | Rong/thieu, do dai `<6` | AU-X8, AU-X9 |
| `password` khi login | Mat khau dung cua email | AU-V4 | Mat khau sai | AU-X10 |
| Bearer token | JWT hop le, chua het han | AU-V5 | Thieu token, token het han, token bi sua | AU-X11, AU-X12, AU-X13 |
| Role truy cap specialist | User role `coordinator`, query role thuoc `transcriber/arranger/artist` | AU-V6 | User khong phai coordinator, query role khong hop le | AU-X14, AU-X15 |
| `id` tren URL | So nguyen `>=1`, user ton tai khi can truy van | AU-V7 | Khong phai so, nho hon 1, user khong ton tai | AU-X16, AU-X17, AU-X18 |
| Doi mat khau | Dung owner, oldPassword dung, newPassword `>=6` | AU-V8 | Sai owner, oldPassword sai, newPassword `<6` | AU-X19, AU-X20, AU-X21 |
| Admin CRUD user | Token role `admin`, role moi thuoc enum hop le | AU-V9 | Khong phai admin, admin tu sua/xoa minh, role khong hop le, email trung | AU-X22, AU-X23, AU-X24, AU-X25 |

### 2.2. Lop tuong duong cho notification-service

| Nhom du lieu | Lop hop le | Tag | Lop khong hop le/hanh vi can quan sat | Tag |
|---|---|---|---|---|
| Health check | Service tra `status=ok` | NO-V1 | Service loi/khong phan hoi | NO-X1 |
| `user_id` khi `/send` | Co the parse thanh so nguyen | NO-V2 | Khong parse duoc so | NO-X2 |
| `title` khi `/send` | Chuoi khong rong, do dai toi da 255 theo DB | NO-V3 | Thieu/null, do dai `>255` | NO-X3, NO-X4 |
| `message` khi `/send` | Chuoi khong rong theo DB | NO-V4 | Thieu/null | NO-X5 |
| `channel` khi `/send` | `push`, `email`, `sms`, hoac bo qua de default `push` | NO-V5 | Gia tri ngoai enum | NO-X6 |
| Token khi list/read | Bearer token hop le | NO-V6 | Thieu token, token sai/het han | NO-X7, NO-X8 |
| Phan trang | `page >= 1`, `1 <= limit <= 100`; code tu dong clamp gia tri ngoai bien | NO-V7 | `page=0`, `limit=0`, `limit>100` duoc chuan hoa | NO-X9 |
| `notification id` | Ton tai va thuoc owner hoac admin | NO-V8 | Khong ton tai, khong phai owner, id bien 0 | NO-X10, NO-X11, NO-X12 |
| `userId` va `fcmToken` khi register-device | Day du, token khong rong, do dai `<=255` | NO-V9 | Thieu userId, thieu token, token rong, token `>255` | NO-X13, NO-X14, NO-X15, NO-X16 |
| `/notify` realtime/push | `userId` hop le hoac `broadcast`, co `eventName`, `data` tuy chon | NO-V10 | Thieu `userId`, thieu `eventName`, endpoint hien tai van co the tra 200 | NO-X17, NO-X18 |
| Bao mat endpoint noi bo | Chi service noi bo nen goi `/send`, `/notify`, `register-device` | NO-V11 | Code hien tai cho phep goi khong can internal token | NO-X19 |

---

## 3. Cau 2. Phan tich gia tri bien

### 3.1. Gia tri bien auth-service

| Tham so | Mien hop le | Gia tri kiem thu | Ky vong | Tag |
|---|---|---|---|---|
| Do dai `name` khi register | `2..100` ky tu | `1`, `2`, `14`, `100`, `101` | `1` va `101` bi tu choi; `2`, `14`, `100` hop le | AU-B1..AU-B5 |
| Do dai `password` | `>=6` ky tu | `5`, `6`, `11` | `5` bi tu choi; `6` va `11` hop le | AU-B6..AU-B8 |
| `id` tren path | So nguyen `>=1` | `0`, `1`, `{{auto_user_id}}`, `99999`, `abc` | `0/abc` sai validation; `99999` khong tim thay; id ton tai hop le | AU-B9..AU-B13 |
| Query `role` specialists | `transcriber`, `arranger`, `artist` | `customer`, `transcriber`, `arranger`, `artist`, rong/thieu | Role chuyen vien hop le tra `200`; role khac/rong tra `400` hoac bi chan quyen | AU-B14..AU-B18 |
| Bearer token | JWT hop le, chua het han | Thieu token, token hop le, token het han, token bi sua | Token hop le tra `200`; cac token con lai tra `401/403` | AU-B19..AU-B22 |

### 3.2. Gia tri bien notification-service

| Tham so | Mien hop le | Gia tri kiem thu | Ky vong | Tag |
|---|---|---|---|---|
| `user_id` khi `/send` | Parse duoc thanh so nguyen | `abc`, `0`, `{{userId}}`, `-1` | `abc` tra `400`; `{{userId}}` hop le; `0/-1` la hanh vi can quan sat vi code hien tai co the chap nhan | NO-B1..NO-B5 |
| Do dai `title` | `1..255` ky tu theo DB | Thieu, `1`, chuoi binh thuong, `255`, `256` | Thieu/qua dai gay loi; gia tri trong mien hop le tao notification | NO-B6..NO-B10 |
| `channel` | `push`, `email`, `sms` | Ngoai enum, `push`, `email`, `sms`, bo qua | `push/email/sms` hop le; bo qua default `push`; ngoai enum gay loi DB | NO-B11..NO-B15 |
| `page` khi list | `>=1` | `0`, `1` | `0` duoc clamp ve `1`; `1` hop le | NO-B16..NO-B18 |
| `limit` khi list | `1..100` | `0`, `1`, `10`, `100`, `101` | `0` duoc clamp ve `1`; `101` duoc clamp ve `100`; cac gia tri trong mien hop le | NO-B19..NO-B23 |
| Do dai `fcmToken` | `1..255` ky tu | Rong, `1`, token fake, `255`, `256` | Rong tra `400`; `255` hop le; `256` tra `500` theo code hien tai | NO-B24..NO-B28 |
| `notification id` | Id ton tai trong DB | `0`, `1`, `{{notificationId}}`, `999999` | Id ton tai va dung owner/admin tra `200`; `0/999999` tra `404` | NO-B29..NO-B32 |

---

## 4. Cau 3. Thiet ke test case

### 4.1. Test case auth-service

#### 4.1.1. Dang ky tai khoan - `POST /auth/register`

| TC | Muc tieu | Input chinh | Ket qua mong doi | Tag |
|---:|---|---|---|---|
| AU-TC01 | Dang ky hop le | `name=Auto Test User`, email moi, password hop le | `201`, co `id`, message thanh cong | AU-V1, AU-V2, AU-V3 |
| AU-TC02 | Chan email trung | Dung lai email da tao | `409`, `Email already exists.` | AU-X6 |
| AU-TC03 | Kiem tra bien duoi cua `name` | `name=A` | `400`, loi field `name` | AU-X3, AU-B1 |
| AU-TC04 | Kiem tra email sai format | `email=invalid_email_format.com` | `400`, loi field `email` | AU-X4 |
| AU-TC05 | Kiem tra `name` tai min | `name=Ab` | `201`, co `id` | AU-V1, AU-B2 |
| AU-TC06 | Kiem tra `name` tai max | `name={{name_100}}` | `201`, co `id` | AU-V1, AU-B4 |
| AU-TC07 | Kiem tra `name` vuot max | `name={{name_101}}` | `400`, loi field `name` | AU-X3, AU-B5 |

#### 4.1.2. Dang nhap va xac thuc token - `POST /auth/login`, `GET /auth/verify`

| TC | Muc tieu | Input chinh | Ket qua mong doi | Tag |
|---:|---|---|---|---|
| AU-TC08 | Dang nhap hop le | Email/password vua dang ky | `200`, co `token`, co thong tin user | AU-V4, AU-V5 |
| AU-TC09 | Sai mat khau | Password sai | `401`, thong bao credential khong dung | AU-X10 |
| AU-TC10 | Email khong ton tai | Email random | `401`, thong bao credential khong dung | AU-X7 |
| AU-TC11 | Email sai format | `email=invalid_email_format.com` | `400`, loi field `email` | AU-X4 |
| AU-TC12 | Password rong | `password=""` | `400`, loi field `password` | AU-X8 |
| AU-TC13 | Verify token hop le | Bearer `{{auth_token}}` | `200`, token hop le | AU-V5 |
| AU-TC14 | Verify thieu token | Khong co Bearer token | `401` hoac `403`, `success=false` | AU-X11 |
| AU-TC15 | Verify token het han | Token expired | `401`, `success=false` | AU-X12 |
| AU-TC16 | Verify token bi sua | Token tampered | `401`, `success=false` | AU-X13 |

#### 4.1.3. Phan quyen, profile va password

| TC | Method/Endpoint | Muc tieu | Input chinh | Ket qua mong doi | Tag |
|---:|---|---|---|---|---|
| AU-TC17 | `GET /auth/users/specialists?role=transcriber` | Customer bi chan | Token customer | `403` | AU-X14 |
| AU-TC18 | `GET /auth/users/specialists?role=transcriber` | Coordinator lay danh sach chuyen vien | Token coordinator | `200`, array user co `id`, `name` | AU-V6 |
| AU-TC19 | `PUT /auth/users/{{auto_user_id}}/password` | Doi mat khau hop le | `oldPassword` dung, `newPassword=newpassword123` | `200`, doi mat khau thanh cong | AU-V8 |
| AU-TC20 | `PUT /auth/users/{{auto_user_id}}/password` | Sai old password | `oldPassword=wrongpassword123` | `401`, mat khau cu khong dung | AU-X20 |
| AU-TC21 | `PUT /auth/users/{{auto_user_id}}/password` | New password duoi bien | `newPassword=12345` | `400` | AU-X21, AU-B6 |
| AU-TC22 | `PUT /auth/users/99999/password` | User doi password cua user khac | Token user A, path id user khac | `403` | AU-X19 |
| AU-TC23 | `PUT /auth/users/{{auto_user_id}}/password` | New password tai min | `newPassword=123456` | `200` | AU-V8, AU-B7 |
| AU-TC24 | `GET /auth/users/{{auto_user_id}}` | Lay user theo id hop le | Id ton tai | `200`, co `id/name/email/role` | AU-V7 |
| AU-TC25 | `GET /auth/users/99999` | Lay user khong ton tai | Id khong ton tai | `404` | AU-X18 |
| AU-TC26 | `GET /auth/users/abc` | Id sai dinh dang | `id=abc` | `400`, loi field `id` | AU-X16 |

#### 4.1.4. Admin CRUD va flow auth

| TC | Muc tieu | Buoc/Input chinh | Ket qua mong doi | Tag |
|---:|---|---|---|---|
| AU-TC27 | Admin login | `admin@mutrapro.com`, `Admin@123` | `200`, user role `admin` | AU-V9 |
| AU-TC28 | Lay id theo role | `GET /auth/users/by-role/customer` | `200`, array chi co `id` | AU-V9 |
| AU-TC29 | Admin lay danh sach users | `GET /auth/admin/users` voi token admin | `200`, khong tra `password_hash` | AU-V9 |
| AU-TC30 | Admin tao user | `POST /auth/admin/users`, `role=transcriber` | `201`, luu `target_user_id` | AU-V9 |
| AU-TC31 | Admin cap nhat user | Doi `name`, `role=coordinator` | `200` | AU-V9 |
| AU-TC32 | Chan admin tu sua minh | Path id la `{{admin_id}}` | `400` | AU-X23 |
| AU-TC33 | Admin xoa user | `DELETE /auth/admin/users/{{target_user_id}}` | `200`, xoa mem | AU-V9 |
| AU-TC34 | Chan admin tu xoa minh | Path id la `{{admin_id}}` | `400` | AU-X23 |
| AU-TC35 | Admin tao email trung | `email=admin@mutrapro.com` | `409` | AU-X25 |
| AU-TC36 | Flow user end-to-end | Register -> login -> verify -> change password | Tat ca buoc chinh `201/200` | AU-V1..AU-V8 |
| AU-TC37 | Flow admin lifecycle | Tao user -> login -> update role -> login lai -> delete -> login fail | Sau delete, login tra `401` | AU-V9, AU-X18 |
| AU-TC38 | Flow coordinator role | Login coordinator -> get specialists -> customer bi chan -> role invalid | `200`, `403`, `400` tuong ung | AU-V6, AU-X14, AU-X15 |

### 4.2. Test case notification-service

#### 4.2.1. Health check va tao notification - `GET /notifications/health`, `POST /notifications/send`

| TC | Muc tieu | Input chinh | Ket qua mong doi | Tag |
|---:|---|---|---|---|
| NO-TC01 | Health check notification | Khong co body | `200`, `service=notification-service`, `status=ok` | NO-V1 |
| NO-TC02 | Tao notification channel push | `user_id={{userId}}`, `channel=push` | `201`, co `id` | NO-V2, NO-V3, NO-V4, NO-V5 |
| NO-TC03 | Tao notification channel email | `channel=email` | `201` | NO-V5, NO-B12 |
| NO-TC04 | Tao notification channel sms | `channel=sms` | `201` | NO-V5, NO-B13 |
| NO-TC05 | Tao notification default channel | Bo qua `channel` | `201`, default `push` | NO-B15 |
| NO-TC06 | `user_id` khong phai so | `user_id=abc` | `400`, user_id bat buoc la so | NO-X2, NO-B1 |
| NO-TC07 | Thieu `title` | Khong co `title` | `500` theo hanh vi hien tai | NO-X3 |
| NO-TC08 | `user_id=0` | `user_id=0` | Postman quan sat `201`; nen validate them | NO-B2, NO-X9 |
| NO-TC09 | `user_id` am | `user_id=-1` | `201` theo code hien tai | NO-B5 |
| NO-TC10 | `title` tai max DB | `title={{title_255}}` | `201` | NO-V3, NO-B9 |
| NO-TC11 | `title` vuot max DB | `title={{title_256}}` | `500` | NO-X4, NO-B10 |

#### 4.2.2. Lay danh sach va danh dau da doc

| TC | Method/Endpoint | Muc tieu | Input chinh | Ket qua mong doi | Tag |
|---:|---|---|---|---|---|
| NO-TC12 | `GET /notifications?page=1&limit=10` | List notification hop le | Token hop le | `200`, `success=true`, co `items`, `pagination` | NO-V6, NO-V7 |
| NO-TC13 | `GET /notifications?page=1&limit=10` | List thieu token | Khong token | `401` | NO-X7 |
| NO-TC14 | `GET /notifications?page=1&limit=10` | List token sai | Token invalid | `401` | NO-X8 |
| NO-TC15 | `GET /notifications?page=0&limit=10` | Page duoi bien | `page=0` | `200`, code clamp ve page 1 | NO-X9, NO-B16 |
| NO-TC16 | `GET /notifications?page=1&limit=0` | Limit duoi bien | `limit=0` | `200`, code clamp ve 1 | NO-X9, NO-B19 |
| NO-TC17 | `GET /notifications?page=1&limit=100` | Limit tai max | `limit=100` | `200` | NO-V7, NO-B22 |
| NO-TC18 | `GET /notifications?page=1&limit=101` | Limit vuot max | `limit=101` | `200`, code clamp ve 100 | NO-X9, NO-B23 |
| NO-TC19 | `PATCH /notifications/{{notificationId}}/read` | Mark read hop le | Owner token | `200`, status thanh `sent` | NO-V8 |
| NO-TC20 | `PATCH /notifications/999999/read` | Mark read id khong ton tai | Id khong ton tai | `404` | NO-X10 |
| NO-TC21 | `PATCH /notifications/{{notificationId}}/read` | Mark read thieu token | Khong token | `401` | NO-X7 |
| NO-TC22 | `PATCH /notifications/{{other_user_noti_id}}/read` | User A mark notification cua user B | Khong phai owner | `403` | NO-X11 |
| NO-TC23 | `GET /notifications/0/read` | Mark read id bang 0 | `id=0` | `404` | NO-X12, NO-B29 |

#### 4.2.3. Dang ky device va notify realtime/push

| TC | Method/Endpoint | Muc tieu | Input chinh | Ket qua mong doi | Tag |
|---:|---|---|---|---|---|
| NO-TC24 | `POST /notifications/register-device` | Dang ky device hop le | `userId={{userId}}`, token fake | `200` | NO-V9 |
| NO-TC25 | `POST /notifications/register-device` | Thieu `userId` | Chi co `fcmToken` | `400` | NO-X13 |
| NO-TC26 | `POST /notifications/register-device` | Thieu `fcmToken` | Chi co `userId` | `400` | NO-X14 |
| NO-TC27 | `POST /notifications/register-device` | Duplicate token | Lap lai token cu | `200`, ON DUPLICATE khong loi | NO-V9 |
| NO-TC28 | `POST /notifications/register-device` | Token rong | `fcmToken=""` | `400` | NO-X15, NO-B24 |
| NO-TC29 | `POST /notifications/register-device` | Token tai max | `fcmToken={{fcm_255}}` | `200` | NO-V9, NO-B27 |
| NO-TC30 | `POST /notifications/register-device` | Token vuot max | `fcmToken={{fcm_256}}` | `500` theo code hien tai | NO-X16, NO-B28 |
| NO-TC31 | `POST /notifications/notify` | Notify broadcast | `userId=broadcast`, co `eventName`, co `data.message` | `200`, co message | NO-V10 |
| NO-TC32 | `POST /notifications/notify` | Notify single user | `userId={{userId}}`, co `eventName` | `200`, co message | NO-V10 |
| NO-TC33 | `POST /notifications/notify` | Notify khong co data | Co `userId`, `eventName`, bo qua `data` | `200` | NO-V10 |
| NO-TC34 | `POST /notifications/notify` | Thieu `userId` | Chi co `eventName`, `data` | `200` hoac `400`; Postman ghi nhan can validate | NO-X17 |
| NO-TC35 | `POST /notifications/notify` | Thieu `eventName` | Co `userId`, bo qua `eventName` | `200` hoac `400`; Postman ghi nhan can validate | NO-X18 |
| NO-TC36 | `POST /notifications/notify` | Security observation: notify public | Goi khong internal token | `200` theo code hien tai | NO-X19 |
| NO-TC37 | `POST /notifications/notify` | FCM offline user | User offline co token | `200`, message co push notification | NO-V10 |
| NO-TC38 | `POST /notifications/notify` | FCM user khong co token | `userId=99999` | `200`, service khong crash | NO-V10 |

#### 4.2.4. Flow notification

| TC | Muc tieu | Buoc chinh | Ket qua mong doi | Tag |
|---:|---|---|---|---|
| NO-TC39 | Flow owner notification | Create -> list -> mark read -> verify status | `201`, `200`, status `sent`, `sent_at != null` | NO-V2, NO-V6, NO-V8 |
| NO-TC40 | Flow cross-user security | Tao noti cho user B -> user A mark read -> admin mark read | User A `403`, admin `200` | NO-X11, NO-V8 |
| NO-TC41 | Flow device va offline notify | Register device -> notify offline user | `200`, notify tra success | NO-V9, NO-V10 |

### 4.3. Nhan xet ve do bao phu

| Tieu chi | Ket qua |
|---|---|
| Co test case hop le cho auth-service | Dat: register, login, verify, specialist, change password, admin CRUD |
| Co test case khong hop le cho auth-service | Dat: email trung, email sai format, password rong/sai, token thieu/sai/het han, role sai, id sai |
| Co test case bien cho auth-service | Dat: `name=1/2/100/101`, `newPassword=5/6`, `id=abc/99999` |
| Co test case hop le cho notification-service | Dat: send, list, read, register device, notify, FCM graceful |
| Co test case khong hop le cho notification-service | Dat: user_id sai, thieu title, title qua dai, thieu token, cross-user, thieu device field |
| Co test case bien cho notification-service | Dat: `title=255/256`, `limit=0/100/101`, `fcmToken=0/255/256`, `notificationId=0/999999` |
| Co flow test lien service | Dat: notification flow co su dung auth token va admin token |
| Co security observation | Dat: ghi nhan `/notifications/notify` va mot so endpoint notification hien tai chua bat internal token/auth |

---

## 5. Cau 4. Trien khai kiem thu tu dong bang Postman

### 5.1. File Postman su dung

| File | Vai tro |
|---|---|
| `postman/Presentation.postman_collection.json` | Chua collection test case cho cac service, trong do co folder `auth-service` va `notification-service` |
| `postman/MutraPro Local.postman_environment.json` | Chua bien moi truong nhu `baseUrl`, token, id user, email test, gia tri bien |

### 5.2. Cach Postman test duoc to chuc

| Folder | Noi dung |
|---|---|
| `api / auth-service / Register / BVA_A1` | Kiem thu dang ky user, email trung, bien do dai `name` |
| `api / auth-service / Login / BVA` | Kiem thu dang nhap hop le, sai password, email khong ton tai, email sai format, password rong |
| `api / auth-service / Xac thuc Token` | Kiem thu token hop le, thieu token, token het han, token bi sua |
| `api / auth-service / Lay ds chuyen vien` | Kiem thu role `coordinator` va role khong du quyen |
| `api / auth-service / Doi mat khau` | Kiem thu doi mat khau hop le, sai old password, new password duoi bien, sai owner |
| `api / auth-service / Admin` | Kiem thu admin login, list/create/update/delete user, chan self-update/self-delete |
| `api / auth-service / FlowTests -Auth` | Kiem thu luong end-to-end user, admin, coordinator |
| `api / notification-service / Health Check` | Kiem thu service song |
| `api / notification-service / Gui thong bao` | Kiem thu `/send` theo EP va BVA |
| `api / notification-service / Danh Sach Thong Bao` | Kiem thu list notification va phan trang |
| `api / notification-service / Danh Dau Da Doc` | Kiem thu owner/admin mark read va cross-user security |
| `api / notification-service / Dang Ky Thiet Bi` | Kiem thu register FCM token va bien do dai token |
| `api / notification-service / Notify Realtime & Push` | Kiem thu broadcast, single user, offline push va observation ve validation |
| `api / notification-service / FlowTests - Noti` | Kiem thu flow owner, cross-user security, device + offline notify |

### 5.3. Lien he test case voi code

| Nhom test | Code lien quan | Hanh vi duoc xac minh |
|---|---|---|
| Register/Login | `auth-service/index.js`, `shared/middleware/validation.js` | Validation input, hash password, kiem tra credential, tao JWT |
| Verify/Role | `auth-service/middleware/authMiddleware.js` | Bearer token va phan quyen role |
| Admin CRUD | `auth-service/index.js`, `init-scripts/init.sql` | Role enum, soft delete `is_deleted`, chan admin tu sua/xoa minh |
| Send notification | `notification-service/index.js`, `init-scripts/init.sql` | Insert bang `notifications`, default `channel=push`, loi DB khi thieu/vuot field |
| List/Read notification | `notification-service/index.js`, `shared/middleware/auth.js` | JWT auth, pagination, owner/admin authorization |
| Device/FCM/Notify | `notification-service/index.js` | Luu `user_devices`, realtime Socket.IO, fallback FCM khi offline |

---

## 6. Ket luan

Bao cao da tong hop lai pham vi kiem thu cho 2 service `auth-service` va `notification-service` dua tren code va Postman collection hien co cua project.

- `auth-service` da co bo test bao phu cac chuc nang dang ky, dang nhap, xac thuc token, phan quyen, doi mat khau va admin CRUD.
- `notification-service` da co bo test bao phu tao notification, list/read notification, dang ky device, notify realtime/push va cac flow bao mat owner/admin.
- Cac gia tri bien quan trong da duoc dua vao test: do dai `name`, do dai password, `title=255/256`, `limit=0/100/101`, `fcmToken=0/255/256`, token hop le/sai/thieu.
- Mot so test case ghi nhan hanh vi hien tai can luu y: `/notifications/send`, `/notifications/register-device`, `/notifications/notify` hien chua bat buoc auth/internal token; `user_id=0` hoac `-1` co the van duoc insert; thieu `title` hoac `title>255` tra `500` do loi DB thay vi validation `400`.

Nhin chung, bo test hien tai co ca kiem thu hop le, khong hop le, bien va flow end-to-end. Neu can nang chat luong API, nen bo sung validation ro rang hon cho notification-service de cac loi dau vao tra `400 Bad Request` thay vi `500 Internal Server Error`.
