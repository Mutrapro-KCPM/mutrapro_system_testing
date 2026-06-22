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
                sh 'docker compose down --remove-orphans'
                script {
                    if (env.BRANCH_NAME != 'main') {
                        sh "docker volume rm ${COMPOSE_PROJECT_NAME}_mysql_data || true"
                    } else {
                        echo "Skipping database wipe for main branch to protect data."
                    }
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
                    echo "Waiting for services to become healthy..."
                    sleep 30
                    docker compose ps
                    docker compose exec -T api-gateway node -e "fetch('http://localhost:3007/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
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