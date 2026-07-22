pipeline {
    agent any

    stages {
        stage('Secret Scan') {
            steps {
                sh '''
                gitleaks detect
                '''
            }
        }
        stage('Static Analysis') {
            steps {
                sh '''
                semgrep scan
                '''
            }
        }
        stage('Deploy') {
            steps {
                sh '''
                ssh \
                    -i /var/jenkins_home/.ssh/id_ed25519 \
                    -o IdentitiesOnly=yes \
                    -o StrictHostKeyChecking=no \
                    root@31.220.85.232 << 'EOF'

                cd /home/projects/ai-document-reader

                git pull origin prod

                docker compose up -d --build

                docker image prune -f

                EOF
                '''
            }
        }
    }
}

