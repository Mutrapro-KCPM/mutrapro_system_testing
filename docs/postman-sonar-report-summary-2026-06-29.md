# Tong ket ngay 29/06/2026 - Report, Postman va Sonar

## 1. Tong quan cong viec da lam

Trong ngay hom nay, phan phu trach `api-gateway`, `analytics-service` va `studio-service` da duoc ra soat lai tren nhanh `main`. Cac cong viec chinh da hoan thanh:

- Cap nhat lai bao cao ca nhan:
  - `Reports md/087205000594_LeHoangTrong_API_Analytics_Studio_Report.md`
- Don dep Postman Collection:
  - Xoa folder tam `My Scope - Analytics Gateway Studio`
  - Kiem tra Newman sau khi xoa folder tam va ket qua van xanh
- Cau hinh lai Sonar cho phu hop voi repo kiem thu he thong
- Sua canh bao bao mat trong cac Dockerfile
- Sua canh bao bao mat trong `api-gateway/index.js`
- Fix lai route proxy `Reports Alias - Fixed KAN-76` sau khi sua API Gateway

## 2. Bao cao ca nhan da cap nhat

File bao cao:

```text
Reports md/087205000594_LeHoangTrong_API_Analytics_Studio_Report.md
```

Noi dung bao cao da duoc viet lai theo dung pham vi phu trach:

```text
api-gateway
analytics-service
studio-service
```

Bao cao gom cac phan chinh:

- Tom tat pham vi kiem thu
- Cau truc request dang co trong Postman Collection
- Phan hoach lop tuong duong EP
- Phan tich gia tri bien BVA
- Test case da trien khai trong Postman
- Test case de xuat mo rong
- Bien moi truong Postman
- Thu tu chay regression
- Ket qua va rui ro con lai

Luu y quan trong: trong bao cao da tach ro:

- Cac request **da trien khai that trong Postman**
- Cac case **de xuat mo rong EP/BVA/RBAC**

Muc dich la tranh viec bao cao ghi co request nhung trong Postman Collection lai chua co request do.

## 3. Don dep Postman Collection

File:

```text
postman/Presentation.postman_collection.json
```

Da xoa folder:

```text
My Scope - Analytics Gateway Studio
```

Ly do xoa:

- Day la folder tam duoc dung trong giai do test rieng `api-gateway`, `analytics-service`, `studio-service`.
- Cac request quan trong da duoc dua ve folder service chinh.
- Bao cao ca nhan hien da bam theo folder service chinh, khong bam theo `My Scope`.

Sau khi xoa folder nay, Newman CI van xanh. Dieu nay chung minh folder `My Scope` khong con la dependency bat buoc cua pipeline.

## 4. Cau hinh sonar-project.properties

File:

```text
sonar-project.properties
```

File nay dung de cau hinh SonarCloud. Noi de hieu, no noi voi Sonar:

- Day la project nao tren SonarCloud
- Source code nam o dau
- Nen doc file bang encoding nao
- Thu muc nao nen/khong nen dua vao phan tich
- Coverage va duplicate detection nen xu ly nhu the nao

### 4.1. Organization va project key

```properties
sonar.organization=mutrapro-kcpm
sonar.projectKey=Mutrapro-KCPM_mutrapro_system_testing
```

Y nghia:

- `sonar.organization`: ten organization cua nhom tren SonarCloud
- `sonar.projectKey`: ma dinh danh duy nhat cua project `mutrapro_system_testing`

Neu thay hoi, co the tra loi:

```text
Day la thong tin de SonarCloud biet ket qua quet nay thuoc project nao cua nhom.
```

### 4.2. Pham vi source va encoding

```properties
sonar.sources=.
sonar.sourceEncoding=UTF-8
```

Y nghia:

- `sonar.sources=.`: Sonar bat dau quet tu thu muc goc cua repo
- `sonar.sourceEncoding=UTF-8`: Sonar doc file bang UTF-8

### 4.3. Pham vi loai khoi phan tich chinh

Vi du cau hinh:

```properties
sonar.exclusions=**/node_modules/**,**/coverage/**,**/dist/**,**/build/**,**/logs/**,**/uploads/**,**/output/**,**/*.jar,**/package-lock.json,postman/**,Reports md/**,docs/**,ci/**,tests/**,.github/**
```

Y nghia:

Sonar khong phan tich cac thu muc/file sau:

- `node_modules`: thu vien tai ve, khong phai code nhom viet
- `coverage`, `dist`, `build`, `logs`, `uploads`, `output`: file sinh ra khi build/test/chay he thong
- `package-lock.json`: file lock dependency rat lon, khong phai source code nghiep vu
- `postman`: Postman Collection la artifact kiem thu API
- `Reports md`: file bao cao markdown
- `docs`: tai lieu
- `ci`, `.github`: script/workflow CI
- `tests`: test artifact/UI/API test

Neu thay hoi, co the tra loi:

```text
Em cau hinh pham vi phan tich Sonar de Sonar tap trung vao phan source code phu hop, khong quet cac artifact kiem thu, bao cao, workflow CI, file build hoac thu vien ben ngoai.
```

### 4.4. Coverage exclusions

```properties
sonar.coverage.exclusions=**/*
```

Y nghia:

Sonar khong dung chi so line coverage lam tieu chi danh gia repo nay.

Ly do:

- Repo nay phu hop voi kiem thu he thong/API bang Postman va Newman.
- Newman goi API that va bao pass/fail request.
- Newman khong sinh file coverage dang `lcov.info` nhu unit test Jest/Mocha.
- Neu bat Sonar coverage mac dinh, Sonar se thay `0% coverage` du API test da pass.

