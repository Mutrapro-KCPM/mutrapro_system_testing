## 1. Mục tiêu bài tập

1. Xác định được điều kiện kiểm thử từ đặc tả API thực tế của `file-service`.
2. Áp dụng kỹ thuật **phân hoạch lớp tương đương** cho dữ liệu upload file.
3. Áp dụng kỹ thuật **phân tích giá trị biên** cho `order_id`, `file_id`, dung lượng file và kiểu file.
4. Thiết kế bảng **test case** có input, expected result và tag bao phủ.
5. Viết test script kiểm thử API bằng Postman/Newman.

---

## 2. Nội dung tham khảo

Bài tập bám sát các kỹ thuật kiểm thử hộp đen:

- **Equivalence Partitioning**: chia miền dữ liệu đầu vào thành lớp hợp lệ và không hợp lệ.
- **Boundary Value Analysis**: kiểm thử tại biên và gần biên.
- **Test case design**: thiết kế test case có input, expected outcome và tag.
- **API automation testing**: kiểm thử tự động bằng Postman/Newman.

Trong bài này, chức năng được chọn để kiểm thử là:

```text
POST /files/upload
GET /files/files/order/:orderId
GET /files/files/download/:fileId
```

Các API này thuộc `file-service` của dự án MuTraPro.

---

## 3. Mô tả bài toán

Hệ thống MuTraPro cho phép người dùng upload file liên quan đến một đơn hàng âm nhạc. File có thể là audio đầu vào từ khách hàng, bản ký âm, bản phối, hoặc sản phẩm hoàn thiện.

Các API chính cần kiểm thử:

```text
POST http://localhost:3007/api/files/upload
GET  http://localhost:3007/api/files/files/order/:orderId
GET  http://localhost:3007/api/files/files/download/:fileId
```

Trong Postman Collection hiện tại, luồng kiểm thử `file-service` gồm:

1. Register Customer For File Order
2. Login Customer
3. Create Order For File Test
4. Upload File
5. Get Files By Order
6. Download File

---

## 4. Đặc tả API từ source code

## 4.1. API upload file

```http
POST /files/upload
```

API yêu cầu đăng nhập bằng Bearer token.

### Body dạng `multipart/form-data`

| Field           | Kiểu dữ liệu     | Bắt buộc | Ý nghĩa                                                             |
| --------------- | ---------------- | -------: | ------------------------------------------------------------------- |
| `order_id`      | positive integer |       Có | ID đơn hàng cần gắn file                                            |
| `file_type`     | enum string      |       Có | Loại file upload                                                    |
| `file`          | file             |       Có | File thực tế được upload                                            |
| `coordinatorId` | positive integer |    Không | ID coordinator để gửi thông báo khi specialist upload file sản phẩm |

### Response thành công

```json
{
  "success": true,
  "message": "File uploaded successfully.",
  "data": {
    "id": 1
  }
}
```

Expected status:

```text
201 Created
```

---

## 4.2. API lấy danh sách file theo order

```http
GET /files/files/order/:orderId
```

API yêu cầu Bearer token hợp lệ.

### Response thành công

```json
{
  "success": true,
  "message": "Files loaded successfully.",
  "data": [
    {
      "id": 1,
      "file_name": "upload-test.mp3",
      "file_type": "audio",
      "file_size": 12345,
      "created_at": "2026-06-23T00:00:00.000Z"
    }
  ]
}
```

Expected status:

```text
200 OK
```

---

## 4.3. API download file

```http
GET /files/files/download/:fileId
```

API yêu cầu Bearer token hợp lệ.

Nếu hợp lệ, server trả file về cho client và có header:

```text
Content-Disposition: attachment
```

Expected status:

```text
200 OK
```

---

## 5. Quy tắc nghiệp vụ

## 5.1. Loại file hợp lệ

