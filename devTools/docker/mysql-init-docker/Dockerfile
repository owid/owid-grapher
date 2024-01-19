FROM mysql/mysql-server:latest

RUN rpm --import https://repo.mysql.com/RPM-GPG-KEY-mysql-2023 \
 && microdnf -y update \
 && microdnf install -y \
    libpwquality \
    curl \
    rsync \
    unzip \
    gzip
