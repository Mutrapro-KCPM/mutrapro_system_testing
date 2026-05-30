pipeline {
    agent any

    environment {
        // Tên project dùng cho docker-compose
        COMPOSE_PROJECT_NAME = 'mutrapro_system'
    }

    stages {
        stage('Debug') {
            steps {
                sh '''
                    whoami
                    docker --version
                    docker compose version
                    pwd
                    ls -la
                '''
            }
        }

        stage('Build') {
            steps {
                // Dừng và xóa các container cũ nếu có để dọn đường build mới
                sh 'docker-compose down || true'
            }
        }

        stage('Test') {
            steps {
                echo "Bắt đầu build các Docker Image cho toàn bộ Microservices..."
                // Build lại toàn bộ image, không dùng cache để đảm bảo code mới nhất
                sh 'docker-compose build --no-cache'
            }
        }

        stage('Deploy') {
            steps {
                echo "Đang khởi động hệ thống Mutrapro..."
                // Chạy ngầm toàn bộ các dịch vụ
                sh 'docker-compose up -d'
            }
        }

        stage('Kiểm tra sức khỏe (Health Check)') {
            steps {
                echo "Chờ các dịch vụ khởi động hoàn tất..."
                // Sleep một chút để đợi DB và các service sẵn sàng
                sleep time: 30, unit: 'SECONDS'
                
                // Kiểm tra trạng thái của các container
                sh 'docker-compose ps'
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
            echo '🎉 Build và Deploy thành công!'
        }
        failure {
            echo '❌ Pipeline thất bại. Hãy kiểm tra lại log.'
        }
    }
}