| `file_type` | Extension hợp lệ                    | MIME type hợp lệ                                                                                               |
| ----------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `audio`     | `.mp3`, `.mp4`, `.m4a`, `.wav`      | `audio/mpeg`, `audio/mp4`, `audio/wav`, `audio/x-wav`, `audio/x-m4a`, `video/mp4`                              |
| `notation`  | `.pdf`, `.xml`, `.mxl`, `.musicxml` | `application/pdf`, `application/xml`, `text/xml`, `application/octet-stream`                                   |
| `mix`       | `.mp3`, `.wav`                      | `audio/mpeg`, `audio/wav`, `audio/x-wav`                                                                       |
| `final`     | `.mp3`, `.wav`, `.pdf`, `.zip`      | `audio/mpeg`, `audio/wav`, `audio/x-wav`, `application/pdf`, `application/zip`, `application/x-zip-compressed` |

## 5.2. Giới hạn dung lượng

```text
MAX_FILE_SIZE = 50MB
```

Nếu file vượt quá 50MB, hệ thống trả:

```text
400 Bad Request
File is too large. Maximum size is 50MB.
```

## 5.3. Phân quyền upload theo role

| Role          | Loại file được upload               |
| ------------- | ----------------------------------- |
| `customer`    | `audio`                             |
| `transcriber` | `notation`                          |
| `arranger`    | `mix`                               |
| `artist`      | `audio`                             |
| `coordinator` | `audio`, `notation`, `mix`, `final` |
| `admin`       | `audio`, `notation`, `mix`, `final` |

Nếu role không được phép upload loại file tương ứng, hệ thống trả:

```text
403 Forbidden
You are not allowed to upload this file type.
```

## 5.4. Quyền truy cập order

Người dùng chỉ được upload, xem hoặc download file nếu có quyền truy cập vào order:

- `admin`, `coordinator`: được truy cập mọi order.
- `customer`: chỉ được truy cập order của chính mình.
- `transcriber`, `arranger`, `artist`: chỉ được truy cập order có task được giao cho mình.

Nếu không có quyền, hệ thống trả:

```text
403 Forbidden
You are not allowed to access files for this order.
```

---

## 6. Giả định của bài toán

1. API được gọi qua API Gateway tại `http://localhost:3007/api`.
2. Người dùng phải login trước để lấy Bearer token.
3. Test case chính tập trung vào `file-service`, nhưng cần tạo customer và order trước khi upload file.
4. File upload trong Postman dùng field tên là `file`.
5. `order_id` và `file_id` phải là số nguyên dương.
6. Không kiểm thử UI.
7. Không kiểm thử trực tiếp database.
8. Không kiểm thử hiệu năng nâng cao.
9. Kiểm thử download chỉ cần kiểm tra status `200 OK` và header `Content-Disposition`.
10. Các lỗi từ service khác như `order-service`, `task-service` được xem là điều kiện phụ trợ.

Công thức logic tổng quát:

```text
ValidUploadFile =
  token is valid
  AND order_id is positive integer
  AND file_type in {audio, notation, mix, final}
  AND file exists
  AND file extension matches file_type
  AND file MIME type matches file_type
  AND file_size <= 50MB
  AND user role is allowed to upload file_type
  AND user can access order
```

---

---

## 1. Xác định lớp tương đương

### 1.1. Bảng lớp tương đương

