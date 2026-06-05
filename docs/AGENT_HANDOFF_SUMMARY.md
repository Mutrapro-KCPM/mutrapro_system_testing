# Agent Handoff Summary

Ngay tao: 2026-06-05  
Repo: `D:\mutrapro_system_testing`  
Branch dang lam viec: `dev`

Tai lieu nay tom tat nhung viec da lam trong thread chat nay de agent AI khac co the tiep tuc ma khong bi roi.

## 1. Muc tieu ban dau

Nguoi dung dua file `D:\mutrapro_system_testing\upgrade.plan` va muon nang cap workflow API CI voi Newman.

Muc tieu chinh:

- Dua cac secret nhay cam ra GitHub Secrets.
- Chay API test bang Docker/Newman trong GitHub Actions.
- Co report JUnit/JSON/HTML va annotation tren GitHub.
- Toi uu Docker build/cache.
- Lam CI on dinh hon, de nhom tiep tuc them nhieu API test.

## 2. GitHub Secrets da yeu cau

Da huong dan tao cac GitHub Secrets sau:

- `DB_PASSWORD`
- `JWT_SECRET`
- `RABBITMQ_DEFAULT_PASS`
- `NIFI_SENSITIVE_PROPS_KEY`
- `INTERNAL_SERVICE_TOKEN`

Ngoai ra repo da co cac Jira secrets:

- `JIRA_API_TOKEN`
- `JIRA_BASE_URL`
- `JIRA_EMAIL`

Ly do can dua len GitHub Secrets:

- CI tren GitHub khong doc duoc env rieng tren may tung thanh vien.
- Khong commit mat khau/token vao repo.
- Moi thanh vien van giu env local rieng; GitHub Secrets chi dung cho runner CI.

## 3. Workflow CI voi Newman

File lien quan: `.github/workflows/api-newman-ci.yml`

Nhung viec da lam:

- Dung cac secrets CI cho DB, JWT, RabbitMQ, NiFi, internal token.
- Them buoc validate required CI secrets.
- Build API stack bang Docker Compose.
- Dung Buildx/cache cho Newman image.
- Tao Newman Docker image tu `.github/newman/Dockerfile`.
- Chay collection `postman/Presentation.postman_collection.json`.
- Xuat report:
  - `newman-results/newman-report.xml`
  - `newman-results/newman-report.json`
  - `newman-results/newman-report.html`
- Upload artifact `newman-results`.
- Dung `dorny/test-reporter` de hien thi test result tren GitHub check `Newman API Tests`.
- Tat Docker build record upload bang `DOCKER_BUILD_RECORD_UPLOAD: false` de tranh artifact zip docker build bi loi mo tren Windows.

Trang thai da tung verify tren GitHub:

- CI da pass voi `184 passed, 0 failed, 0 skipped` truoc khi don placeholder.
- Sau khi don placeholder, local Newman pass voi `176 assertions, 0 failed`.
- Sau fix revision/task, local Newman pass voi `178 assertions, 0 failed`.

## 4. Docker/Newman setup

File lien quan:

- `.github/newman/Dockerfile`
- `.github/workflows/api-newman-ci.yml`

Newman image:

```text
mutrapro-newman-ci:latest
```

Newman Dockerfile cai:

```text
newman-reporter-htmlextra
```

Lenh local da dung de chay Newman:

```powershell
docker run --rm --network host -v "$($PWD.Path):/etc/newman" -w /etc/newman mutrapro-newman-ci:latest run "postman/Presentation.postman_collection.json" --environment "postman/MutraPro Local.postman_environment.json" --env-var "baseUrl=http://localhost:3007/api" --working-dir "/etc/newman" --reporters cli,junit,json,htmlextra --reporter-junit-export newman-results/newman-report.xml --reporter-json-export newman-results/newman-report.json --reporter-htmlextra-export newman-results/newman-report.html
```

Neu image chua co local:

```powershell
docker build -f .github/newman/Dockerfile -t mutrapro-newman-ci:latest .
```

Luu y:

