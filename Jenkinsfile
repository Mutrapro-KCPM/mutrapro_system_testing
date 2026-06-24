pipeline {
    agent any

    environment {
        // Tên project dùng cho docker-compose
        COMPOSE_PROJECT_NAME = "mutrapro_${env.BRANCH_NAME == 'main' ? 'main' : 'dev'}"
        MYSQL_PORT = "${env.BRANCH_NAME == 'main' ? '3307' : '3308'}"
        NIFI_PORT = "${env.BRANCH_NAME == 'main' ? '9090' : '9091'}"
        NOTIFY_PORT = "${env.BRANCH_NAME == 'main' ? '3006' : '3008'}"
        API_PORT = "${env.BRANCH_NAME == 'main' ? '3007' : '3009'}"
        SONAR_PORT = "${env.BRANCH_NAME == 'main' ? '9000' : '9001'}"
        WEB_PORT = "${env.BRANCH_NAME == 'main' ? '80' : '3000'}"
        DB_PASSWORD = '123456'
        JWT_SECRET = '9f7c2d1e4a8b6c5d3e7f1a9b2c4d6e8f0a1b3c5d7e9f2a4b6c8d1e3f5a7b9c2d'
        CORS_ORIGIN = "${env.BRANCH_NAME == 'main' ? 'http://localhost' : 'http://localhost:3000'}"
        RABBITMQ_DEFAULT_USER = 'user'
        RABBITMQ_DEFAULT_PASS = 'password'
        NIFI_SENSITIVE_PROPS_KEY = 'change_me_for_demo'
        INTERNAL_SERVICE_TOKEN = 'change_me_internal_service_token'
    }

    stages {
        stage('Debug') {
            steps {
                checkout scm
                echo 'Code đã được kéo về máy chủ Jenkins thành công!'
            }
        }

        stage('Validate Docker Compose') {
            steps {
                sh 'docker compose config'
            }
        }

        stage('Stop Old System') {
            steps {
                sh '''
                    echo "=== Bước 1: Dừng containers qua compose ==="
                    docker compose down --remove-orphans || true

                    echo "=== Bước 2: Xóa SonarQube cũ nếu còn sót ==="
                    docker rm -f mutrapro_system_testing-sonarqube-1 || true

                    echo "=== Bước 3: Dọn container dừng/lỗi ==="
                    docker container prune -f || true

                    echo "=== Bước 4: Xóa cứng từng container theo tên ==="
                    docker rm -f mutrapro_dev-web-app-1 || true
                    docker rm -f mutrapro_dev-api-gateway-1 || true
                    docker rm -f mutrapro_dev-auth-service-1 || true
                    docker rm -f mutrapro_dev-order-service-1 || true
                    docker rm -f mutrapro_dev-task-service-1 || true
                    docker rm -f mutrapro_dev-studio-service-1 || true
                    docker rm -f mutrapro_dev-file-service-1 || true
                    docker rm -f mutrapro_dev-notification-service-1 || true
                    docker rm -f mutrapro_dev-analytics-service-1 || true
                    docker rm -f mutrapro_dev-mysql_db-1 || true
                    docker rm -f mutrapro_dev-rabbitmq-1 || true
                    docker rm -f mutrapro_dev-redis_cache-1 || true
                    docker rm -f mutrapro_dev-sonarqube-1 || true
                    docker rm -f mutrapro_dev-nifi-1 || true

                    echo "=== Xác nhận kết quả ==="
                    docker ps -a | grep mutrapro_dev || echo "✅ Không còn container nào"
                '''
                script {
                    sh 'docker volume rm mutrapro_dev_mysql_data || true'
                }
            }
        }

        stage('Build Images') {
            steps {
                sh 'docker compose build --no-cache'
            }
        }

        stage('Deploy') {
            steps {
                sh 'docker compose up -d'
            }
        }

        stage('Show Container Status') {
            steps {
                sh 'docker compose ps'
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    echo "Chờ services khởi động..."
                    sleep 30

                    echo "=== Kiểm tra API Gateway ==="
                    curl -f http://localhost:3009/api/health || exit 1
                    echo "✅ API Gateway OK"

                    echo "=== Danh sách containers đang chạy ==="
                    docker compose ps
                '''
            }
        }
    }

    post {
        failure {
            echo 'Pipeline thất bại. In log để debug...'
            sh '''
                docker compose ps || true
                docker compose logs --tail=200 auth-service || true
                docker compose logs --tail=200 api-gateway || true
                docker compose logs --tail=200 mysql_db || true
            '''
        }
        success {
            echo 'Build/Deploy thành công!'
        }
    }
}