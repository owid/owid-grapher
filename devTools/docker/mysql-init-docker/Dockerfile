FROM mysql/mysql-server:latest

RUN microdnf -y update --exclude=mysql-shell \
 && microdnf install -y \
    libpwquality \
    curl \
    rsync \
    unzip \
    gzip
