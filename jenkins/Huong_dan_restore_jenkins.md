# Hướng dẫn Restore Jenkins Backup trên máy khác

## Mục tiêu
Khôi phục toàn bộ Jenkins (Job, User, Plugin, Credentials, Pipeline, Jira, GitHub Token...) từ file backup.

---

## Điều kiện cần

- Docker Desktop đã được cài đặt.
- Có file backup:
  - `jenkins_backup.zip`
  - hoặc `jenkins_backup.tar.gz`

---

## Bước 1: Giải nén file backup

Ví dụ:

```text
D:\JenkinsBackup\
└── jenkins_home\
```

Sau khi giải nén, kiểm tra phải có:

```text
jenkins_home/
├── jobs/
├── users/
├── plugins/
├── secrets/
├── credentials.xml
├── config.xml
```

---

## Bước 2: Tạo Jenkins Container

Tạo file `docker-compose.yml`:

```yaml
services:
  jenkins:
    image: jenkins/jenkins:lts
    container_name: jenkins
    restart: unless-stopped

    ports:
      - "8080:8080"
      - "50000:50000"

    volumes:
      - jenkins_home:/var/jenkins_home
      - /var/run/docker.sock:/var/run/docker.sock

volumes:
  jenkins_home:
```

Khởi động:

```powershell
docker compose up -d
```

---

## Bước 3: Dừng Jenkins

```powershell
docker stop jenkins
```

---

## Bước 4: Copy dữ liệu backup vào container

Ví dụ dữ liệu backup nằm tại:

```text
D:\JenkinsBackup\jenkins_home
```

Copy:

```powershell
docker cp D:\JenkinsBackup\jenkins_home\. jenkins:/var/jenkins_home
```

Lưu ý dấu `.` phía sau `jenkins_home`.

---

## Bước 5: Khởi động lại Jenkins

```powershell
docker start jenkins
```

Đợi khoảng 30–60 giây.

---

## Bước 6: Đăng nhập

Mở:

```text
http://localhost:8080
```

Đăng nhập bằng tài khoản đã có trong bản backup.

Không cần tạo tài khoản mới.

---

## Bước 7: Kiểm tra

Kiểm tra:

- Job xuất hiện đầy đủ.
- Plugin còn nguyên.
- Credentials còn nguyên.
- Pipeline chạy được.
- GitHub/Jira vẫn kết nối.

---

## Nếu Jenkins không lên

Xem log:

```powershell
docker logs -f jenkins
```

Kiểm tra thư mục backup có:

```text
secrets/
credentials.xml
config.xml
users/
jobs/
plugins/
```

Nếu thiếu `secrets/` hoặc `credentials.xml`, các token và mật khẩu lưu trong Jenkins có thể không hoạt động.

---

## Cập nhật Jenkins sau này

Tạo backup mới:

```powershell
docker cp jenkins:/var/jenkins_home D:\JenkinsBackup
```

Sau đó nén lại:

```powershell
Compress-Archive -Path D:\JenkinsBackup\jenkins_home -DestinationPath D:\JenkinsBackup\jenkins_backup.zip -Force
```

---

## Kết quả

Sau khi restore thành công, máy mới sẽ có:

- Toàn bộ Job.
- Toàn bộ User.
- Toàn bộ Plugin.
- Toàn bộ Credentials.
- Toàn bộ cấu hình Jenkins.

Gần như giống hệt máy Jenkins gốc.
