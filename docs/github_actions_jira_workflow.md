# Hướng dẫn Workflow CI và Jira Tự Động cho Nhóm

Tài liệu này giải thích quy trình tự động hóa đã được thiết lập giữa GitHub Actions, Newman và Jira cho dự án của chúng ta.

## 1. Luồng làm việc (Workflow)
Khi một thành viên tạo **Pull Request (PR)** vào nhánh `dev` hoặc đẩy code lên nhánh `dev`:
1. **GitHub Actions** tự động chạy CI.
2. Nó sẽ dựng môi trường, chạy test Postman/Newman Collection (`postman/Presentation.postman_collection.json`).
3. Nếu tất cả test **PASS**:
   - Nếu có PR, GitHub tự động gắn comment thông báo thành công.
   - Code có thể được merge an toàn.
4. Nếu có test **FAIL**:
   - Workflow bị chặn lại (Fail).
   - Hệ thống tự động phân tích report lỗi.
   - Phát hiện ra Service nào bị lỗi và ai là người phụ trách.
   - Kiểm tra trên Jira xem lỗi này đã có ticket Bug chưa (dựa vào `bug_signature`).
   - Tự động tạo Bug mới (hoặc comment vào Bug cũ) trên dự án `KAN`.

## 2. Phân công người phụ trách (Service Owners)
Mọi việc map service - người phụ trách được lưu ở file `ci/service-owners.yml`.
Nếu sau này nhóm đổi việc, chỉ cần cập nhật file này.

Ngoài ra, file `.github/CODEOWNERS` đảm bảo nếu bạn sửa code vào thư mục của người khác, GitHub sẽ tự động gọi người đó vào Review PR.

## 3. Cách xem Report
Khi test xong, kết quả HTML/XML/JSON được lưu ở mục **Artifacts** trong GitHub Actions. Bạn có thể bấm vào Workflow run đó tải file `newman-report-...zip` về để xem báo cáo HTML cực kỳ trực quan.

## 4. Tránh spam Jira
Hệ thống có cơ chế băm `bug_signature`. Nếu bạn chạy CI fail 10 lần với cùng một lỗi, nó sẽ **không** tạo ra 10 Bug rác. Nó chỉ comment log báo lỗi cập nhật vào cái Bug đầu tiên nó tạo. Nên Jira luôn sạch sẽ!