| Biến đầu vào     | Lớp hợp lệ                                      | Tag | Lớp không hợp lệ                                           | Tag |
| ---------------- | ----------------------------------------------- | --- | ---------------------------------------------------------- | --- |
| `Authorization`  | Bearer token hợp lệ                             | V1  | Không gửi token                                            | X1  |
| `Authorization`  | Bearer token hợp lệ                             | V1  | Token sai hoặc hết hạn                                     | X2  |
| `order_id`       | Số nguyên dương, order tồn tại và user có quyền | V2  | Thiếu `order_id`                                           | X3  |
| `order_id`       | Số nguyên dương                                 | V2  | `order_id = 0` hoặc số âm                                  | X4  |
| `order_id`       | Số nguyên dương                                 | V2  | `order_id = abc`                                           | X5  |
| `order_id`       | Order thuộc quyền truy cập của user             | V3  | Order không thuộc quyền truy cập                           | X6  |
| `file_type`      | `audio`, `notation`, `mix`, `final`             | V4  | Thiếu `file_type`                                          | X7  |
| `file_type`      | Enum hợp lệ                                     | V4  | Giá trị ngoài enum, ví dụ `image`, `video`, `document`     | X8  |
| `file`           | Có file upload                                  | V5  | Không gửi file                                             | X9  |
| `file extension` | Đúng extension theo `file_type`                 | V6  | Extension không khớp `file_type`                           | X10 |
| `file MIME type` | Đúng MIME type theo `file_type`                 | V7  | MIME type không khớp `file_type`                           | X11 |
| `file_size`      | Nhỏ hơn hoặc bằng 50MB                          | V8  | Lớn hơn 50MB                                               | X12 |
| `role`           | Role được phép upload loại file đó              | V9  | Role không được phép upload loại file đó                   | X13 |
| `file_id`        | Số nguyên dương, file tồn tại                   | V10 | `file_id = 0`, âm hoặc chữ                                 | X14 |
| `file_id`        | File tồn tại trên DB và ổ đĩa                   | V11 | File metadata không tồn tại hoặc file vật lý không tồn tại | X15 |

### 1.2. Giải thích các lớp

- `Authorization` bắt buộc vì cả 3 API đều dùng `authMiddleware`.
- `order_id` và `file_id` phải là số nguyên dương.
- `file_type` là enum gồm 4 giá trị: `audio`, `notation`, `mix`, `final`.
- File hợp lệ khi đúng cả extension và MIME type.
- Role của user quyết định loại file được phép upload.
- Download file cần kiểm tra cả metadata trong database và file vật lý trên server.

---

## 2. Phân tích giá trị biên

## 2.1. Giá trị biên cho `order_id`

| Biến đầu vào | invalid dưới biên | min | min+ |          nominal | invalid kiểu dữ liệu | Tag |
| ------------ | ----------------: | --: | ---: | ---------------: | -------------------- | --- |
| `order_id`   |                 0 |   1 |    2 | ID order tồn tại | `abc`                | B1  |

Expected:

| Giá trị | Expected                                  |
| ------- | ----------------------------------------- |
| `0`     | `400 Bad Request`                         |
| `-1`    | `400 Bad Request`                         |
| `1`     | Hợp lệ nếu order tồn tại và user có quyền |
| `2`     | Hợp lệ nếu order tồn tại và user có quyền |
| `abc`   | `400 Bad Request`                         |

## 2.2. Giá trị biên cho `file_id`

| Biến đầu vào | invalid dưới biên | min | min+ |         nominal | invalid kiểu dữ liệu | Tag |
| ------------ | ----------------: | --: | ---: | --------------: | -------------------- | --- |
| `file_id`    |                 0 |   1 |    2 | ID file tồn tại | `abc`                | B2  |

Expected:

| Giá trị  | Expected                                   |
| -------- | ------------------------------------------ |
| `0`      | `400 Bad Request`                          |
| `-1`     | `400 Bad Request`                          |
| `1`      | `200 OK` nếu file tồn tại và user có quyền |
| `999999` | `404 Not Found` nếu metadata không tồn tại |
| `abc`    | `400 Bad Request`                          |

## 2.3. Giá trị biên cho dung lượng file

| Biến đầu vào |         invalid dưới biên |    min | nominal |  max |          max+ | Tag |
| ------------ | ------------------------: | -----: | ------: | ---: | ------------: | --- |
| `file_size`  | 0 byte hoặc không có file | 1 byte |     1MB | 50MB | 50MB + 1 byte | B3  |

Expected:

| Giá trị        | Expected             |
| -------------- | -------------------- |
| Không gửi file | `400 Bad Request`    |
| 1 byte         | Hợp lệ nếu đúng type |
| 1MB            | Hợp lệ nếu đúng type |
| 50MB           | Hợp lệ               |
| 50MB + 1 byte  | `400 Bad Request`    |

