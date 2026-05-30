pipeline {
    agent any

    environment {
        // Biến môi trường
        DOCKER_COMPOSE_CMD = 'docker compose' 
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
                echo 'Bắt đầu build project...'
                // Sử dụng docker-compose vì thấy có file docker-compose.yml trong project
                sh "${DOCKER_COMPOSE_CMD} up --build -d"
            }
        }

        stage('Test') {
            steps {
                echo 'Chạy các unit test/API test...'
                // Bạn có thể tích hợp chạy test ở đây (ví dụ: npm test hoặc chạy Postman/Newman)
            }
        }

        stage('Deploy') {
            steps {
                echo 'Khởi động hệ thống (Deploy)...'
                // sh "${DOCKER_COMPOSE_CMD} up -d"
            }
        }

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