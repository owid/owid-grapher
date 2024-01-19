FROM mysql/mysql-server:8.0

RUN microdnf -y update \
 && microdnf install -y \
    libpwquality \
    curl \
    rsync \
    unzip \
    gzip