## 2.4. Giá trị đại diện cho `file_type`

| Nhóm       | Giá trị    | Expected                                       | Tag |
| ---------- | ---------- | ---------------------------------------------- | --- |
| Hợp lệ 1   | `audio`    | Hợp lệ với `.mp3`, `.mp4`, `.m4a`, `.wav`      | B4  |
| Hợp lệ 2   | `notation` | Hợp lệ với `.pdf`, `.xml`, `.mxl`, `.musicxml` | B5  |
| Hợp lệ 3   | `mix`      | Hợp lệ với `.mp3`, `.wav`                      | B6  |
| Hợp lệ 4   | `final`    | Hợp lệ với `.mp3`, `.wav`, `.pdf`, `.zip`      | B7  |
| Ngoài miền | `image`    | Không hợp lệ                                   | B8  |
| Rỗng       | `""`       | Không hợp lệ                                   | B9  |

---

## 3. Thiết kế test case

## 3.1. Test case chuẩn bị dữ liệu

| STT | Tên test case                      | API                   | Input                                                              | Kết quả mong đợi                                | Tag      |
| --: | ---------------------------------- | --------------------- | ------------------------------------------------------------------ | ----------------------------------------------- | -------- |
|   1 | Đăng ký customer phục vụ test file | `POST /auth/register` | name, email dynamic, password                                      | `201 Created`                                   | SETUP    |
|   2 | Login customer                     | `POST /auth/login`    | email, password                                                    | `200 OK`, response có token, role là `customer` | SETUP,V1 |
|   3 | Tạo order test upload file         | `POST /orders`        | `service_type=transcription`, `description=Order test upload file` | `201 Created`, lưu `file_order_id`              | SETUP,V2 |

## 3.2. Test case cho upload file

| STT | Tên test case                      | `order_id`             | `file_type` | File              | Token/Role        | Kết quả mong đợi                | Tag                           |
| --: | ---------------------------------- | ---------------------- | ----------- | ----------------- | ----------------- | ------------------------------- | ----------------------------- |
|   4 | Customer upload audio hợp lệ       | ID order vừa tạo       | `audio`     | `upload-test.mp3` | Customer token    | `201 Created`, trả về `id` file | V1,V2,V3,V4,V5,V6,V7,V8,V9,B4 |
|   5 | Thiếu token khi upload             | ID hợp lệ              | `audio`     | `.mp3`            | Không token       | `401 Unauthorized`              | X1                            |
|   6 | Token sai khi upload               | ID hợp lệ              | `audio`     | `.mp3`            | Token sai         | `401 Unauthorized`              | X2                            |
|   7 | Thiếu `order_id`                   | Không gửi              | `audio`     | `.mp3`            | Customer token    | `400 Bad Request`               | X3                            |
|   8 | `order_id = 0`                     | `0`                    | `audio`     | `.mp3`            | Customer token    | `400 Bad Request`               | X4,B1                         |
|   9 | `order_id` là chữ                  | `abc`                  | `audio`     | `.mp3`            | Customer token    | `400 Bad Request`               | X5,B1                         |
|  10 | Upload vào order không thuộc quyền | ID order của user khác | `audio`     | `.mp3`            | Customer token    | `403 Forbidden`                 | X6                            |
|  11 | Thiếu `file_type`                  | ID hợp lệ              | Không gửi   | `.mp3`            | Customer token    | `400 Bad Request`               | X7                            |
|  12 | `file_type` ngoài enum             | ID hợp lệ              | `image`     | `.jpg`            | Customer token    | `400 Bad Request`               | X8,B8                         |
|  13 | Không gửi file                     | ID hợp lệ              | `audio`     | Không gửi         | Customer token    | `400 Bad Request`               | X9,B3                         |
|  14 | File extension sai với `audio`     | ID hợp lệ              | `audio`     | `.pdf`            | Customer token    | `400 Bad Request`               | X10                           |
|  15 | File MIME type sai                 | ID hợp lệ              | `audio`     | file giả MIME sai | Customer token    | `400 Bad Request`               | X11                           |
|  16 | File lớn hơn 50MB                  | ID hợp lệ              | `audio`     | 50MB + 1 byte     | Customer token    | `400 Bad Request`               | X12,B3                        |
|  17 | Customer upload `notation`         | ID hợp lệ              | `notation`  | `.pdf`            | Customer token    | `403 Forbidden`                 | X13                           |
|  18 | Admin upload `final` hợp lệ        | ID hợp lệ              | `final`     | `.zip`            | Admin token       | `201 Created`                   | V9,B7                         |
|  19 | Transcriber upload notation hợp lệ | ID order được giao     | `notation`  | `.pdf`            | Transcriber token | `201 Created`                   | V9,B5                         |
|  20 | Arranger upload mix hợp lệ         | ID order được giao     | `mix`       | `.wav`            | Arranger token    | `201 Created`                   | V9,B6                         |

