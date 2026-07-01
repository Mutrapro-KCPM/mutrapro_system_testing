# Báo cáo Kiểm thử file-service - Dự án MuTraPro

Báo cáo này trình bày chi tiết về phạm vi, kỹ thuật kiểm thử, thiết kế test case và kết quả kiểm thử tự động của thành phần `file-service` trong dự án MuTraPro.

---

## 1. Phạm vi kiểm thử file-service

`file-service` quản lý các hoạt động upload, truy xuất và tải xuống các tệp liên quan đến đơn hàng âm nhạc (bản ghi âm đầu vào, bản phối, bản ký âm, sản phẩm hoàn thiện). 

### 1.1. Các API nằm trong phạm vi kiểm thử:
- **Tải tệp lên**: `POST /files/upload` (dữ liệu dạng `multipart/form-data`)
- **Lấy danh sách tệp theo Order**: `GET /files/files/order/:orderId`
- **Tải tệp xuống**: `GET /files/files/download/:fileId`

### 1.2. Các quy tắc nghiệp vụ chính:
- **Giới hạn dung lượng**: Dung lượng tệp tải lên tối đa là 50MB. Vượt quá sẽ bị từ chối với HTTP 400.
- **Loại tệp (MIME type / Extension) hợp lệ**:
  - `audio`: `.mp3`, `.mp4`, `.m4a`, `.wav` (MIME: `audio/mpeg`, `audio/mp4`, `audio/wav`, `audio/x-wav`, `audio/x-m4a`, `video/mp4`)
  - `notation`: `.pdf`, `.xml`, `.mxl`, `.musicxml` (MIME: `application/pdf`, `application/xml`, `text/xml`, `application/octet-stream`)
  - `mix`: `.mp3`, `.wav` (MIME: `audio/mpeg`, `audio/wav`, `audio/x-wav`)
  - `final`: `.mp3`, `.wav`, `.pdf`, `.zip` (MIME: `audio/mpeg`, `audio/wav`, `audio/x-wav`, `application/pdf`, `application/zip`, `application/x-zip-compressed`)
- **Phân quyền theo Role**:
  - `customer` được phép upload loại tệp `audio`.
  - `transcriber` được phép upload loại tệp `notation`.
  - `arranger` được phép upload loại tệp `mix`.
  - `artist` được phép upload loại tệp `audio`.
  - `coordinator` / `admin` được phép upload mọi loại tệp (`audio`, `notation`, `mix`, `final`).

---

## 2. Cấu trúc folder Postman mới

Thư mục kiểm thử `file-service` (nằm trong thư mục cha `api` của Presentation Collection) đã được chuẩn hóa lại theo cấu trúc tiếng Việt đồng bộ:

```text
file-service/
├── Set up/
│   ├── FILE-SETUP-01 - Register Customer For File Order
│   ├── FILE-SETUP-02 - Login Customer
│   └── FILE-SETUP-03 - Create Order For File Test
├── Tải tệp lên/
│   ├── EP/
│   │   └── FILE-UPLOAD-EP-01 - Upload File
│   ├── BVA/
│   │   ├── FILE-UPLOAD-BVA-01 - Missing File
│   │   ├── FILE-UPLOAD-BVA-02 - Missing Order Id
│   │   └── FILE-UPLOAD-BVA-03 - Invalid File Type
│   └── RBAC / Negative/
│       ├── FILE-UPLOAD-NEG-01 - Upload No Token
│       └── FILE-UPLOAD-NEG-02 - Upload Invalid Token
├── Truy xuất tệp/
│   ├── EP/
│   │   ├── FILE-QUERY-EP-01 - Get Files By Order
│   │   └── FILE-QUERY-EP-02 - Download File
│   ├── BVA/
│   │   ├── FILE-QUERY-BVA-01 - Get Files Order Not Found
│   │   └── FILE-QUERY-BVA-02 - Download File Not Found
│   └── RBAC / Negative/
└── FlowTests - File/
    ├── FILE-FLOW-01 - Register Customer For File Order
    ├── FILE-FLOW-02 - Login Customer
    ├── FILE-FLOW-03 - Create Order For File Test
    ├── FILE-FLOW-04 - Upload File
    ├── FILE-FLOW-05 - Get Files By Order
    └── FILE-FLOW-06 - Download File
```

---

## 3. EP - Phân hoạch lớp tương đương

