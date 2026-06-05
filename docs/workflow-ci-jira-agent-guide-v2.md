# HƯỚNG DẪN CHO AI AGENT: Hoàn thiện workflow CI tự động kết hợp GitHub Actions, Newman/Postman và Jira

> Tài liệu này dùng để đưa cho AI Agent/Codex/ChatGPT trong VSCode đọc dự án và hướng dẫn hoặc triển khai workflow tự động cho nhóm.
>
> Mục tiêu: Khi thành viên push code hoặc tạo Pull Request, hệ thống tự chạy CI, lưu report, phân tích lỗi, cập nhật Jira, tạo bug task đúng người phụ trách service, tránh tạo task trùng và hỗ trợ lập kế hoạch báo cáo theo tuần.

---

## 1. Vai trò của AI Agent

Bạn là một **AI Agent chuyên gia DevOps, kiểm thử phần mềm, GitHub Actions, Postman/Newman và Jira Automation**.

Nhiệm vụ của bạn:

1. Đọc toàn bộ repository hiện tại.
2. Xác định cấu trúc service của dự án.
3. Kiểm tra workflow GitHub Actions hiện có.
4. Kiểm tra Postman Collection, Newman command, environment file và test report.
5. Thiết kế hoặc chỉnh sửa workflow CI để chạy test tự động.
6. Tích hợp Jira để tự động comment hoặc tạo Bug task khi cần.
7. Thêm cơ chế phân loại lỗi, gán priority, tránh tạo task trùng.
8. Tạo tài liệu hướng dẫn nhóm sử dụng workflow.
9. Đảm bảo mọi thay đổi an toàn, không làm hỏng project đang chạy.

Nguyên tắc làm việc:

- Không xóa file cũ nếu chưa cần thiết.
- Không sửa logic business nếu nhiệm vụ chỉ là CI/Jira workflow.
- Luôn giải thích trước khi thay đổi file quan trọng.
- Ưu tiên tạo cấu trúc dễ hiểu cho sinh viên và dễ báo cáo giáo viên.
- Mọi secret như Jira token, GitHub token, password, API key phải để trong GitHub Secrets, không hard-code vào source code.

---

## 2. Bối cảnh dự án

Dự án là hệ thống web/microservices tên **Mutrapro**.

Nhóm đang dùng:

- GitHub để quản lý source code.
- GitHub Actions để chạy CI.
- Postman Collection và Newman để kiểm thử API.
- Jira để quản lý task, bug và tiến độ.
- Docker/Docker Compose để chạy service nếu cần.
- Node.js cho các backend service.

Các service có thể có trong dự án:

- `api-gateway`
- `auth-service`
- `order-service`
- `notification-service`
- `file-service`
- `task-service`
- `studio-service`
- `analytics-service`
- `web-app`

Mục tiêu của nhóm là xây dựng quy trình kiểm chứng phần mềm chuyên nghiệp: code thay đổi → CI chạy test → có report → có bug/task trên Jira nếu fail → có bằng chứng báo cáo giáo viên.

---

## 3. Mục tiêu workflow cuối cùng

Khi developer push code hoặc tạo Pull Request:

1. GitHub Actions tự động chạy CI.
2. CI cài đặt môi trường cần thiết.
3. CI khởi động service hoặc kiểm tra service đang chạy.
4. CI chạy Newman/Postman API test.
5. CI chạy smoke test, API test, integration test nếu có.
6. CI xuất report HTML/XML/JSON.
7. CI lưu report vào GitHub Actions Artifact.
8. CI phân tích kết quả pass/fail.
9. Nếu pass:
   - Không tạo Jira Bug task mới.
   - Comment vào Jira task liên quan nếu commit/PR có mã Jira task.
   - Cho phép merge Pull Request.
   - Lưu report làm bằng chứng.
10. Nếu fail:
   - Chặn merge Pull Request.
   - Xác định service bị lỗi.
   - Xác định người phụ trách service.
   - Phân loại lỗi.
   - Gán priority.
   - Kiểm tra đã có Bug task tương tự chưa.
   - Nếu đã có, comment thêm log mới vào task cũ.
   - Nếu chưa có, tạo Bug task mới trên Jira.
   - Description phải có đủ log, endpoint, expected result, actual result, link GitHub Actions, link report và gợi ý fix.
11. Cuối tuần:
   - Tổng hợp số lần CI pass/fail.
   - Tổng hợp bug đã tạo, đã fix, còn tồn.
   - Đề xuất task tuần sau để báo cáo giáo viên.

---

## 4. Luồng workflow thực tế nên áp dụng

