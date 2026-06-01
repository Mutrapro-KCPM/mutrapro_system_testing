pipeline {
    agent any

    environment {
        // Tên project dùng cho docker-compose
<<<<<<< HEAD
        COMPOSE_PROJECT_NAME = 'mutrapro_system'
=======
        COMPOSE_PROJECT_NAME = 'mutrapro_system_testing'
        DB_PASSWORD = '123456'
        JWT_SECRET = '9f7c2d1e4a8b6c5d3e7f1a9b2c4d6e8f0a1b3c5d7e9f2a4b6c8d1e3f5a7b9c2d'
        CORS_ORIGIN = 'http://localhost:3000'
        RABBITMQ_DEFAULT_USER = 'user'
        RABBITMQ_DEFAULT_PASS = 'password'
        NIFI_SENSITIVE_PROPS_KEY = 'change_me_for_demo'
        INTERNAL_SERVICE_TOKEN = 'change_me_internal_service_token'
>>>>>>> c4cfc2ac4227e7048d90a2c81b6863ea433cd39f
    }

    stages {
        stage('Debug') {
            steps {
<<<<<<< HEAD
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
=======
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
                sh 'docker compose down --remove-orphans'
                sh 'docker volume rm mutrapro_system_testing_mysql_data || true'
            }
        }

        stage('Build Images') {
            steps {
                sh 'docker compose build --no-cache'
>>>>>>> c4cfc2ac4227e7048d90a2c81b6863ea433cd39f
            }
        }

        stage('Deploy') {
            steps {
<<<<<<< HEAD
                echo "Đang khởi động hệ thống Mutrapro..."
                // Chạy ngầm toàn bộ các dịch vụ
                sh 'docker-compose up -d'
=======
                sh 'docker compose up -d'
>>>>>>> c4cfc2ac4227e7048d90a2c81b6863ea433cd39f
            }
        }

        stage('Show Container Status') {
            steps {
<<<<<<< HEAD
                echo "Chờ các dịch vụ khởi động hoàn tất..."
                // Sleep một chút để đợi DB và các service sẵn sàng
                sleep time: 30, unit: 'SECONDS'
                
                // Kiểm tra trạng thái của các container
                sh 'docker-compose ps'
=======
                sh 'docker compose ps'
>>>>>>> c4cfc2ac4227e7048d90a2c81b6863ea433cd39f
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    echo "Waiting for services to become healthy..."
                    sleep 30
                    docker compose ps
                    docker compose exec -T api-gateway node -e "fetch('http://localhost:3007/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
                '''
            }
        }
    }

    post {
<<<<<<< HEAD
        success {
            echo '🎉 Build và Deploy thành công!'
        }
        failure {
            echo '❌ Pipeline thất bại. Hãy kiểm tra lại log.'
=======
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
>>>>>>> c4cfc2ac4227e7048d90a2c81b6863ea433cd39f
        }
    }
}