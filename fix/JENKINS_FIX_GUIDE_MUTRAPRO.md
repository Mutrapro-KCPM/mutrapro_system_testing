# HƯỚNG DẪN FIX TRIỆT ĐỂ LỖI JENKINS / DOCKER COMPOSE - MUTRAPRO SYSTEM TESTING

> Tài liệu này dùng để đưa cho AI/Codex/ChatGPT trong VSCode đọc dự án và sửa lỗi một cách có hệ thống.  
> Mục tiêu: fix triệt để lỗi Jenkins pipeline `FAILURE` do `auth-service` bị `unhealthy`, đồng thời chuẩn hóa quy trình CI/CD, Docker Compose, healthcheck, dependency và kiểm thử.

---

## 1. Bối cảnh hệ thống

Dự án: `mutrapro_system_testing`  
Repository: `https://github.com/Mutrapro-KCPM/mutrapro_system_testing.git`  
Branch Jenkins đang build: `dev`  
Môi trường chạy: Jenkins trong Docker, build/deploy bằng Docker Compose.

Các service chính trong hệ thống:

- `web-app`
- `api-gateway`
- `auth-service`
- `order-service`
- `task-service`
- `file-service`
- `studio-service`
- `notification-service`
- `analytics-service`
- `mysql_db`
- `redis_cache`
- `rabbitmq`
- `nifi`
- `sonarqube`

---

## 2. Tóm tắt kết quả Jenkins hiện tại

Pipeline chạy qua được các bước:

- Checkout source code từ GitHub: OK.
- `docker compose down`: OK.
- `docker compose build --no-cache`: build image thành công.
- React frontend build thành công nhưng có ESLint warning.
- `docker compose up -d`: FAIL.

Lỗi chính:

```text
Container mutrapro_system_testing-auth-service-1 Error dependency auth-service failed to start
dependency failed to start: container mutrapro_system_testing-auth-service-1 is unhealthy
```

Sau đó Jenkins bỏ qua stage Health Check:

```text
Stage "Kiểm tra sức khỏe (Health Check)" skipped due to earlier failure(s)
ERROR: script returned exit code 1
Finished: FAILURE
```

Kết luận: **pipeline fail do `auth-service` bị unhealthy sau khi deploy**. Build image không phải nguyên nhân chính.

---

## 3. Mục tiêu fix triệt để

AI cần sửa theo thứ tự ưu tiên sau:

1. Làm rõ nguyên nhân thật khiến `auth-service` bị unhealthy.
2. Sửa code/config để `auth-service` start ổn định trong Docker Compose.
3. Chuẩn hóa healthcheck của từng service.
4. Chuẩn hóa `depends_on` để service chỉ khởi động khi dependency thực sự sẵn sàng.
5. Tách lỗi runtime, lỗi DB connection, lỗi thiếu env, lỗi health endpoint.
6. Thêm logging rõ ràng cho từng service.
7. Bổ sung bước test trước deploy trong Jenkins.
8. Làm pipeline thất bại đúng chỗ, có log dễ đọc, dễ debug.
9. Giảm warning dependency và ESLint để dự án sạch hơn.

---

## 4. Việc AI cần kiểm tra đầu tiên

### 4.1. Kiểm tra log container `auth-service`

Chạy trên máy Jenkins hoặc môi trường Docker đang deploy:

```bash
docker compose ps
```

```bash
docker compose logs auth-service
```

Hoặc:

```bash
docker logs mutrapro_system_testing-auth-service-1
```

Kiểm tra chi tiết healthcheck:

```bash
docker inspect mutrapro_system_testing-auth-service-1
```

Tập trung tìm các lỗi dạng:

```text
ECONNREFUSED
Access denied for user
Unknown database
JWT_SECRET is required
Cannot find module
Port already in use
Healthcheck failed
Connection timeout
SequelizeConnectionError
ER_BAD_DB_ERROR
ER_ACCESS_DENIED_ERROR
```

---

