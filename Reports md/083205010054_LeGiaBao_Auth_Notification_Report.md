# Bao cao kiem thu chuc nang auth-service va notification-service

**Mon hoc:** Kiem thu phan mem  
**Chu de:** Phan hoach lop tuong duong, phan tich gia tri bien, thiet ke test case va kiem thu API tu dong  
**Du an:** MuTraPro System Testing  
**Pham vi:** `auth-service`, `notification-service`  
**Cong cu kiem thu tu dong:** Postman Collection (kiem thu blackbox) va Jest + Supertest (kiem thu whitebox - unit test)  
**Nguon doi chieu:** `services/auth-service`, `services/notification-service`, `shared/middleware`, `init-scripts/init.sql`, `postman/Presentation.postman_collection.json`, `tests/unit/auth.test.js`, `tests/unit/authMiddleware.test.js`, `tests/unit/notification.test.js`

---

## Muc luc

1. [Tom tat pham vi kiem thu](#1-tom-tat-pham-vi-kiem-thu)
2. [Cau 1. Xac dinh lop tuong duong](#2-cau-1-xac-dinh-lop-tuong-duong)
3. [Cau 2. Phan tich gia tri bien](#3-cau-2-phan-tich-gia-tri-bien)
4. [Cau 3. Thiet ke test case](#4-cau-3-thiet-ke-test-case)
5. [Cau 4. Trien khai kiem thu tu dong bang Postman (Blackbox)](#5-cau-4-trien-khai-kiem-thu-tu-dong-bang-postman)
6. [Cau 5. Kiem thu Whitebox bang Unit Test (Jest + Supertest)](#6-cau-5-kiem-thu-whitebox-bang-unit-test-jest--supertest)
7. [Ket luan](#7-ket-luan)

---

## 1. Tom tat pham vi kiem thu

He thong MuTraPro duoc tach thanh nhieu microservice. Bao cao nay tap trung vao 2 service:

| Service                | File chinh                               | Chuc nang duoc kiem thu                                                                                                         |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `auth-service`         | `services/auth-service/index.js`         | Dang ky, dang nhap, xac thuc token, phan quyen theo role, doi mat khau, lay thong tin user, admin CRUD user                     |
| `notification-service` | `services/notification-service/index.js` | Health check, tao notification, lay danh sach notification, danh dau da doc, dang ky FCM device, gui realtime/push notification |

Bao cao ap dung 2 phuong phap kiem thu song song cho ca 2 service:

| Phuong phap | Cong cu         | Muc tieu                                                                                                                                                       | File chinh                                                                                        |
| ----------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Blackbox    | Postman         | Kiem thu qua API gateway theo goc nhin nguoi dung, khong quan tam code ben trong                                                                               | `postman/Presentation.postman_collection.json`, `postman/MutraPro Local.postman_environment.json` |
| Whitebox    | Jest, Supertest | Kiem thu truc tiep tren source code cua service (mock DB, Redis, bcrypt, JWT, Firebase), kiem tra tung nhanh logic, tung status code va tung dieu kien if/else | `tests/unit/auth.test.js`, `tests/unit/authMiddleware.test.js`, `tests/unit/notification.test.js` |

### 1.1. Cac endpoint chinh cua auth-service

| Method   | Endpoint qua gateway               | Muc dich                      | Dieu kien bao ve                                   |
| -------- | ---------------------------------- | ----------------------------- | -------------------------------------------------- |
| `POST`   | `/auth/register`                   | Dang ky user moi              | Public, co validation body                         |
| `POST`   | `/auth/login`                      | Dang nhap va cap JWT          | Public, co validation body                         |
| `GET`    | `/auth/verify`                     | Kiem tra token hop le         | Can Bearer token                                   |
| `GET`    | `/auth/users/specialists?role=...` | Lay danh sach chuyen vien     | Can token va role `coordinator`                    |
| `PUT`    | `/auth/users/:id`                  | Cap nhat ten profile          | Chi dung user do duoc sua                          |
| `PUT`    | `/auth/users/:id/password`         | Doi mat khau                  | Chi dung user do duoc doi                          |
| `GET`    | `/auth/users/:id`                  | Lay thong tin co ban cua user | Internal/public theo code hien tai, co validate id |
| `GET`    | `/auth/users/by-role/:role`        | Lay danh sach id theo role    | Internal/public theo code hien tai                 |
| `GET`    | `/auth/admin/users`                | Admin lay tat ca user         | Can role `admin`                                   |
| `POST`   | `/auth/admin/users`                | Admin tao user                | Can role `admin`, co validation body               |
| `PUT`    | `/auth/admin/users/:id`            | Admin cap nhat user           | Can role `admin`, chan admin tu sua chinh minh     |
| `DELETE` | `/auth/admin/users/:id`            | Admin xoa mem user            | Can role `admin`, chan admin tu xoa chinh minh     |

### 1.2. Cac endpoint chinh cua notification-service

| Method  | Endpoint qua gateway             | Muc dich                                             | Dieu kien bao ve                   |
| ------- | -------------------------------- | ---------------------------------------------------- | ---------------------------------- |
| `GET`   | `/notifications/health`          | Health check service                                 | Public                             |
| `POST`  | `/notifications/send`            | Luu notification vao database                        | Public/internal theo code hien tai |
| `GET`   | `/notifications?page=&limit=`    | Lay notification cua user hien tai                   | Can Bearer token                   |
| `PATCH` | `/notifications/:id/read`        | Danh dau notification da doc                         | Owner hoac role `admin`            |
| `POST`  | `/notifications/register-device` | Dang ky FCM token thiet bi                           | Public theo code hien tai          |
| `POST`  | `/notifications/notify`          | Gui realtime notification hoac push khi user offline | Public/internal theo code hien tai |

---

## 2. Cau 1. Xac dinh lop tuong duong

### 2.1. Lop tuong duong cho auth-service

| Nhom du lieu               | Lop hop le                                                              | Tag   | Lop khong hop le                                                                        | Tag                            |
| -------------------------- | ----------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------- | ------------------------------ |
| `name` khi register        | Chuoi khong rong, do dai `2..100`                                       | AU-V1 | Rong, thieu, do dai `<2`, do dai `>100`                                                 | AU-X1, AU-X2, AU-X3            |
| `email` khi register/login | Email dung dinh dang, chua bi trung khi register                        | AU-V2 | Sai dinh dang, rong/thieu, email da ton tai khi register, email khong ton tai khi login | AU-X4, AU-X5, AU-X6, AU-X7     |
| `password` khi register    | Chuoi khong rong, do dai `>=6`                                          | AU-V3 | Rong/thieu, do dai `<6`                                                                 | AU-X8, AU-X9                   |
| `password` khi login       | Mat khau dung cua email                                                 | AU-V4 | Mat khau sai                                                                            | AU-X10                         |
| Bearer token               | JWT hop le, chua het han                                                | AU-V5 | Thieu token, token het han, token bi sua                                                | AU-X11, AU-X12, AU-X13         |
| Role truy cap specialist   | User role `coordinator`, query role thuoc `transcriber/arranger/artist` | AU-V6 | User khong phai coordinator, query role khong hop le                                    | AU-X14, AU-X15                 |
| `id` tren URL              | So nguyen `>=1`, user ton tai khi can truy van                          | AU-V7 | Khong phai so, nho hon 1, user khong ton tai                                            | AU-X16, AU-X17, AU-X18         |
| Doi mat khau               | Dung owner, oldPassword dung, newPassword `>=6`                         | AU-V8 | Sai owner, oldPassword sai, newPassword `<6`                                            | AU-X19, AU-X20, AU-X21         |
| Admin CRUD user            | Token role `admin`, role moi thuoc enum hop le                          | AU-V9 | Khong phai admin, admin tu sua/xoa minh, role khong hop le, email trung                 | AU-X22, AU-X23, AU-X24, AU-X25 |

### 2.2. Lop tuong duong cho notification-service

| Nhom du lieu                               | Lop hop le                                                              | Tag    | Lop khong hop le/hanh vi can quan sat                                   | Tag                            |
| ------------------------------------------ | ----------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------- | ------------------------------ |
| Health check                               | Service tra `status=ok`                                                 | NO-V1  | Service loi/khong phan hoi                                              | NO-X1                          |
| `user_id` khi `/send`                      | Co the parse thanh so nguyen                                            | NO-V2  | Khong parse duoc so                                                     | NO-X2                          |
| `title` khi `/send`                        | Chuoi khong rong, do dai toi da 255 theo DB                             | NO-V3  | Thieu/null, do dai `>255`                                               | NO-X3, NO-X4                   |
| `message` khi `/send`                      | Chuoi khong rong theo DB                                                | NO-V4  | Thieu/null                                                              | NO-X5                          |
| `channel` khi `/send`                      | `push`, `email`, `sms`, hoac bo qua de default `push`                   | NO-V5  | Gia tri ngoai enum                                                      | NO-X6                          |
| Token khi list/read                        | Bearer token hop le                                                     | NO-V6  | Thieu token, token sai/het han                                          | NO-X7, NO-X8                   |
| Phan trang                                 | `page >= 1`, `1 <= limit <= 100`; code tu dong clamp gia tri ngoai bien | NO-V7  | `page=0`, `limit=0`, `limit>100` duoc chuan hoa                         | NO-X9                          |
| `notification id`                          | Ton tai va thuoc owner hoac admin                                       | NO-V8  | Khong ton tai, khong phai owner, id bien 0                              | NO-X10, NO-X11, NO-X12         |
| `userId` va `fcmToken` khi register-device | Day du, token khong rong, do dai `<=255`                                | NO-V9  | Thieu userId, thieu token, token rong, token `>255`                     | NO-X13, NO-X14, NO-X15, NO-X16 |
| `/notify` realtime/push                    | `userId` hop le hoac `broadcast`, co `eventName`, `data` tuy chon       | NO-V10 | Thieu `userId`, thieu `eventName`, endpoint hien tai van co the tra 200 | NO-X17, NO-X18                 |
| Bao mat endpoint noi bo                    | Chi service noi bo nen goi `/send`, `/notify`, `register-device`        | NO-V11 | Code hien tai cho phep goi khong can internal token                     | NO-X19                         |

---

## 3. Cau 2. Phan tich gia tri bien

### 3.1. Gia tri bien auth-service

| Tham so                    | Mien hop le                         | Gia tri kiem thu                                            | Ky vong                                                                        | Tag            |
| -------------------------- | ----------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------- |
| Do dai `name` khi register | `2..100` ky tu                      | `1`, `2`, `14`, `100`, `101`                                | `1` va `101` bi tu choi; `2`, `14`, `100` hop le                               | AU-B1..AU-B5   |
| Do dai `password`          | `>=6` ky tu                         | `5`, `6`, `11`                                              | `5` bi tu choi; `6` va `11` hop le                                             | AU-B6..AU-B8   |
| `id` tren path             | So nguyen `>=1`                     | `0`, `1`, `{{auto_user_id}}`, `99999`, `abc`                | `0/abc` sai validation; `99999` khong tim thay; id ton tai hop le              | AU-B9..AU-B13  |
| Query `role` specialists   | `transcriber`, `arranger`, `artist` | `customer`, `transcriber`, `arranger`, `artist`, rong/thieu | Role chuyen vien hop le tra `200`; role khac/rong tra `400` hoac bi chan quyen | AU-B14..AU-B18 |
| Bearer token               | JWT hop le, chua het han            | Thieu token, token hop le, token het han, token bi sua      | Token hop le tra `200`; cac token con lai tra `401/403`                        | AU-B19..AU-B22 |

### 3.2. Gia tri bien notification-service

| Tham so               | Mien hop le                | Gia tri kiem thu                            | Ky vong                                                                                                | Tag            |
| --------------------- | -------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------- |
| `user_id` khi `/send` | Parse duoc thanh so nguyen | `abc`, `0`, `{{userId}}`, `-1`              | `abc` tra `400`; `{{userId}}` hop le; `0/-1` la hanh vi can quan sat vi code hien tai co the chap nhan | NO-B1..NO-B5   |
| Do dai `title`        | `1..255` ky tu theo DB     | Thieu, `1`, chuoi binh thuong, `255`, `256` | Thieu/qua dai gay loi; gia tri trong mien hop le tao notification                                      | NO-B6..NO-B10  |
| `channel`             | `push`, `email`, `sms`     | Ngoai enum, `push`, `email`, `sms`, bo qua  | `push/email/sms` hop le; bo qua default `push`; ngoai enum gay loi DB                                  | NO-B11..NO-B15 |
| `page` khi list       | `>=1`                      | `0`, `1`                                    | `0` duoc clamp ve `1`; `1` hop le                                                                      | NO-B16..NO-B18 |
| `limit` khi list      | `1..100`                   | `0`, `1`, `10`, `100`, `101`                | `0` duoc clamp ve `1`; `101` duoc clamp ve `100`; cac gia tri trong mien hop le                        | NO-B19..NO-B23 |
| Do dai `fcmToken`     | `1..255` ky tu             | Rong, `1`, token fake, `255`, `256`         | Rong tra `400`; `255` hop le; `256` tra `500` theo code hien tai                                       | NO-B24..NO-B28 |
| `notification id`     | Id ton tai trong DB        | `0`, `1`, `{{notificationId}}`, `999999`    | Id ton tai va dung owner/admin tra `200`; `0/999999` tra `404`                                         | NO-B29..NO-B32 |

---

## 4. Cau 3. Thiet ke test case

### 4.1. Test case auth-service

#### 4.1.1. Dang ky tai khoan - `POST /auth/register`

|      TC | Muc tieu                      | Input chinh                                       | Ket qua mong doi                   | Tag                 |
| ------: | ----------------------------- | ------------------------------------------------- | ---------------------------------- | ------------------- |
| au-a1.1 | Dang ky hop le                | `name=Auto Test User`, email moi, password hop le | `201`, co `id`, message thanh cong | AU-V1, AU-V2, AU-V3 |
| au-a1.2 | Chan email trung              | Dung lai email da tao                             | `409`, `Email already exists.`     | AU-X6               |
| au-a1.3 | Kiem tra bien duoi cua `name` | `name=A`                                          | `400`, loi field `name`            | AU-X3, AU-B1        |
| au-a1.4 | Kiem tra email sai format     | `email=invalid_email_format.com`                  | `400`, loi field `email`           | AU-X4               |
| au-a1.5 | Kiem tra `name` tai min       | `name=Ab`                                         | `201`, co `id`                     | AU-V1, AU-B2        |
| au-a1.6 | Kiem tra `name` tai max       | `name={{name_100}}`                               | `201`, co `id`                     | AU-V1, AU-B4        |
| au-a1.7 | Kiem tra `name` vuot max      | `name={{name_101}}`                               | `400`, loi field `name`            | AU-X3, AU-B5        |

#### 4.1.2. Dang nhap va xac thuc token - `POST /auth/login`, `GET /auth/verify`

|      TC | Muc tieu             | Input chinh                      | Ket qua mong doi                       | Tag          |
| ------: | -------------------- | -------------------------------- | -------------------------------------- | ------------ |
| au-a2.1 | Dang nhap hop le     | Email/password vua dang ky       | `200`, co `token`, co thong tin user   | AU-V4, AU-V5 |
| au-a2.2 | Sai mat khau         | Password sai                     | `401`, thong bao credential khong dung | AU-X10       |
| au-a2.3 | Email khong ton tai  | Email random                     | `401`, thong bao credential khong dung | AU-X7        |
| au-a2.4 | Email sai format     | `email=invalid_email_format.com` | `400`, loi field `email`               | AU-X4        |
| au-a2.5 | Password rong        | `password=""`                    | `400`, loi field `password`            | AU-X8        |
| au-a3.1 | Verify token hop le  | Bearer `{{auth_token}}`          | `200`, token hop le                    | AU-V5        |
| au-a3.2 | Verify thieu token   | Khong co Bearer token            | `401` hoac `403`, `success=false`      | AU-X11       |
| au-a3.3 | Verify token het han | Token expired                    | `401`, `success=false`                 | AU-X12       |
| au-a3.4 | Verify token bi sua  | Token tampered                   | `401`, `success=false`                 | AU-X13       |

#### 4.1.3. Phan quyen, profile va password

|      TC | Method/Endpoint                                | Muc tieu                              | Input chinh                                      | Ket qua mong doi                  | Tag           |
| ------: | ---------------------------------------------- | ------------------------------------- | ------------------------------------------------ | --------------------------------- | ------------- |
| au-a4.1 | `GET /auth/users/specialists?role=transcriber` | Customer bi chan                      | Token customer                                   | `403`                             | AU-X14        |
| au-a4.2 | `GET /auth/users/specialists?role=transcriber` | Coordinator lay danh sach chuyen vien | Token coordinator                                | `200`, array user co `id`, `name` | AU-V6         |
| au-a5.1 | `PUT /auth/users/{{auto_user_id}}/password`    | Doi mat khau hop le                   | `oldPassword` dung, `newPassword=newpassword123` | `200`, doi mat khau thanh cong    | AU-V8         |
| au-a5.2 | `PUT /auth/users/{{auto_user_id}}/password`    | Sai old password                      | `oldPassword=wrongpassword123`                   | `401`, mat khau cu khong dung     | AU-X20        |
| au-a5.3 | `PUT /auth/users/{{auto_user_id}}/password`    | New password duoi bien                | `newPassword=12345`                              | `400`                             | AU-X21, AU-B6 |
| au-a5.4 | `PUT /auth/users/99999/password`               | User doi password cua user khac       | Token user A, path id user khac                  | `403`                             | AU-X19        |
| au-a5.5 | `PUT /auth/users/{{auto_user_id}}/password`    | New password tai min                  | `newPassword=123456`                             | `200`                             | AU-V8, AU-B7  |
| au-a6.1 | `GET /auth/users/{{auto_user_id}}`             | Lay user theo id hop le               | Id ton tai                                       | `200`, co `id/name/email/role`    | AU-V7         |
| au-a6.2 | `GET /auth/users/99999`                        | Lay user khong ton tai                | Id khong ton tai                                 | `404`                             | AU-X18        |
| au-a6.3 | `GET /auth/users/abc`                          | Id sai dinh dang                      | `id=abc`                                         | `400`, loi field `id`             | AU-X16        |

#### 4.1.4. Admin CRUD va flow auth

|      TC | Muc tieu                  | Buoc/Input chinh                                                         | Ket qua mong doi                 | Tag                   |
| ------: | ------------------------- | ------------------------------------------------------------------------ | -------------------------------- | --------------------- |
| au-a8.0 | Admin login               | `admin@mutrapro.com`, `Admin@123`                                        | `200`, user role `admin`         | AU-V9                 |
| au-a8.1 | Lay id theo role          | `GET /auth/users/by-role/customer`                                       | `200`, array chi co `id`         | AU-V9                 |
| au-a8.2 | Admin lay danh sach users | `GET /auth/admin/users` voi token admin                                  | `200`, khong tra `password_hash` | AU-V9                 |
| au-a8.3 | Admin tao user            | `POST /auth/admin/users`, `role=transcriber`                             | `201`, luu `target_user_id`      | AU-V9                 |
| au-a8.4 | Admin cap nhat user       | Doi `name`, `role=coordinator`                                           | `200`                            | AU-V9                 |
| au-a8.5 | Chan admin tu sua minh    | Path id la `{{admin_id}}`                                                | `400`                            | AU-X23                |
| au-a8.6 | Admin xoa user            | `DELETE /auth/admin/users/{{target_user_id}}`                            | `200`, xoa mem                   | AU-V9                 |
| au-a8.7 | Chan admin tu xoa minh    | Path id la `{{admin_id}}`                                                | `400`                            | AU-X23                |
| au-a8.8 | Admin tao email trung     | `email=admin@mutrapro.com`                                               | `409`                            | AU-X25                |
|   Flow1 | Flow user end-to-end      | Register -> login -> verify -> change password                           | Tat ca buoc chinh `201/200`      | AU-V1..AU-V8          |
|   Flow2 | Flow admin lifecycle      | Tao user -> login -> update role -> login lai -> delete -> login fail    | Sau delete, login tra `401`      | AU-V9, AU-X18         |
|   Flow3 | Flow coordinator role     | Login coordinator -> get specialists -> customer bi chan -> role invalid | `200`, `403`, `400` tuong ung    | AU-V6, AU-X14, AU-X15 |

### 4.2. Test case notification-service

#### 4.2.1. Health check va tao notification - `GET /notifications/health`, `POST /notifications/send`

|               TC | Muc tieu                         | Input chinh                          | Ket qua mong doi                                   | Tag                        |
| ---------------: | -------------------------------- | ------------------------------------ | -------------------------------------------------- | -------------------------- |
|        noti-hc-1 | Health check notification        | Khong co body                        | `200`, `service=notification-service`, `status=ok` | NO-V1                      |
|  noti-send-ep-01 | Tao notification channel push    | `user_id={{userId}}`, `channel=push` | `201`, co `id`                                     | NO-V2, NO-V3, NO-V4, NO-V5 |
|  noti-send-ep-02 | Tao notification channel email   | `channel=email`                      | `201`                                              | NO-V5, NO-B12              |
|  noti-send-ep-03 | Tao notification channel sms     | `channel=sms`                        | `201`                                              | NO-V5, NO-B13              |
|  noti-send-ep-04 | Tao notification default channel | Bo qua `channel`                     | `201`, default `push`                              | NO-B15                     |
|  noti-send-ep-05 | `user_id` khong phai so          | `user_id=abc`                        | `400`, user_id bat buoc la so                      | NO-X2, NO-B1               |
|  noti-send-ep-06 | Thieu `title`                    | Khong co `title`                     | `500` theo hanh vi hien tai                        | NO-X3                      |
| noti-send-bva-01 | `user_id=0`                      | `user_id=0`                          | Postman quan sat `201`; nen validate them          | NO-B2, NO-X9               |
| noti-send-bva-02 | `user_id` am                     | `user_id=-1`                         | `201` theo code hien tai                           | NO-B5                      |
| noti-send-bva-03 | `title` tai max DB               | `title={{title_255}}`                | `201`                                              | NO-V3, NO-B9               |
| noti-send-bva-04 | `title` vuot max DB              | `title={{title_256}}`                | `500`                                              | NO-X4, NO-B10              |

#### 4.2.2. Lay danh sach va danh dau da doc

|               TC | Method/Endpoint                                    | Muc tieu                            | Input chinh      | Ket qua mong doi                                | Tag            |
| ---------------: | -------------------------------------------------- | ----------------------------------- | ---------------- | ----------------------------------------------- | -------------- |
|  noti-list-ep-01 | `GET /notifications?page=1&limit=10`               | List notification hop le            | Token hop le     | `200`, `success=true`, co `items`, `pagination` | NO-V6, NO-V7   |
|  noti-list-ep-02 | `GET /notifications?page=1&limit=10`               | List thieu token                    | Khong token      | `401`                                           | NO-X7          |
|  noti-list-ep-03 | `GET /notifications?page=1&limit=10`               | List token sai                      | Token invalid    | `401`                                           | NO-X8          |
| noti-list-bva-01 | `GET /notifications?page=0&limit=10`               | Page duoi bien                      | `page=0`         | `200`, code clamp ve page 1                     | NO-X9, NO-B16  |
| noti-list-bva-02 | `GET /notifications?page=1&limit=0`                | Limit duoi bien                     | `limit=0`        | `200`, code clamp ve 1                          | NO-X9, NO-B19  |
| noti-list-bva-03 | `GET /notifications?page=1&limit=100`              | Limit tai max                       | `limit=100`      | `200`                                           | NO-V7, NO-B22  |
| noti-list-bva-04 | `GET /notifications?page=1&limit=101`              | Limit vuot max                      | `limit=101`      | `200`, code clamp ve 100                        | NO-X9, NO-B23  |
|  noti-read-ep-01 | `PATCH /notifications/{{notificationId}}/read`     | Mark read hop le                    | Owner token      | `200`, status thanh `sent`                      | NO-V8          |
|  noti-read-ep-02 | `PATCH /notifications/999999/read`                 | Mark read id khong ton tai          | Id khong ton tai | `404`                                           | NO-X10         |
|  noti-read-ep-03 | `PATCH /notifications/{{notificationId}}/read`     | Mark read thieu token               | Khong token      | `401`                                           | NO-X7          |
|  noti-read-ep-04 | `PATCH /notifications/{{other_user_noti_id}}/read` | User A mark notification cua user B | Khong phai owner | `403`                                           | NO-X11         |
| noti-read-bva-01 | `GET /notifications/0/read`                        | Mark read id bang 0                 | `id=0`           | `404`                                           | NO-X12, NO-B29 |

#### 4.2.3. Dang ky device va notify realtime/push

|                 TC | Method/Endpoint                       | Muc tieu                            | Input chinh                                           | Ket qua mong doi                                | Tag            |
| -----------------: | ------------------------------------- | ----------------------------------- | ----------------------------------------------------- | ----------------------------------------------- | -------------- |
|  noti-device-ep-01 | `POST /notifications/register-device` | Dang ky device hop le               | `userId={{userId}}`, token fake                       | `200`                                           | NO-V9          |
|  noti-device-ep-02 | `POST /notifications/register-device` | Thieu `userId`                      | Chi co `fcmToken`                                     | `400`                                           | NO-X13         |
|  noti-device-ep-03 | `POST /notifications/register-device` | Thieu `fcmToken`                    | Chi co `userId`                                       | `400`                                           | NO-X14         |
|  noti-device-ep-04 | `POST /notifications/register-device` | Duplicate token                     | Lap lai token cu                                      | `200`, ON DUPLICATE khong loi                   | NO-V9          |
| noti-device-bva-01 | `POST /notifications/register-device` | Token rong                          | `fcmToken=""`                                         | `400`                                           | NO-X15, NO-B24 |
| noti-device-bva-02 | `POST /notifications/register-device` | Token tai max                       | `fcmToken={{fcm_255}}`                                | `200`                                           | NO-V9, NO-B27  |
| noti-device-bva-03 | `POST /notifications/register-device` | Token vuot max                      | `fcmToken={{fcm_256}}`                                | `500` theo code hien tai                        | NO-X16, NO-B28 |
|  noti-notify-ep-01 | `POST /notifications/notify`          | Notify broadcast                    | `userId=broadcast`, co `eventName`, co `data.message` | `200`, co message                               | NO-V10         |
|  noti-notify-ep-02 | `POST /notifications/notify`          | Notify single user                  | `userId={{userId}}`, co `eventName`                   | `200`, co message                               | NO-V10         |
|  noti-notify-ep-03 | `POST /notifications/notify`          | Notify khong co data                | Co `userId`, `eventName`, bo qua `data`               | `200`                                           | NO-V10         |
|  noti-notify-ep-04 | `POST /notifications/notify`          | Thieu `userId`                      | Chi co `eventName`, `data`                            | `200` hoac `400`; Postman ghi nhan can validate | NO-X17         |
|  noti-notify-ep-05 | `POST /notifications/notify`          | Thieu `eventName`                   | Co `userId`, bo qua `eventName`                       | `200` hoac `400`; Postman ghi nhan can validate | NO-X18         |
|     noti-sec-ep-01 | `POST /notifications/notify`          | Security observation: notify public | Goi khong internal token                              | `200` theo code hien tai                        | NO-X19         |
|     noti-fcm-ep-01 | `POST /notifications/notify`          | FCM offline user                    | User offline co token                                 | `200`, message co push notification             | NO-V10         |
|     noti-fcm-ep-02 | `POST /notifications/notify`          | FCM user khong co token             | `userId=99999`                                        | `200`, service khong crash                      | NO-V10         |

#### 4.2.4. Flow notification

|    TC | Muc tieu                      | Buoc chinh                                                 | Ket qua mong doi                               | Tag                 |
| ----: | ----------------------------- | ---------------------------------------------------------- | ---------------------------------------------- | ------------------- |
| Flow1 | Flow owner notification       | Create -> list -> mark read -> verify status               | `201`, `200`, status `sent`, `sent_at != null` | NO-V2, NO-V6, NO-V8 |
| Flow2 | Flow cross-user security      | Tao noti cho user B -> user A mark read -> admin mark read | User A `403`, admin `200`                      | NO-X11, NO-V8       |
| Flow3 | Flow device va offline notify | Register device -> notify offline user                     | `200`, notify tra success                      | NO-V9, NO-V10       |

### 4.3. Nhan xet ve do bao phu

| Tieu chi                                           | Ket qua                                                                                                     |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Co test case hop le cho auth-service               | Dat: register, login, verify, specialist, change password, admin CRUD                                       |
| Co test case khong hop le cho auth-service         | Dat: email trung, email sai format, password rong/sai, token thieu/sai/het han, role sai, id sai            |
| Co test case bien cho auth-service                 | Dat: `name=1/2/100/101`, `newPassword=5/6`, `id=abc/99999`                                                  |
| Co test case hop le cho notification-service       | Dat: send, list, read, register device, notify, FCM graceful                                                |
| Co test case khong hop le cho notification-service | Dat: user_id sai, thieu title, title qua dai, thieu token, cross-user, thieu device field                   |
| Co test case bien cho notification-service         | Dat: `title=255/256`, `limit=0/100/101`, `fcmToken=0/255/256`, `notificationId=0/999999`                    |
| Co flow test lien service                          | Dat: notification flow co su dung auth token va admin token                                                 |
| Co security observation                            | Dat: ghi nhan `/notifications/notify` va mot so endpoint notification hien tai chua bat internal token/auth |

---

## 5. Cau 4. Trien khai kiem thu tu dong bang Postman

### 5.1. File Postman su dung

| File                                              | Vai tro                                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `postman/Presentation.postman_collection.json`    | Chua collection test case cho cac service, trong do co folder `auth-service` va `notification-service` |
| `postman/MutraPro Local.postman_environment.json` | Chua bien moi truong nhu `baseUrl`, token, id user, email test, gia tri bien                           |

### 5.2. Cach Postman test duoc to chuc

| Folder                                                | Noi dung                                                                                      |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `api / auth-service / Register / BVA_A1`              | Kiem thu dang ky user, email trung, bien do dai `name`                                        |
| `api / auth-service / Login / BVA`                    | Kiem thu dang nhap hop le, sai password, email khong ton tai, email sai format, password rong |
| `api / auth-service / Xac thuc Token`                 | Kiem thu token hop le, thieu token, token het han, token bi sua                               |
| `api / auth-service / Lay ds chuyen vien`             | Kiem thu role `coordinator` va role khong du quyen                                            |
| `api / auth-service / Doi mat khau`                   | Kiem thu doi mat khau hop le, sai old password, new password duoi bien, sai owner             |
| `api / auth-service / Admin`                          | Kiem thu admin login, list/create/update/delete user, chan self-update/self-delete            |
| `api / auth-service / FlowTests -Auth`                | Kiem thu luong end-to-end user, admin, coordinator                                            |
| `api / notification-service / Health Check`           | Kiem thu service song                                                                         |
| `api / notification-service / Gui thong bao`          | Kiem thu `/send` theo EP va BVA                                                               |
| `api / notification-service / Danh Sach Thong Bao`    | Kiem thu list notification va phan trang                                                      |
| `api / notification-service / Danh Dau Da Doc`        | Kiem thu owner/admin mark read va cross-user security                                         |
| `api / notification-service / Dang Ky Thiet Bi`       | Kiem thu register FCM token va bien do dai token                                              |
| `api / notification-service / Notify Realtime & Push` | Kiem thu broadcast, single user, offline push va observation ve validation                    |
| `api / notification-service / FlowTests - Noti`       | Kiem thu flow owner, cross-user security, device + offline notify                             |

### 5.3. Lien he test case voi code

| Nhom test              | Code lien quan                                               | Hanh vi duoc xac minh                                                            |
| ---------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Register/Login         | `auth-service/index.js`, `shared/middleware/validation.js`   | Validation input, hash password, kiem tra credential, tao JWT                    |
| Verify/Role            | `auth-service/middleware/authMiddleware.js`                  | Bearer token va phan quyen role                                                  |
| Admin CRUD             | `auth-service/index.js`, `init-scripts/init.sql`             | Role enum, soft delete `is_deleted`, chan admin tu sua/xoa minh                  |
| Send notification      | `notification-service/index.js`, `init-scripts/init.sql`     | Insert bang `notifications`, default `channel=push`, loi DB khi thieu/vuot field |
| List/Read notification | `notification-service/index.js`, `shared/middleware/auth.js` | JWT auth, pagination, owner/admin authorization                                  |
| Device/FCM/Notify      | `notification-service/index.js`                              | Luu `user_devices`, realtime Socket.IO, fallback FCM khi offline                 |

---

## 6. Cau 5. Kiem thu Whitebox bang Unit Test (Jest + Supertest)

### 6.1. Cong cu va cach to chuc unit test

Khac voi Postman (goi API tu ben ngoai qua gateway), bo unit test whitebox goi truc tiep app Express cua tung service bang `supertest`, dong thoi dung `jest.mock()` de gia lap toan bo lop ha tang ben duoi. Nho vay test co the ep tung nhanh code (if/else, try/catch, rap ranh gia tri) chay chinh xac ma khong can DB/Redis/Firebase that.

| Thanh phan duoc mock | Muc dich mock                                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mysql2/promise`     | Gia lap `pool.execute` de dieu khien ket qua tra ve tu DB (rong, co du lieu, loi)                                                                                      |
| `ioredis`            | Gia lap cache, kiem tra `redis.del` co duoc goi khi update user                                                                                                        |
| `bcrypt`             | Gia lap `hash`/`compare` de kiem soat nhanh dung/sai mat khau                                                                                                          |
| `jsonwebtoken`       | Ky/verify token that (khong mock trong `authMiddleware.test.js`) hoac mock tra ve payload gia (trong `authMiddleware.test.js` file `jsonwebtoken` duoc mock hoan toan) |
| `firebase-admin`     | Gia lap `messaging().sendEachForMulticast` de test luong push notification                                                                                             |
| `shared/logger`      | Gia lap `info/warn/error/debug` de tranh log that va kiem tra loi duoc log                                                                                             |

| File test                           | Service                   | Doi tuong kiem thu                                                                                                                                                                                   | So test case |
| ----------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -----------: |
| `tests/unit/auth.test.js`           | auth-service              | `POST /register`, `POST /login`, `GET /health`, `GET /verify`, `GET /users/specialists`, `PUT /users/:id`, `PUT /users/:id/password`, `GET /users/:id`, `GET /users/by-role/:role`, Admin CRUD users |           33 |
| `tests/unit/authMiddleware.test.js` | auth-service (middleware) | `authMiddleware`, `checkRole`                                                                                                                                                                        |            7 |
| `tests/unit/notification.test.js`   | notification-service      | `GET /health`, `POST /send`, `GET /`, `PATCH /:id/read`, `POST /register-device`, `POST /notify`, quan ly online user, `sendPushNotification`                                                        |           21 |
| **Tong**                            |                           |                                                                                                                                                                                                      |       **61** |

### 6.2. Chi tiet test case whitebox - auth-service

#### 6.2.1. `tests/unit/authMiddleware.test.js` - Middleware xac thuc va phan quyen

| TC       | Ham duoc test    | Muc tieu                                         | Gia lap dau vao                                                                       | Ket qua mong doi (assertion)                                                             | Tag    |
| -------- | ---------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------ |
| MW-WB-01 | `authMiddleware` | Khong co header `authorization`                  | `req.headers = {}`                                                                    | Goi `next(AppError)`, `statusCode = 401`                                                 | AU-X11 |
| MW-WB-02 | `authMiddleware` | Header khong bat dau bang `Bearer`               | `authorization = 'InvalidTokenFormat'`                                                | Goi `next(AppError)`                                                                     | AU-X13 |
| MW-WB-03 | `authMiddleware` | Token hop le, `jwt.verify` tra ve payload        | `authorization = 'Bearer validtoken'`, mock `jwt.verify` tra `{ id:1, role:'admin' }` | `jwt.verify` duoc goi dung tham so, `req.user` duoc gan dung payload, `next()` khong loi | AU-V5  |
| MW-WB-04 | `authMiddleware` | Token sai hoac het han, `jwt.verify` nem loi     | Mock `jwt.verify` throw `Error('jwt expired')`                                        | Goi `next(AppError)`, `statusCode = 401`                                                 | AU-X12 |
| MW-WB-05 | `checkRole`      | Khong co `req.user` (chua qua `authMiddleware`)  | `req.user` khong ton tai                                                              | Goi `next(AppError)`, `statusCode = 403`                                                 | AU-X14 |
| MW-WB-06 | `checkRole`      | Role cua user khong nam trong danh sach cho phep | `req.user.role = 'customer'`, allowed = `admin, coordinator`                          | Goi `next(AppError)`, `statusCode = 403`                                                 | AU-X14 |
| MW-WB-07 | `checkRole`      | Role hop le                                      | `req.user.role = 'admin'`, allowed = `admin, coordinator`                             | Goi `next()` khong co tham so loi                                                        | AU-V6  |

#### 6.2.2. `tests/unit/auth.test.js` - Register va Login

| TC       | Endpoint         | Muc tieu                            | Mock DB / bcrypt                                               | Input chinh                  | Ket qua mong doi                                                    | Tag                 |
| -------- | ---------------- | ----------------------------------- | -------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------- | ------------------- |
| AU-WB-01 | `POST /register` | Email da ton tai trong DB           | `pool.execute` tra ve `[{id:1}]` (query check email)           | `name/email/password` hop le | `409`, message khop `Email already exists`                          | AU-X6               |
| AU-WB-02 | `POST /register` | Tao user moi thanh cong             | Check email tra rong, insert tra `insertId:99`                 | `name/email/password` hop le | `201`, `id=99`, message thanh cong, `bcrypt.hash` duoc goi voi salt | AU-V1, AU-V2, AU-V3 |
| AU-WB-03 | `POST /register` | Validation: `name` rong             | Khong can mock DB (chan o middleware validation)               | `name=''`                    | `400`, loi khop `Ten khong duoc de trong`                           | AU-X1               |
| AU-WB-04 | `POST /register` | Validation: `email` sai dinh dang   | -                                                              | `email='not-an-email'`       | `400`, loi khop `Email khong hop le`                                | AU-X4               |
| AU-WB-05 | `POST /register` | Validation: `password` duoi 6 ky tu | -                                                              | `password='123'`             | `400`, loi khop `Mat khau phai co it nhat 6 ky tu`                  | AU-X8, AU-B6        |
| AU-WB-06 | `POST /login`    | Dang nhap thanh cong                | DB tra ve user co `password_hash`, `bcrypt.compare` tra `true` | Email/password dung          | `200`, message `Login successful`, co `token`                       | AU-V4, AU-V5        |
| AU-WB-07 | `POST /login`    | Sai mat khau                        | DB tra ve user, `bcrypt.compare` tra `false`                   | Password sai                 | `401`, message `Email hoac mat khau khong dung`                     | AU-X10              |
| AU-WB-08 | `POST /login`    | Email khong ton tai trong DB        | `pool.execute` tra ve mang rong                                | Email random                 | `401`, message `Email hoac mat khau khong dung`                     | AU-X7               |
| AU-WB-09 | `POST /login`    | Validation: `email` sai dinh dang   | -                                                              | `email='invalid'`            | `400`, loi khop `Email khong hop le`                                | AU-X4               |
| AU-WB-10 | `POST /login`    | Validation: `password` bi trong     | -                                                              | `password=''`                | `400`, loi khop `Mat khau khong duoc de trong`                      | AU-X8               |

#### 6.2.3. `tests/unit/auth.test.js` - Health, Verify, Specialists, Profile, Password

| TC       | Endpoint                             | Muc tieu                              | Mock DB                                                                    | Input chinh                                               | Ket qua mong doi                                     | Tag           |
| -------- | ------------------------------------ | ------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------- | ------------- |
| AU-WB-11 | `GET /health`                        | Health check tra trang thai ok        | -                                                                          | Khong body                                                | `200`, `service='auth-service'`                      | -             |
| AU-WB-12 | `GET /verify`                        | Token hop le tra ve thong tin user    | -                                                                          | Bearer token that (ky bang `jwt.sign`)                    | `200`, `body.user` khop payload (`toMatchObject`)    | AU-V5         |
| AU-WB-13 | `GET /users/specialists?role=artist` | Coordinator lay danh sach chuyen vien | `pool.execute` tra `[{id:2,name:'S1'}]`                                    | Token `role=coordinator`                                  | `200`, mang co do dai 1                              | AU-V6         |
| AU-WB-14 | `GET /users/specialists?role=admin`  | Role query khong hop le               | -                                                                          | Token `role=coordinator`, `role=admin` (khong thuoc enum) | `400`                                                | AU-X15        |
| AU-WB-15 | `PUT /users/:id`                     | Cap nhat ten thanh cong, xoa cache    | `pool.execute` tra `affectedRows:1`                                        | Token chinh chu, `name='New Name'`                        | `200`, `redis.del` duoc goi voi key `user:1:name`    | AU-V7         |
| AU-WB-16 | `PUT /users/:id`                     | Chan sua ten user khac                | -                                                                          | Token `id=1`, path `id=2`                                 | `403`                                                | AU-X19        |
| AU-WB-17 | `PUT /users/:id`                     | `name` rong (chi co khoang trang)     | -                                                                          | `name='   '`                                              | `400`, message `Name is required`                    | AU-X1         |
| AU-WB-18 | `PUT /users/:id`                     | `name` vuot 100 ky tu                 | -                                                                          | `name` = 101 ky tu                                        | `400`, message `Name must be at most 100 characters` | AU-X3, AU-B5  |
| AU-WB-19 | `PUT /users/:id`                     | User khong ton tai trong DB           | `pool.execute` tra `affectedRows:0`                                        | Token hop le, id hop le                                   | `404`, message `User not found`                      | AU-X18        |
| AU-WB-20 | `PUT /users/:id/password`            | Doi mat khau thanh cong               | Select tra `password_hash`, `bcrypt.compare=true`, update `affectedRows:1` | `oldPassword`/`newPassword` hop le                        | `200`                                                | AU-V8         |
| AU-WB-21 | `PUT /users/:id/password`            | `newPassword` duoi bien (< 6 ky tu)   | -                                                                          | `newPassword='123'`                                       | `400`                                                | AU-X21, AU-B6 |
| AU-WB-22 | `PUT /users/:id/password`            | Khong tim thay user khi doi mat khau  | Select tra rong `[[]]`                                                     | Token hop le                                              | `404`                                                | AU-X19        |
| AU-WB-23 | `GET /users/:id`                     | Lay thong tin co ban thanh cong       | `pool.execute` tra `[{id:1,name:'A'}]`                                     | Id ton tai                                                | `200`, `name='A'`                                    | AU-V7         |
| AU-WB-24 | `GET /users/:id`                     | Khong tim thay user                   | `pool.execute` tra rong                                                    | Id khong ton tai                                          | `404`                                                | AU-X18        |
| AU-WB-25 | `GET /users/by-role/:role`           | Lay danh sach id theo role            | `pool.execute` tra 2 phan tu                                               | `role=customer`                                           | `200`, mang co do dai 2                              | AU-V7         |

#### 6.2.4. `tests/unit/auth.test.js` - Admin CRUD users

| TC       | Endpoint                  | Muc tieu                                  | Mock DB                                       | Input chinh                         | Ket qua mong doi                             | Tag    |
| -------- | ------------------------- | ----------------------------------------- | --------------------------------------------- | ----------------------------------- | -------------------------------------------- | ------ |
| AU-WB-26 | `GET /admin/users`        | Admin lay danh sach user                  | `pool.execute` tra `[{id:1,email:'a@a.com'}]` | Token `role=admin`                  | `200`                                        | AU-V9  |
| AU-WB-27 | `POST /admin/users`       | Admin tao user moi thanh cong             | Insert tra `insertId:2`, mock `bcrypt.hash`   | Token admin, body user moi hop le   | `201`                                        | AU-V9  |
| AU-WB-28 | `PUT /admin/users/:id`    | Admin cap nhat user thanh cong, xoa cache | `pool.execute` tra `affectedRows:1`           | Token admin, `id=2` (khac id admin) | `200`, `redis.del` goi voi key `user:2:name` | AU-V9  |
| AU-WB-29 | `PUT /admin/users/:id`    | Chan admin tu sua role cua chinh minh     | -                                             | Token admin `id=99`, path `id=99`   | `400`                                        | AU-X23 |
| AU-WB-30 | `PUT /admin/users/:id`    | Khong tim thay user de cap nhat           | `pool.execute` tra `affectedRows:0`           | Token admin, id khac                | `404`                                        | AU-X18 |
| AU-WB-31 | `DELETE /admin/users/:id` | Admin xoa mem user thanh cong             | `pool.execute` tra `affectedRows:1`           | Token admin, id khac                | `200`                                        | AU-V9  |
| AU-WB-32 | `DELETE /admin/users/:id` | Chan admin tu xoa chinh minh              | -                                             | Token admin `id=99`, path `id=99`   | `400`                                        | AU-X23 |
| AU-WB-33 | `DELETE /admin/users/:id` | Khong tim thay user de xoa                | `pool.execute` tra `affectedRows:0`           | Token admin, id khac                | `404`                                        | AU-X18 |

### 6.3. Chi tiet test case whitebox - notification-service (`tests/unit/notification.test.js`)

| TC       | Endpoint / Ham           | Muc tieu                                              | Mock                                                                | Input chinh                                       | Ket qua mong doi                                                       | Tag            |
| -------- | ------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------- | -------------- |
| NO-WB-01 | `GET /health`            | Health check tra trang thai ok                        | -                                                                   | Khong body                                        | `200`, `service='notification-service'`                                | NO-V1          |
| NO-WB-02 | `POST /send`             | Tao notification thanh cong                           | `pool.execute` tra `insertId:1`                                     | `user_id=1`, `title/message` hop le               | `201`, `id=1`                                                          | NO-V2..NO-V5   |
| NO-WB-03 | `POST /send`             | `user_id` khong phai so                               | -                                                                   | `user_id='abc'`                                   | `400`                                                                  | NO-X2          |
| NO-WB-04 | `POST /send`             | Loi tu DB khi insert                                  | `pool.execute` reject `Error('DB Error')`                           | Body hop le                                       | `500`                                                                  | -              |
| NO-WB-05 | `GET /`                  | Lay danh sach notification thanh cong (co phan trang) | Mock `execute` tra `COUNT` roi tra `SELECT`                         | Token hop le (`role=customer`)                    | `200`, `data.items` co do dai 1                                        | NO-V6, NO-V7   |
| NO-WB-06 | `GET /`                  | Loi DB khi lay danh sach                              | `pool.execute` reject                                               | Token hop le                                      | `500`                                                                  | -              |
| NO-WB-07 | `PATCH /:id/read`        | Owner tu danh dau da doc thanh cong                   | Select tra ban ghi cua chinh owner, update `affectedRows:1`         | Token `id=1`, notification `user_id=1`            | `200`                                                                  | NO-V8          |
| NO-WB-08 | `PATCH /:id/read`        | Khong tim thay notification                           | Select tra rong `[[]]`                                              | Id khong ton tai                                  | `404`                                                                  | NO-X10         |
| NO-WB-09 | `PATCH /:id/read`        | Nguoi khac (khong phai owner) cap nhat                | Select tra ban ghi thuoc `user_id=2`                                | Token `id=1`, notification `user_id=2`            | `403`                                                                  | NO-X11         |
| NO-WB-10 | `PATCH /:id/read`        | Admin duoc phep cap nhat notification cua nguoi khac  | Select tra `user_id=2`, update thanh cong                           | Token `role=admin, id=99`                         | `200`                                                                  | NO-V8          |
| NO-WB-11 | `POST /register-device`  | Dang ky device thanh cong                             | `pool.execute` tra `affectedRows:1`                                 | `userId/fcmToken` hop le                          | `200`                                                                  | NO-V9          |
| NO-WB-12 | `POST /register-device`  | Thieu du lieu bat buoc                                | -                                                                   | Chi co `userId`                                   | `400`                                                                  | NO-X13         |
| NO-WB-13 | `POST /register-device`  | `fcmToken` qua dai (256 ky tu)                        | -                                                                   | `fcmToken='a'.repeat(256)`                        | `500`                                                                  | NO-X16, NO-B28 |
| NO-WB-14 | `POST /register-device`  | Loi tu DB khi dang ky device                          | `pool.execute` reject                                               | Body hop le                                       | `500`                                                                  | -              |
| NO-WB-15 | `POST /notify`           | Gui broadcast toi tat ca user                         | -                                                                   | `userId='broadcast'`, `eventName`, `data`         | `200`, message khop `/broadcast/i`                                     | NO-V10         |
| NO-WB-16 | `POST /notify`           | Gui realtime toi user dang online                     | Gia lap user online bang `addUser(1,'socket-123')`                  | `userId=1`, `eventName`, `data`                   | `200`, message khop `/realtime/i`                                      | NO-V10         |
| NO-WB-17 | `POST /notify`           | User offline: fallback sang push qua FCM              | Select tra `fcm_token`, `sendEachForMulticast` tra `successCount:1` | `userId=1` (offline)                              | `200`, message khop `/push/i`, `sendEachForMulticast` duoc goi (async) | NO-V10         |
| NO-WB-18 | `addUser` / `removeUser` | Them va xoa user khoi danh sach online                | -                                                                   | `addUser(99,'sock99')` roi `removeUser('sock99')` | `onlineUsers[99]` co gia tri roi `undefined` sau khi xoa               | -              |
| NO-WB-19 | `removeUser`             | Xoa voi socket id khong ton tai thi khong lam gi ca   | -                                                                   | `removeUser('unknown-sock')`                      | `onlineUsers[99]` van giu nguyen                                       | -              |
| NO-WB-20 | `sendPushNotification`   | User khong co FCM token nao                           | Select tra rong `[[]]`                                              | Goi truc tiep ham `sendPushNotification`          | `sendEachForMulticast` khong duoc goi                                  | -              |
| NO-WB-21 | `sendPushNotification`   | FCM nem loi khi gui                                   | `sendEachForMulticast` reject `Error('FCM fail')`                   | Goi truc tiep ham `sendPushNotification`          | Loi duoc bat va log lai, khong crash service                           | -              |

### 6.4. Doi chieu whitebox vs blackbox

| Tieu chi                     | Blackbox (Postman)                                                          | Whitebox (Jest unit test)                                                            |
| ---------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Goc nhin                     | Tu ngoai vao, qua API gateway, khong biet code ben trong                    | Tu trong ra, goi thang app Express, biet ro nhanh code va cau truc DB                |
| Phu thuoc                    | Can server dang chay that, DB/Redis/Firebase that                           | Mock toan bo DB, Redis, bcrypt, JWT, Firebase, chay doc lap khong can service that   |
| Diem manh                    | Phat hien loi tich hop, loi gateway, loi cau hinh moi truong                | Kiem tra chinh xac tung dieu kien if/else, tung status code, tung nhanh loi hiem gap |
| Diem yeu                     | Kho ep duoc cac nhanh loi hiem (vi du loi DB, FCM fail)                     | Khong phat hien loi tich hop that giua cac service hoac cau hinh moi truong          |
| Vi du minh hoa trong bao cao | `noti-send-ep-06` chi quan sat duoc `500` khi thieu title qua response that | `NO-WB-04` ep truc tiep `pool.execute` nem loi de kiem tra nhanh `catch` xu ly `500` |
| Bo sung cho nhau             | Xac nhan hanh vi thuc te cua he thong khi trien khai                        | Xac nhan logic code dung nhu thiet ke, bat loi som truoc khi tich hop                |

---

## 7. Ket luan

Bao cao da tong hop lai pham vi kiem thu cho 2 service `auth-service` va `notification-service` bang **2 phuong phap ket hop**: kiem thu blackbox qua Postman va kiem thu whitebox bang unit test Jest + Supertest, dua tren code va cac file test hien co cua project.

**Ve blackbox (Postman):**

- `auth-service` da co bo test bao phu cac chuc nang dang ky, dang nhap, xac thuc token, phan quyen, doi mat khau va admin CRUD.
- `notification-service` da co bo test bao phu tao notification, list/read notification, dang ky device, notify realtime/push va cac flow bao mat owner/admin.
- Cac gia tri bien quan trong da duoc dua vao test: do dai `name`, do dai password, `title=255/256`, `limit=0/100/101`, `fcmToken=0/255/256`, token hop le/sai/thieu.
- Mot so test case ghi nhan hanh vi hien tai can luu y: `/notifications/send`, `/notifications/register-device`, `/notifications/notify` hien chua bat buoc auth/internal token; `user_id=0` hoac `-1` co the van duoc insert; thieu `title` hoac `title>255` tra `500` do loi DB thay vi validation `400`.

**Ve whitebox (Jest unit test):**

- Tong cong 61 test case whitebox duoc trien khai qua 3 file: `auth.test.js` (33 test), `authMiddleware.test.js` (7 test), `notification.test.js` (21 test).
- Bo test whitebox mock toan bo DB (`mysql2/promise`), Redis (`ioredis`), ma hoa mat khau (`bcrypt`), Firebase Admin va logger, nen co the ep chay chinh xac ca cac nhanh loi hiem gap nhu loi DB khi insert/select, FCM gui that bai, hoac user khong co token thiet bi nao - la nhung truong hop rat kho tao ra khi kiem thu blackbox qua Postman.
- Cac test whitebox cung xac nhan lai dung cac hanh vi da ghi nhan o blackbox: chan admin tu sua/xoa chinh minh (`400`), chan user thuong cap nhat/doi mat khau cua nguoi khac (`403`), cache Redis duoc xoa dung key sau khi cap nhat profile.

**Doi chieu 2 phuong phap:** blackbox xac nhan he thong hoat dong dung khi trien khai thuc te qua gateway, con whitebox xac nhan tung nhanh logic trong code dung nhu thiet ke va bat duoc som cac loi tiem an truoc khi tich hop. Hai phuong phap bo sung cho nhau va cung khong phat hien mau thuan nao ve hanh vi giua cac test.

Nhin chung, bo test hien tai (ca blackbox va whitebox) co du kiem thu hop le, khong hop le, bien va flow end-to-end/mock loi. Neu can nang chat luong API, nen bo sung validation ro rang hon cho notification-service de cac loi dau vao tra `400 Bad Request` thay vi `500 Internal Server Error`, dong thoi bo sung them unit test cho cac nhanh loi con thieu (vi du: loi DB khi `PATCH /:id/read`, loi DB khi `POST /notify`).