## 3.3. Test case cho xem file theo order

| STT | Tên test case                        | API                                        | Input          | Kết quả mong đợi                           | Tag      |
| --: | ------------------------------------ | ------------------------------------------ | -------------- | ------------------------------------------ | -------- |
|  21 | Lấy danh sách file theo order hợp lệ | `GET /files/files/order/{{file_order_id}}` | Customer token | `200 OK`, response là JSON, `data` là mảng | V1,V2,V3 |
|  22 | Thiếu token khi lấy danh sách file   | `GET /files/files/order/{{file_order_id}}` | Không token    | `401 Unauthorized`                         | X1       |
|  23 | `orderId = 0`                        | `GET /files/files/order/0`                 | Customer token | `400 Bad Request`                          | X4,B1    |
|  24 | `orderId = abc`                      | `GET /files/files/order/abc`               | Customer token | `400 Bad Request`                          | X5,B1    |
|  25 | User không có quyền xem file order   | Order của user khác                        | Customer token | `403 Forbidden`                            | X6       |

## 3.4. Test case cho download file

| STT | Tên test case                     | API                                           | Input               | Kết quả mong đợi                          | Tag           |
| --: | --------------------------------- | --------------------------------------------- | ------------------- | ----------------------------------------- | ------------- |
|  26 | Download file hợp lệ              | `GET /files/files/download/{{file_id}}`       | Customer token      | `200 OK`, có header `Content-Disposition` | V1,V10,V11,B2 |
|  27 | Thiếu token khi download          | `GET /files/files/download/{{file_id}}`       | Không token         | `401 Unauthorized`                        | X1            |
|  28 | `fileId = 0`                      | `GET /files/files/download/0`                 | Customer token      | `400 Bad Request`                         | X14,B2        |
|  29 | `fileId = abc`                    | `GET /files/files/download/abc`               | Customer token      | `400 Bad Request`                         | X14,B2        |
|  30 | File metadata không tồn tại       | `GET /files/files/download/999999`            | Customer token      | `404 Not Found`                           | X15           |
|  31 | File vật lý bị mất trên server    | File có metadata nhưng không có trong uploads | Customer token      | `404 Not Found`                           | X15           |
|  32 | User không có quyền download file | File thuộc order của user khác                | Customer token khác | `403 Forbidden`                           | X6            |

## 3.5. Mức bao phủ mong muốn

| Nhóm kiểm thử          | Test case bao phủ                              |
| ---------------------- | ---------------------------------------------- |
| Setup dữ liệu          | TC01, TC02, TC03                               |
| Happy path upload      | TC04, TC18, TC19, TC20                         |
| Authentication         | TC05, TC06, TC22, TC27                         |
| Validation `order_id`  | TC07, TC08, TC09, TC23, TC24                   |
| Validation `file_type` | TC11, TC12, TC14, TC15                         |
| Validation file        | TC13, TC16                                     |
| Authorization/RBAC     | TC10, TC17, TC25, TC32                         |
| Get files by order     | TC21-TC25                                      |
| Download file          | TC26-TC32                                      |
| Boundary value         | TC08, TC09, TC13, TC16, TC23, TC24, TC28, TC29 |