## 5. Các nguyên nhân có khả năng cao

### Nguyên nhân 1: `auth-service` không kết nối được MySQL

Dù log Jenkins cho thấy `mysql_db` đã `Healthy`, `auth-service` vẫn có thể fail nếu:

- Sai `DB_HOST`.
- Sai `DB_PORT`.
- Sai `DB_USER`.
- Sai `DB_PASSWORD`.
- Sai `DB_NAME`.
- Database chưa được tạo.
- Bảng chưa được migrate/seed.
- App khởi động trước khi MySQL thực sự nhận connection.

Trong Docker Compose, `DB_HOST` không được để là `localhost`. Phải dùng tên service MySQL:

```env
DB_HOST=mysql_db
DB_PORT=3306
```

Nếu để:

```env
DB_HOST=localhost
```

thì bên trong container `auth-service`, `localhost` là chính container đó, không phải MySQL.

### Cách fix đề xuất

Trong `docker-compose.yml`, kiểm tra `auth-service.environment`:

```yaml
auth-service:
  environment:
    DB_HOST: mysql_db
    DB_PORT: 3306
    DB_USER: root
    DB_PASSWORD: ${DB_PASSWORD}
    DB_NAME: ${AUTH_DB_NAME}
    JWT_SECRET: ${JWT_SECRET}
```

Trong `.env`:

```env
DB_PASSWORD=your_mysql_password
AUTH_DB_NAME=mutrapro_auth
JWT_SECRET=replace_with_long_random_secret_at_least_32_chars
```

Kiểm tra MySQL container:

```bash
docker exec -it mutrapro_system_testing-mysql_db-1 mysql -uroot -p
```

Trong MySQL:

```sql
SHOW DATABASES;
USE mutrapro_auth;
SHOW TABLES;
```

---

## 6. Kiểm tra và sửa healthcheck của `auth-service`

### 6.1. Kiểm tra app có endpoint health không

Trong `auth-service`, cần có endpoint rõ ràng:

```js
app.get('/health', async (req, res) => {
  res.status(200).json({
    success: true,
    service: 'auth-service',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});
```

Nếu healthcheck đang gọi sai endpoint, container sẽ bị unhealthy dù app vẫn chạy.

Ví dụ healthcheck sai:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
```

Trong khi app chỉ có:

```text
/health
```

Thì phải sửa cho khớp.

### 6.2. Với image `node:20-alpine`, cần chú ý thiếu `curl`

Alpine image thường không có sẵn `curl`. Nếu healthcheck dùng `curl`, container có thể bị unhealthy vì không tìm thấy lệnh `curl`.

Có 2 hướng fix:

#### Cách 1: Cài curl trong Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3001
CMD ["node", "index.js"]
```

#### Cách 2: Dùng `wget` nếu Alpine có sẵn

```yaml
healthcheck:
  test: ["CMD-SHELL", "wget -qO- http://localhost:3001/health || exit 1"]
  interval: 10s
  timeout: 5s
  retries: 10
  start_period: 30s
```

Khuyến nghị: dùng `wget` hoặc cài `curl` rõ ràng. Không để healthcheck phụ thuộc vào tool không tồn tại.

---

## 7. Chuẩn hóa `depends_on` trong Docker Compose

Nếu các service phụ thuộc vào `auth-service`, không nên chỉ dùng:

```yaml
depends_on:
  - auth-service
```

Nên dùng điều kiện health:

```yaml
depends_on:
  mysql_db:
    condition: service_healthy
  auth-service:
    condition: service_healthy
```

Ví dụ chuẩn cho `auth-service`:

```yaml
auth-service:
  build:
    context: .
    dockerfile: services/auth-service/Dockerfile
  environment:
    NODE_ENV: production
    PORT: 3001
    DB_HOST: mysql_db
    DB_PORT: 3306
    DB_USER: root
    DB_PASSWORD: ${DB_PASSWORD}
    DB_NAME: ${AUTH_DB_NAME}
    JWT_SECRET: ${JWT_SECRET}
  ports:
    - "3001:3001"
  depends_on:
    mysql_db:
      condition: service_healthy
  healthcheck:
    test: ["CMD-SHELL", "wget -qO- http://localhost:3001/health || exit 1"]
    interval: 10s
    timeout: 5s
    retries: 10
    start_period: 40s
  restart: unless-stopped
  networks:
    - mutrapro-network
```

Ví dụ chuẩn cho MySQL:

```yaml
mysql_db:
  image: mysql:8.0
  environment:
    MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
  ports:
    - "3306:3306"
  volumes:
    - mysql_data:/var/lib/mysql
    - ./init-scripts:/docker-entrypoint-initdb.d
  healthcheck:
    test: ["CMD-SHELL", "mysqladmin ping -h localhost -uroot -p${DB_PASSWORD} || exit 1"]
    interval: 10s
    timeout: 5s
    retries: 10
    start_period: 40s
  networks:
    - mutrapro-network
```

---

## 8. Kiểm tra biến môi trường bắt buộc khi app start

Trong `auth-service`, nên thêm validate env ngay lúc khởi động.

Ví dụ:

```js
const requiredEnv = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET'
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`[CONFIG ERROR] Missing required env: ${key}`);
    process.exit(1);
  }
}
```

Lợi ích:

- Nếu thiếu env, log chỉ rõ thiếu biến nào.
- Jenkins dễ debug.
- Tránh tình trạng container chỉ báo `unhealthy` mơ hồ.

---

## 9. Sửa logic kết nối database

Trong `auth-service`, không nên start server ngay khi DB chưa kết nối.

Cấu trúc nên là:

```js
async function startServer() {
  try {
    await connectDatabase();
    console.log('[DB] Auth service connected to database successfully');

    app.listen(PORT, () => {
      console.log(`[AUTH] Auth service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('[STARTUP ERROR] Auth service failed to start:', error);
    process.exit(1);
  }
}

startServer();
```

Nếu DB cần thời gian khởi động, thêm retry:

```js
async function connectWithRetry(connectFn, retries = 10, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await connectFn();
      return;
    } catch (error) {
      console.error(`[DB] Connection attempt ${attempt}/${retries} failed:`, error.message);
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}
```

---

## 10. Sửa Dockerfile Node service

Hiện nhiều service dùng `npm install`. Nên đổi sang `npm ci` để CI ổn định hơn.

Dockerfile khuyến nghị cho backend service:

```dockerfile
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache wget

COPY services/auth-service/package*.json ./
RUN npm ci --omit=dev

COPY shared ./shared
COPY services/auth-service/ ./

EXPOSE 3001