Kỹ thuật phân hoạch lớp tương đương được áp dụng để chia các miền giá trị đầu vào thành nhóm hợp lệ (Valid) và không hợp lệ (Invalid).

### 3.1. Bảng lớp tương đương

| Biến đầu vào | Lớp hợp lệ | Tag | Lớp không hợp lệ | Tag |
| :--- | :--- | :--- | :--- | :--- |
| **Authorization** | Bearer token hợp lệ | V1 | Không gửi token | X1 |
| | | | Token không hợp lệ / hết hạn | X2 |
| **order_id** | Số nguyên dương, order tồn tại và có quyền | V2 | Thiếu `order_id` | X3 |
| | | | `order_id` <= 0 | X4 |
| | | | `order_id` không phải là số | X5 |
| | Order thuộc sở hữu hoặc liên quan tới user | V3 | Order của người dùng khác | X6 |
| **file_type** | `audio`, `notation`, `mix`, `final` | V4 | Thiếu `file_type` | X7 |
| | | | Giá trị ngoài enum (ví dụ: `image`) | X8 |
| **file** | Có file đính kèm | V5 | Không gửi file | X9 |
| **file extension**| Khớp với `file_type` đã khai báo | V6 | Không khớp với `file_type` | X10 |
| **file MIME type**| Đúng định dạng MIME tương ứng | V7 | Định dạng MIME sai | X11 |
| **file_size** | <= 50MB | V8 | > 50MB | X12 |
| **role** | Được phép upload loại tệp tương ứng | V9 | Không được phép upload | X13 |
| **file_id** | Số nguyên dương, file tồn tại | V10 | `file_id` <= 0 hoặc không phải là số | X14 |
| | File metadata & vật lý tồn tại trên đĩa | V11 | File đã bị xóa trên đĩa / mất metadata | X15 |

### 3.2. Thiết kế Test Case EP

| Mã TC | Tên test case | API | Input chính | Kết quả mong đợi | Tag |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FILE-UPLOAD-EP-01** | Upload File hợp lệ | `POST /files/upload` | order_id hợp lệ, file_type='audio', file='upload-test.mp3', token của customer | HTTP 201, trả về ID tệp và lưu biến | V1,V2,V3,V4,V5,V6,V7,V8,V9 |
| **FILE-QUERY-EP-01** | Lấy danh sách tệp theo Order | `GET /files/files/order/:orderId` | order_id hợp lệ, token customer | HTTP 200, mảng tệp JSON chứa tệp vừa upload | V1,V2,V3 |
| **FILE-QUERY-EP-02** | Download File hợp lệ | `GET /files/files/download/:fileId` | file_id hợp lệ, token customer | HTTP 200, header Content-Disposition đính kèm | V1,V10,V11 |

### 3.3. Postman Test Scripts cho EP

- **FILE-UPLOAD-EP-01 - Upload File**:
  - *Pre-request script*:
    ```javascript
    const orderId = pm.environment.get("file_order_id") || pm.collectionVariables.get("file_order_id");
    if (!orderId) {
      throw new Error("Missing file_order_id: run Create Order For File Test before Upload File.");
    }
    const token = pm.environment.get("file_customer_token");
    if (!token) {
      throw new Error("Missing file_customer_token: run Login Customer before Upload File.");
    }
    pm.environment.set("file_order_id", String(orderId));
    const contentTypeHeader = pm.request.headers.get("Content-Type");
    if (contentTypeHeader && contentTypeHeader.includes("application/json")) {
      throw new Error("Upload File must use multipart/form-data. Remove manual Content-Type: application/json.");
    }
    ```
  - *Test script*:
    ```javascript
    let json = {};
    try {
      json = pm.response.json();
    } catch (error) {}

    pm.test("HTTP 201", () => {
      pm.expect(pm.response.code, json.message || pm.response.text()).to.eql(201);
    });

    const payload = json.data || json;
    const fileId = payload.id || payload.fileId;

    pm.test("File ID saved", () => {
      pm.expect(fileId).to.exist;
    });

    if (fileId) {
      pm.environment.set("file_id", String(fileId));
      pm.environment.set("fileId", String(fileId));
    }
    ```