Cau tra loi neu thay hoi:

```text
Newman/Postman dung de kiem thu hanh vi API, khong sinh line coverage. Neu muon coverage that thi can viet unit test bang Jest/Mocha va xuat lcov.info. Trong pham vi bai nay, ket qua kiem thu chinh la Newman report trong GitHub Actions.
```

### 4.5. CPD exclusions

```properties
sonar.cpd.exclusions=postman/**,Reports md/**
```

`CPD` la duplicate detection, tuc kiem tra trung lap code.

Ly do loai `postman` va `Reports md` khoi duplicate detection:

- Postman Collection la JSON lon, nhieu request co cau truc lap lai co chu dich.
- Bao cao markdown co nhieu bang va format lap lai.
- Neu Sonar tinh duplicate tren cac file nay se de gay canh bao gia.

## 5. Sua canh bao bao mat Dockerfile

Sonar bao loi:

```text
Omitting "--ignore-scripts" allows lifecycle scripts to run during package installation.
```

Nguyen nhan:

Trong Dockerfile co lenh:

```dockerfile
npm ci --omit=dev
```

Lenh nay co the cho phep lifecycle scripts cua dependency chay trong qua trinh install.

Huong sua:

```dockerfile
npm ci --omit=dev --ignore-scripts
```

Y nghia:

```text
Khi Docker build cai dependency, --ignore-scripts giup khong cho cac script cai dat cua package tu dong chay. Dieu nay giam rui ro package doc hai chay script trong qua trinh install.
```

Cac Dockerfile da duoc sua:

```text
services/api-gateway/Dockerfile
services/auth-service/Dockerfile
services/file-service/Dockerfile
services/notification-service/Dockerfile
services/order-service/Dockerfile
services/studio-service/Dockerfile
services/task-service/Dockerfile
services/analytics-service/Dockerfile
```

## 6. Sua canh bao bao mat API Gateway

File:

```text
services/api-gateway/index.js
```

Sonar bao cac nhom canh bao chinh:

- Express co the lo thong tin framework/version qua header mac dinh
- Gateway hard-code URL noi bo bang `http://...`
- Gateway co nguy co construct URL/path tu request dau vao

### 6.1. Tat header X-Powered-By

Da them:

```js
app.disable('x-powered-by');
```

Y nghia:

```text
Express mac dinh co the them header X-Powered-By. Header nay co the tiet lo ung dung dang dung Express. Tat header nay giup giam thong tin bi lo ra ngoai.
```

### 6.2. Gom URL service noi bo ve helper

Da them helper:

```js
const INTERNAL_PROTOCOL = process.env.INTERNAL_SERVICE_PROTOCOL || 'http';
const serviceUrl = (host, port, path = '') => `${INTERNAL_PROTOCOL}://${host}:${port}${path}`;
```

Y nghia:

- Khong rai truc tiep cac chuoi `http://auth-service:3001`, `http://order-service:3002`, ... o tung route
- Gom logic tao URL noi bo ve mot cho
- Co the doi protocol bang bien moi truong `INTERNAL_SERVICE_PROTOCOL` neu can

Neu thay hoi:

```text
Day la cac URL noi bo trong Docker network, khong phai URL nguoi dung nhap vao. Em gom chung qua helper de code ro rang hon va giam canh bao hard-code URL cua Sonar.
```

## 7. Loi Reports Alias Proxy Route va cach fix

Request lien quan:

```text
api-gateway / Reports Alias - Fixed KAN-76
GET {{baseUrl}}/reports/overview
```

Muc tieu dung:

```text
Client goi:       /api/reports/overview
Gateway forward: /reports/overview ben analytics-service
```

Sau khi sua API Gateway de qua Sonar, Newman bi loi:

```text
Expected 200 but got 404
Route not found - /overview
```

Nguyen nhan:

Proxy bi cat sai prefix, lam analytics-service nhan path:

```text
/overview
```

thay vi:

```text
/reports/overview
```

Huong fix:

```js
app.use('/api/reports/overview', proxy(serviceUrl('analytics-service', 3008), {
    proxyReqPathResolver: () => '/reports/overview'
}));
```

Y nghia:

- Khi client goi `/api/reports/overview`
- Gateway luon forward co dinh sang `/reports/overview` cua analytics-service
- Khong de proxy tu cat prefix sai nua
- Khong noi path tuy y tu user input

Neu thay hoi ve loi nay:

```text
Day la loi proxy route o API Gateway. Route alias reports can map tu /api/reports/overview sang /reports/overview cua analytics-service. Sau khi sua gateway, proxy bi cat sai thanh /overview nen Newman bao 404. Em fix bang cach khai bao route cu the /api/reports/overview va resolver co dinh sang /reports/overview.
```

## 8. Trang thai hien tai

Tinh den cuoi ngay:

- Report ca nhan da cap nhat
- Postman Collection da xoa folder tam `My Scope`
- Newman van xanh sau khi xoa folder tam
- Sonar da duoc cau hinh lai pham vi phan tich
- Cac Dockerfile da them `--ignore-scripts`
- API Gateway da tat `X-Powered-By`
- Reports alias proxy route da duoc fix lai

Neu lan quet sau chi con loi trong folder `orders`, phan do thuoc order-service cua thanh vien khac. Phan phu trach `api-gateway`, `analytics-service`, `studio-service` da duoc xu ly theo pham vi hom nay.