CMD ["node", "index.js"]
```

Lưu ý:

- Nếu service cần `curl` thì cài `curl`.
- Nếu healthcheck dùng `wget`, cài `wget`.
- Không copy toàn bộ repository nếu không cần, để image nhẹ hơn.
- Không đưa `.env`, `node_modules`, logs vào image.

---

## 11. Sửa `.dockerignore`

Đảm bảo `.dockerignore` có:

```gitignore
node_modules
npm-debug.log
.git
.gitignore
.env
logs
*.log
coverage
.DS_Store
dist
build
.cache
```

Với frontend, nếu build trong Docker thì không ignore source cần thiết, nhưng vẫn ignore `node_modules`.

---

## 12. Sửa Jenkinsfile để debug tốt hơn

Hiện pipeline fail ở `docker compose up -d`, nhưng chưa tự in log service lỗi. Cần thêm bước lấy log khi fail.

Jenkinsfile đề xuất:

```groovy
pipeline {
    agent any

    environment {
        COMPOSE_PROJECT_NAME = 'mutrapro_system_testing'
    }

    stages {
        stage('Checkout Code') {
            steps {
                checkout scm
                echo 'Code đã được kéo về máy chủ Jenkins thành công!'
            }
        }

        stage('Validate Docker Compose') {
            steps {
                sh 'docker compose config'
            }
        }

        stage('Stop Old System') {
            steps {
                sh 'docker compose down --remove-orphans'
            }
        }

        stage('Build Images') {
            steps {
                sh 'docker compose build --no-cache'
            }
        }

        stage('Deploy') {
            steps {
                sh 'docker compose up -d'
            }
        }

        stage('Show Container Status') {
            steps {
                sh 'docker compose ps'
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    echo "Waiting for services to become healthy..."
                    sleep 20
                    docker compose ps
                    curl -f http://localhost:3007/api/health
                '''
            }
        }
    }

    post {
        failure {
            echo 'Pipeline thất bại. In log để debug...'
            sh '''
                docker compose ps || true
                docker compose logs --tail=200 auth-service || true
                docker compose logs --tail=200 api-gateway || true
                docker compose logs --tail=200 mysql_db || true
            '''
        }
        success {
            echo 'Build/Deploy thành công!'
        }
    }
}
```

Lợi ích:

- Khi fail sẽ tự in log `auth-service`, `api-gateway`, `mysql_db`.
- Không cần đoán lỗi từ Jenkins console quá dài.
- Dễ nộp báo cáo kiểm chứng phần mềm.

---

## 13. Kiểm tra local trước khi push lên Jenkins

Trước khi push code, developer phải chạy local:

```bash
docker compose down --remove-orphans
```

```bash
docker compose build --no-cache auth-service
```

```bash
docker compose up -d mysql_db auth-service
```

```bash
docker compose ps
```

```bash
docker compose logs auth-service
```

Test health:

```bash
curl http://localhost:3001/health
```

Nếu auth-service OK, mới chạy toàn bộ:

```bash
docker compose up -d
```

Test API Gateway:

```bash
curl http://localhost:3007/api/health
```

---

## 14. Checklist fix `auth-service`

AI cần hoàn thành checklist này:

- [ ] Mở `docker-compose.yml` và kiểm tra cấu hình `auth-service`.
- [ ] Kiểm tra `DB_HOST` có phải `mysql_db` không.
- [ ] Kiểm tra `DB_NAME` có đúng với database được init không.
- [ ] Kiểm tra `.env` có đủ `DB_PASSWORD`, `JWT_SECRET`, `AUTH_DB_NAME` không.
- [ ] Kiểm tra Dockerfile `auth-service` có cài tool cho healthcheck không.
- [ ] Kiểm tra endpoint `/health` có tồn tại không.
- [ ] Kiểm tra port app đang listen có trùng với healthcheck không.
- [ ] Kiểm tra app có log rõ khi DB connect fail không.
- [ ] Thêm retry DB connection nếu cần.
- [ ] Chạy riêng `mysql_db` + `auth-service` để cô lập lỗi.
- [ ] Khi auth-service healthy, chạy lại toàn bộ compose.
- [ ] Khi compose OK, chạy lại Jenkins pipeline.

---

## 15. Xử lý warning npm audit

Log Jenkins có nhiều cảnh báo vulnerability, trong đó có service/package có số lượng cao.

Quy trình xử lý an toàn:

```bash
npm audit
```

```bash
npm audit fix
```

Không vội chạy:

```bash
npm audit fix --force
```

vì có thể nâng major version và làm hỏng dự án.

Với từng service:

```bash
cd services/auth-service
npm audit
npm audit fix
npm test
```

Sau đó commit từng phần.

Nếu package cũ như `multer@1.x`, cần nâng lên `multer@2.x` và test upload/file-service kỹ.

---

## 16. Xử lý warning React ESLint

Frontend build thành công nhưng có warning:

- React Hook thiếu dependency.
- `CoordinatorDashboard.js` có nhiều lỗi `Unexpected whitespace before property`.

Cần sửa các lỗi kiểu:

```js
order .id
```

thành:

```js
order.id
```

Với React Hook, kiểm tra các file:

- `src/components/Layout.js`
- `src/pages/ArrangerWorkspacePage.js`
- `src/pages/ArtistWorkspacePage.js`
- `src/pages/CoordinatorDashboard.js`
- `src/pages/TranscriberWorkspacePage.js`

Không nên tắt ESLint bừa bằng `eslint-disable` nếu chưa hiểu logic. Hãy sửa dependency array đúng cách hoặc dùng `useCallback` hợp lý.

---

## 17. Quy trình làm việc chuẩn cho AI/Codex

Khi AI nhận dự án, hãy làm theo quy trình này:

### Bước 1: Đọc cấu trúc dự án

Yêu cầu AI đọc:

- `docker-compose.yml`
- `.env.example` hoặc `.env`
- `Jenkinsfile`
- `services/auth-service/Dockerfile`
- `services/auth-service/package.json`
- `services/auth-service/index.js` hoặc file entry chính
- file cấu hình database của auth-service
- thư mục `shared`
- `init-scripts` hoặc SQL init database

### Bước 2: Xác định healthcheck thật sự gọi gì

AI phải trả lời được:

- Healthcheck đang gọi URL nào?
- URL đó có tồn tại trong app không?
- Port có đúng không?
- Trong image có `curl`/`wget` không?

### Bước 3: Xác định auth-service connect DB thế nào

AI phải trả lời được:

- ORM/thư viện DB đang dùng là gì?
- Config DB lấy từ env nào?
- Tên database thật sự là gì?
- MySQL init có tạo database đó không?
- App có chờ DB trước khi listen không?

### Bước 4: Sửa tối thiểu nhưng triệt để

Không refactor toàn dự án ngay. Ưu tiên:

1. Fix health endpoint.
2. Fix Dockerfile healthcheck dependency.
3. Fix env DB.
4. Fix startup DB retry.
5. Fix Jenkins post-failure logs.

### Bước 5: Test theo tầng

Không chạy toàn bộ ngay. Test theo thứ tự:

```bash
docker compose up -d mysql_db
```

```bash
docker compose up -d auth-service
```

```bash
curl http://localhost:3001/health
```

```bash
docker compose up -d api-gateway
```

```bash
curl http://localhost:3007/api/health
```

Cuối cùng mới chạy:

```bash
docker compose up -d
```

---

## 18. Prompt đưa cho AI/Codex để fix dự án

Copy prompt này đưa cho AI trong VSCode/Codex:

```text
Bạn là chuyên gia DevOps, Docker, Jenkins CI/CD và Node.js microservices. Hãy đọc toàn bộ dự án mutrapro_system_testing và fix triệt để lỗi Jenkins deploy thất bại.

Bối cảnh lỗi Jenkins:
- Checkout GitHub branch dev thành công.
- docker compose down thành công.
- docker compose build --no-cache thành công.
- React web-app build thành công nhưng có ESLint warning.
- Lỗi xảy ra ở docker compose up -d.
- Log chính: container mutrapro_system_testing-auth-service-1 is unhealthy.
- Các service phụ thuộc bị fail vì dependency auth-service failed to start.
- Health Check stage bị skip và Jenkins kết thúc FAILURE.

Nhiệm vụ của bạn:
1. Kiểm tra docker-compose.yml, Jenkinsfile, .env/.env.example, Dockerfile và source code auth-service.
2. Tìm nguyên nhân thật khiến auth-service bị unhealthy.
3. Kiểm tra DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET và các biến môi trường bắt buộc.
4. Đảm bảo trong Docker network, service Node.js không dùng DB_HOST=localhost mà dùng DB_HOST=mysql_db.
5. Kiểm tra MySQL init script có tạo đúng database/table cho auth-service không.
6. Kiểm tra healthcheck của auth-service đang gọi đúng endpoint và đúng port chưa.
7. Nếu healthcheck dùng curl/wget, đảm bảo Docker image có cài tool tương ứng hoặc đổi healthcheck cho phù hợp.
8. Thêm endpoint /health cho auth-service nếu thiếu.
9. Thêm validate env khi service khởi động để log rõ thiếu biến nào.
10. Thêm retry kết nối DB trước khi start server nếu cần.
11. Chuẩn hóa depends_on với condition: service_healthy cho mysql_db và các dependency quan trọng.
12. Cập nhật Jenkinsfile để khi pipeline fail tự in docker compose ps và logs của auth-service, mysql_db, api-gateway.
13. Không refactor lan man. Chỉ sửa những phần cần thiết để pipeline deploy ổn định.
14. Sau khi sửa, cung cấp danh sách file đã sửa, lý do sửa, và lệnh test lại.

Yêu cầu kết quả:
- docker compose build thành công.
- docker compose up -d thành công.
- auth-service ở trạng thái healthy.
- api-gateway health endpoint trả về OK.
- Jenkins pipeline chạy tới cuối và SUCCESS.
```

---

## 19. Lệnh test cuối cùng sau khi AI sửa

Chạy từ thư mục root dự án:

```bash
docker compose down --remove-orphans
```

```bash
docker compose build --no-cache
```

```bash
docker compose up -d
```

```bash
docker compose ps
```

Kiểm tra log:

```bash
docker compose logs --tail=100 auth-service
```

```bash
docker compose logs --tail=100 mysql_db
```

```bash
docker compose logs --tail=100 api-gateway
```

Health check:

```bash
curl http://localhost:3001/health
```

```bash
curl http://localhost:3007/api/health
```

Nếu tất cả OK, push code:

```bash
git status
```

```bash
git add .
```

```bash
git commit -m "fix: stabilize auth-service healthcheck and Jenkins deployment"
```

```bash
git push origin dev
```

Sau đó chạy lại Jenkins.

---

## 20. Tiêu chí hoàn thành

Được xem là fix triệt để khi đạt đủ:

- [ ] `docker compose up -d` không còn báo dependency failed.
- [ ] `auth-service` hiện `healthy`.
- [ ] `mysql_db` hiện `healthy`.
- [ ] `api-gateway` hiện `healthy` hoặc trả health OK.
- [ ] Jenkins không dừng ở stage Deploy.
- [ ] Jenkins chạy qua stage Health Check.
- [ ] Jenkins kết thúc `SUCCESS`.
- [ ] Nếu fail lần sau, Jenkins tự in log service liên quan.
- [ ] File `.env.example` được cập nhật để người khác setup không thiếu biến.
- [ ] Không commit `.env`, logs, `node_modules` lên GitHub.

---

## 21. Ghi chú cho báo cáo kiểm chứng phần mềm

Có thể ghi trong báo cáo:

> Trong quá trình CI/CD bằng Jenkins, pipeline build image thành công nhưng deploy thất bại do `auth-service` bị đánh dấu `unhealthy`. Nhóm đã phân tích log Jenkins, cô lập lỗi tại tầng runtime/dependency thay vì tầng build, sau đó kiểm tra Docker Compose healthcheck, biến môi trường, kết nối MySQL và quy trình khởi động service. Hệ thống được cải tiến bằng cách chuẩn hóa health endpoint, bổ sung validate env, thêm retry DB connection và cập nhật Jenkinsfile để tự động in log khi thất bại.

---

## 22. Thứ tự ưu tiên sửa nhanh

Nếu cần sửa nhanh để Jenkins qua trước, làm theo thứ tự:

1. Xem log thật của `auth-service`.
2. Sửa healthcheck endpoint/port/tool.
3. Sửa `DB_HOST=mysql_db`.
4. Sửa `.env` thiếu biến.
5. Kiểm tra database auth có tồn tại không.
6. Thêm `start_period` dài hơn cho healthcheck.
7. Chạy lại `docker compose up -d auth-service`.
8. Chạy lại Jenkins.

Không nên sửa frontend, SonarQube, Nifi, hoặc npm audit trước khi `auth-service` healthy, vì đó không phải nguyên nhân chính làm pipeline fail hiện tại.