- `newman-results/` la report sinh ra khi test local. Thuong khong can commit report nay neu chi can CI artifact.
- Docker build co the hien npm audit warning tu `newman-reporter-htmlextra`; build van pass. Day la viec co the xu ly sau, khong phai loi chinh cua API suite.

## 5. DB/MySQL va env

File lien quan:

- `docker-compose.yml`
- `init-scripts/init.sql`
- `init-scripts/zz-create-app-user.sh`

Van de da gap:

```text
Access denied for user 'mutrapro_app'
```

Nguyen nhan local:

- May local co MySQL volume cu, mat khau trong volume khong trung voi `.env`.
- GitHub CI tao volume moi nen phai dam bao init user dung theo env.

Fix da lam:

- `docker-compose.yml` co `MYSQL_APP_PASSWORD: ${DB_PASSWORD}`.
- Them script `init-scripts/zz-create-app-user.sh` de tao/alter user `mutrapro_app` bang env `MYSQL_APP_PASSWORD`.
- `init.sql` khong hardcode password `123456` cho `mutrapro_app` nua.
- MySQL healthcheck trong compose hien tai dung root ping:

```yaml
MYSQL_PWD="$$MYSQL_ROOT_PASSWORD" mysqladmin ping -h localhost -uroot --silent
```

Ly do khong dung `mutrapro_app` truc tiep trong healthcheck:

- Tren CI fresh volume, app user co the chua san sang dung thoi diem Docker healthcheck dau tien.
- Healthcheck MySQL nen chi xac nhan MySQL server ready.
- Workflow CI co buoc rieng de validate app user login duoc truoc khi start backend.

Workflow CI hien co buoc:

```bash
docker compose up -d --no-build mysql_db redis_cache rabbitmq

for i in {1..45}; do
  if docker compose exec -T -e MYSQL_PWD="$DB_PASSWORD" mysql_db mysql -h localhost -umutrapro_app -e "SELECT 1"; then
    echo "MySQL app user is ready"
    break
  fi
  ...
done

docker compose up -d --no-build api-gateway
```

Canh bao cho agent tiep theo:

- Khong xoa volume MySQL cua user bang `docker compose down -v` neu chua duoc hoi/y chap thuan, vi co the mat data local.
- Neu local lai bi Access denied, kiem tra volume cu truoc. Co the sua password user trong MySQL thay vi xoa volume.

## 6. Docker build optimization

Da toi uu cac Node service Dockerfile de dung BuildKit cache cho npm:

```dockerfile
# syntax=docker/dockerfile:1.7
RUN --mount=type=cache,id=mutrapro-npm,target=/root/.npm npm ci --omit=dev
```

Services da duoc toi uu trong qua trinh lam viec:

- `auth-service`
- `order-service`
- `task-service`
- `file-service`
- `studio-service`
- `notification-service`
- `analytics-service`
- `api-gateway`

Da toi uu `.dockerignore` de tranh copy file lon/khong can thiet vao build context, dac biet file upload/log/node_modules.

## 7. Don test placeholder trong Postman

File lien quan:

- `postman/Presentation.postman_collection.json`
- `docs/github_actions_jira_workflow.md`

Da xoa 4 request placeholder khoi collection:

- `ORD-BUG-01 - Ghi nhan bug sai phan quyen`
- `ORD-BUG-06 - Retest bug sau khi backend sua`
- `ORD-REPORT-01 - Tong hop so test case Pass`
- `ORD-REPORT-05 - Ghi nhan rui ro con lai`

Ly do:

- Cac request nay chi goi `/health` va assert `true === true`.
- Chung lam report dep hon nhung khong test nghiep vu that.

Da them ghi chu vao `docs/github_actions_jira_workflow.md` muc:

```text
Manual notes removed from automated regression
```

Sau khi xoa placeholder:

- Assertion giam tu 184 xuong 176 la dung ky vong.
- Local Newman pass.

## 8. Fix RabbitMQ/task revision triệt de hon

File lien quan:

- `services/task-service/index.js`
- `postman/Presentation.postman_collection.json`

Van de da thay trong Docker Desktop logs:

```text
[RabbitMQ] Message received (key: order.revision_requested)
No task found for order 13 to reopen
Khong tim thay task cho order 13
No task found for order 3 to reopen
```