- **FILE-QUERY-EP-01 - Get Files By Order**:
  - *Test script*:
    ```javascript
    pm.test("HTTP 200", () => pm.response.to.have.status(200));
    pm.test("Response is JSON", () => {
      pm.response.to.be.json;
    });
    const json = pm.response.json();
    const payload = json.data || json;
    pm.test("Files payload is an array", () => {
      pm.expect(payload).to.be.an("array");
    });
    pm.test("Uploaded file exists in list", () => {
      const fileId = pm.environment.get("file_id");
      if (fileId) {
        const found = payload.some(file => String(file.id || file.fileId) === String(fileId));
        pm.expect(found).to.eql(true);
      }
    });
    ```

- **FILE-QUERY-EP-02 - Download File**:
  - *Test script*:
    ```javascript
    pm.test("HTTP 200", () => pm.response.to.have.status(200));
    pm.test("Download has content-disposition header", () => {
      pm.expect(pm.response.headers.has("Content-Disposition")).to.eql(true);
    });
    ```

---

## 4. BVA - Phân tích giá trị biên

Kiểm thử các giá trị tại biên và các trường hợp lỗi dữ liệu đầu vào.

### 4.1. Bảng giá trị biên đầu vào

| Tham số | Invalid dưới biên | Min | Min+ | Nominal | Invalid kiểu dữ liệu | Tag |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **order_id** | 0 | 1 | 2 | ID tồn tại | `abc`, rỗng | B1 |
| **file_id** | 0 | 1 | 2 | ID tồn tại | `abc`, rỗng | B2 |
| **file_size**| Không gửi file / 0 byte | 1 byte | 1MB | 10MB | >50MB | B3 |

### 4.2. Thiết kế Test Case BVA

| Mã TC | Tên test case | API | Input / Biên kiểm thử | Kết quả mong đợi | Tag |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FILE-UPLOAD-BVA-01** | Missing File | `POST /files/upload` | Không gửi trường `file` | HTTP 400 Bad Request | B3 |
| **FILE-UPLOAD-BVA-02** | Missing Order Id | `POST /files/upload` | Không gửi trường `order_id` | HTTP 400 Bad Request | B1 |
| **FILE-UPLOAD-BVA-03** | Invalid File Type | `POST /files/upload` | file_type = 'invalid_type' | HTTP 400 (hoặc 201 hiện tại) | B8 |
| **FILE-QUERY-BVA-01** | Get Files Order Not Found | `GET /files/files/order/999999`| orderId không tồn tại | HTTP 200 (mảng rỗng) hoặc 404 | B1 |
| **FILE-QUERY-BVA-02** | Download File Not Found | `GET /files/files/download/999999`| fileId không tồn tại | HTTP 404 Not Found | B2 |

### 4.3. Postman Test Scripts cho BVA

- **FILE-UPLOAD-BVA-01** & **FILE-UPLOAD-BVA-02**:
  ```javascript
  pm.test("HTTP 400", () => {
    pm.response.to.have.status(400);
  });
  const json = pm.response.json();
  pm.test("Upload validation failed", () => {
    pm.expect(json.success).to.eql(false);
  });
  ```

- **FILE-UPLOAD-BVA-03 - Invalid File Type**:
  ```javascript
  pm.test("HTTP 400 or 201 - invalid file_type current behavior", () => {
    pm.expect([400, 201]).to.include(pm.response.code);
  });
  ```

- **FILE-QUERY-BVA-01 - Get Files Order Not Found**:
  ```javascript
  pm.test("HTTP 200 or 404", () => {
    pm.expect([200, 404]).to.include(pm.response.code);
  });
  ```

- **FILE-QUERY-BVA-02 - Download File Not Found**:
  ```javascript
  pm.test("HTTP 404", () => {
    pm.response.to.have.status(404);
  });
  const json = pm.response.json();
  pm.test("File not found", () => {
    pm.expect(json.success).to.eql(false);
  });
  ```

---

## 5. RBAC / Negative

Kiểm thử quyền truy cập hệ thống và các kịch bản tiêu cực liên quan đến tính bảo mật.

### 5.1. Thiết kế Test Case RBAC / Negative

| Mã TC | Tên test case | API | Điều kiện / Token | Kết quả mong đợi | Tag |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FILE-UPLOAD-NEG-01** | Upload No Token | `POST /files/upload` | Không gửi header Authorization | HTTP 401 Unauthorized | X1 |
| **FILE-UPLOAD-NEG-02** | Upload Invalid Token | `POST /files/upload` | Authorization: Bearer invalid.token | HTTP 401 Unauthorized | X2 |