---

## 4. Triển khai kiểm thử tự động

## 4.1. Hàm kiểm tra logic upload file

```javascript
const FILE_RULES = {
  audio: {
    extensions: [".mp3", ".mp4", ".m4a", ".wav"],
  },
  notation: {
    extensions: [".pdf", ".xml", ".mxl", ".musicxml"],
  },
  mix: {
    extensions: [".mp3", ".wav"],
  },
  final: {
    extensions: [".mp3", ".wav", ".pdf", ".zip"],
  },
};

const ROLE_FILE_TYPES = {
  customer: ["audio"],
  transcriber: ["notation"],
  arranger: ["mix"],
  artist: ["audio"],
  coordinator: ["audio", "notation", "mix", "final"],
  admin: ["audio", "notation", "mix", "final"],
};

function validateUploadFile({
  tokenValid,
  orderId,
  fileType,
  fileName,
  fileSize,
  role,
  canAccessOrder,
}) {
  if (tokenValid !== true) return false;

  const parsedOrderId = Number.parseInt(orderId, 10);
  if (!Number.isInteger(parsedOrderId) || parsedOrderId < 1) return false;

  if (!FILE_RULES[fileType]) return false;

  if (!fileName || typeof fileName !== "string") return false;

  const extension = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
  if (!FILE_RULES[fileType].extensions.includes(extension)) return false;

  if (
    typeof fileSize !== "number" ||
    fileSize < 1 ||
    fileSize > 50 * 1024 * 1024
  ) {
    return false;
  }

  const allowedTypes = ROLE_FILE_TYPES[role] || [];
  if (!allowedTypes.includes(fileType)) return false;

  if (canAccessOrder !== true) return false;

  return true;
}

module.exports = { validateUploadFile };
```

## 4.2. Unit test cho trường hợp biên

```javascript
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateUploadFile } = require("./validateUploadFile");

test("Valid upload: customer uploads mp3 audio", () => {
  const result = validateUploadFile({
    tokenValid: true,
    orderId: 1,
    fileType: "audio",
    fileName: "upload-test.mp3",
    fileSize: 1024,
    role: "customer",
    canAccessOrder: true,
  });

  assert.equal(result, true);
});

test("Invalid boundary: orderId is 0", () => {
  const result = validateUploadFile({
    tokenValid: true,
    orderId: 0,
    fileType: "audio",
    fileName: "upload-test.mp3",
    fileSize: 1024,
    role: "customer",
    canAccessOrder: true,
  });

  assert.equal(result, false);
});

test("Invalid boundary: file is larger than 50MB", () => {
  const result = validateUploadFile({
    tokenValid: true,
    orderId: 1,
    fileType: "audio",
    fileName: "upload-test.mp3",
    fileSize: 50 * 1024 * 1024 + 1,
    role: "customer",
    canAccessOrder: true,
  });

  assert.equal(result, false);
});

test("Invalid partition: customer cannot upload notation", () => {
  const result = validateUploadFile({
    tokenValid: true,
    orderId: 1,
    fileType: "notation",
    fileName: "score.pdf",
    fileSize: 1024,
    role: "customer",
    canAccessOrder: true,
  });

  assert.equal(result, false);
});

test("Invalid partition: audio cannot use pdf extension", () => {
  const result = validateUploadFile({
    tokenValid: true,
    orderId: 1,
    fileType: "audio",
    fileName: "score.pdf",
    fileSize: 1024,
    role: "customer",
    canAccessOrder: true,
  });

  assert.equal(result, false);
});
```

---

## 4.3. Postman test script cho register customer

Áp dụng cho request:

```text
Register Customer For File Order
```

Request:

```json
{
  "name": "File Customer",
  "email": "{{file_customer_email}}",
  "password": "{{default_password}}"
}
```

Test script:

```javascript
pm.test("HTTP 201", () => pm.response.to.have.status(201));

pm.test("File customer email prepared", () => {
  pm.expect(pm.environment.get("file_customer_email")).to.not.be.empty;
});
```

