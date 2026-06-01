-- Đảm bảo kết nối này sử dụng UTF8MB4
SET NAMES 'utf8mb4';
SET CHARACTER SET 'utf8mb4';

-- Script này sẽ tự động chạy khi container MySQL khởi động lần đầu
-- Tạo tất cả các databases VỚI CHARSET UTF8MB4
CREATE DATABASE IF NOT EXISTS mutrapro_auth CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS mutrapro_order CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS mutrapro_task CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS mutrapro_file CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS mutrapro_studio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS mutrapro_notification CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ================ DATABASE: mutrapro_auth ================
USE mutrapro_auth;
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('customer','coordinator','transcriber','arranger','artist','studio_admin','admin') NOT NULL DEFAULT 'customer',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; -- THÊM CHARSET

-- Mật khẩu mặc định cho các tài khoản mẫu là: Admin@123
-- Bạn nên đổi chúng ngay sau khi đăng nhập lần đầu
INSERT IGNORE INTO users (name, email, password_hash, role) VALUES
('System Admin', 'admin@mutrapro.com', '$2b$10$JUw0.X0O8tN/MYxaGT9f7O8/Xi/mtqQ3KD2zOSKw6wRUXN65Z.lGC', 'admin'),
('Coordinator', 'dpv@mutrapro.com', '$2b$10$JUw0.X0O8tN/MYxaGT9f7O8/Xi/mtqQ3KD2zOSKw6wRUXN65Z.lGC', 'coordinator'),
('Transcriber', 'cvka@mutrapro.com', '$2b$10$JUw0.X0O8tN/MYxaGT9f7O8/Xi/mtqQ3KD2zOSKw6wRUXN65Z.lGC', 'transcriber'),
('Arranger', 'cvpk@mutrapro.com', '$2b$10$JUw0.X0O8tN/MYxaGT9f7O8/Xi/mtqQ3KD2zOSKw6wRUXN65Z.lGC', 'arranger'),
('Artist', 'artist@mutrapro.com', '$2b$10$JUw0.X0O8tN/MYxaGT9f7O8/Xi/mtqQ3KD2zOSKw6wRUXN65Z.lGC', 'artist'),
('Studio Admin', 'studio@mutrapro.com', '$2b$10$JUw0.X0O8tN/MYxaGT9f7O8/Xi/mtqQ3KD2zOSKw6wRUXN65Z.lGC', 'studio_admin');

-- ================ DATABASE: mutrapro_order ================
USE mutrapro_order;
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    service_type ENUM('transcription','arrangement','recording') NOT NULL,
    description TEXT,
    status ENUM('pending','assigned','in_progress','completed','revision_requested','fixed','paid','cancelled') DEFAULT 'pending',
    price DECIMAL(10, 2) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_customer (customer_id),
    INDEX idx_status (status),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; -- THÊM CHARSET

