# CI phát hiện lỗi tự động

## 1. Thông tin chung
- Service bị ảnh hưởng: `[Tên service]`
- Người phụ trách chính: `[Tên Dev]`
- Loại lỗi: `[Loại lỗi]`
- Priority: `[Priority]`
- Branch: `[Branch]`
- Commit: `[Commit SHA]`
- Người push code: `[GitHub Actor]`
- Workflow run: `[URL]`
- Thời gian phát hiện: `[Timestamp]`

## 2. Thông tin test fail
- Test case: `[Tên test case]`
- Endpoint: `[Method] [URL]`
- Error Message: `[Lỗi chi tiết]`

## 3. Đề xuất kiểm tra
1. Kiểm tra lại logic API.
2. Kiểm tra token/quyền truy cập.
3. Chạy lại Postman Collection ở local trước khi push.

## 4. Bug signature
`[Bug Signature]`