### 4.1. Luồng khi developer làm việc

Developer không nên push thẳng lên `main`. Quy trình đề xuất:

1. Developer nhận Jira task.
2. Developer tạo branch theo task.

Ví dụ:

```bash
 git checkout -b feature/ORDER-12-update-order-status
```

3. Developer sửa code.
4. Developer commit theo quy ước có mã Jira task.

Ví dụ:

```bash
 git add .
 git commit -m "ORDER-12 fix update order status API"
 git push origin feature/ORDER-12-update-order-status
```

5. Developer tạo Pull Request vào `dev`.
6. GitHub Actions chạy CI.
7. Nếu CI pass, reviewer xem và merge.
8. Nếu CI fail, Jira được cập nhật hoặc tạo Bug task.

### 4.2. Luồng khi CI pass

Khi CI pass:

- Không tạo task mới.
- Lưu report vào GitHub Actions Artifact.
- Comment vào Jira task nếu tìm thấy mã task trong commit hoặc PR title.
- Có thể chuyển Jira task sang `Ready for Review` nếu nhóm muốn.

Ví dụ comment Jira khi pass:

```txt
CI PASSED

Service liên quan: order-service
Branch: feature/ORDER-12-update-order-status
Commit: abc123
Workflow: <GitHub Actions URL>
Report: <Artifact URL nếu có>
Kết quả: Các test case liên quan đã chạy thành công.
```

### 4.3. Luồng khi CI fail

Khi CI fail:

- Chặn merge Pull Request.
- Lưu report fail.
- Phân tích lỗi.
- Xác định service bị ảnh hưởng.
- Tìm người phụ trách service.
- Tìm Jira task gốc nếu commit/PR có mã task.
- Nếu lỗi thuộc task gốc, comment lỗi vào task đó.
- Nếu lỗi là bug riêng hoặc ảnh hưởng service khác, tạo Bug task mới.
- Trước khi tạo Bug task mới, phải kiểm tra task tương tự đã tồn tại chưa.

---

## 5. Cấu trúc file nên thêm vào repo

Agent cần tạo hoặc kiểm tra các file sau:

```txt
.github/
  workflows/
    ci-newman-jira.yml
  CODEOWNERS

ci/
  service-owners.yml
  jira-task-template.md
  weekly-plan-template.md
  scripts/
    detect-service.js
    classify-error.js
    jira-upsert-bug.js
    summarize-ci-weekly.js

postman/
  Presentation.postman_collection.json
  environments/
    local.postman_environment.json

newman-results/
  # thư mục sinh ra khi chạy CI, không cần commit nếu chỉ chứa report runtime
```

Nếu dự án đã có cấu trúc khác, agent cần điều chỉnh theo thực tế, không bắt buộc đúng 100% như trên.

---

## 6. File phân công service owner

Tạo file:

```txt
ci/service-owners.yml
```

Nội dung mẫu:

```yml
api-gateway:
  owner_name: TeamLead
  github_username: teamlead
  jira_assignee_id: "JIRA_ACCOUNT_ID_HERE"
  jira_component: api-gateway

order-service:
  owner_name: ThanhTri
  github_username: nguyentri160705
  jira_assignee_id: "JIRA_ACCOUNT_ID_HERE"
  jira_component: order-service

notification-service:
  owner_name: MemberB
  github_username: memberb
  jira_assignee_id: "JIRA_ACCOUNT_ID_HERE"
  jira_component: notification-service

auth-service:
  owner_name: MemberA
  github_username: membera
  jira_assignee_id: "JIRA_ACCOUNT_ID_HERE"
  jira_component: auth-service

file-service:
  owner_name: MemberC
  github_username: memberc
  jira_assignee_id: "JIRA_ACCOUNT_ID_HERE"
  jira_component: file-service

task-service:
  owner_name: MemberD
  github_username: memberd
  jira_assignee_id: "JIRA_ACCOUNT_ID_HERE"
  jira_component: task-service

studio-service:
  owner_name: MemberE
  github_username: membere
  jira_assignee_id: "JIRA_ACCOUNT_ID_HERE"
  jira_component: studio-service

analytics-service:
  owner_name: MemberF
  github_username: memberf
  jira_assignee_id: "JIRA_ACCOUNT_ID_HERE"
  jira_component: analytics-service

web-app:
  owner_name: FrontendOwner
  github_username: frontendowner
  jira_assignee_id: "JIRA_ACCOUNT_ID_HERE"
  jira_component: web-app
```

Lưu ý:

