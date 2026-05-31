pipeline {
    agent any

    environment {
        // Tên project dùng cho docker-compose
        COMPOSE_PROJECT_NAME = 'mutrapro_system_testing'
        DB_PASSWORD = '123456'
        JWT_SECRET = '9f7c2d1e4a8b6c5d3e7f1a9b2c4d6e8f0a1b3c5d7e9f2a4b6c8d1e3f5a7b9c2d'
        CORS_ORIGIN = 'http://localhost:3000'
        RABBITMQ_DEFAULT_USER = 'user'
        RABBITMQ_DEFAULT_PASS = 'password'
        NIFI_SENSITIVE_PROPS_KEY = 'change_me_for_demo'
        INTERNAL_SERVICE_TOKEN = 'change_me_internal_service_token'
    }

    stages {
        stage('Checkout Code') {
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
                sh 'docker compose down --remove-orphans'
                sh 'docker volume rm mutrapro_system_testing_mysql_data || true'
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
                    echo "Waiting for services to become healthy..."
                    sleep 20
                    docker compose ps
                    curl -f http://localhost:3007/api/health
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