Nguyen nhan:

- `order-service` gui event `order.revision_requested`.
- `task-service` nhan event va tim task theo `order_id`.
- Mot so order trong test/local data khong co task tuong ung.
- Truoc day `task-service` throw error va `nack(..., requeue=true)`, lam message co the bi retry/log lap.

Fix service:

- Neu khong tim thay task: log `warn`, return, message duoc ack, khong retry vo han.
- Neu task da la `revision_requested`: coi la idempotent, return success.
- Cho phep reopen task tu cac trang thai:
  - `done`
  - `assigned`
  - `in_progress`
- Neu status khong hop le: log warn va khong throw.

Fix Postman:

- Them request setup truoc `ORD-REV-01`:

```text
ORD-REV-SETUP-01 - Tao task cho order revision
```

Request nay tao task cho `recording_order_id` truoc khi goi:

```text
POST /orders/{{recording_order_id}}/request-revision
```

Ket qua local sau fix:

```text
requests: 130
assertions: 178
failed: 0
duration: ~6.6s
```

Log dung sau fix:

```text
New task created for order #23
Message received: order.revision_requested
Task #3 for order #23 has been re-opened for revision
```

Luu y:

- Neu Docker Desktop con hien warning cho order cu `3`, `13`, do co the la message cu trong RabbitMQ tu truoc khi fix. Sau fix, message duoc acknowledge mot lan va khong lap vo han.
- Tren CI fresh environment se khong co message cu.

## 9. Trang thai test/report

Cac moc verify quan trong trong thread:

1. GitHub CI pass ban dau:

```text
184 passed, 0 failed, 0 skipped
```

2. Sau khi xoa placeholder:

```text
requests: 129
assertions: 176
failed: 0
duration: ~7s
```

3. Sau khi fix revision/task:

```text
requests: 130
assertions: 178
failed: 0
duration: ~6.6s
```

Report local nam o:

```text
D:\mutrapro_system_testing\newman-results\newman-report.html
D:\mutrapro_system_testing\newman-results\newman-report.json
D:\mutrapro_system_testing\newman-results\newman-report.xml
```

GitHub report xem o:

- GitHub Actions run summary.
- Check `Newman API Tests`.
- Artifact `newman-results`.

## 10. Cac lenh nen chay khi tiep tuc

Kiem tra worktree:

```powershell
git status --short
git diff --stat
```

Validate Docker Compose:

```powershell
docker compose config
```

Build/restart stack neu sua service:

```powershell
docker compose build task-service
docker compose up -d api-gateway
docker compose ps
```

Build Newman image neu can:

```powershell
docker build -f .github/newman/Dockerfile -t mutrapro-newman-ci:latest .
```

Run Newman local:

```powershell
New-Item -ItemType Directory -Force -Path newman-results | Out-Null
docker run --rm --network host -v "$($PWD.Path):/etc/newman" -w /etc/newman mutrapro-newman-ci:latest run "postman/Presentation.postman_collection.json" --environment "postman/MutraPro Local.postman_environment.json" --env-var "baseUrl=http://localhost:3007/api" --working-dir "/etc/newman" --reporters cli,junit,json,htmlextra --reporter-junit-export newman-results/newman-report.xml --reporter-json-export newman-results/newman-report.json --reporter-htmlextra-export newman-results/newman-report.html
```

Doc ket qua JSON nhanh:

```powershell
node -e "const fs=require('fs'); const r=JSON.parse(fs.readFileSync('newman-results/newman-report.json','utf8')); console.log(JSON.stringify({failures:r.run.failures.length, assertions:r.run.stats.assertions, requests:r.run.stats.requests, duration:r.run.timings.completed-r.run.timings.started}, null, 2));"
```

Doc log task-service:

```powershell
docker compose logs --tail=120 task-service
```

## 11. Viec nen lam tiep

Thu tu de tiep tuc an toan:

1. Push cac thay doi len GitHub va cho CI chay lai tren branch `dev`.
2. Ky vong CI moi:

```text
Newman API Tests: pass
requests: 130
assertions: 178
failed: 0
```

3. Neu CI fail o MySQL:

- Xem step `Start API stack`.
- Kiem tra log `mysql_db`.
- Dam bao GitHub Secrets co `DB_PASSWORD`.
- Dam bao `zz-create-app-user.sh` duoc copy vao MySQL image.

4. Neu CI fail o Newman:

- Tai artifact `newman-results`.
- Mo `newman-report.html` hoac doc `newman-report.json`.
- Chi fix test that su fail, khong them placeholder pass gia.

5. Viec cai thien sau do:

- Giam warning/log 404 tu order-service khi fetch task cho order khong co task, neu can report/log sach hon.
- Rar lai cac assertion dang qua rong nhu `HTTP 200 or 400`.
- Xu ly npm audit warning cua `newman-reporter-htmlextra` neu muon build log sach.
- Chuan hoa encoding hien thi trong terminal/report neu nguoi dung con thay ten test bi mojibake. Luu y collection JSON parse UTF-8 dung; loi chu xau thuong do terminal/codepage/report display.

## 12. Canh bao cho agent khac

- Khong reset git, khong `git reset --hard`.
- Khong xoa Docker volumes khi chua hoi nguoi dung.
- Khong revert thay doi cua nguoi dung.
- Khong commit secret that vao repo.
- Khi sua Postman collection, dung JSON parser de doc/ghi thay vi replace chuoi thu cong.
- Khi sua CI, uu tien test local bang Docker truoc, sau do moi bao nguoi dung push/CI.
- Neu Docker bi sandbox/permission chan, can xin escalated permission.

## 13. Nâng cấp CI/Jira Automation V2

Dựa trên tài liệu `docs/workflow-ci-jira-agent-guide-v2.md`, hệ thống CI đã được nâng cấp để tự động bắt lỗi và tạo vé Bug trên Jira:

### 13.1. Cấu hình Phân quyền (Ownership)
- **`ci/service-owners.yml`**: Ánh xạ 9 services cho 5 thành viên (Minh Trọng, Gia Bảo, Thanh Trí, Phát Đạt, Hoàng Trọng), bao gồm GitHub Username và Jira Account ID.
- **`.github/CODEOWNERS`**: Tự động assign PR reviewer dựa trên thư mục service.

### 13.2. Script xử lý lỗi tự động (Node.js)
Thay vì dùng bash script phức tạp, hệ thống dùng 3 file Node.js độc lập trong `ci/scripts/`:
- **`detect-service.js`**: Trích xuất tên service từ URL bị lỗi trong báo cáo Newman.
- **`classify-error.js`**: Phân loại lỗi (Validation, Auth, Database...) dựa trên HTTP Status Code và nội dung phản hồi, đồng thời phân cấp Priority (Critical, High, Medium).
- **`jira-upsert-bug.js`**: Tập lệnh chính kết nối với Jira API v3:
  - Tạo `bug_signature` (mã băm) để chặn việc tạo trùng lặp thẻ Bug cho cùng một lỗi.
  - Tự động cấp phát thời gian (Original Estimate: 4 giờ/lỗi) và Due Date (rộng rãi từ 2 ngày đến 2 tuần tùy khối lượng lỗi).
  - Tự động tạo Bug và gán đích danh cho thành viên phụ trách service, hoặc tự động comment nhắc nhở nếu lỗi cũ chưa được sửa.

### 13.3. Tích hợp Workflow & Tài liệu
- **`.github/workflows/api-newman-ci.yml`**: Gắn `jira-upsert-bug.js` vào luồng chạy GitHub Actions hiện có.
- **`ci/weekly-plan-template.md`**: Mẫu báo cáo tiến độ tuần cho nhóm.
- **`ci/jira-task-template.md`**: Mẫu cấu trúc thẻ Jira task/bug.
- **`docs/github_actions_jira_workflow.md`**: Tài liệu hướng dẫn sử dụng luồng CI/Jira dành cho các thành viên.

**Lưu ý cho Agent tiếp theo**: Hệ thống Node.js này hoạt động ổn định và chính xác. Tránh can thiệp hoặc thay đổi cấu trúc thư mục `ci/scripts/` trừ khi có yêu cầu nâng cấp nghiệp vụ.