- `owner_name` dùng để đưa vào tiêu đề Jira task.
- `github_username` dùng để mention/review trên GitHub.
- `jira_assignee_id` là accountId trên Jira Cloud, không phải email trong nhiều trường hợp.
- `jira_component` dùng để gắn component cho Jira issue.

---

## 7. Quy ước tiêu đề Jira task

Tất cả Bug task tự động phải có dạng:

```txt
[service-owner][error-type][priority] mô tả lỗi ngắn gọn
```

Ví dụ:

```txt
[order-service-ThanhTri][Authorization][High] API /stats trả về 403 khi dùng sai role
[auth-service-MemberA][Authentication][Medium] Login sai mật khẩu không trả về 401 như mong đợi
[notification-service-MemberB][Integration][High] Không gửi notification khi order status thay đổi
[api-gateway-TeamLead][Routing][Critical] API Gateway không route được request đến order-service
```

Nếu muốn đơn giản hơn cho nhóm sinh viên, có thể dùng:

```txt
[order-service-ThanhTri] Cập nhật trạng thái đơn hàng bị lỗi khi chạy CI
```

---

## 8. Quy tắc phân loại lỗi tự động

Agent cần tạo logic phân loại lỗi dựa vào log, endpoint hoặc tên test case.

Các nhóm lỗi đề xuất:

| Nhóm lỗi | Dấu hiệu | Ví dụ |
|---|---|---|
| Authentication | login, token, verify, 401 | Đăng nhập sai, token thiếu |
| Authorization | role, forbidden, 403 | Customer gọi API admin |
| Validation | 400, invalid input, missing field | Thiếu dữ liệu bắt buộc |
| API Response | status code sai, response body sai | Expected 200 but got 500 |
| Database | connection, SQL, duplicate, migration | Không kết nối DB |
| Integration | service A gọi service B fail | order-service không gọi notification-service |
| Timeout | request timeout, ECONNRESET | Service phản hồi quá lâu |
| Routing | 404, gateway, proxy | API Gateway route sai |
| Environment | env missing, port conflict | Thiếu biến môi trường |
| Unknown | không phân loại được | Log không rõ nguyên nhân |

Ví dụ rule đơn giản:

```txt
Nếu log có 401 → Authentication
Nếu log có 403 → Authorization
Nếu log có 400 → Validation
Nếu log có 404 + api-gateway → Routing
Nếu log có ECONNREFUSED hoặc database → Database/Environment
Nếu log có timeout → Timeout
Nếu endpoint liên quan nhiều service → Integration
```

---

## 9. Quy tắc gán priority tự động

| Priority | Điều kiện |
|---|---|
| Critical | Service không start, API Gateway chết, login toàn hệ thống fail, database không kết nối được |
| High | Chức năng chính fail: order, auth, payment, notification chính |
| Medium | Một endpoint phụ fail, response không đúng format, rule nghiệp vụ nhỏ sai |
| Low | Warning, message chưa đúng, log không ảnh hưởng chức năng chính |

Ví dụ:

```txt
Critical: api-gateway không chạy, auth-service không login được
High: order-service không tạo/hủy/cập nhật đơn được
Medium: /stats sai quyền hoặc sai format response
Low: message trả về chưa đúng tiếng Việt
```

---

## 10. Cơ chế tránh tạo trùng Jira Bug task

Đây là phần rất quan trọng. Workflow không được tạo task mới cho cùng một lỗi lặp lại nhiều lần.

### 10.1. Bug signature

Mỗi lỗi nên tạo một `bug_signature` dựa trên:

```txt
service + endpoint + error_type + status_code + test_case_name
```

Ví dụ:

```txt
order-service|PATCH /orders/:id/status|API Response|500|Update order status
```

### 10.2. Cách xử lý

Trước khi tạo Bug task mới:

1. Search Jira issue có label `ci-failed` và cùng `bug_signature`.
2. Nếu có task đang `To Do`, `In Progress`, `Reopened`:
   - Không tạo task mới.
   - Comment thêm log mới vào task cũ.
3. Nếu task cũ đã `Done` nhưng lỗi xuất hiện lại:
   - Có thể reopen task cũ hoặc tạo task mới với label `regression`.
4. Nếu không có task nào:
   - Tạo Bug task mới.

### 10.3. Label nên thêm vào Jira

```txt
ci-failed
auto-created
newman
github-actions
service-name
error-type
bug-signature-hash
```

Ví dụ:

```txt
ci-failed
auto-created
newman
order-service
authorization
sig-a1b2c3
```

---

## 11. Description mẫu cho Jira Bug task

Agent cần tạo description theo mẫu sau:

```md
# CI phát hiện lỗi tự động

## 1. Thông tin chung

- Service bị ảnh hưởng: `order-service`
- Người phụ trách chính: `ThanhTri`
- Loại lỗi: `Authorization`
- Priority: `High`
- Branch: `<branch>`
- Commit: `<commit_sha>`
- Người push code: `<github_actor>`
- Pull Request: `<pull_request_url>`
- Workflow run: `<github_actions_url>`
- Thời gian phát hiện: `<timestamp>`

## 2. Thông tin test fail

- Test suite: `<collection/folder>`
- Test case: `<test_case_name>`
- Endpoint: `<method> <url>`
- Expected result: `<expected>`
- Actual result: `<actual>`
- Status code thực tế: `<status_code>`

## 3. Log lỗi chính

```txt
<trích đoạn log lỗi ngắn gọn>
```

## 4. Ảnh hưởng

Lỗi này có thể ảnh hưởng đến chức năng `<mô tả chức năng>` và có thể làm workflow nghiệp vụ liên quan bị sai.

## 5. Gợi ý kiểm tra

1. Kiểm tra token hoặc role khi gọi API.
2. Kiểm tra validate request body.
3. Kiểm tra service có chạy đúng port không.
4. Kiểm tra kết nối database.
5. Kiểm tra logic gọi service liên quan.
6. Chạy lại Postman Collection ở local trước khi push lại.

## 6. Tài liệu/report đính kèm

- GitHub Actions Workflow: `<url>`
- Newman HTML Report: `<artifact_url>`
- Newman XML/JSON Report: `<artifact_url>`
- Commit gây phát hiện lỗi: `<commit_url>`

## 7. Bug signature

`<bug_signature>`
```

---

## 12. CODEOWNERS

Agent nên tạo file:

```txt
.github/CODEOWNERS
```

Nội dung mẫu:

```txt
# Service owners
/order-service/ @nguyentri160705
/auth-service/ @membera
/notification-service/ @memberb
/file-service/ @memberc
/task-service/ @memberd
/studio-service/ @membere
/analytics-service/ @memberf
/api-gateway/ @teamlead
/web-app/ @frontendowner

# CI and testing files
/.github/workflows/ @teamlead @nguyentri160705
/postman/ @nguyentri160705
/ci/ @teamlead @nguyentri160705
```

Mục đích:

- Khi ai sửa service nào, GitHub tự đề xuất người phụ trách review.
- Bổ trợ cho Jira assignment.
- Giúp báo cáo quy trình chuyên nghiệp hơn.

---

## 13. Quy ước commit message

Developer phải commit theo dạng:

```txt
<JIRA_KEY> <mô tả ngắn>
```

Ví dụ:

```txt
ORDER-12 fix update order status API
AUTH-08 improve login validation
NOTI-05 add notification when order cancelled
```

Nếu commit không có Jira key:

- Workflow vẫn chạy CI.
- Nếu pass: chỉ lưu report.
- Nếu fail: tạo Bug task mới hoặc comment vào task bug đã tồn tại dựa trên bug signature.

---

## 14. Quy tắc branch và Pull Request

Đề xuất branch:

```txt
main       : nhánh ổn định nhất
 dev        : nhánh tích hợp cho nhóm
 feature/*  : nhánh làm chức năng
 bugfix/*   : nhánh sửa lỗi
 hotfix/*   : nhánh sửa lỗi khẩn cấp
```

Quy tắc:

| Hành động | CI chạy gì | Jira xử lý |
|---|---|---|
| Push lên feature branch | Smoke test + test liên quan | Không tạo bug nếu chưa cần, ưu tiên comment PR |
| Pull Request vào dev | Full Newman/API test | Nếu fail thì chặn merge, tạo/cập nhật Jira bug |
| Push/merge vào dev | Full CI + integration test | Nếu fail thì tạo/cập nhật Jira bug |
| Merge vào main | Regression test | Nếu pass thì đánh dấu bản ổn định |

---

## 15. Workflow GitHub Actions mẫu

Tạo file:

```txt
.github/workflows/ci-newman-jira.yml
```

Nội dung mẫu tham khảo:

```yml
name: CI - Newman + Jira Automation

on:
  push:
    branches:
      - dev
      - main
      - "feature/**"
      - "bugfix/**"
  pull_request:
    branches:
      - dev
      - main

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  ci-test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout source code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Newman
        run: |
          npm install -g newman newman-reporter-htmlextra

      - name: Prepare report folder
        run: mkdir -p newman-results

      # Nếu dự án cần Docker Compose, bật phần này
      # - name: Start services with Docker Compose
      #   run: |
      #     docker compose up -d --build
      #     sleep 30

      - name: Run Newman API tests
        id: newman
        continue-on-error: true
        run: |
          newman run postman/Presentation.postman_collection.json \
            --working-dir . \
            --reporters cli,junit,htmlextra,json \
            --reporter-junit-export newman-results/newman-report.xml \
            --reporter-htmlextra-export newman-results/newman-report.html \
            --reporter-json-export newman-results/newman-report.json

      - name: Upload Newman reports
        uses: actions/upload-artifact@v4
        with:
          name: newman-report-${{ github.run_id }}
          path: newman-results/

      - name: Install CI helper dependencies
        run: |
          npm install js-yaml axios

      - name: Analyze CI result and sync Jira
        env:
          JIRA_BASE_URL: ${{ secrets.JIRA_BASE_URL }}
          JIRA_EMAIL: ${{ secrets.JIRA_EMAIL }}
          JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
          JIRA_PROJECT_KEY: ${{ secrets.JIRA_PROJECT_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITHUB_RUN_URL: https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }}
          GITHUB_ACTOR: ${{ github.actor }}
          GITHUB_BRANCH: ${{ github.ref_name }}
          GITHUB_SHA: ${{ github.sha }}
          EVENT_NAME: ${{ github.event_name }}
        run: |
          node ci/scripts/jira-upsert-bug.js

      - name: Fail workflow if Newman failed
        if: steps.newman.outcome == 'failure'
        run: exit 1
```

Lưu ý:

- `continue-on-error: true` ở bước Newman giúp workflow vẫn chạy tiếp bước phân tích và tạo Jira task.
- Bước cuối cùng mới `exit 1` để GitHub Actions hiển thị CI fail đúng.
- Nếu không dùng Docker Compose trong CI, bỏ phần start services.
- Nếu cần chạy Docker Compose, phải đảm bảo service health check ổn định trước khi chạy Newman.

---

## 16. GitHub Secrets cần cấu hình

Vào GitHub repository:

```txt
Settings → Secrets and variables → Actions → New repository secret
```

Thêm các secret:

```txt
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token
JIRA_PROJECT_KEY=YOURPROJECTKEY
```

Không commit các giá trị này vào GitHub.

---

## 17. Script detect service

Tạo file:

```txt
ci/scripts/detect-service.js
```

Yêu cầu logic:

1. Đọc `newman-results/newman-report.json`.
2. Lấy danh sách test case fail.
3. Dựa vào URL, folder, request name hoặc path để xác định service.
4. Nếu URL chứa `/orders`, `/order`, `/stats` thuộc order thì map `order-service`.
5. Nếu URL chứa `/auth`, `/login`, `/register`, `/verify` thì map `auth-service`.
6. Nếu URL chứa `/notify`, `/notifications` thì map `notification-service`.
7. Nếu không xác định được, dùng `api-gateway` hoặc `unknown-service`.

Map tham khảo:

```js
const serviceRules = [
  { service: 'auth-service', patterns: ['/auth', '/login', '/register', '/verify'] },
  { service: 'order-service', patterns: ['/orders', '/order', '/stats'] },
  { service: 'notification-service', patterns: ['/notify', '/notifications'] },
  { service: 'file-service', patterns: ['/files', '/upload'] },
  { service: 'task-service', patterns: ['/tasks'] },
  { service: 'studio-service', patterns: ['/studios'] },
  { service: 'analytics-service', patterns: ['/analytics', '/dashboard'] },
];
```

Agent có thể cải thiện rule này dựa trên route thật của dự án.

---

## 18. Script classify error

Tạo file:

```txt
ci/scripts/classify-error.js
```

Logic đề xuất:

```js
function classifyError({ statusCode, message, endpoint }) {
  const text = `${statusCode || ''} ${message || ''} ${endpoint || ''}`.toLowerCase();

  if (text.includes('401')) return 'Authentication';
  if (text.includes('403')) return 'Authorization';
  if (text.includes('400')) return 'Validation';
  if (text.includes('404')) return 'Routing';
  if (text.includes('500')) return 'API Response';
  if (text.includes('timeout')) return 'Timeout';
  if (text.includes('econnrefused') || text.includes('database') || text.includes('sql')) return 'Database';
  if (text.includes('notification') || text.includes('rabbitmq')) return 'Integration';

  return 'Unknown';
}

function determinePriority({ service, errorType, statusCode }) {
  if (errorType === 'Database') return 'Critical';
  if (service === 'api-gateway') return 'Critical';
  if (service === 'auth-service' && ['Authentication', 'API Response'].includes(errorType)) return 'Critical';
  if (service === 'order-service') return 'High';
  if (statusCode >= 500) return 'High';
  if ([401, 403, 404].includes(statusCode)) return 'Medium';
  return 'Low';
}

module.exports = { classifyError, determinePriority };
```