---

## 4.4. Postman test script cho login customer

Áp dụng cho request:

```text
Login Customer
```

Request:

```json
{
  "email": "{{file_customer_email}}",
  "password": "{{default_password}}"
}
```

Test script:

```javascript
pm.test("HTTP 200", () => pm.response.to.have.status(200));

const json = pm.response.json();

pm.test("Customer login success", () => {
  pm.expect(json.token).to.exist;
  pm.expect(json.user.role).to.eql("customer");
});

pm.environment.set("file_customer_token", json.token);
```

---

## 4.5. Postman test script cho tạo order test

Áp dụng cho request:

```text
Create Order For File Test
```

Request:

```json
{
  "service_type": "transcription",
  "description": "Order test upload file"
}
```

Test script:

```javascript
pm.test("HTTP 201", () => pm.response.to.have.status(201));

const json = pm.response.json();
const payload = json.data || json.order || json;
const orderId = payload.id || payload.orderId;

pm.test("File order ID exists", () => {
  pm.expect(orderId).to.exist;
});

pm.environment.set("file_order_id", String(orderId));
```

---

## 4.6. Postman test script cho upload file hợp lệ

Áp dụng cho request:

```text
Upload File
```

Request `multipart/form-data`:

| Key         | Value                            | Type |
| ----------- | -------------------------------- | ---- |
| `order_id`  | `{{file_order_id}}`              | text |
| `file_type` | `audio`                          | text |
| `file`      | `tests/fixtures/upload-test.mp3` | file |

Test script:

```javascript
let json = {};
try {
  json = pm.response.json();
} catch (error) {}

pm.test("HTTP 201", () => {
  pm.expect(pm.response.code, json.message || pm.response.text()).to.eql(201);
});

pm.test("Upload response has file id", () => {
  const payload = json.data || json;
  pm.expect(payload.id).to.exist;
  pm.environment.set("file_id", String(payload.id));
});
```

---

## 4.7. Postman test script cho lấy file theo order

Áp dụng cho request:

```text
Get Files By Order
```

Request:

```http
GET {{baseUrl}}/files/files/order/{{file_order_id}}
```

Test script:

```javascript
pm.test("HTTP 200", () => pm.response.to.have.status(200));

pm.test("Response is JSON", () => {
  pm.response.to.be.json;
});

const json = pm.response.json();
const payload = json.data || json;

pm.test("Files payload is array", () => {
  pm.expect(payload).to.be.an("array");
});
```

---

## 4.8. Postman test script cho download file

Áp dụng cho request:

```text
Download File
```

Request:

```http
GET {{baseUrl}}/files/files/download/{{file_id}}
```

Test script:

```javascript
pm.test("HTTP 200", () => pm.response.to.have.status(200));

pm.test("Download has content-disposition header", () => {
  pm.expect(pm.response.headers.has("Content-Disposition")).to.eql(true);
});
```

---

## 4.9. Postman test script cho lỗi thiếu token

Áp dụng cho upload, get files hoặc download khi không gửi Bearer token:

```javascript
pm.test("Status code is 401 Unauthorized", function () {
  pm.response.to.have.status(401);
});

pm.test("Response has authentication error", function () {
  const json = pm.response.json();
  pm.expect(json.message || json.error).to.exist;
});
```

---

## 4.10. Postman test script cho lỗi file sai định dạng

Áp dụng cho upload `file_type=audio` nhưng gửi file `.pdf`:

```javascript
pm.test("Status code is 400 Bad Request", function () {
  pm.response.to.have.status(400);
});

pm.test("Response has unsupported format message", function () {
  const json = pm.response.json();
  pm.expect(json.message || json.error).to.exist;
});
```

---

## 4.11. Chạy kiểm thử tự động bằng Newman

Collection hiện có:

```text
postman/Presentation.postman_collection.json
```

Environment hiện có:

```text
postman/MutraPro Local.postman_environment.json
```

