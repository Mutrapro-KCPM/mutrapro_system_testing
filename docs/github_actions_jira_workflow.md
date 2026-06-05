# Quy trinh Jira + GitHub Actions cho MuTraPro

Tai lieu nay thay the cach lam dua tren Jenkins. Quy trinh hien tai chi tap trung vao Jira, GitHub, GitHub Actions, Postman va Newman.

## 1. Muc tieu

- Moi task tren Jira phai co ma issue, vi du `KAN-36`.
- Branch, commit va Pull Request phai chua ma Jira de GitHub/Jira tu lien ket cong viec.
- GitHub Actions tu khoi dong he thong bang Docker Compose.
- Newman chay collection `postman/Presentation.postman_collection.json`.
- Ket qua test duoc luu thanh artifact `newman-results`.
- Neu da cau hinh Jira Secrets, workflow se comment ket qua pass/fail vao Jira issue tuong ung.

## 2. Nhung yeu cau duoc bo qua

- Khong dung Jenkins trong quy trinh nay.
- Khong dung cac action `atlassian/gajira-*`; workflow dung Jira REST API qua `curl` de tranh phu thuoc action cu.
- Khong tu dong tao Bug task moi cho moi lan CI fail, vi rat de lam Jira bi spam. Giai doan dau chi comment vao issue goc.
- Khong hard-code Jira token, email, mat khau, URL noi bo hoac secret vao source code.

## 3. Cau truc lien quan trong repo

```text
.github/
└── workflows/
    └── api-newman-ci.yml

postman/
├── Presentation.postman_collection.json
└── MutraPro Local.postman_environment.json

tests/
└── fixtures/
    └── upload-test.mp3
```

Workflow chinh:

```text
.github/workflows/api-newman-ci.yml
```

## 4. Secrets can cau hinh tren GitHub

Vao GitHub repository:

```text
Settings -> Secrets and variables -> Actions -> New repository secret
```

Tao cac secret sau:

```text
DB_PASSWORD
JWT_SECRET
RABBITMQ_DEFAULT_PASS
NIFI_SENSITIVE_PROPS_KEY
INTERNAL_SERVICE_TOKEN
JIRA_BASE_URL
JIRA_EMAIL
JIRA_API_TOKEN
```

Vi du:

```text
DB_PASSWORD=123456
JWT_SECRET=mutrapro_ci_jwt_secret_please_change_before_production_2026
RABBITMQ_DEFAULT_PASS=password
NIFI_SENSITIVE_PROPS_KEY=mutrapro_ci_nifi_sensitive_props_key_2026
INTERNAL_SERVICE_TOKEN=mutrapro_ci_internal_service_token_2026
JIRA_BASE_URL=https://ut-team-z6hmsj1i.atlassian.net
JIRA_EMAIL=email-dang-nhap-jira@example.com
JIRA_API_TOKEN=token-tao-tu-atlassian
```

Khong dua token vao file `.env`, README, commit message, workflow log hoac chat nhom.

## 5. Quy uoc dat ten bat buoc

Branch phai co Jira key:

```bash
feature/KAN-36-github-actions-newman
bugfix/KAN-41-fix-payment-test
test/KAN-40-update-postman-workflow
hotfix/KAN-99-fix-ci-error
```

Commit nen co Jira key:

```bash
git commit -m "KAN-36 setup GitHub Actions Newman workflow"
git commit -m "KAN-40 update Postman workflow collection"
```

Pull Request title nen co Jira key:

```text
KAN-36 Setup GitHub Actions with Newman
```

Workflow se tim Jira key trong:

```text
PR title
branch name
commit message
```

## 6. Luong lam viec hang ngay

```text
Nhan Jira issue
-> Tao branch co KAN-xx
-> Cap nhat code/Postman test
-> Chay test local neu co the
-> Commit co KAN-xx
-> Push len GitHub
-> GitHub Actions chay Docker Compose + Newman
-> Xem artifact/log neu fail
-> Mo Pull Request khi pass
-> Review va merge
```

## 7. Cach workflow dang chay

Workflow `api-newman-ci.yml` se chay khi:

```text
push vao main/dev/feature/**/bugfix/**/test/**
pull_request vao main/dev
chay thu cong bang workflow_dispatch
```

Nhung buoc chinh:

```text
1. Checkout source code
2. Kiem tra cac CI secrets bat buoc
3. Validate docker compose config
4. Build truoc cac image API chinh bang BuildKit: mysql_db, cac backend service va api-gateway
5. Start API stack bang `docker compose up -d --no-build api-gateway`
6. Cho API Gateway healthy tai http://localhost:3007/api/health va in health/status cac service khi dang cho
7. Build Newman Docker image tu .github/newman/Dockerfile, co cache Buildx/GHA
8. Chay Postman collection bang Newman Docker
9. Upload JUnit/JSON/HTML reports vao artifact newman-results
10. Publish Newman API Tests len GitHub Checks/PR annotations
11. In health summary va logs cua toan bo API stack khi fail
12. Stop containers va xoa volume CI
13. Tim Jira issue key
14. Comment pass/fail vao Jira neu da cau hinh secrets
```

Dockerfile cua cac Node service dung `npm ci --omit=dev` va BuildKit cache mount tai `/root/.npm`.
Dieu nay giup build on dinh theo `package-lock.json` va giam viec tai lai npm package trong qua trinh build.
File `.dockerignore` loai bo upload/log/node_modules va cac thu muc khong can cho backend build de giam Docker build context.
MySQL healthcheck dang kiem tra bang user `mutrapro_app`, nen cac backend chi start sau khi app database user da duoc tao va dang nhap duoc.

## 8. Cach doc loi khi GitHub Actions fail

1. Vao GitHub repo.
2. Mo tab `Actions`.
3. Chon workflow `API CI with Newman`.
4. Mo run bi do.
5. Xem step bi loi, thuong la:
   - `Wait for API Gateway health`
   - `Build Newman Docker image`
   - `Run Postman collection with Newman Docker`
6. Neu fail o health check, xem `Service health summary` de biet service nao `unhealthy`, `exited` hoac chua duoc tao.
7. Xem `Recent logs for API stack` de doc log cua service loi.
8. Tai artifact `newman-results`.
9. Mo:
   - `newman-report.html`
   - `newman-report.json`
   - `newman-report.xml`
10. Sua code, collection hoac environment.
11. Commit lai voi cung ma Jira.
12. Push lai de CI chay tiep.

## 9. Jira Automation nen cau hinh

Trong Jira project `KAN`, co the tao cac rule:

```text
Branch created co KAN-xx -> In Progress
Pull request created co KAN-xx -> Code Review
Pull request merged co KAN-xx -> Ready for Test
Build failed -> them comment hoac chuyen sang Failed
Build successful -> them comment hoac chuyen sang Ready for Test
```

Khuyen nghi giai doan dau:

```text
To Do -> In Progress -> Code Review -> Ready for Test -> Done
```

Neu test fail:

```text
Ready for Test -> In Progress
```

## 10. Checklist sau khi cau hinh

- [ ] `.github/workflows/api-newman-ci.yml` ton tai tren GitHub.
- [ ] GitHub Actions hien workflow `API CI with Newman`.
- [ ] Push branch `feature/KAN-xx-*` lam workflow tu chay.
- [ ] Workflow upload artifact `newman-results`.
- [ ] Check `Newman API Tests` hien trong GitHub Checks khi co file `newman-report.xml`.
- [ ] Jira issue hien branch/commit/PR tu GitHub.
- [ ] Jira co comment CI passed/failed neu da them secrets.
- [ ] Branch `main` va `dev` bat branch protection.
- [ ] Khong ai push truc tiep vao `main`.

## 11. Definition of Done cho task CI/test

Mot task ve automation test duoc xem la xong khi:

```text
Postman collection da cap nhat
Environment dung endpoint local/CI
Newman chay duoc tren GitHub Actions
Workflow pass hoac fail dung theo ket qua test that
Report duoc upload thanh artifact
Jira issue nhan comment tu CI neu da cau hinh secrets
Pull Request duoc review
```

## 12. Manual notes removed from automated regression

Nhung request Postman dang la placeholder khong kiem tra nghiep vu that da duoc loai khoi CI regression suite:

```text
ORD-BUG-01 - Ghi nhan bug sai phan quyen
ORD-BUG-06 - Retest bug sau khi backend sua
ORD-REPORT-01 - Tong hop so test case Pass
ORD-REPORT-05 - Ghi nhan rui ro con lai
```

Neu can ghi nhan cac muc nay, dung Jira comment, PR description hoac bao cao kiem thu thay vi de chung lam request pass ao trong Newman.