---

## 19. Script Jira upsert bug

Tạo file:

```txt
ci/scripts/jira-upsert-bug.js
```

Yêu cầu:

1. Đọc report Newman JSON.
2. Nếu không có lỗi:
   - Tìm Jira key từ commit message/branch nếu có.
   - Comment CI pass vào Jira task.
   - Kết thúc.
3. Nếu có lỗi:
   - Lấy lỗi đầu tiên hoặc nhóm lỗi theo service.
   - Detect service.
   - Classify error.
   - Determine priority.
   - Load owner từ `ci/service-owners.yml`.
   - Tạo bug signature.
   - Search Jira xem task có cùng signature chưa.
   - Nếu có, comment thêm log mới.
   - Nếu chưa có, tạo Bug issue mới.

Pseudo-code:

```js
main() {
  const report = readNewmanJson();
  const failures = extractFailures(report);

  if (failures.length === 0) {
    const jiraKey = extractJiraKeyFromGitContext();
    if (jiraKey) commentCiPassed(jiraKey);
    return;
  }

  const groupedFailures = groupByService(failures);

  for (const group of groupedFailures) {
    const service = detectService(group);
    const owner = getServiceOwner(service);
    const errorType = classifyError(group.mainFailure);
    const priority = determinePriority(service, errorType);
    const signature = buildBugSignature(service, group.mainFailure, errorType);

    const existingIssue = searchJiraIssueBySignature(signature);

    if (existingIssue) {
      commentExistingBug(existingIssue.key, group, signature);
    } else {
      createJiraBug({ service, owner, errorType, priority, group, signature });
    }
  }
}
```

Agent cần triển khai script này phù hợp với Jira REST API và format Atlassian Document Format nếu dùng Jira Cloud API v3.

---

## 20. Jira API cần dùng

Các API chính:

### 20.1. Search issue

Dùng để tránh tạo task trùng.

```txt
GET /rest/api/3/search/jql?jql=<JQL>
```

JQL ví dụ:

```txt
project = MUTRA AND labels = ci-failed AND labels = sig-a1b2c3 AND statusCategory != Done
```

### 20.2. Create issue

```txt
POST /rest/api/3/issue
```

Issue fields cần có:

- project key
- summary
- description
- issuetype: Bug
- priority
- labels
- assignee nếu có accountId
- components nếu project đã cấu hình component

### 20.3. Add comment

```txt
POST /rest/api/3/issue/{issueIdOrKey}/comment
```

Dùng khi:

- CI pass và có Jira task liên quan.
- CI fail nhưng bug đã tồn tại.
- Muốn cập nhật log mới vào task cũ.

---

## 21. Definition of Done cho mỗi task

Mỗi Jira task nên có tiêu chuẩn hoàn thành:

```txt
Definition of Done:
- Code đã được push lên branch đúng quy ước.
- Commit message có mã Jira task.
- Developer đã test local cơ bản.
- Pull Request đã được tạo vào dev.
- GitHub Actions CI đã chạy.
- Newman/Postman report đã được lưu.
- CI pass hoặc bug liên quan đã được xử lý.
- Reviewer đã kiểm tra code.
- Jira task đã được cập nhật trạng thái.
```

---

## 22. Kế hoạch triển khai theo tuần

### Tuần 1: Hoàn thiện CI cơ bản

Mục tiêu: GitHub Actions chạy được test và lưu report.

Task đề xuất:

1. Kiểm tra cấu trúc repo và Postman Collection.
2. Chuẩn hóa file Postman Collection để import và chạy Newman không lỗi JSON.
3. Tạo workflow `.github/workflows/ci-newman-jira.yml`.
4. Cấu hình Newman chạy collection.
5. Xuất report HTML/XML/JSON.
6. Lưu report bằng GitHub Actions Artifact.
7. Chạy thử trên branch `dev`.

Kết quả cần có:

- GitHub Actions chạy được.
- Có report Newman.
- Biết CI pass/fail rõ ràng.

### Tuần 2: Tích hợp Jira cơ bản

Mục tiêu: CI fail thì tạo Jira Bug task.

Task đề xuất:

1. Tạo Jira API token và cấu hình GitHub Secrets.
2. Tạo script gọi Jira API.
3. Tạo Bug task khi Newman fail.
4. Tạo description có log, endpoint, expected, actual.
5. Comment CI pass vào Jira task nếu commit có Jira key.
6. Test thử bằng một collection fail có kiểm soát.

