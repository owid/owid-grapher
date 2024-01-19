FROM mysql/mysql-server:latest

RUN microdnf -y update \
 && microdnf install -y \
    libpwquality \
    curl \
    rsync \
    unzip \
    gzip