Lệnh chạy riêng folder `file-service`:

```powershell
newman.cmd run "postman/Presentation.postman_collection.json" `
  --environment "postman/MutraPro Local.postman_environment.json" `
  --env-var "baseUrl=http://localhost:3007/api" `
  --folder "file-service" `
  --reporters "cli,json,htmlextra" `
  --reporter-json-export local-test-notes\newman-results\file-service-report.json `
  --reporter-htmlextra-export local-test-notes\newman-results\file-service-report.html
```

Kết quả mong đợi:

| Chỉ số             | Kết quả mong đợi |
| ------------------ | ---------------: |
| Register customer  |             Pass |
| Login customer     |             Pass |
| Create order       |             Pass |
| Upload file        |             Pass |
| Get files by order |             Pass |
| Download file      |             Pass |
| Failed             |                0 |

Kết luận mong đợi:

```text
Bộ kiểm thử API cho file-service chạy thành công.
File được upload đúng order, có thể lấy danh sách theo order và download lại bằng file_id.
Các request sai token, sai order_id, sai file_type, sai định dạng file hoặc sai quyền phải bị từ chối bằng status code phù hợp.
```

## Đánh giá

## 1. Vì sao `file-service` phù hợp để kiểm thử hộp đen?

`file-service` có nhiều điều kiện đầu vào rõ ràng:

- Token đăng nhập.
- `order_id`.
- `file_type`.
- File upload.
- Extension.
- MIME type.
- Dung lượng file.
- Role người dùng.
- Quyền truy cập order.
- `file_id` khi download.

Vì vậy, service này phù hợp để áp dụng cả:

- Phân hoạch lớp tương đương.
- Phân tích giá trị biên.
- Thiết kế test case API.
- Kiểm thử tự động bằng Postman/Newman.

## 2. Điểm khác so với order-service

| Nội dung         | order-service                 | file-service                          |
| ---------------- | ----------------------------- | ------------------------------------- |
| Kiểu input chính | JSON body                     | multipart/form-data                   |
| Biến quan trọng  | `service_type`, `description` | `order_id`, `file_type`, `file`       |
| Biên chính       | Độ dài description, order id  | Dung lượng file, order id, file id    |
| Rủi ro chính     | Sai dữ liệu order             | Sai định dạng file, sai quyền upload  |
| Output chính     | Order mới                     | File metadata và file tải về          |
| Phân quyền       | Customer tạo order            | Role quyết định loại file được upload |

## 3. Rủi ro cần chú ý khi test thực tế

1. File upload phải đúng đường dẫn trên máy chạy Newman.
2. Nếu file `tests/fixtures/upload-test.mp3` không tồn tại, request upload sẽ fail trước khi đến server.
3. Nếu order-service không chạy, upload có thể fail khi kiểm tra quyền truy cập order.
4. Nếu task-service không chạy, specialist role có thể fail khi kiểm tra task được giao.
5. Nếu file bị xóa khỏi thư mục `uploads`, download sẽ trả `404`.
6. Nếu JWT secret giữa auth-service và file-service không giống nhau, token sẽ bị xem là invalid.

---

## 4. Kết luận

Bài kiểm thử đã chuyển đổi thành công sang chức năng upload và download file trong `file-service` của dự án MuTraPro.

Các kỹ thuật đã áp dụng:

- Phân hoạch lớp tương đương.
- Phân tích giá trị biên.
- Thiết kế test case có tag bao phủ.
- Kiểm thử tự động bằng Postman/Newman.
- Kiểm thử quyền truy cập dựa trên role và ownership.

Kết quả mong đợi cuối cùng:

```text
file-service chỉ chấp nhận upload file khi user có token hợp lệ,
order_id hợp lệ, file_type đúng enum, file đúng định dạng,
dung lượng không vượt quá 50MB và user có quyền với order đó.

Các request thiếu token, sai token, sai order_id, sai file_type,
sai định dạng file, quá dung lượng hoặc sai quyền phải bị từ chối
bằng HTTP status code phù hợp.
```