Kết quả cần có:

- Fail thì Jira có bug.
- Pass thì không tạo bug mới.
- Có bằng chứng report.

### Tuần 3: Phân công theo service và tránh trùng bug

Mục tiêu: Bug task được giao đúng người, không tạo trùng.

Task đề xuất:

1. Tạo `ci/service-owners.yml`.
2. Tạo logic detect service.
3. Tạo logic classify error.
4. Tạo logic priority.
5. Tạo bug signature.
6. Search Jira trước khi tạo task.
7. Nếu bug đã tồn tại thì comment thay vì tạo mới.

Kết quả cần có:

- Bug order-service giao cho ThanhTri.
- Bug auth-service giao cho người phụ trách auth.
- Không bị spam Jira task.

### Tuần 4: Pull Request workflow và báo cáo

Mục tiêu: Workflow đủ chuyên nghiệp để báo cáo.

Task đề xuất:

1. Bật CI cho Pull Request vào `dev`.
2. Chặn merge nếu CI fail.
3. Thêm CODEOWNERS.
4. Tạo checklist Definition of Done.
5. Tạo weekly report template.
6. Tổng hợp số lần CI pass/fail.
7. Chuẩn bị tài liệu báo cáo giáo viên.

Kết quả cần có:

- PR fail thì không merge.
- Có CODEOWNERS.
- Có báo cáo tiến độ tuần.
- Có quy trình rõ ràng cho nhóm.

---

## 23. Báo cáo tuần mẫu cho giáo viên

Tạo file hoặc Jira task tuần:

```md
# Báo cáo CI/Jira tuần <số tuần>

## 1. Mục tiêu tuần

- Hoàn thiện workflow CI với GitHub Actions.
- Chạy kiểm thử API tự động bằng Newman.
- Tích hợp Jira để quản lý lỗi.

## 2. Công việc đã thực hiện

- Đã cấu hình GitHub Actions.
- Đã chạy Newman Collection tự động.
- Đã xuất report HTML/XML.
- Đã lưu report vào Artifact.
- Đã tạo Jira Bug task tự động khi CI fail.

## 3. Kết quả CI

- Tổng số lần chạy CI: `<number>`
- Số lần pass: `<number>`
- Số lần fail: `<number>`
- Tỉ lệ pass: `<percent>`

## 4. Bug phát hiện

| Service | Số bug | Trạng thái |
|---|---:|---|
| order-service | 2 | 1 Done, 1 In Progress |
| auth-service | 1 | Done |
| notification-service | 1 | To Do |

## 5. Vấn đề còn tồn tại

- Một số lỗi chưa phân loại tự động chính xác.
- Cần bổ sung thêm integration test.
- Cần chuẩn hóa commit message có Jira key.

## 6. Kế hoạch tuần sau

- Bổ sung CODEOWNERS.
- Chặn merge Pull Request nếu CI fail.
- Thêm cơ chế tránh tạo trùng Jira task.
- Hoàn thiện dashboard/report tổng hợp.
```

---

## 24. Checklist cho AI Agent khi bắt đầu triển khai

Agent phải làm theo checklist này:

```txt
[ ] Đọc cấu trúc repository.
[ ] Tìm file Postman Collection hiện tại.
[ ] Kiểm tra collection có valid JSON không.
[ ] Tìm workflow GitHub Actions hiện có.
[ ] Kiểm tra branch chính của repo: dev/main.
[ ] Kiểm tra cách chạy service local/Docker.
[ ] Xác định command Newman đang dùng.
[ ] Tạo hoặc cập nhật workflow CI.
[ ] Tạo thư mục ci/scripts.
[ ] Tạo service-owners.yml.
[ ] Tạo hoặc cập nhật CODEOWNERS.
[ ] Tạo script detect service.
[ ] Tạo script classify error.
[ ] Tạo script Jira upsert bug.
[ ] Đảm bảo Jira token dùng GitHub Secrets.
[ ] Chạy thử CI với case pass.
[ ] Chạy thử CI với case fail.
[ ] Kiểm tra Jira có tạo/comment đúng không.
[ ] Viết tài liệu hướng dẫn nhóm sử dụng.
```

---

## 25. Prompt ngắn để giao cho AI Agent trong VSCode

Dùng prompt này trong Codex/AI Agent:

```txt
Bạn là chuyên gia DevOps, GitHub Actions, Newman/Postman và Jira Automation. Hãy đọc toàn bộ repository hiện tại và triển khai workflow CI tự động theo tài liệu `workflow-ci-jira-agent-guide-v2.md`.

Mục tiêu:
1. Khi push code hoặc tạo Pull Request, GitHub Actions phải chạy Newman/Postman test.
2. Xuất report HTML/XML/JSON và lưu vào GitHub Actions Artifact.
3. Nếu CI pass, không tạo Jira bug mới; chỉ comment vào Jira task liên quan nếu commit/PR có mã Jira task.
4. Nếu CI fail, phân tích lỗi, xác định service, người phụ trách, loại lỗi, priority.
5. Trước khi tạo Jira Bug task, kiểm tra xem bug tương tự đã tồn tại chưa. Nếu có thì comment thêm log mới, nếu chưa có thì tạo bug mới.
6. Tiêu đề bug theo dạng `[service-owner][error-type][priority] mô tả lỗi`.
7. Description phải có service, endpoint, expected result, actual result, log lỗi, commit, người push, workflow URL, report URL và gợi ý fix.
8. Thêm `ci/service-owners.yml`, `.github/CODEOWNERS`, và các script cần thiết trong `ci/scripts`.
9. Không hard-code secret. Tất cả Jira token/base URL/project key phải lấy từ GitHub Secrets.
10. Không làm hỏng logic business hiện tại của dự án.

Sau khi triển khai, hãy giải thích rõ các file đã thêm/sửa và hướng dẫn tôi cách cấu hình GitHub Secrets, cách test workflow pass/fail, và cách xem report trên GitHub Actions.
```

---

## 26. Prompt yêu cầu Agent chỉ hướng dẫn, chưa sửa code

Nếu chưa muốn agent tự sửa file, dùng prompt này:

```txt
Bạn là chuyên gia DevOps, GitHub Actions, Newman/Postman và Jira Automation. Hãy đọc repository hiện tại và tài liệu `workflow-ci-jira-agent-guide-v2.md`, nhưng chưa sửa code ngay.

Hãy phân tích:
1. Repo hiện tại thiếu file nào để làm workflow CI + Jira tự động?
2. Postman Collection hiện tại có chạy được Newman không?
3. GitHub Actions hiện tại đã đủ chưa?
4. Cần thêm những GitHub Secrets nào?
5. Cần tạo những script nào?
6. Service nào nên map cho ai phụ trách?
7. Workflow pass/fail nên xử lý ra sao?
8. Cho tôi kế hoạch triển khai từng bước an toàn, mỗi bước có lệnh cụ thể.

Sau khi phân tích xong, hãy chờ tôi xác nhận rồi mới sửa file.
```

---

## 27. Tiêu chí đánh giá workflow đã hoàn thiện

Workflow được xem là đạt yêu cầu khi:

```txt
[ ] Push code lên GitHub thì CI tự chạy.
[ ] Pull Request vào dev thì CI tự chạy.
[ ] Newman chạy được collection không lỗi đường dẫn.
[ ] Report HTML/XML/JSON được tạo.
[ ] Report được upload vào GitHub Actions Artifact.
[ ] CI pass thì không tạo Jira Bug task mới.
[ ] CI pass có thể comment vào Jira task liên quan.
[ ] CI fail thì tạo hoặc cập nhật Jira Bug task.
[ ] Bug task có title đúng format.
[ ] Bug task có description đủ thông tin.
[ ] Bug task được gán đúng service owner.
[ ] Có phân loại lỗi.
[ ] Có priority.
[ ] Có tránh tạo trùng task.
[ ] Có CODEOWNERS.
[ ] Có kế hoạch tuần và báo cáo tuần.
[ ] Không lộ secret trong repo.
[ ] Nhóm có thể dùng quy trình này để báo cáo môn kiểm chứng phần mềm.
```

---

## 28. Kết luận

Workflow hoàn chỉnh nên không chỉ dừng lại ở việc “test fail thì tạo Jira task”. Phiên bản tốt hơn cần có:

1. Pull Request workflow.
2. Chặn merge nếu CI fail.
3. Report test rõ ràng.
4. Phân công bug theo service owner.
5. Phân loại lỗi tự động.
6. Gán priority tự động.
7. Tránh tạo trùng Jira task.
8. Comment vào task cũ khi lỗi lặp lại.
9. CODEOWNERS để hỗ trợ review.
10. Báo cáo tiến độ tuần để trình bày với giáo viên.

Với cách này, nhóm có một quy trình CI + Jira Automation thực tế, chuyên nghiệp và phù hợp với yêu cầu môn kiểm chứng phần mềm.