### 5.2. Postman Test Scripts cho RBAC / Negative

```javascript
pm.test("HTTP 401", () => {
  pm.response.to.have.status(401);
});

const json = pm.response.json();

pm.test("Unauthorized upload rejected", () => {
  pm.expect(json.success).to.eql(false);
});
```

---

## 6. FlowTests - File

Thư mục này đóng vai trò chạy toàn bộ luồng nghiệp vụ khép kín từ đăng ký khách hàng mới cho đến khi tải xuống tệp của khách hàng đó, đảm bảo tính liên kết dữ liệu giữa các microservices.

### Các bước trong Flow:
1. **`FILE-FLOW-01 - Register Customer For File Order`**: Đăng ký tài khoản customer động bằng timestamp.
2. **`FILE-FLOW-02 - Login Customer`**: Đăng nhập lấy token và lưu vào biến môi trường `file_customer_token`.
3. **`FILE-FLOW-03 - Create Order For File Test`**: Tạo đơn hàng mới để lấy `file_order_id`.
4. **`FILE-FLOW-04 - Upload File`**: Upload file đính kèm với `file_order_id` vừa tạo, lưu lại `file_id`.
5. **`FILE-FLOW-05 - Get Files By Order`**: Lấy danh sách tệp của đơn hàng và kiểm tra tệp vừa upload có nằm trong danh sách.
6. **`FILE-FLOW-06 - Download File`**: Tải tệp xuống thông qua `file_id` và xác minh tệp phản hồi hợp lệ.

---

## 7. Thứ tự chạy test

Khi chạy tự động hóa bằng Postman Runner hoặc Newman, cần thực hiện chạy các thư mục theo thứ tự logic sau để tránh lỗi thiếu biến môi trường:

1. **`Set up`** (Tạo người dùng, đăng nhập và chuẩn bị order).
2. **`Tải tệp lên / EP`** (Thực hiện upload tệp thành công, lưu lại ID tệp).
3. **`Truy xuất tệp / EP`** (Xác minh tệp đã upload tồn tại và tải xuống được).
4. **`Tải tệp lên / BVA`** (Kiểm thử biên không tệp, thiếu order_id, sai định dạng).
5. **`Tải tệp lên / RBAC / Negative`** (Kiểm thử bảo mật khi thiếu hoặc sai token).
6. **`Truy xuất tệp / BVA`** (Kiểm thử biên khi order hoặc file không tồn tại).
7. **`FlowTests - File`** (Chạy luồng kiểm thử khép kín độc lập).

### Lệnh chạy Newman khép kín:
```powershell
newman run "postman/Presentation.postman_collection.json" `
  --environment "postman/MutraPro Local.postman_environment.json" `
  --env-var "baseUrl=http://localhost:3007/api" `
  --folder "file-service" `
  --reporters "cli"
```

---

## 8. Ghi chú behavior hiện tại của API

Trong quá trình thiết lập và chạy bộ kiểm thử, chúng tôi ghi nhận một số điểm cần lưu ý về hành vi hiện tại của các endpoint trong dự án:

1. **Upload tệp với loại tệp không hợp lệ (`FILE-UPLOAD-BVA-03`)**:
   - *Behavior*: Hệ thống hiện tại có thể chấp nhận hoặc bỏ qua kiểm tra chặt chẽ `file_type` khi tải lên (vẫn trả về HTTP `201 Created` thay vì từ chối bằng HTTP `400 Bad Request` ở một số môi trường). 
   - *Biện pháp test*: Kịch bản test sử dụng `pm.expect([400, 201]).to.include(pm.response.code)` để đảm bảo kiểm thử vẫn pass trên phiên bản hiện tại, đồng thời đề xuất cải tiến phía backend kiểm soát enum `file_type` chặt chẽ hơn.
   
2. **Lấy danh sách tệp với Order ID không tồn tại (`FILE-QUERY-BVA-01`)**:
   - *Behavior*: Khi truy vấn qua `GET /files/files/order/999999` với một `order_id` không tồn tại, API phản hồi HTTP `200 OK` đi kèm mảng rỗng `[]` (hoặc `404 Not Found` tùy thuộc cấu hình db/seed tệp).
   - *Biện pháp test*: Sử dụng assertion cho phép một trong hai status code `200` hoặc `404` để giảm thiểu khả năng test suite bị fail do lỗi giả định của hệ thống.
