pipeline {
    agent any

    environment {
        // Tên project dùng cho docker-compose
        COMPOSE_PROJECT_NAME = 'mutrapro_system'
    }

    stages {
        stage('Checkout Code') {
            steps {
                // Bước này tự động clone code từ repository về Workspace của Jenkins
                checkout scm
                echo "Code đã được kéo về máy chủ Jenkins thành công!"
            }
        }

        stage('Dừng hệ thống cũ') {
            steps {
                // Dừng và xóa các container cũ nếu có để dọn đường build mới
                sh 'docker compose down || true'
            }
        }

        stage('Build System Images') {
            steps {
                echo "Bắt đầu build các Docker Image cho toàn bộ Microservices..."
                // Build lại toàn bộ image, không dùng cache để đảm bảo code mới nhất
                sh 'docker compose build --no-cache'
            }
        }

        stage('Triển khai (Deploy)') {
            steps {
                echo "Đang khởi động hệ thống Mutrapro..."
                // Chạy ngầm toàn bộ các dịch vụ
                sh 'docker compose up -d'
            }
        }

        stage('Kiểm tra sức khỏe (Health Check)') {
            steps {
                echo "Chờ các dịch vụ khởi động hoàn tất..."
                // Sleep một chút để đợi DB và các service sẵn sàng
                sleep time: 30, unit: 'SECONDS'
                
                // Kiểm tra trạng thái của các container
                sh 'docker compose ps'
            }
        }

        /* 
        // Bỏ comment khối này nếu bạn muốn chạy tự động Postman Test bằng Newman 
        stage('Automated API Testing') {
            steps {
                echo "Chạy Postman Collection để test API..."
                // Yêu cầu máy chủ Jenkins đã cài newman (npm install -g newman)
                // Hoặc chạy newman qua docker container
                sh 'docker run --network mutrapro-network -v ${PWD}/postman:/etc/newman -t postman/newman run /etc/newman/Presentation.postman_collection.json'
            }
        }
        */
    }

    post {
        success {
            echo "🎉 Hệ thống đã được Build và Deploy THÀNH CÔNG!"
            // Ở đây bạn có thể thêm lệnh gửi Email hoặc Slack thông báo
        }
        failure {
            echo "❌ Quá trình Build/Deploy THẤT BẠI. Vui lòng kiểm tra lại log."
            // Tự động tắt hệ thống nếu deploy lỗi để tránh lỗi lan truyền
            // sh 'docker-compose down'
        }
    }
}
