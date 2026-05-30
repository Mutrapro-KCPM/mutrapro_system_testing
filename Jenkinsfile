pipeline {
    agent any

    environment {
        // Biến môi trường
        DOCKER_COMPOSE_CMD = 'docker compose' 
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Đang lấy code từ nhánh dev...'
                // LƯU Ý: Thay <URL_GITHUB_CUA_BAN> bằng link thực tế của repo (ví dụ: 'https://github.com/user/mutrapro_system_testing.git')
                // Nếu repo là private, thêm tham số credentialsId: 'your-credential-id'
                git branch: 'giabao', url: 'https://github.com/Mutrapro-KCPM/mutrapro_system_testing.git'
            }
        }

        stage('Build') {
            steps {
                echo 'Bắt đầu build project...'
                // Sử dụng docker-compose vì thấy có file docker-compose.yml trong project
                sh "${DOCKER_COMPOSE_CMD}up --build -d"
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
    }

    post {
        success {
            echo 'Build và Deploy thành công!'
        }
        failure {
            echo 'Pipeline thất bại. Hãy kiểm tra lại log.'
        }
    }
}