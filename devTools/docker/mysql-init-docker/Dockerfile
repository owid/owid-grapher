FROM mysql/mysql-server:latest

RUN microdnf -y update --nogpgcheck \
 && microdnf install -y \
    libpwquality \
    curl \
    rsync \
    unzip \
    gzip
