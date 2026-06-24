FROM jenkins/jenkins:lts

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && . /etc/os-release \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        docker-ce-cli \
        docker-compose-plugin \
        docker-buildx-plugin \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt tự động các plugin cần thiết cho Job hiện tại
USER jenkins
RUN jenkins-plugin-cli --plugins "workflow-aggregator git github jira"

# Tắt màn hình Setup Wizard lúc mới cài đặt
ENV JAVA_OPTS="-Djenkins.install.runSetupWizard=false"

# Copy script tự động tạo tài khoản admin/admin
COPY security.groovy /usr/share/jenkins/ref/init.groovy.d/security.groovy

# Tạo sẵn Job CI/CD từ file config.xml
COPY config.xml /usr/share/jenkins/ref/jobs/mutrapro_system/config.xml