CREATE TABLE IF NOT EXISTS payment (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    customer_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    method ENUM('credit_card','paypal','bank_transfer') DEFAULT 'credit_card',
    status ENUM('pending','paid','failed') DEFAULT 'pending',
    transaction_id VARCHAR(255),
    paid_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order (order_id),
    INDEX idx_customer (customer_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; -- THÊM CHARSET

CREATE TABLE IF NOT EXISTS feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL UNIQUE,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order (order_id),
    INDEX idx_rating (rating)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; -- THÊM CHARSET

-- ================ DATABASE: mutrapro_task ================
USE mutrapro_task;
CREATE TABLE IF NOT EXISTS task (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    assigned_to INT NOT NULL,
    specialist_role ENUM('transcriber','arranger','artist') NOT NULL,
    status ENUM('assigned','in_progress','revision_requested','done') DEFAULT 'assigned',
    revision_comment TEXT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deadline DATETIME NOT NULL,
    completed_at DATETIME NULL,
    INDEX idx_order (order_id),
    INDEX idx_assigned (assigned_to),
    INDEX idx_status (status),
    INDEX idx_deadline (deadline)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; -- THÊM CHARSET

-- ================ DATABASE: mutrapro_file ================
USE mutrapro_file;
CREATE TABLE IF NOT EXISTS file (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    uploader_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_type ENUM('audio','notation','mix','final') NOT NULL,
    file_size BIGINT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_order (order_id),
    INDEX idx_uploader (uploader_id),
    INDEX idx_type (file_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; -- THÊM CHARSET

-- ================ DATABASE: mutrapro_studio ================
USE mutrapro_studio;
CREATE TABLE IF NOT EXISTS studios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(255) NOT NULL,
    status ENUM('available','booked','maintenance') DEFAULT 'available',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; -- THÊM CHARSET

CREATE TABLE IF NOT EXISTS booking (
    id INT AUTO_INCREMENT PRIMARY KEY,
    studio_id INT NOT NULL,
    artist_id INT NOT NULL,
    order_id INT,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status ENUM('scheduled','completed','cancelled') DEFAULT 'scheduled',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
    INDEX idx_studio (studio_id),
    INDEX idx_artist (artist_id),
    INDEX idx_order (order_id),
    INDEX idx_start_time (start_time),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; -- THÊS CHARSET

-- Insert sample studios (Dữ liệu tiếng Việt này giờ sẽ được lưu đúng)
INSERT IGNORE INTO studios (name, location, status) VALUES
('Phòng thu âm Tstudio', '211/134B Hoàng Hoa Thám, Phường 5, Quận Phú Nhuận, TP.HCM', 'available'),
('Phòng thu âm Anh Huy', '10/12 Nguyễn Văn Đậu, Phường 5, Quận Phú Nhuận', 'available'),
('Jetstudio', 'Lê Hồng Phong, Phường 10, Quận 10', 'available'),
('Phòng thu âm Lam Quân', '315 Lý Tự Trọng, Bến Thành, Quận 1', 'available'),
('The Wings Media', '28/1 Ngô Văn Năm, Phường Bến Nghé, Quận 1', 'available'),
('FLYPRO Entertainment', '891/10 Nguyễn Kiệm, Phường 3, Quận Gò Vấp', 'available'),
('Phòng thu âm Báu Studio', '24 Trương Quyền, Phường 6, Quận 3', 'available'),
('Calvin Music', '09/01 Nguyễn Đình Khởi, Phường 4, Quận Tân Bình', 'available'),
('Sonar Studio', '242 Trần Bình Trọng, Phường 4, Quận 5', 'available'),
('Phòng thu âm HIT Production', '505 TK 14/2 Trần Hưng Đạo, Cầu Kho', 'available'),
('Phòng thu âm Fan Studio', '243 Tô Hiến Thành, Phường 13, Quận 10', 'maintenance');

-- ================ DATABASE: mutrapro_notification ================
USE mutrapro_notification;
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    channel ENUM('email','sms','push') DEFAULT 'push',
    status ENUM('pending','sent','failed') DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME NULL,
    INDEX idx_user (user_id),
    INDEX idx_status (status),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- ================ DATABASE: mutrapro_notification (Thêm bảng mới) ================
USE mutrapro_notification;
CREATE TABLE IF NOT EXISTS user_devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  fcm_token VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_user_token (user_id, fcm_token), -- Tránh 1 user đăng ký 1 token nhiều lần
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*
================================================================
(MỚI) DATABASE: mutrapro_analytics (Dành cho NiFi)
================================================================
*/
CREATE DATABASE IF NOT EXISTS mutrapro_analytics CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE mutrapro_analytics;

/*
Bảng này sẽ lưu kết quả báo cáo đã được NiFi tính toán trước.
Trang Admin Dashboard sẽ đọc từ bảng này.
*/
CREATE TABLE IF NOT EXISTS report_dashboard (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_name VARCHAR(100) UNIQUE NOT NULL,
  json_value JSON,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* Thêm 1 dòng dữ liệu mẫu (report_name) để NiFi có thể "UPDATE"
*/
INSERT IGNORE INTO report_dashboard (report_name, json_value) VALUES
('dashboard_stats', '{"totalRevenue": 0, "totalOrders": 0, "orderStats": []}');

/*
================================================================
(MỚI) DATABASE: TẠO USER ỨNG DỤNG
================================================================
*/
CREATE USER IF NOT EXISTS 'mutrapro_app'@'%' IDENTIFIED WITH mysql_native_password BY '123456';
GRANT ALL PRIVILEGES ON mutrapro_auth.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_order.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_task.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_file.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_studio.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_notification.* TO 'mutrapro_app'@'%';
GRANT ALL PRIVILEGES ON mutrapro_analytics.* TO 'mutrapro_app'@'%';
FLUSH PRIVILEGES;
