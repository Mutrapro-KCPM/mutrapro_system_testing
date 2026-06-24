# Hướng dẫn làm việc nhóm với Jira + GitHub Actions

Tài liệu này hướng dẫn team MuTraPro làm việc theo quy trình hiện tại: **Jira quản lý task**, **GitHub quản lý source code**, **GitHub Actions chạy kiểm thử tự động bằng Newman**.

Quy trình Jenkins cũ chỉ còn là tài liệu tham khảo trong thư mục `jenkins/`, không dùng làm luồng chính hằng ngày.

## 1. Luồng làm việc chung

```text
Jira issue KAN-xx
-> tạo branch có KAN-xx
-> code hoặc cập nhật Postman test
-> commit có KAN-xx
-> push lên GitHub
-> GitHub Actions chạy Docker Compose + Newman
-> xem report/log
-> tạo Pull Request
-> review và merge
```

## 2. Nhận task trên Jira

Mỗi thành viên nhận task trên Jira project `KAN`.

Trước khi làm cần đọc:

- Mục tiêu task.
- API hoặc chức năng cần test.
- Expected result.
- Người được assign.
- Trạng thái hiện tại của task.

## 3. Tạo branch theo Jira key

Luôn lấy code mới nhất trước:

```bash
git checkout dev
git pull origin dev
```

Tạo branch mới:

```bash
git checkout -b feature/KAN-36-github-actions-newman
```

Một số prefix nên dùng:

```text
feature/  làm chức năng hoặc task mới
bugfix/   sửa lỗi
test/     viết hoặc cập nhật test
hotfix/   sửa lỗi gấp
```

Ví dụ:

```text
feature/KAN-36-github-actions-newman
test/KAN-40-update-postman-workflow
bugfix/KAN-41-fix-payment-test
```

## 4. Commit và push

Commit phải có Jira key:

```bash
git add .
git commit -m "KAN-36 setup GitHub Actions Newman workflow"
git push origin feature/KAN-36-github-actions-newman
```

Không nên commit kiểu:

```text
fix bug
update
test
final
```

Vì Jira và workflow sẽ khó nhận diện task liên quan.

## 5. GitHub Actions tự chạy kiểm thử

Workflow chính:

```text
.github/workflows/api-newman-ci.yml
```

Workflow sẽ chạy khi:

```text
push vào main/dev/feature/**/bugfix/**/test/**
pull request vào main/dev
chạy thủ công từ tab Actions
```

Các bước chính:

```text
validate Docker Compose
build/start API stack
wait API Gateway health
run Newman với Postman collection
upload report artifact
comment Jira pass/fail nếu đã cấu hình secrets
```

## 6. Xem kết quả khi fail

Vào GitHub:

```text
Actions -> API CI with Newman -> chọn run bị đỏ
```

Kiểm tra:

```text
step bị lỗi
log của Docker Compose
artifact newman-results
newman-report.html
newman-report.json
```

Sau khi sửa:

```bash
git add .
git commit -m "KAN-36 fix Newman failure"
git push
```

## 7. Pull Request

Khi workflow đã ổn, tạo Pull Request.

PR title nên có Jira key:

```text
KAN-36 Setup GitHub Actions with Newman
```

PR nên ghi:

```text
đã thay đổi gì
cách test
link Jira issue
kết quả GitHub Actions
ảnh/report nếu cần
```

Chỉ merge khi:

```text
GitHub Actions pass
có người review
không conflict
đúng Jira issue
```

## 8. Quy tắc bảo mật

- Không commit Jira token.
- Không commit file `.env` chứa secret.
- Không đưa token vào README hoặc comment công khai.
- Nếu lộ token, xóa token cũ và tạo token mới ngay.
- Secrets Jira phải đặt trong GitHub Repository Secrets.

Các secret cần có nếu muốn comment Jira:

```text
JIRA_BASE_URL
JIRA_EMAIL
JIRA_API_TOKEN
```

## 9. Trạng thái Jira đề xuất

```text
To Do
-> In Progress
-> Code Review
-> Ready for Test
-> Done
```

Nếu test fail:

```text
Ready for Test -> In Progress
```

## 10. Checklist cho thành viên

- [ ] Branch có `KAN-xx`.
- [ ] Commit có `KAN-xx`.
- [ ] Đã chạy test local nếu có thể.
- [ ] GitHub Actions đã chạy.
- [ ] Nếu fail, đã đọc log và artifact.
- [ ] Nếu pass, đã tạo Pull Request.
- [ ] Jira issue được cập nhật đúng trạng thái.
